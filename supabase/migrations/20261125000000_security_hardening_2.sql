-- ============================================================================
-- Endurecimento de segurança (2.ª ronda)
--
--  1. Código de confirmação da entrega passa para uma tabela privada
--     (delivery_secrets). Antes estava em `deliveries`: o entregador atribuído
--     conseguia lê-lo por SELECT e pelo Realtime, anulando a prova de entrega.
--  2. Fecha leituras públicas (delivery_persons: matrícula, verificação…).
--  3. Retira a escrita directa em activity_logs (registo de auditoria forjável).
--  4. Retira privilégios desnecessários ao papel `anon` e aos papéis de API.
--  5. Funções de trigger deixam de ser invocáveis pela API.
--  6. Dados bancários dos levantamentos cifrados (pgcrypto + chave no Vault),
--     com leitura só para admin e registo de auditoria.
--
-- Ordem de aplicação: fundir primeiro o frontend (NewDelivery já não lê
-- delivery_code) e só depois aplicar esta migração.
-- ============================================================================

-- ─── 1. Segredos da entrega ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_secrets (
  delivery_id       uuid PRIMARY KEY REFERENCES public.deliveries(id) ON DELETE CASCADE,
  delivery_code     text NOT NULL,
  code_attempts     integer NOT NULL DEFAULT 0,
  code_locked_until timestamptz
);
ALTER TABLE public.delivery_secrets ENABLE ROW LEVEL SECURITY;
-- Sem políticas e sem privilégios: só funções SECURITY DEFINER lhe tocam.
REVOKE ALL ON public.delivery_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO public.delivery_secrets (delivery_id, delivery_code, code_attempts, code_locked_until)
SELECT id, delivery_code, COALESCE(code_attempts, 0), code_locked_until
  FROM public.deliveries
 WHERE delivery_code IS NOT NULL
ON CONFLICT (delivery_id) DO NOTHING;

-- Código de 6 dígitos a partir de aleatoriedade criptográfica (48 bits → viés desprezável)
CREATE OR REPLACE FUNCTION public.new_delivery_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT lpad(
    ((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint) % 1000000)::text,
    6, '0');
$$;
REVOKE ALL ON FUNCTION public.new_delivery_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_delivery_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.delivery_secrets (delivery_id, delivery_code)
  VALUES (NEW.id, public.new_delivery_code())
  ON CONFLICT (delivery_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_delivery_secret() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_delivery_code ON public.deliveries;
DROP TRIGGER IF EXISTS trg_create_delivery_secret ON public.deliveries;
CREATE TRIGGER trg_create_delivery_secret
  AFTER INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.create_delivery_secret();

-- guard: sem referências às colunas que vão deixar de existir
CREATE OR REPLACE FUNCTION public.guard_delivery_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT COALESCE(public.is_admin(), false) THEN

    IF NEW.entrepreneur_id IS DISTINCT FROM OLD.entrepreneur_id THEN
      RAISE EXCEPTION 'Campo protegido da entrega.' USING ERRCODE = '42501';
    END IF;

    IF NEW.estimated_value IS DISTINCT FROM OLD.estimated_value
       AND (v_uid IS DISTINCT FROM OLD.entrepreneur_id OR OLD.deliverer_id IS NOT NULL) THEN
      RAISE EXCEPTION 'O valor da entrega não pode ser alterado.' USING ERRCODE = '42501';
    END IF;

    IF v_uid IS DISTINCT FROM OLD.entrepreneur_id
       AND (NEW.item_type           IS DISTINCT FROM OLD.item_type
         OR NEW.origin_address      IS DISTINCT FROM OLD.origin_address
         OR NEW.destination_address IS DISTINCT FROM OLD.destination_address
         OR NEW.notes               IS DISTINCT FROM OLD.notes) THEN
      RAISE EXCEPTION 'Só o dono pode alterar os dados do pedido.' USING ERRCODE = '42501';
    END IF;

    IF OLD.current_status IN ('completed', 'cancelled')
       AND NEW.current_status IS DISTINCT FROM OLD.current_status THEN
      RAISE EXCEPTION 'Esta entrega já está encerrada.' USING ERRCODE = '42501';
    END IF;

    IF NEW.current_status IS DISTINCT FROM OLD.current_status
       AND NEW.current_status = 'completed' THEN
      RAISE EXCEPTION 'A entrega só pode ser concluída com o código de confirmação.'
        USING ERRCODE = '42501';
    END IF;

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

CREATE OR REPLACE FUNCTION public.verify_delivery_code(
  p_delivery_id uuid, p_code text, p_deliverer_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d            record;
  s            record;
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

  SELECT * INTO s FROM public.delivery_secrets WHERE delivery_id = d.id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta entrega não tem código. Contacte o suporte.');
  END IF;

  IF s.code_locked_until IS NOT NULL AND s.code_locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Demasiadas tentativas. Tente novamente em %s min.',
                      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.code_locked_until - now())) / 60)::int))
    );
  END IF;

  IF v_code <> '' AND v_code = upper(s.delivery_code) THEN
    UPDATE public.deliveries
       SET current_status = 'completed',
           completed_at   = now(),
           delivered_at   = now(),
           updated_at     = now()
     WHERE id = d.id;
    UPDATE public.delivery_secrets
       SET code_attempts = 0, code_locked_until = NULL
     WHERE delivery_id = d.id;
    RETURN jsonb_build_object('success', true);
  END IF;

  v_attempts := COALESCE(s.code_attempts, 0) + 1;
  IF v_attempts >= v_max THEN
    UPDATE public.delivery_secrets
       SET code_attempts = 0,
           code_locked_until = now() + make_interval(mins => v_lock_min)
     WHERE delivery_id = d.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Código incorrecto. Verificação bloqueada por %s min.', v_lock_min)
    );
  END IF;

  UPDATE public.delivery_secrets SET code_attempts = v_attempts WHERE delivery_id = d.id;
  RETURN jsonb_build_object(
    'success', false,
    'error', format('Código incorrecto. Restam %s tentativa(s).', v_max - v_attempts)
  );
END;
$$;

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

  SELECT dl.id, dl.entrepreneur_id, dl.current_status, s.delivery_code
    INTO d
    FROM public.deliveries dl
    LEFT JOIN public.delivery_secrets s ON s.delivery_id = dl.id
   WHERE dl.id = p_delivery_id;

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

CREATE OR REPLACE FUNCTION public.regenerate_delivery_code(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_delivery record;
  v_new_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;

  SELECT id, entrepreneur_id, current_status
    INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não encontrada.');
  END IF;
  IF v_delivery.entrepreneur_id <> auth.uid() AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão.');
  END IF;
  IF v_delivery.current_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível regenerar o código desta entrega.');
  END IF;

  v_new_code := public.new_delivery_code();
  INSERT INTO public.delivery_secrets (delivery_id, delivery_code, code_attempts, code_locked_until)
  VALUES (p_delivery_id, v_new_code, 0, NULL)
  ON CONFLICT (delivery_id) DO UPDATE
    SET delivery_code = EXCLUDED.delivery_code, code_attempts = 0, code_locked_until = NULL;

  RETURN jsonb_build_object('success', true, 'code', v_new_code);
END;
$$;

ALTER TABLE public.deliveries
  DROP COLUMN IF EXISTS delivery_code,
  DROP COLUMN IF EXISTS code_attempts,
  DROP COLUMN IF EXISTS code_locked_until;

DROP FUNCTION IF EXISTS public.generate_delivery_code();

-- ─── 2. Leituras públicas ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Leitura pública de entregadores" ON public.deliverers;
DROP POLICY IF EXISTS deliverers_select ON public.deliverers;
CREATE POLICY deliverers_select ON public.deliverers
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Leitura pública delivery_persons" ON public.delivery_persons;
DROP POLICY IF EXISTS delivery_persons_select ON public.delivery_persons;
CREATE POLICY delivery_persons_select ON public.delivery_persons
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.deliveries d
                WHERE d.deliverer_id = delivery_persons.user_id
                  AND d.entrepreneur_id = (SELECT auth.uid()))
  );

-- ─── 3. Auditoria não forjável ──────────────────────────────────────────────
-- Entradas de auditoria vêm de triggers/funções do servidor; o cliente só
-- escreve se for admin (difusões e levantamentos).
DROP POLICY IF EXISTS activity_logs_insert_own ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_insert_admin ON public.activity_logs;
CREATE POLICY activity_logs_insert_admin ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Histórico legado de subscrições: o utilizador não deve fabricar entradas
DROP POLICY IF EXISTS "Usuários inserem seu histórico" ON public.subscription_changes;

-- ─── Políticas com papel `public` → `authenticated` ─────────────────────────
ALTER POLICY own_keys                                    ON public.api_keys             TO authenticated;
ALTER POLICY admin_manage_broadcasts                     ON public.broadcasts           TO authenticated;
ALTER POLICY "Users manage own payment methods"          ON public.payment_methods      TO authenticated;
ALTER POLICY "Usuários veem incidentes relacionados"     ON public.incidents            TO authenticated;
ALTER POLICY "Users can view own invoices"               ON public.invoices             TO authenticated;
ALTER POLICY "Usuários podem ver suas próprias subscriptions" ON public.subscriptions   TO authenticated;
ALTER POLICY "Usuários veem próprias transações"         ON public.transactions         TO authenticated;
ALTER POLICY "Users can delete own settings"             ON public.user_settings        TO authenticated;
ALTER POLICY "Users can insert own settings"             ON public.user_settings        TO authenticated;
ALTER POLICY "Users can view own settings"               ON public.user_settings        TO authenticated;
ALTER POLICY "Users can update own settings"             ON public.user_settings        TO authenticated;
ALTER POLICY "Usuários veem suas assinaturas"            ON public.user_subscriptions   TO authenticated;
ALTER POLICY "Usuários veem seu histórico"               ON public.subscription_changes TO authenticated;
ALTER POLICY "Usuários veem seus pagamentos"             ON public.subscription_payments TO authenticated;
ALTER POLICY "Users can view checkpoints of own deliveries" ON public.delivery_checkpoints TO authenticated;

-- ─── 4. Privilégios mínimos ─────────────────────────────────────────────────
-- `anon` (qualquer pessoa com a chave pública) deixa de ter acesso directo às
-- tabelas; a única leitura pública mantida é a dos planos activos (preços).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT SELECT ON public.plans, public.subscription_plans TO anon;
-- Privilégios que a API nunca usa e que contornam a RLS (TRUNCATE)
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ─── 5. Funções de trigger não são endpoints ────────────────────────────────
REVOKE EXECUTE ON FUNCTION
  public.log_delivery_checkpoint(),
  public.guard_delivery_changes(),
  public.prevent_privileged_profile_changes(),
  public.protect_tracking_code(),
  public.update_notifications_updated_at(),
  public.update_payment_timestamp(),
  public.update_updated_at_column(),
  public.update_user_settings_updated_at(),
  public.update_withdrawal_processed_at(),
  public.update_withdrawals_updated_at()
FROM PUBLIC, anon, authenticated;

-- ─── 6. Cifra de dados bancários ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'zomar_pii_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'zomar_pii_key',
      'Chave de cifra de dados bancários (ZOMAR)');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pii_encrypt(p_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE k text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'zomar_pii_key';
  IF k IS NULL THEN RAISE EXCEPTION 'Chave de cifra indisponível.'; END IF;
  RETURN 'enc:v1:' || replace(encode(extensions.pgp_sym_encrypt(p_text, k), 'base64'), E'\n', '');
END;
$$;

CREATE OR REPLACE FUNCTION public.pii_decrypt(p_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE k text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  IF left(p_text, 7) <> 'enc:v1:' THEN RETURN p_text; END IF;  -- legado sem cifra
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'zomar_pii_key';
  IF k IS NULL THEN RAISE EXCEPTION 'Chave de cifra indisponível.'; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(substr(p_text, 8), 'base64'), k);
END;
$$;
REVOKE ALL ON FUNCTION public.pii_encrypt(text), public.pii_decrypt(text) FROM PUBLIC, anon, authenticated;

-- Dados bancários já guardados passam a cifrados
ALTER TABLE public.withdrawals DISABLE TRIGGER USER;
UPDATE public.withdrawals
   SET bank_data = public.pii_encrypt(bank_data)
 WHERE bank_data IS NOT NULL AND left(bank_data, 7) <> 'enc:v1:';
ALTER TABLE public.withdrawals ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric, p_method text, p_phone text DEFAULT NULL, p_bank jsonb DEFAULT NULL)
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
     CASE WHEN p_method = 'bank_transfer' THEN public.pii_encrypt(jsonb_build_object(
            'nib', p_bank->>'nib',
            'bankName', btrim(p_bank->>'bankName'),
            'accountHolder', btrim(p_bank->>'accountHolder'))::text) ELSE NULL END,
     now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'net_amount', p_amount - v_fee);
END;
$$;

-- Leitura do destino do pagamento: só admin, com registo de quem viu e quando
CREATE OR REPLACE FUNCTION public.admin_get_withdrawal_destination(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  w record;
  v_bank text;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT user_id, payment_method, phone_number, bank_data
    INTO w FROM public.withdrawals WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Levantamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.activity_logs (user_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (w.user_id, auth.uid(), 'withdrawal_destination_viewed', 'withdrawal', p_id::text, '{}'::jsonb);

  v_bank := public.pii_decrypt(w.bank_data);
  RETURN jsonb_build_object(
    'method', w.payment_method,
    'phone',  w.phone_number,
    'bank',   CASE WHEN v_bank IS NULL THEN NULL ELSE v_bank::jsonb END);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_withdrawal_destination(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_withdrawal_destination(uuid) TO authenticated;
