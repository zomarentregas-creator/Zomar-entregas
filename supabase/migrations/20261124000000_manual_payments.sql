-- Pagamentos manuais (sem Stripe): o cliente paga por carteira móvel/transferência,
-- envia o comprovativo por WhatsApp e o administrador activa o plano no painel.
-- Toda a escrita passa por funções SECURITY DEFINER (a tabela `subscriptions`
-- só aceita escrita do service_role).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- 1) Cliente pede um plano (preço e limites vêm sempre do servidor)
CREATE OR REPLACE FUNCTION public.request_subscription(p_plan_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_slug text := regexp_replace(coalesce(p_plan_id, ''), '^plan_', '');
  v_plan record;
  v_ref  text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND role = 'entrepreneur') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas empresários podem subscrever planos.');
  END IF;

  SELECT id, name, price, max_deliveries INTO v_plan
    FROM public.plans WHERE id = 'plan_' || v_slug AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plano inválido.');
  END IF;

  -- Um único pedido pendente de cada vez
  UPDATE public.subscriptions SET status = 'canceled', updated_at = now()
    WHERE user_id = v_uid AND status = 'pending';

  v_ref := 'ZOMAR-' || upper(v_slug) || '-' || upper(left(replace(v_uid::text, '-', ''), 4))
           || '-' || upper(left(md5(random()::text || clock_timestamp()::text), 4));

  INSERT INTO public.subscriptions
    (user_id, plan_id, plan_name, price, status, max_deliveries, current_usage,
     payment_method, start_date, renewal_date, notes)
  VALUES
    (v_uid, v_slug, v_plan.name, v_plan.price, 'pending', v_plan.max_deliveries, 0,
     'mobile_money', now(), NULL, v_ref);

  INSERT INTO public.notifications (user_id, title, message, type, read)
  SELECT p.user_id, '🧾 Novo pedido de plano',
         'Pedido ' || v_ref || ' (' || v_plan.name || '). Confirme o comprovativo recebido por WhatsApp e active o plano.',
         'payment', false
  FROM public.profiles p WHERE p.role = 'admin';

  INSERT INTO public.activity_logs (user_id, actor_id, action, entity_type, metadata)
  VALUES (v_uid, v_uid, 'subscription_requested', 'subscription',
          jsonb_build_object('plan', v_slug, 'price', v_plan.price, 'ref', v_ref));

  RETURN jsonb_build_object('success', true, 'ref', v_ref, 'plan_name', v_plan.name, 'price', v_plan.price);
END;
$$;

-- 2) Cliente desiste de um pedido ainda pendente
CREATE OR REPLACE FUNCTION public.cancel_pending_subscription()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;
  UPDATE public.subscriptions SET status = 'canceled', updated_at = now()
    WHERE user_id = auth.uid() AND status = 'pending';
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3) Admin confirma o pagamento e activa/renova o plano
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_subscription_id uuid, p_months int DEFAULT 1, p_amount numeric DEFAULT NULL, p_reference text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub  record;
  v_now  timestamptz := now();
  v_end  timestamptz;
  v_ref  text := nullif(btrim(coalesce(p_reference, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores.');
  END IF;
  IF p_months IS NULL OR p_months < 1 OR p_months > 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duração inválida (1 a 12 meses).');
  END IF;
  IF p_amount IS NOT NULL AND (p_amount < 0 OR p_amount > 1000000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido.');
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscrição não encontrada.');
  END IF;

  v_end := v_now + make_interval(months => p_months);

  -- Evita duas subscrições activas para o mesmo utilizador
  UPDATE public.subscriptions SET status = 'canceled', updated_at = v_now
    WHERE user_id = v_sub.user_id AND id <> v_sub.id AND status IN ('active', 'trialing', 'pending');

  UPDATE public.subscriptions SET
    status = 'active', start_date = v_now, end_date = v_end,
    renewal_date = v_end - interval '3 days', current_usage = 0,
    activated_by = auth.uid(), activated_at = v_now, updated_at = v_now
  WHERE id = v_sub.id;

  INSERT INTO public.transactions
    (user_id, subscription_id, amount, currency, status, payment_method, transaction_date, description)
  VALUES
    (v_sub.user_id, v_sub.id, coalesce(p_amount, v_sub.price * p_months), 'MZN', 'completed', 'mobile_money', v_now,
     'Pagamento manual confirmado — ' || v_sub.plan_name || ' (' || p_months || ' mês/meses)'
       || coalesce(' · Ref. ' || v_ref, ''));

  INSERT INTO public.notifications (user_id, title, message, type, read)
  VALUES (v_sub.user_id, '✅ Plano activado!',
          'O plano ' || v_sub.plan_name || ' está activo até ' || to_char(v_end, 'DD/MM/YYYY') || '. Já pode criar entregas.',
          'payment', false);

  INSERT INTO public.activity_logs (user_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_sub.user_id, auth.uid(), 'subscription_activated', 'subscription', v_sub.id,
          jsonb_build_object('plan', v_sub.plan_id, 'months', p_months, 'amount', coalesce(p_amount, v_sub.price * p_months), 'reference', v_ref));

  RETURN jsonb_build_object('success', true, 'end_date', v_end);
END;
$$;

-- 4) Admin edita campos permitidos de uma subscrição
CREATE OR REPLACE FUNCTION public.admin_update_subscription(p_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores.');
  END IF;
  IF p_patch ? 'status' THEN
    v_status := CASE p_patch->>'status' WHEN 'cancelled' THEN 'canceled' ELSE p_patch->>'status' END;
    IF v_status NOT IN ('active', 'trialing', 'past_due', 'canceled', 'expired', 'pending') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estado inválido.');
    END IF;
  END IF;

  UPDATE public.subscriptions SET
    status         = CASE WHEN p_patch ? 'status'         THEN v_status ELSE status END,
    plan_name      = CASE WHEN p_patch ? 'plan_name'      THEN left(p_patch->>'plan_name', 80) ELSE plan_name END,
    price          = CASE WHEN p_patch ? 'price'          THEN (p_patch->>'price')::numeric ELSE price END,
    max_deliveries = CASE WHEN p_patch ? 'max_deliveries' THEN (p_patch->>'max_deliveries')::int ELSE max_deliveries END,
    current_usage  = CASE WHEN p_patch ? 'current_usage'  THEN (p_patch->>'current_usage')::int ELSE current_usage END,
    end_date       = CASE WHEN p_patch ? 'end_date'       THEN (p_patch->>'end_date')::timestamptz ELSE end_date END,
    renewal_date   = CASE WHEN p_patch ? 'renewal_date'   THEN (p_patch->>'renewal_date')::timestamptz ELSE renewal_date END,
    updated_at     = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscrição não encontrada.');
  END IF;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'subscription_updated', 'subscription', p_id, p_patch);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5) Quota: um plano com data de fim já ultrapassada deixa de permitir novas entregas
CREATE OR REPLACE FUNCTION public.enforce_delivery_subscription_quota()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_subscription_id uuid;
  v_max_deliveries integer;
  v_current_usage integer;
BEGIN
  SELECT id, max_deliveries, current_usage
    INTO v_subscription_id, v_max_deliveries, v_current_usage
    FROM public.subscriptions
    WHERE user_id = NEW.entrepreneur_id
      AND status IN ('active', 'trialing')
      AND (end_date IS NULL OR end_date > now())
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Não existe uma assinatura activa para criar entregas.'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_current_usage, 0) >= v_max_deliveries THEN
    RAISE EXCEPTION 'O limite de entregas do seu plano foi atingido.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.subscriptions
    SET current_usage = COALESCE(current_usage, 0) + 1, updated_at = now()
    WHERE id = v_subscription_id;

  RETURN NEW;
END;
$$;

-- Funções chamáveis só por utilizadores autenticados
REVOKE EXECUTE ON FUNCTION public.request_subscription(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_pending_subscription() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_activate_subscription(uuid, int, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_subscription(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_subscription(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_subscription(uuid, int, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription(uuid, jsonb) TO authenticated;
