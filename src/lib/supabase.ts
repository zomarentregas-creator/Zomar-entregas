// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase não configurado. Verifique seu arquivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,   // ← NECESSÁRIO para OAuth implicit flow detectar o token na URL
    storage: window.localStorage,
    storageKey: 'supabase-auth',
    flowType: 'implicit',       // ← MUDADO de 'pkce' para 'implicit' — funciona em SPAs sem SSR
  },
  global: {
    headers: {
      'x-application-name': 'delivery-app'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
})

// Limpa a sessão só quando o token é mesmo inválido (refresh token revogado/em falta).
// Erros de rede ou lentidão NÃO apagam a sessão: antes isto deslogava ao actualizar a página.
const limparSessoesInvalidas = async () => {
  try {
    const { error } = await supabase.auth.getSession()
    if (error && /refresh token|invalid.*token/i.test(error.message)) {
      console.warn('⚠️ Token inválido, a terminar sessão local...', error.message)
      await supabase.auth.signOut({ scope: 'local' })
    }
  } catch (err) {
    console.warn('⚠️ Erro ao verificar sessão:', err)
  }
}

limparSessoesInvalidas()

export default supabase
