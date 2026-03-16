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

// Limpar sessões corrompidas ao iniciar
const limparSessoesInvalidas = async () => {
  try {
    const { error } = await supabase.auth.getSession()
    if (error) {
      console.warn('⚠️ Sessão inválida, limpando storage...', error.message)
      localStorage.removeItem('supabase-auth')
      sessionStorage.clear()
      await supabase.auth.signOut()
    }
  } catch (err) {
    console.warn('⚠️ Erro ao verificar sessão:', err)
  }
}

limparSessoesInvalidas()

// =============================================
// FUNÇÕES DE AUTENTICAÇÃO
// =============================================

export async function verificarAutenticacao() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) return { autenticado: false, error }
    return { autenticado: !!session, session, userId: session?.user?.id }
  } catch (error) {
    return { autenticado: false, error }
  }
}

export async function fazerLogin(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}

export async function fazerLogout() {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem('supabase-auth')
    sessionStorage.clear()
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=')
      if (name.includes('sb-') || name.includes('supabase')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      }
    })
    return { success: true }
  } catch (error) {
    localStorage.removeItem('supabase-auth')
    sessionStorage.clear()
    return { success: false, error }
  }
}

// =============================================
// FUNÇÕES DE PERFIL
// =============================================

export async function buscarPerfil(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error) return null
    return data
  } catch {
    return null
  }
}

export async function criarPerfil(profileData: any) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single()
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}

export async function atualizarPerfil(userId: string, dados: any) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(dados)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}

// =============================================
// FUNÇÕES DE ENTREGAS
// =============================================

export async function buscarEntregasDoEmpreendedor(userId: string) {
  try {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`*, deliverer:profiles!deliveries_deliverer_id_fkey(full_name)`)
      .eq('entrepreneur_id', userId)
      .order('created_at', { ascending: false })
    if (error) return { data: [], error }
    return { data: data || [], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export async function criarEntrega(entregaData: any) {
  try {
    const { data, error } = await supabase
      .from('deliveries')
      .insert([entregaData])
      .select()
      .single()
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}

// =============================================
// FUNÇÕES DE INCIDENTES
// =============================================

export async function reportarProblema(incidentData: any) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .insert([incidentData])
      .select()
      .single()
    if (error) return { success: false, error }
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}

// =============================================
// FUNÇÕES DE UTILIDADE
// =============================================

export async function verificarTabelas() {
  const tables = ['profiles', 'deliveries', 'incidents']
  const resultados: Record<string, boolean> = {}
  const faltando: string[] = []

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .limit(1)
      if (error) { resultados[table] = false; faltando.push(table) }
      else resultados[table] = true
    } catch {
      resultados[table] = false; faltando.push(table)
    }
  }

  return {
    todasExistem: faltando.length === 0,
    resultados,
    tabelasFaltando: faltando,
    mensagem: faltando.length > 0
      ? `Tabelas faltando: ${faltando.join(', ')}`
      : 'Todas as tabelas existem'
  }
}

export async function limparSessaoCorrompida() {
  try {
    localStorage.removeItem('supabase-auth')
    sessionStorage.clear()
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=')
      if (name.includes('sb-') || name.includes('supabase')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      }
    })
    await supabase.auth.signOut()
    return { success: true }
  } catch (error) {
    return { success: false, error }
  }
}

export async function verificarConexao() {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true })
      .limit(1)
    if (error) return { conectado: false, error: error.message }
    return { conectado: true }
  } catch (error: any) {
    return { conectado: false, error: error.message }
  }
}

export async function obterUsuarioAtual() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) return null
    return user
  } catch {
    return null
  }
}

export async function testarConexaoCompleta() {
  const conexao = await verificarConexao()
  if (!conexao.conectado) return conexao
  const auth = await verificarAutenticacao()
  const tabelas = await verificarTabelas()
  return {
    conexao: conexao.conectado,
    autenticacao: auth.autenticado,
    tabelas: tabelas.todasExistem,
    detalhes: { tabelasFaltando: tabelas.tabelasFaltando }
  }
}

export default supabase