-- Caixa de pedidos do admin: o admin precisa de VER as subscrições dos clientes
-- (antes só o próprio dono e o service_role as liam, por isso a lista aparecia vazia
-- e os pedidos pendentes nunca eram vistos nem aceites).

CREATE POLICY "Admin le subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Admin le transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_admin());

-- Rejeitar um pedido pendente (com motivo, que o cliente vê na notificação)
CREATE OR REPLACE FUNCTION public.admin_reject_subscription(p_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sub record;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores.');
  END IF;
  IF char_length(v_reason) < 5 OR char_length(v_reason) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indique o motivo (5 a 300 caracteres).');
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_sub.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado ou já tratado.');
  END IF;

  UPDATE public.subscriptions SET status = 'canceled', updated_at = now() WHERE id = p_id;

  INSERT INTO public.notifications (user_id, title, message, type, read)
  VALUES (v_sub.user_id, 'Pedido de plano não confirmado',
          'O seu pedido do plano ' || v_sub.plan_name || ' não foi confirmado: ' || v_reason
            || ' Pode fazer um novo pedido ou falar connosco pelo WhatsApp.',
          'warning', false);

  INSERT INTO public.activity_logs (user_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_sub.user_id, auth.uid(), 'subscription_rejected', 'subscription', p_id,
          jsonb_build_object('plan', v_sub.plan_id, 'reason', v_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_reject_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_subscription(uuid, text) TO authenticated;

-- Avisa os admins dos pedidos que já estavam pendentes (sem alerta)
INSERT INTO public.notifications (user_id, title, message, type, read)
SELECT a.user_id, '🧾 Pedido de plano por confirmar',
       'Pedido ' || coalesce(s.notes, s.id::text) || ' (' || s.plan_name || ') está a aguardar confirmação do pagamento.',
       'payment', false
FROM public.subscriptions s
CROSS JOIN public.profiles a
WHERE s.status = 'pending' AND a.role = 'admin';
