// supabase/functions/withdraw/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MPESA_BASE = "https://api.sandbox.vm.co.mz"; // muda para production depois
const SERVICE_PROVIDER_CODE = Deno.env.get("MPESA_SERVICE_PROVIDER_CODE")!;
const API_KEY = Deno.env.get("MPESA_API_KEY")!;
const PUBLIC_KEY = Deno.env.get("MPESA_PUBLIC_KEY")!;

async function getAccessToken() {
  const auth = btoa(`${API_KEY}:${PUBLIC_KEY}`);
  const res = await fetch(`${MPESA_BASE}/ipg/v1x/auth/oauth/v1/generate?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  const body = await req.json();
  const { user_id, amount, method, phoneNumber, bankData } = body;

  // Valida JWT do Supabase (opcional mas recomendado)
  // const authHeader = req.headers.get("Authorization");
  // ... verifica token com supabase.auth.getUser()

  if (!user_id || !amount || amount <= 0) {
    return new Response(JSON.stringify({ error: "Dados inválidos" }), { status: 400 });
  }

  let status = "pending";
  let errorMsg = null;

  try {
    if (method === "m-pesa") {
      const token = await getAccessToken();
      const netAmount = Math.floor(amount - 10); // tua FEE

      const payoutRes = await fetch(`${MPESA_BASE}/b2cPayment/`, {  // endpoint aproximado – confirma no teu portal
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Origin": "https://developer.mpesa.vm.co.mz", // ou teu domínio
        },
        body: JSON.stringify({
          input_TransactionReference: `WD_${Date.now()}`,
          input_CustomerMSISDN: phoneNumber.replace("+258", ""),
          input_Amount: netAmount.toString(),
          input_ThirdPartyReference: `user_${user_id}`,
          input_ServiceProviderCode: SERVICE_PROVIDER_CODE,
        }),
      });

      const payoutData = await payoutRes.json();
      if (payoutRes.ok && payoutData.ResponseCode === "INS-0") {  // sucesso
        status = "completed";
      } else {
        throw new Error(payoutData.ErrorMessage || "Falha no payout");
      }
    }
    // Para e-mola, mkesh, bank: fica pending (processamento manual)

  } catch (err) {
    errorMsg = (err as Error).message;
    console.error(err);
  }

  // Salva no Supabase (usa admin client se necessário)
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { error } = await supabaseAdmin.from("withdrawals").insert({
    user_id,
    amount,
    payment_method: method,
    phone_number: method !== "bank_transfer" ? phoneNumber : null,
    bank_data: method === "bank_transfer" ? JSON.stringify(bankData) : null,
    status,
    requested_at: new Date().toISOString(),
    error_message: errorMsg,
  });

  if (error) {
    return new Response(JSON.stringify({ error: "Falha ao salvar" }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, status }), { status: 200 });
});