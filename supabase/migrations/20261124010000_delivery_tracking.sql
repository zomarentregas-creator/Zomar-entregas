-- Rastreio de entregas
-- 1) Código de rastreio público (diferente do código de confirmação, que é secreto)
-- 2) Checkpoints criados só pelo servidor (fonte única, sem duplicados nem falsificação)
-- 3) Função pública track_delivery(código) com dados mínimos para o destinatário

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS tracking_code text;

UPDATE public.deliveries
   SET tracking_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
 WHERE tracking_code IS NULL;

ALTER TABLE public.deliveries
  ALTER COLUMN tracking_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  ALTER COLUMN tracking_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS deliveries_tracking_code_key ON public.deliveries (tracking_code);

-- O código de rastreio não pode ser alterado pelos utilizadores
CREATE OR REPLACE FUNCTION public.protect_tracking_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.tracking_code IS DISTINCT FROM OLD.tracking_code THEN
    NEW.tracking_code := OLD.tracking_code;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_tracking_code ON public.deliveries;
CREATE TRIGGER trg_protect_tracking_code BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.protect_tracking_code();

-- Checkpoints automáticos
CREATE OR REPLACE FUNCTION public.log_delivery_checkpoint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_accepted_logged boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_checkpoints (delivery_id, status, description)
    VALUES (NEW.id, NEW.current_status,
      CASE WHEN NEW.current_status = 'scheduled' AND NEW.scheduled_date IS NOT NULL
           THEN 'Entrega agendada para ' || to_char(NEW.scheduled_date, 'DD/MM/YYYY')
                || coalesce(' entre ' || NEW.window_start || ' e ' || NEW.window_end, '')
           ELSE 'Pedido criado e disponível para entregadores' END);
    RETURN NEW;
  END IF;

  IF OLD.deliverer_id IS NULL AND NEW.deliverer_id IS NOT NULL THEN
    INSERT INTO public.delivery_checkpoints (delivery_id, status, description)
    VALUES (NEW.id, 'accepted', 'Um entregador aceitou o pedido');
    v_accepted_logged := true;
  END IF;

  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    IF NEW.current_status = 'accepted' AND v_accepted_logged THEN
      NULL;
    ELSE
      INSERT INTO public.delivery_checkpoints (delivery_id, status, description)
      VALUES (NEW.id, NEW.current_status,
        CASE NEW.current_status
          WHEN 'accepted'    THEN 'Um entregador aceitou o pedido'
          WHEN 'in_progress' THEN 'Item recolhido pelo entregador — a caminho'
          WHEN 'completed'   THEN 'Entrega concluída — código verificado'
          WHEN 'cancelled'   THEN 'Entrega cancelada'
          WHEN 'problem'     THEN 'Problema reportado na entrega'
          WHEN 'created'     THEN 'Pedido voltou a ficar disponível'
          ELSE 'Estado actualizado: ' || NEW.current_status END);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_delivery_checkpoint ON public.deliveries;
CREATE TRIGGER trg_log_delivery_checkpoint AFTER INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.log_delivery_checkpoint();

-- Só o servidor escreve checkpoints (fecha a escrita directa pelo cliente)
DROP POLICY IF EXISTS "Delivery participants can insert checkpoints" ON public.delivery_checkpoints;

-- Consulta pública por código de rastreio: sem moradas completas, contactos, valores nem código de confirmação
CREATE OR REPLACE FUNCTION public.track_delivery(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  d record;
  v_name text;
  v_cps jsonb;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE tracking_code = upper(btrim(coalesce(p_code, '')));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF d.deliverer_id IS NOT NULL THEN
    SELECT split_part(btrim(full_name), ' ', 1) INTO v_name FROM public.profiles WHERE user_id = d.deliverer_id;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('status', c.status, 'description', c.description, 'at', c.created_at)
                            ORDER BY c.created_at), '[]'::jsonb)
    INTO v_cps FROM public.delivery_checkpoints c WHERE c.delivery_id = d.id;

  RETURN jsonb_build_object(
    'found', true,
    'status', d.current_status,
    'item_type', d.item_type,
    'origin_area', btrim(regexp_replace(d.origin_address, '^.*,', '')),
    'destination_area', btrim(regexp_replace(d.destination_address, '^.*,', '')),
    'created_at', d.created_at,
    'picked_up_at', d.picked_up_at,
    'delivered_at', coalesce(d.delivered_at, d.completed_at),
    'scheduled_at', d.scheduled_at,
    'deliverer_first_name', nullif(v_name, ''),
    'checkpoints', v_cps);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.track_delivery(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_delivery(text) TO anon, authenticated;
