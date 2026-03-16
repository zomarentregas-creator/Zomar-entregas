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

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)
  const sessionCheckTimeout = useRef<NodeJS.Timeout | null>(null)

  // ✅ Buscar perfil completo do usuário
  const fetchUserProfile = useCallback(async (authUserId: string): Promise<User | null> => {
    try {
      console.log('🔍 AuthContext - Buscando perfil para user_id:', authUserId)

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
          return await createUserProfile(authUserId)
        }

        if (error) {
          console.error('❌ AuthContext - Erro ao buscar perfil:', error)
          return null
        }

        // Admins sempre têm role definida no BD — nunca vão para RoleSelection
        // Perfil sem role → força RoleSelection (apenas entrepreneur/deliverer novos)
        if (!profile.role) {
          console.log('ℹ️ AuthContext - Perfil sem role definida. Aguarda RoleSelection.')
          return null
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

        console.log('✅ AuthContext - Perfil carregado:')
        console.log('   📧 Email:', userData.email)
        console.log('   👤 Nome:', userData.full_name)
        console.log('   🎭 Role:', userData.role)

        return userData
      } catch (err: any) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
          console.error('⏱️ AuthContext - Timeout ao buscar perfil')
        }
        throw err
      }
    } catch (err: any) {
      console.error('❌ AuthContext - Erro ao processar perfil:', err)
      return null
    }
  }, [])

  // ✅ Criar perfil para novos utilizadores (nunca cria admin automaticamente)
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
          status: 'ativo'
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
        console.log('ℹ️ AuthContext - Perfil novo sem role. Aguarda RoleSelection.')
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
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        setUser(profile)
      }
    } catch (error) {
      console.error('❌ AuthContext - Erro ao atualizar usuário:', error)
    }
  }, [fetchUserProfile])

  // ============================================
  // VERIFICAR SESSÃO INICIAL
  // ============================================
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const initializeAuth = async () => {
      try {
        console.log('🔐 AuthContext - Inicializando autenticação...')

        if (sessionCheckTimeout.current) clearTimeout(sessionCheckTimeout.current)

        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) => {
          sessionCheckTimeout.current = setTimeout(() => {
            reject(new Error('Timeout ao verificar sessão'))
          }, 5000)
        })

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any

        if (sessionCheckTimeout.current) clearTimeout(sessionCheckTimeout.current)

        if (error) {
          console.error('❌ Erro ao verificar sessão:', error)
          setUser(null)
          return
        }

        if (session?.user) {
          console.log('✅ AuthContext - Sessão encontrada:', session.user.email)
          const profile = await fetchUserProfile(session.user.id)
          setUser(profile)
        } else {
          console.log('ℹ️ AuthContext - Nenhuma sessão ativa')
          setUser(null)
        }
      } catch (error: any) {
        console.error('❌ AuthContext - Erro na inicialização:', error.message)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthContext - Auth state changed:', event)

        if (event === 'SIGNED_OUT') {
          setUser(null)
        } else if (session?.user) {
          const profile = await fetchUserProfile(session.user.id)
          setUser(profile)
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
      if (sessionCheckTimeout.current) clearTimeout(sessionCheckTimeout.current)
    }
  }, [fetchUserProfile])

  // ============================================
  // LOGIN
  // ============================================
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 AuthContext - Tentando login:', email)
      setLoading(true)

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('❌ AuthContext - Erro no login:', error.message)
        return { success: false, error: error.message }
      }

      if (!data.user) {
        return { success: false, error: 'Erro ao fazer login' }
      }

      const profile = await fetchUserProfile(data.user.id)
      setUser(profile)
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

      console.log('📝 AuthContext - CADASTRO:', { email, role })
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
          status: 'ativo'
        }])

      if (profileError) {
        // Perfil já existe → atualizar
        if (profileError.code === '23505') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ full_name: fullName, role, phone: phone || '', status: 'ativo' })
            .eq('user_id', authData.user.id)

          if (updateError) return { success: false, error: 'Erro ao atualizar perfil' }
        } else {
          return { success: false, error: 'Erro ao criar perfil: ' + profileError.message }
        }
      }

      const profile = await fetchUserProfile(authData.user.id)
      setUser(profile)
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
      sessionStorage.clear()
      setUser(null)
    } catch (error) {
      console.error('❌ AuthContext - Erro ao fazer logout:', error)
      setUser(null)
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
      console.log('🔍 AUTH STATE:', {
        user: user ? { email: user.email, role: user.role, hasRole: !!user.role } : 'null',
        isAuthenticated: !!user,
        loading
      })
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