-- ============================================================================
-- Configurações reais: acessibilidade, preferências de entrega e notificações
-- que o servidor passa a respeitar.
-- ============================================================================

-- 1. Novas colunas em user_settings (apenas o que a app usa)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS accessibility           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_origin_address  text,
  ADD COLUMN IF NOT EXISTS default_item_type       text;

ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_prefs_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_prefs_check CHECK (
  pg_column_size(accessibility) < 1024
  AND char_length(coalesce(default_origin_address, '')) <= 200
  AND char_length(coalesce(default_item_type, '')) <= 80
) NOT VALID;

-- Defaults coerentes com Moçambique (antes: pt-BR / America/Sao_Paulo)
ALTER TABLE public.user_settings ALTER COLUMN language SET DEFAULT 'pt-MZ';
ALTER TABLE public.user_settings ALTER COLUMN timezone SET DEFAULT 'Africa/Maputo';

-- 2. Helper: o utilizador quer receber este tipo de aviso? (sem linha = sim)
CREATE OR REPLACE FUNCTION public.wants_notification(p_user uuid, p_kind text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE p_kind
      WHEN 'new_delivery'  THEN ns.new_delivery
      WHEN 'status_update' THEN ns.status_update
      WHEN 'payment_alert' THEN ns.payment_alert
      WHEN 'system_news'   THEN ns.system_news
      ELSE true END
    FROM public.notification_settings ns WHERE ns.user_id = p_user
  ), CASE p_kind WHEN 'system_news' THEN false ELSE true END);
$$;
REVOKE EXECUTE ON FUNCTION public.wants_notification(uuid, text) FROM PUBLIC, anon, authenticated;

-- 3. Nova entrega disponível: só para entregadores que a querem receber
CREATE OR REPLACE FUNCTION public.notify_new_delivery()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.current_status = 'created' AND NEW.deliverer_id IS NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
    SELECT p.user_id,
           '🚚 Nova entrega disponível',
           '"' || left(NEW.item_type, 60) || '" · ' || left(NEW.origin_address, 80) || ' · ' ||
             to_char(NEW.estimated_value, 'FM999G999G990') || ' MZN. Aceite já!',
           'delivery_status', false, NEW.id
    FROM public.profiles p
    WHERE p.role = 'deliverer' AND p.status = 'ativo'
      AND public.wants_notification(p.user_id, 'new_delivery');
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Eventos da entrega: respeita "atualizações das entregas"; cancelamentos e
--    problemas são sempre enviados (são críticos).
CREATE OR REPLACE FUNCTION public.notify_delivery_events()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deliverer_name text;
  v_item text;
BEGIN
  v_item := COALESCE(NEW.item_type, 'item');

  IF OLD.deliverer_id IS NULL AND NEW.deliverer_id IS NOT NULL THEN
    SELECT COALESCE(full_name, 'Um entregador') INTO v_deliverer_name
      FROM public.profiles WHERE user_id = NEW.deliverer_id;

    IF public.wants_notification(NEW.entrepreneur_id, 'status_update') THEN
      INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
      VALUES (NEW.entrepreneur_id, '🚚 Entrega aceite',
        COALESCE(v_deliverer_name, 'Um entregador') || ' aceitou a sua entrega "' || v_item || '" e está a caminho.',
        'delivery_status', false, NEW.id);
    END IF;
    IF public.wants_notification(NEW.deliverer_id, 'status_update') THEN
      INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
      VALUES (NEW.deliverer_id, '✅ Entrega aceite com sucesso',
        'Aceitaste a entrega "' || v_item || '". Dirige-te ao endereço de origem para recolher.',
        'delivery_status', false, NEW.id);
    END IF;
  END IF;

  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    IF NEW.current_status = 'in_progress' AND NEW.deliverer_id IS NOT NULL THEN
      IF public.wants_notification(NEW.entrepreneur_id, 'status_update') THEN
        INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
        VALUES (NEW.entrepreneur_id, '📦 Item recolhido',
          'O item "' || v_item || '" foi recolhido e está em rota para o destino.',
          'delivery_status', false, NEW.id);
      END IF;

    ELSIF NEW.current_status = 'completed' THEN
      IF public.wants_notification(NEW.entrepreneur_id, 'status_update') THEN
        INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
        VALUES (NEW.entrepreneur_id, '✅ Entrega concluída!',
          'A sua entrega "' || v_item || '" foi concluída com sucesso.',
          'success', false, NEW.id);
      END IF;
      IF NEW.deliverer_id IS NOT NULL AND public.wants_notification(NEW.deliverer_id, 'status_update') THEN
        INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
        VALUES (NEW.deliverer_id, '✅ Entrega confirmada!',
          'A entrega "' || v_item || '" foi registada como concluída.',
          'success', false, NEW.id);
      END IF;

    ELSIF NEW.current_status = 'cancelled' THEN
      INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
      VALUES (NEW.entrepreneur_id, '❌ Entrega cancelada',
        'A entrega "' || v_item || '" foi cancelada.', 'warning', false, NEW.id);
      IF NEW.deliverer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
        VALUES (NEW.deliverer_id, '❌ Entrega cancelada',
          'A entrega "' || v_item || '" que tinha aceite foi cancelada.', 'warning', false, NEW.id);
      END IF;

    ELSIF NEW.current_status = 'problem' THEN
      INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
      VALUES (NEW.entrepreneur_id, '⚠️ Problema na entrega',
        'Foi reportado um problema na entrega "' || v_item || '". Contacte o suporte.',
        'warning', false, NEW.id);
      INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
      SELECT p.user_id, '⚠️ Problema numa entrega',
        'Problema em "' || v_item || '" (#' || UPPER(LEFT(NEW.id::text, 8)) || ')',
        'warning', false, NEW.id
      FROM public.profiles p WHERE p.role = 'admin';

    ELSIF public.wants_notification(NEW.entrepreneur_id, 'status_update') THEN
      INSERT INTO public.notifications (user_id, title, message, type, read, delivery_id)
      VALUES (NEW.entrepreneur_id, 'Estado da entrega actualizado',
        'O estado da entrega "' || v_item || '" foi actualizado para ' || NEW.current_status || '.',
        'delivery_status', false, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Avisos de plano/pagamento (activação e fim do período de teste) respeitam a
--    preferência; falhas de pagamento ('payment_failed') são sempre entregues.
CREATE OR REPLACE FUNCTION public.notifications_respect_prefs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.type IN ('payment', 'trial_ending')
     AND NOT public.wants_notification(NEW.user_id, 'payment_alert') THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notifications_respect_prefs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifications_respect_prefs ON public.notifications;
CREATE TRIGGER trg_notifications_respect_prefs BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_respect_prefs();
