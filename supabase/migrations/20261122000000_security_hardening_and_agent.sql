-- ============================================================================
-- ZOMAR — Endurecimento de segurança, correcções de esquema e base do agente
-- ----------------------------------------------------------------------------
-- Este ficheiro foi escrito a partir do estado REAL da base de dados
-- (projecto gcqakslxtszbimxqlbxa), não da migração antiga do repositório, que
-- estava desactualizada. É idempotente: pode ser executado mais de uma vez.
--
-- O que faz:
--   1. Funções em falta que o cliente já chama (get/verify_delivery_code).
--   2. Máquina de estados da entrega coerente (created → accepted →
--      in_progress → completed) e blindagem de campos sensíveis.
--   3. Levantamentos com saldo verificado no servidor (request_withdrawal).
--   4. Políticas RLS: remove brechas (logs anónimos, auto-atribuição de plano,
--      levantamentos escritos pelo cliente, platform_settings inutilizável).
--   5. Tabelas/buckets que o cliente usa mas não existiam
--      (support_tickets, notification_settings, avatars, agent_messages).
-- ============================================================================


-- ─── 1. COLUNAS EM FALTA ─────────────────────────────────────────────────────

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS window_start   text,
  ADD COLUMN IF NOT EXISTS window_end     text,
  ADD COLUMN IF NOT EXISTS scheduled_at   timestamptz;

-- O perfil guarda a morada (a página de Perfil já a grava), mas a coluna não existia
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS phone_number  text,
  ADD COLUMN IF NOT EXISTS fee           numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount    numeric(12,2),
  ADD COLUMN IF NOT EXISTS error_message text;

-- O cliente usa m-pesa / e-mola / mkesh / bank_transfer (o 'pix' é legado brasileiro)
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_payment_method_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_payment_method_check
  CHECK (payment_method = ANY (ARRAY['m-pesa','e-mola','mkesh','bank_transfer','pix']));

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_current_status_check;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_current_status_check
  CHECK (current_status = ANY (ARRAY[
    'created','scheduled','accepted','in_progress','completed','cancelled','problem'
  ]));


-- ─── 2. PERFIS: nunca confiar no cliente para campos privilegiados ───────────
-- A versão anterior comparava request.jwt.claim.role, que desaparece em
-- versões recentes do PostgREST, e bloqueava até o SQL Editor e os admins.

CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  role_changed boolean;
BEGIN
  -- Só se aplica a pedidos vindos da API (papéis authenticated/anon) e que não
  -- sejam de um admin. SQL Editor, service_role e funções SECURITY DEFINER passam.
  IF current_user IN ('authenticated', 'anon') AND NOT COALESCE(public.is_admin(), false) THEN

    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS NOT NULL AND NEW.role NOT IN ('entrepreneur', 'deliverer') THEN
        RAISE EXCEPTION 'Papel inválido.' USING ERRCODE = '42501';
      END IF;
      NEW.status            := 'ativo';
      NEW.trust_score       := 5.0;
      NEW.phone_verified    := false;
      NEW.document_verified := false;
      NEW.suspension_reason := NULL;
      NEW.stripe_customer_id := NULL;
      RETURN NEW;
    END IF;

    role_changed := NEW.role IS DISTINCT FROM OLD.role
      AND NOT (OLD.role IS NULL AND NEW.role IN ('entrepreneur', 'deliverer'));

    IF role_changed
       OR NEW.status             IS DISTINCT FROM OLD.status
       OR NEW.trust_score        IS DISTINCT FROM OLD.trust_score
       OR NEW.document_verified  IS DISTINCT FROM OLD.document_verified
       OR NEW.document_type      IS DISTINCT FROM OLD.document_type
       OR NEW.document_number    IS DISTINCT FROM OLD.document_number
       OR NEW.document_url       IS DISTINCT FROM OLD.document_url
       OR NEW.suspension_reason  IS DISTINCT FROM OLD.suspension_reason
       OR NEW.phone_verified     IS DISTINCT FROM OLD.phone_verified
       OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
       OR NEW.email              IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Alteração de campos privilegiados do perfil não autorizada'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_insert ON public.profiles;
CREATE TRIGGER protect_profile_privileged_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_changes();


-- ─── 3. ENTREGAS: blindagem de campos e transições ───────────────────────────

CREATE OR REPLACE FUNCTION public.guard_delivery_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT COALESCE(public.is_admin(), false) THEN

    -- Código de confirmação e contadores só mudam pelas funções do servidor
    IF NEW.entrepreneur_id   IS DISTINCT FROM OLD.entrepreneur_id
       OR NEW.delivery_code      IS DISTINCT FROM OLD.delivery_code
       OR NEW.code_attempts      IS DISTINCT FROM OLD.code_attempts
       OR NEW.code_locked_until  IS DISTINCT FROM OLD.code_locked_until THEN
      RAISE EXCEPTION 'Campo protegido da entrega.' USING ERRCODE = '42501';
    END IF;

    -- O valor só pode ser editado pelo dono enquanto ninguém aceitou a entrega
    IF NEW.estimated_value IS DISTINCT FROM OLD.estimated_value
       AND (v_uid IS DISTINCT FROM OLD.entrepreneur_id OR OLD.deliverer_id IS NOT NULL) THEN
      RAISE EXCEPTION 'O valor da entrega não pode ser alterado.' USING ERRCODE = '42501';
    END IF;

    -- Quem não é o dono (ex.: entregador) não mexe no conteúdo do pedido
    IF v_uid IS DISTINCT FROM OLD.entrepreneur_id
       AND (NEW.item_type           IS DISTINCT FROM OLD.item_type
         OR NEW.origin_address      IS DISTINCT FROM OLD.origin_address
         OR NEW.destination_address IS DISTINCT FROM OLD.destination_address
         OR NEW.notes               IS DISTINCT FROM OLD.notes) THEN
      RAISE EXCEPTION 'Só o dono pode alterar os dados do pedido.' USING ERRCODE = '42501';
    END IF;

    -- Estados finais não voltam atrás
    IF OLD.current_status IN ('completed', 'cancelled')
       AND NEW.current_status IS DISTINCT FROM OLD.current_status THEN
      RAISE EXCEPTION 'Esta entrega já está encerrada.' USING ERRCODE = '42501';
    END IF;

    -- Concluir só com o código (verify_delivery_code corre como dono da função)
    IF NEW.current_status IS DISTINCT FROM OLD.current_status
       AND NEW.current_status = 'completed' THEN
      RAISE EXCEPTION 'A entrega só pode ser concluída com o código de confirmação.'
        USING ERRCODE = '42501';
    END IF;

    -- Atribuição de entregador: só "ninguém → eu", só um entregador, só se estava disponível
    IF NEW.deliverer_id IS DISTINCT FROM OLD.deliverer_id THEN
      IF NOT (OLD.deliverer_id IS NULL AND NEW.deliverer_id = v_uid) THEN
        RAISE EXCEPTION 'Atribuição de entregador inválida.' USING ERRCODE = '42501';
      END IF;
      IF OLD.current_status NOT IN ('created', 'scheduled') THEN
        RAISE EXCEPTION 'Esta entrega já não está disponível.' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid AND p.role = 'deliverer') THEN
        RAISE EXCEPTION 'Só entregadores podem aceitar entregas.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_delivery_changes ON public.deliveries;
CREATE TRIGGER trg_guard_delivery_changes
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_changes();

-- Políticas coerentes com o fluxo real do app:
--   disponível = sem entregador e em 'created'/'scheduled'  (antes: 'accepted')
DROP POLICY IF EXISTS deliveries_select ON public.deliveries;
DROP POLICY IF EXISTS deliveries_update ON public.deliveries;
DROP POLICY IF EXISTS deliveries_insert ON public.deliveries;
DROP POLICY IF EXISTS deliveries_delete ON public.deliveries;

CREATE POLICY deliveries_select ON public.deliveries FOR SELECT TO authenticated
  USING (
    entrepreneur_id = (SELECT auth.uid())
    OR deliverer_id = (SELECT auth.uid())
    OR (deliverer_id IS NULL AND current_status IN ('created', 'scheduled')
        AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.user_id = (SELECT auth.uid()) AND p.role = 'deliverer'))
    OR public.is_admin()
  );

CREATE POLICY deliveries_insert ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (
    entrepreneur_id = (SELECT auth.uid())
    AND deliverer_id IS NULL
    AND current_status IN ('created', 'scheduled')
  );

CREATE POLICY deliveries_update ON public.deliveries FOR UPDATE TO authenticated
  USING (
    entrepreneur_id = (SELECT auth.uid())
    OR deliverer_id = (SELECT auth.uid())
    OR (deliverer_id IS NULL AND current_status IN ('created', 'scheduled')
        AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.user_id = (SELECT auth.uid()) AND p.role = 'deliverer'))
    OR public.is_admin()
  )
  WITH CHECK (
    entrepreneur_id = (SELECT auth.uid())
    OR deliverer_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY deliveries_delete ON public.deliveries FOR DELETE TO authenticated
  USING (public.is_admin());


-- ─── 4. CÓDIGO DE CONFIRMAÇÃO (funções que o cliente já chama) ───────────────

CREATE OR REPLACE FUNCTION public.get_delivery_code(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;

  SELECT id, entrepreneur_id, delivery_code, current_status
    INTO d FROM public.deliveries WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não encontrada.');
  END IF;

  IF d.entrepreneur_id <> auth.uid() AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão.');
  END IF;

  IF d.current_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega cancelada.');
  END IF;

  RETURN jsonb_build_object('success', true, 'code', d.delivery_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_delivery_code(
  p_delivery_id  uuid,
  p_code         text,
  p_deliverer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d            record;
  v_code       text := upper(btrim(coalesce(p_code, '')));
  v_max        constant int := 5;
  v_lock_min   constant int := 15;
  v_attempts   int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;
  IF p_deliverer_id IS NOT NULL AND p_deliverer_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão.');
  END IF;

  SELECT * INTO d FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não encontrada.');
  END IF;
  IF d.deliverer_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta entrega não lhe está atribuída.');
  END IF;
  IF d.current_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta entrega já foi concluída.');
  END IF;
  IF d.current_status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Confirme primeiro a recolha do item.');
  END IF;
  IF d.code_locked_until IS NOT NULL AND d.code_locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Demasiadas tentativas. Tente novamente em %s min.',
                      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (d.code_locked_until - now())) / 60)::int))
    );
  END IF;

  IF v_code <> '' AND v_code = upper(coalesce(d.delivery_code, '')) THEN
    UPDATE public.deliveries
       SET current_status    = 'completed',
           completed_at      = now(),
           delivered_at      = now(),
           code_attempts     = 0,
           code_locked_until = NULL,
           updated_at        = now()
     WHERE id = d.id;
    RETURN jsonb_build_object('success', true);
  END IF;

  v_attempts := COALESCE(d.code_attempts, 0) + 1;
  IF v_attempts >= v_max THEN
    UPDATE public.deliveries
       SET code_attempts = 0,
           code_locked_until = now() + make_interval(mins => v_lock_min)
     WHERE id = d.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Código incorrecto. Verificação bloqueada por %s min.', v_lock_min)
    );
  END IF;

  UPDATE public.deliveries SET code_attempts = v_attempts WHERE id = d.id;
  RETURN jsonb_build_object(
    'success', false,
    'error', format('Código incorrecto. Restam %s tentativa(s).', v_max - v_attempts)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_delivery_code(uuid)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_delivery_code(uuid, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_delivery_code(uuid)              TO authenticated;
GRANT  EXECUTE ON FUNCTION public.verify_delivery_code(uuid, text, uuid) TO authenticated;


-- ─── 5. LEVANTAMENTOS: saldo verificado no servidor ──────────────────────────
-- Antes: o cliente inseria livremente em `withdrawals` (qualquer valor, qualquer
-- estado) e a função `withdraw` nem estava publicada. Agora só esta RPC cria
-- pedidos, sempre 'pending', e só até ao saldo realmente ganho.

CREATE OR REPLACE FUNCTION public.deliverer_available_balance()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT GREATEST(
    COALESCE((SELECT SUM(round(estimated_value * 0.8, 2))
                FROM public.deliveries
               WHERE deliverer_id = auth.uid() AND current_status = 'completed'), 0)
    -
    COALESCE((SELECT SUM(amount)
                FROM public.withdrawals
               WHERE user_id = auth.uid() AND status IN ('pending', 'approved', 'completed')), 0),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_method text,
  p_phone  text DEFAULT NULL,
  p_bank   jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fee     constant numeric := 10;
  v_min     constant numeric := 50;
  v_balance numeric;
  v_phone   text;
  v_id      uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND role = 'deliverer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas entregadores podem levantar saldo.');
  END IF;
  IF p_method NOT IN ('m-pesa', 'e-mola', 'mkesh', 'bank_transfer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Método inválido.');
  END IF;
  IF p_amount IS NULL OR p_amount < v_min THEN
    RETURN jsonb_build_object('success', false, 'error', format('Valor mínimo: %s MZN.', v_min));
  END IF;

  IF p_method = 'bank_transfer' THEN
    IF p_bank IS NULL
       OR coalesce(p_bank->>'nib', '') !~ '^[0-9]{21}$'
       OR btrim(coalesce(p_bank->>'bankName', '')) = ''
       OR btrim(coalesce(p_bank->>'accountHolder', '')) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Dados bancários inválidos (NIB com 21 dígitos, banco e titular).');
    END IF;
  ELSE
    v_phone := regexp_replace(coalesce(p_phone, ''), '\s', '', 'g');
    IF v_phone !~ '^\+258[0-9]{8,9}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Número inválido. Use o formato +258XXXXXXXXX.');
    END IF;
  END IF;

  -- Serializa pedidos do mesmo utilizador (evita duas retiradas em paralelo)
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  v_balance := public.deliverer_available_balance();
  IF p_amount > v_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente.', 'available', v_balance);
  END IF;

  INSERT INTO public.withdrawals
    (user_id, amount, fee, net_amount, status, payment_method, phone_number, bank_data, requested_at)
  VALUES
    (v_uid, p_amount, v_fee, p_amount - v_fee, 'pending', p_method,
     CASE WHEN p_method = 'bank_transfer' THEN NULL ELSE v_phone END,
     CASE WHEN p_method = 'bank_transfer' THEN p_bank::text ELSE NULL END,
     now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'net_amount', p_amount - v_fee);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deliverer_available_balance()                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, jsonb)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deliverer_available_balance()                    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, jsonb)  TO authenticated;

DROP POLICY IF EXISTS "Users can insert own withdrawals"          ON public.withdrawals;
DROP POLICY IF EXISTS "Users can update own pending withdrawals"  ON public.withdrawals;
DROP POLICY IF EXISTS "Users can delete own pending withdrawals"  ON public.withdrawals;
DROP POLICY IF EXISTS "Users can view own withdrawals"            ON public.withdrawals;
DROP POLICY IF EXISTS withdrawals_select ON public.withdrawals;
DROP POLICY IF EXISTS withdrawals_admin_update ON public.withdrawals;

CREATE POLICY withdrawals_select ON public.withdrawals FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY withdrawals_admin_update ON public.withdrawals FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ─── 6. RLS: brechas e políticas partidas ────────────────────────────────────

-- is_admin() não deve ser chamável por anónimos
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Políticas que chamam is_admin() passam a ser só para autenticados
ALTER POLICY admins_can_see_all_profiles ON public.profiles TO authenticated;
ALTER POLICY notifications_select        ON public.notifications TO authenticated;
ALTER POLICY notifications_delete        ON public.notifications TO authenticated;
ALTER POLICY notifications_update        ON public.notifications TO authenticated;
ALTER POLICY payments_select_own         ON public.payment_transactions TO authenticated;

-- activity_logs: qualquer pessoa (inclusive anónima) podia escrever logs
DROP POLICY IF EXISTS service_insert_activity_logs ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_insert_own     ON public.activity_logs;
CREATE POLICY activity_logs_insert_own ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = (SELECT auth.uid()) OR user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS admin_read_activity_logs ON public.activity_logs;
CREATE POLICY admin_read_activity_logs ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- platform_settings: a política comparava auth.jwt()->>'role' com 'admin'
-- (o papel do JWT é 'authenticated'), por isso nem o admin conseguia usar.
DROP POLICY IF EXISTS "Admins only" ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_read  ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_admin ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY platform_settings_admin ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_subscriptions (legado): o utilizador podia inserir/atualizar a própria
-- assinatura, ou seja, dar-se um plano pago. Escrita só pelo servidor.
DROP POLICY IF EXISTS "Usuários inserem suas assinaturas"  ON public.user_subscriptions;
DROP POLICY IF EXISTS "Usuários atualizam suas assinaturas" ON public.user_subscriptions;

-- Incidentes: só existia SELECT, por isso ninguém conseguia reportar um problema
DROP POLICY IF EXISTS incidents_insert_participant ON public.incidents;
DROP POLICY IF EXISTS incidents_admin_all          ON public.incidents;
CREATE POLICY incidents_insert_participant ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.deliveries d
                WHERE d.id = delivery_id
                  AND (d.entrepreneur_id = (SELECT auth.uid()) OR d.deliverer_id = (SELECT auth.uid())))
  );
CREATE POLICY incidents_admin_all ON public.incidents FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Funções com search_path mutável (aviso do linter). Mantém `public` porque
-- algumas fazem INSERT sem qualificar o esquema.
ALTER FUNCTION public.update_updated_at_column()   SET search_path = public, pg_temp;
ALTER FUNCTION public.update_payment_timestamp()   SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_delivery_code()     SET search_path = public, pg_temp;
ALTER FUNCTION public.log_delivery_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_profile_change()         SET search_path = public, pg_temp;
ALTER FUNCTION public.promote_to_admin(text)       SET search_path = public, pg_temp;

-- Código de entrega a partir de uuid aleatório criptográfico (random() não serve)
CREATE OR REPLACE FUNCTION public.generate_delivery_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.delivery_code IS NULL THEN
    NEW.delivery_code := lpad(
      (abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text,
      6, '0');
  END IF;
  RETURN NEW;
END;
$$;


-- ─── 7. TABELAS QUE O CLIENTE USA MAS NÃO EXISTIAM ───────────────────────────

-- 7.1 Pedidos de suporte (HelpPage)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text,
  subject     text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 140),
  message     text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 4000),
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  category    text NOT NULL DEFAULT 'general',
  status      text NOT NULL DEFAULT 'open'   CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_insert_own ON public.support_tickets;
DROP POLICY IF EXISTS tickets_select_own ON public.support_tickets;
DROP POLICY IF EXISTS tickets_admin_all  ON public.support_tickets;
CREATE POLICY tickets_insert_own ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'open');
CREATE POLICY tickets_select_own ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY tickets_admin_all ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);

-- 7.2 Preferências de notificação (Perfil)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_delivery   boolean NOT NULL DEFAULT true,
  status_update  boolean NOT NULL DEFAULT true,
  payment_alert  boolean NOT NULL DEFAULT true,
  system_news    boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_settings_own ON public.notification_settings;
CREATE POLICY notif_settings_own ON public.notification_settings FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- 7.3 Bucket de avatares (não existia: o upload falhava e o app mostrava só um
--     pré-visualização local que desaparecia ao recarregar)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
DROP POLICY IF EXISTS avatars_select_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY avatars_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- 7.4 Conversas do agente (botão flutuante)
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_messages_select_own ON public.agent_messages;
DROP POLICY IF EXISTS agent_messages_insert_own ON public.agent_messages;
DROP POLICY IF EXISTS agent_messages_delete_own ON public.agent_messages;
CREATE POLICY agent_messages_select_own ON public.agent_messages FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY agent_messages_insert_own ON public.agent_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY agent_messages_delete_own ON public.agent_messages FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS agent_messages_user_idx ON public.agent_messages (user_id, created_at DESC);

-- 7.5 Índices úteis às consultas mais frequentes
CREATE INDEX IF NOT EXISTS deliveries_entrepreneur_idx ON public.deliveries (entrepreneur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deliveries_deliverer_idx    ON public.deliveries (deliverer_id, current_status);
CREATE INDEX IF NOT EXISTS deliveries_available_idx    ON public.deliveries (created_at DESC)
  WHERE deliverer_id IS NULL AND current_status IN ('created', 'scheduled');
CREATE INDEX IF NOT EXISTS notifications_user_idx      ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_user_idx        ON public.withdrawals (user_id, requested_at DESC);

-- 7.6 Admin pode enviar notificações (difusão e avisos de levantamento)
DROP POLICY IF EXISTS notifications_admin_insert ON public.notifications;
CREATE POLICY notifications_admin_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 7.7 Avisar os entregadores activos quando surge uma entrega nova (o cliente não
--     pode escrever notificações para outros utilizadores, por isso fica no servidor)
CREATE OR REPLACE FUNCTION public.notify_new_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHERE p.role = 'deliverer' AND p.status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_new_delivery() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_new_delivery ON public.deliveries;
CREATE TRIGGER trg_notify_new_delivery AFTER INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_delivery();
