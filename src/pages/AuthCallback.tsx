// src/pages/AuthCallback.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const processed = useRef(false)

  useEffect(() => {
    // Evitar execução duplicada
    if (processed.current) return
    processed.current = true

    console.log('🔔 AuthCallback - Iniciando processamento...')

    const handleAuthCallback = async () => {
      try {
        // 1. PEGAR PARÂMETROS DA URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)
        
        console.log('📍 Hash params:', Object.fromEntries(hashParams))
        console.log('📍 Query params:', Object.fromEntries(queryParams))

        // 2. VERIFICAR SE TEM ERRO NA URL
        const error = queryParams.get('error') || hashParams.get('error')
        if (error) {
          throw new Error(error)
        }

        // 3. CASO 1: FLUXO PKCE (code na query)
        const code = queryParams.get('code')
        if (code) {
          console.log('🔑 Fluxo PKCE detectado, trocando code por sessão...')
          
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          )
          
          if (error) throw error
          
          if (data.session?.user) {
            await handleUserRedirection(data.session.user.id)
            return
          }
        }

        // 4. CASO 2: FLUXO IMPLÍCITO (access_token no hash)
        const accessToken = hashParams.get('access_token')
        if (accessToken) {
          console.log('🔑 Fluxo implícito detectado, aguardando evento SIGNED_IN...')
          
          // O Supabase já processa o hash automaticamente e dispara SIGNED_IN
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              console.log('📡 Evento de auth:', event)
              
              if (event === 'SIGNED_IN' && session?.user) {
                subscription.unsubscribe()
                await handleUserRedirection(session.user.id)
              }
            }
          )

          // Timeout de segurança
          setTimeout(() => {
            subscription.unsubscribe()
            if (status === 'loading') {
              throw new Error('Tempo excedido ao aguardar autenticação')
            }
          }, 10000)

          return
        }

        // 5. CASO 3: JÁ TEM SESSÃO
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('✅ Sessão já existente encontrada')
          await handleUserRedirection(session.user.id)
          return
        }

        // 6. NENHUM MÉTODO FUNCIONOU
        throw new Error('Nenhum método de autenticação encontrado')

      } catch (err: any) {
        console.error('❌ Erro no callback:', err)
        setErrorMsg(err.message || 'Erro na autenticação')
        setStatus('error')
        
        // Redirecionar para login após 4 segundos
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 4000)
      }
    }

    // Função auxiliar para redirecionar baseado na role
    const handleUserRedirection = async (userId: string) => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', userId)
          .single()

        if (error) throw error

        console.log('👤 Perfil encontrado:', profile)

        if (profile?.role === 'entrepreneur') {
          navigate('/entrepreneur/dashboard', { replace: true })
        } else if (profile?.role === 'deliverer') {
          navigate('/deliverer/dashboard', { replace: true })
        } else {
          // Primeiro login - sem role definida
          navigate('/role-selection', { replace: true })
        }
      } catch (err) {
        console.error('❌ Erro ao buscar perfil:', err)
        // Se não encontrar perfil, vai para role selection
        navigate('/role-selection', { replace: true })
      }
    }

    handleAuthCallback()
  }, [navigate]) // ✅ Dependência correta

  // UI (mantém igual)
  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] bg-emerald-600/8" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] bg-teal-500/6" />
      </div>

      <div className="relative z-10 text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
              <Truck size={40} className="text-white" />
            </div>
            {status === 'loading' && (
              <div className="absolute inset-0 rounded-2xl border-4 border-emerald-400/20 border-t-emerald-400/80 animate-spin" />
            )}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black text-white tracking-widest">ZOMAR</h1>
          <p className="text-white/40 text-sm mt-1">Entregas Inteligentes</p>
        </div>

        {status === 'loading' ? (
          <div className="space-y-4">
            <p className="text-emerald-400 font-semibold animate-pulse">
              A autenticar...
            </p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-red-400 font-semibold">Erro na autenticação</p>
            <p className="text-white/40 text-sm max-w-xs mx-auto">{errorMsg}</p>
            <p className="text-white/25 text-xs">A redirecionar para o login...</p>
          </div>
        )}
      </div>
    </div>
  )
}

