// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Configuração inicial
console.log('🚀 Inicializando aplicação...')

// Verificar configuração do Supabase
const checkConfiguration = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  console.log('🔧 Configuração:')
  console.log('- Supabase URL:', supabaseUrl ? '✅ Configurada' : '❌ Não configurada')
  console.log('- Supabase Key:', supabaseKey ? '✅ Configurada' : '❌ Não configurada')
  
  // Se não configurado, ativar modo desenvolvimento
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase não configurado. Ativando modo desenvolvimento...')
    localStorage.setItem('dev_mode', 'true')
  }
  
  // Verificar parâmetro de URL para modo dev
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('dev') === 'true') {
    console.log('🚀 Modo desenvolvimento ativado via URL')
    localStorage.setItem('dev_mode', 'true')
  }
  
  // Limpar storage se forçado
  if (urlParams.get('clear') === 'true') {
    console.log('🧹 Limpando storage...')
    localStorage.clear()
    sessionStorage.clear()
    console.log('✅ Storage limpo')
  }
}

// Executar verificação
checkConfiguration()

// Info do navegador
console.log('🌍 Navegador info:', {
  userAgent: navigator.userAgent,
  cookiesEnabled: navigator.cookieEnabled,
  localStorage: typeof localStorage !== 'undefined' ? '✅ Disponível' : '❌ Indisponível',
  sessionStorage: typeof sessionStorage !== 'undefined' ? '✅ Disponível' : '❌ Indisponível'
})

// Forçar reset se necessário
if (window.location.search.includes('reset')) {
  console.log('🧹 Forçando reset completo...')
  localStorage.clear()
  sessionStorage.clear()
  // Limpar cookies do Supabase
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=')
    if (name.includes('sb-') || name.includes('supabase')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    }
  })
  window.location.href = window.location.origin
}

// Renderizar aplicação
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento root não encontrado')
}

console.log('🎬 Iniciando renderização React...')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)