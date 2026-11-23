import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ============================================
// TIPOS E INTERFACES
// ============================================

export type UserRole = 'entrepreneur' | 'deliverer' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  created_at: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Cópia local do perfil (sem dados sensíveis) para restaurar a sessão de imediato
// ao actualizar a página e para sobreviver a falhas temporárias de rede.
const USER_CACHE_KEY = 'zomar-user-cache'
const readCachedUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch { return null }
}
const writeCachedUser = (u: User | null) => {
  try {
    if (u) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_CACHE_KEY)
  } catch { /* storage indisponível */ }
}

/** failed=true: erro temporário (rede/timeout) — NÃO significa "sem perfil". */
interface ProfileResult { user: User | null; failed: boolean }

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)
  const sessionCheckTimeout = useRef<NodeJS.Timeout | null>(null)

  // ✅ Buscar perfil completo do usuário
  const fetchUserProfile = useCallback(async (authUserId: string): Promise<ProfileResult> => {
    try {

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUserId)
          .abortSignal(controller.signal)
          .maybeSingle()

        clearTimeout(timeoutId)

        // Perfil não encontrado → criar
        if (!profile && !error) {
          console.warn('⚠️ AuthContext - Perfil não encontrado, criando...')
          return { user: await createUserProfile(authUserId), failed: false }
        }

        if (error) {
          console.error('❌ AuthContext - Erro ao buscar perfil:', error)
          return { user: null, failed: true }
        }

        // Admins sempre têm role definida no BD — nunca vão para RoleSelection
        // Perfil sem role → força RoleSelection (apenas entrepreneur/deliverer novos)
        if (!profile.role) {
          return { user: null, failed: false }
        }

        const userData: User = {
          id: profile.user_id,
          email: profile.email || '',
          full_name: profile.full_name || '',
          role: profile.role as UserRole,
          phone: profile.phone,
          created_at: profile.created_at,
          avatar_url: profile.avatar_url
        }

        
        return { user: userData, failed: false }
      } catch (err: any) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
          console.error('⏱️ AuthContext - Timeout ao buscar perfil')
        }
        throw err
      }
    } catch (err: any) {
      console.error('❌ AuthContext - Erro ao processar perfil:', err)
      return { user: null, failed: true }
    }
  }, [])

  /** Aplica o resultado do perfil: em falha temporária mantém o utilizador actual. */
  const applyProfile = useCallback(async (authUserId: string) => {
    const { user: profile, failed } = await fetchUserProfile(authUserId)
    if (failed) {
      // Sessão válida mas perfil indisponível agora: não deslogar.
      setUser(prev => prev ?? readCachedUser())
      return
    }
    setUser(profile)
    writeCachedUser(profile)
  }, [fetchUserProfile])

  // ✅ Criar perfil para novos utilizadores (Google OAuth, etc.)
  // CORRECÇÃO: trust_score adicionado para evitar erro no trigger trg_log_profile_change
  const createUserProfile = async (authUserId: string): Promise<User | null> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null

      const userRole = authUser.user_metadata?.role || null

      // Segurança: nunca criar admin automaticamente a partir de metadata
      const safeRole = userRole === 'admin' ? null : userRole

      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          user_id: authUserId,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
          role: safeRole,
          phone: authUser.user_metadata?.phone || '',
          created_at: new Date().toISOString(),
          status: 'ativo',
          trust_score: 5.0  // ✅ CORRECÇÃO: evita erro "record old has no field trust_score"
        }])

      if (insertError) {
        console.error('❌ Erro ao criar perfil:', insertError)
        return null
      }

      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUserId)
        .maybeSingle()

      if (!newProfile) return null

      // Sem role → redireciona para RoleSelection
      if (!newProfile.role) {
        
        return null
      }

      return {
        id: newProfile.user_id,
        email: newProfile.email || '',
        full_name: newProfile.full_name || '',
        role: newProfile.role as UserRole,
        phone: newProfile.phone,
        created_at: newProfile.created_at,
        avatar_url: newProfile.avatar_url
      }
    } catch (err) {
      console.error('❌ Erro ao criar perfil:', err)
      return null
    }
  }

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) await applyProfile(session.user.id)
    } catch (error) {
      console.error('❌ AuthContext - Erro ao atualizar usuário:', error)
    }
  }, [applyProfile])

  // ============================================
  // VERIFICAR SESSÃO INICIAL
  // ============================================
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const initializeAuth = async () => {
      try {
        if (sessionCheckTimeout.current) clearTimeout(sessionCheckTimeout.current)

        // Restauro imediato: se há sessão guardada, mostra a app já com o perfil em cache.
        const cached = readCachedUser()
        if (cached) { setUser(cached); setLoading(false) }

        const TIMEOUT = Symbol('timeout')
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<typeof TIMEOUT>((resolve) => {
            sessionCheckTimeout.current = setTimeout(() => resolve(TIMEOUT), 8000)
          }),
        ])
        if (sessionCheckTimeout.current) clearTimeout(sessionCheckTimeout.current)

        if (result === TIMEOUT) {
          // Rede lenta: mantém o que há em cache; o listener actualiza quando a sessão chegar.
          console.warn('⏱️ AuthContext - getSession lento; a manter sessão em cache')
          return
        }

        const { data: { session }, error } = result
        if (error) {
          console.error('❌ Erro ao verificar sessão:', error)
          // Só desloga se o token for mesmo inválido; erros de rede mantêm a sessão.
          if (/refresh token|invalid.*token|jwt/i.test(error.message)) {
            setUser(null); writeCachedUser(null)
          }
          return
        }

        if (session?.user) {
          await applyProfile(session.user.id)
        } else {
          setUser(null); writeCachedUser(null)
        }
      } catch (error: any) {
        console.error('❌ AuthContext - Erro na inicialização:', error.message)
        // Falha inesperada: não apaga a sessão.
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // IMPORTANTE: o callback não pode fazer `await` a chamadas do Supabase (bloqueia o
    // cliente). Adia o trabalho com setTimeout e ignora eventos que não mudam o perfil.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null); writeCachedUser(null); setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
      if (session?.user) {
        const uid = session.user.id
        setTimeout(() => { applyProfile(uid).finally(() => setLoading(false)) }, 0)
      } else {
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      if (sessionCheckTimeout.current) clearTimeout(sessionCheckTimeout.current)
    }
  }, [applyProfile])

  // ============================================
  // LOGIN
  // ============================================
  const signIn = async (email: string, password: string) => {
    try {
      
      setLoading(true)

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('❌ AuthContext - Erro no login:', error.message)
        return { success: false, error: error.message }
      }

      if (!data.user) {
        return { success: false, error: 'Erro ao fazer login' }
      }

      const { user: profile } = await fetchUserProfile(data.user.id)
      setUser(profile); writeCachedUser(profile)
      return { success: true }
    } catch (err: any) {
      console.error('❌ AuthContext - Exceção no login:', err)
      return { success: false, error: err.message || 'Erro ao fazer login' }
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // CADASTRO (admin nunca pode ser criado aqui)
  // CORRECÇÃO: trust_score adicionado em todos os INSERTs/UPDATEs
  // ============================================
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    phone?: string
  ) => {
    try {
      // Bloquear tentativa de criar admin via signUp público
      if (role === 'admin') {
        return { success: false, error: 'Não é possível criar uma conta admin por este método.' }
      }

      
      setLoading(true)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role, phone: phone || '' }
        }
      })

      if (authError) return { success: false, error: authError.message }
      if (!authData.user) return { success: false, error: 'Erro ao criar usuário' }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          user_id: authData.user.id,
          email,
          full_name: fullName,
          role,
          phone: phone || '',
          created_at: new Date().toISOString(),
          status: 'ativo',
          trust_score: 5.0  // ✅ CORRECÇÃO: evita erro "record old has no field trust_score"
        }])

      if (profileError) {
        // Perfil já existe → atualizar
        if (profileError.code === '23505') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              role,
              phone: phone || '',
              status: 'ativo',
              trust_score: 5.0  // ✅ CORRECÇÃO: incluído também no update de fallback
            })
            .eq('user_id', authData.user.id)

          if (updateError) return { success: false, error: 'Erro ao atualizar perfil' }
        } else {
          return { success: false, error: 'Erro ao criar perfil: ' + profileError.message }
        }
      }

      const { user: profile } = await fetchUserProfile(authData.user.id)
      setUser(profile); writeCachedUser(profile)
      return { success: true }
    } catch (err: any) {
      console.error('❌ AuthContext - Exceção no cadastro:', err)
      return { success: false, error: err.message || 'Erro ao criar conta' }
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // LOGOUT
  // ============================================
  const signOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      localStorage.removeItem('supabase-auth')
      writeCachedUser(null)
      sessionStorage.clear()
      setUser(null)
    } catch (error) {
      console.error('❌ AuthContext - Erro ao fazer logout:', error)
      setUser(null)
      writeCachedUser(null)
      localStorage.removeItem('supabase-auth')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // RECUPERAÇÃO DE SENHA
  // ============================================
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // ============================================
  // ATUALIZAR SENHA
  // ============================================
  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // ============================================
  // DEBUG (development only)
  // ============================================
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      
    }
  }, [user, loading])

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}