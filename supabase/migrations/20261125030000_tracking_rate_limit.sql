-- Limite de tentativas falhadas na consulta pública de rastreio (por cliente).
-- Só conta códigos inexistentes; consultas legítimas não são afectadas.
CREATE TABLE IF NOT EXISTS public.tracking_attempts (
  client_hash  text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  fails        integer NOT NULL DEFAULT 0
);
ALTER TABLE public.tracking_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracking_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_delivery(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  d record;
  v_name text;
  v_cps jsonb;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_hdr jsonb;
  v_ip text;
  v_key text;
  v_fails int;
  v_max constant int := 30;          -- falhas permitidas por janela
  v_window constant interval := interval '10 minutes';
BEGIN
  BEGIN
    v_hdr := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_hdr := NULL;
  END;
  -- cf-connecting-ip é definido pela borda; senão, a última entrada de x-forwarded-for
  v_ip := coalesce(
    nullif(btrim(v_hdr->>'cf-connecting-ip'), ''),
    nullif(btrim(regexp_replace(coalesce(v_hdr->>'x-forwarded-for', ''), '^.*,', '')), ''),
    'desconhecido');
  v_key := encode(extensions.digest(v_ip, 'sha256'), 'hex');

  SELECT fails INTO v_fails FROM public.tracking_attempts
   WHERE client_hash = v_key AND window_start > now() - v_window;
  IF coalesce(v_fails, 0) >= v_max THEN
    RETURN jsonb_build_object('found', false, 'rate_limited', true);
  END IF;

  SELECT * INTO d FROM public.deliveries WHERE tracking_code = v_code;
  IF NOT FOUND THEN
    INSERT INTO public.tracking_attempts (client_hash, window_start, fails)
    VALUES (v_key, now(), 1)
    ON CONFLICT (client_hash) DO UPDATE
      SET fails = CASE WHEN public.tracking_attempts.window_start > now() - v_window
                       THEN public.tracking_attempts.fails + 1 ELSE 1 END,
          window_start = CASE WHEN public.tracking_attempts.window_start > now() - v_window
                              THEN public.tracking_attempts.window_start ELSE now() END;
    -- limpeza oportunista de janelas antigas
    DELETE FROM public.tracking_attempts WHERE window_start < now() - interval '1 day';
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
$function$;
