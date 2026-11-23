# Publicar as alterações de segurança e do assistente

Ordem recomendada (cada passo é seguro mesmo que o seguinte ainda não tenha sido feito):

1. **Migração** — rever e aplicar `migrations/20261122000000_security_hardening_and_agent.sql`
   (SQL Editor do Supabase ou `supabase db push`). Cria `support_tickets`, `notification_settings`,
   `agent_messages`, o bucket `avatars`, as funções `get_delivery_code`, `verify_delivery_code`,
   `deliverer_available_balance`, `request_withdrawal`, e endurece RLS/triggers.
2. **Edge Functions** — `supabase functions deploy zomar-agent delete-account create-checkout-session create-portal-session stripe-webhook`
3. **Segredos** (`supabase secrets set ...`):
   - Assistente (um dos dois; sem nenhum usa o motor de regras): `ANTHROPIC_API_KEY`
     **ou** `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL` (qualquer API compatível com OpenAI).
     Opcional: `AGENT_MODEL` (por omissão `claude-haiku-5-5`).
   - CORS: `APP_URL` (domínio do site) e/ou `ALLOWED_ORIGINS` (lista separada por vírgulas).
     Enquanto nenhum estiver definido, as funções aceitam qualquer origem (comportamento anterior).
   - Stripe: `ALLOWED_PRICE_IDS` (IDs `price_...` dos planos, separados por vírgulas).
4. **Dashboard Supabase** — Authentication → ativar *Leaked password protection* e,
   para o 2FA, ativar MFA (TOTP).
