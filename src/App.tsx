// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import Loader from './components/Common/Loader'
import DeliveryDetails from './components/Common/Deliverydetails'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import RoleSelection from './pages/RoleSelection/RoleSelection'
import { Download, X, Smartphone } from 'lucide-react'

// ========== EMPREENDEDOR ==========
import ActiveDeliveries from './components/entrepreneur/ActiveDeliveries'
import NewDelivery from './components/entrepreneur/NewDelivery'
import DeliveryHistory from './components/entrepreneur/DeliveryHistory'
import Overview from './components/entrepreneur/Overview'
import SubscriptionPage from './pages/Subscriptionpage'

// ========== ENTREGADOR ==========
import DelivererDashboard from './components/deliverer/Delivererdashboard'
import AvailableDeliveries from './components/deliverer/AvailableDeliveries'
import MyDeliveries from './components/deliverer/MyDeliveries'
import Earnings from './components/deliverer/Earnings'
import DelivererProfile from './components/deliverer/Profile'

// ========== ADMIN ==========
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDeliveries from './pages/admin/AdminDeliveries'
import AdminSettings from './pages/admin/AdminSettings'
import AdminSubscriptions from './pages/Adminsubscriptions'
import AdminActivityLog from './pages/admin/AdminActivityLog'
import AdminBroadcast from './pages/admin/AdminBroadcast'

// ========== COMPARTILHADOS ==========
import Profile from './components/shared/Profile'
import Notifications from './components/shared/Notifications'
import Settings from './components/shared/Settings'
import HelpPage from './components/shared/HelpPage'
import TermsPage from './components/shared/TermsPage'

// ========== LAYOUTS ==========
import EntrepreneurLayout from './components/layouts/EntrepreneurLayout'
import DelivererLayout from './components/layouts/DelivererLayout'

// ─── PWA: hook de instalação ─────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function usePWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detectar iOS
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    setIsIOS(ios)

    // Detectar se já está instalado como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Capturar evento de instalação (Chrome / Edge / Android)
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      setPrompt(null)
    }
  }

  return { prompt, install, isInstalled, isIOS }
}

// ─── PWA: Banner de instalação ───────────────────────────────────────────────

function PWAInstallBanner() {
  const { prompt, install, isInstalled, isIOS } = usePWAInstall()
  const [dismissed, setDismissed] = useState(() => {
    // Não mostrar se o utilizador já dispensou nas últimas 7 dias
    const ts = localStorage.getItem('pwa_dismissed')
    if (!ts) return false
    return Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000
  })

  const dismiss = () => {
    localStorage.setItem('pwa_dismissed', String(Date.now()))
    setDismissed(true)
  }

  if (isInstalled || dismissed) return null

  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 9999,
    background: 'linear-gradient(135deg, #059669, #10b981)',
    borderRadius: 16,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 8px 32px rgba(16,185,129,0.40)',
    animation: 'slideUpBanner .35s cubic-bezier(.16,1,.3,1)',
  }

  // iOS — instrução manual (não há evento automático no Safari)
  if (isIOS) return (
    <>
      <style>{`
        @keyframes slideUpBanner {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0);    }
        }
      `}</style>
      <div style={bannerStyle}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Smartphone size={22} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
            Instalar ZOMAR
          </p>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, margin: '3px 0 0', lineHeight: 1.4 }}>
            Toca em <strong>⎙ Partilhar</strong> → <strong>"Adicionar ao ecrã inicial"</strong>
          </p>
        </div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }}>
          <X size={18} color="white" />
        </button>
      </div>
    </>
  )

  // Chrome / Edge / Android — botão de instalação automática
  if (!prompt) return null

  return (
    <>
      <style>{`
        @keyframes slideUpBanner {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .pwa-install-btn:hover { background: #f0fdf4 !important; }
      `}</style>
      <div style={bannerStyle}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Download size={20} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
            Instalar ZOMAR
          </p>
          <p style={{ color: 'rgba(255,255,255,0.80)', fontSize: 12, margin: '2px 0 0' }}>
            Adicionar ao ecrã inicial para acesso rápido
          </p>
        </div>
        <button
          className="pwa-install-btn"
          onClick={install}
          style={{
            background: 'white', border: 'none', borderRadius: 9,
            padding: '8px 15px', fontWeight: 700, fontSize: 13,
            color: '#059669', cursor: 'pointer', flexShrink: 0,
            transition: 'background .15s',
          }}
        >
          Instalar
        </button>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }}>
          <X size={16} color="white" />
        </button>
      </div>
    </>
  )
}

// ─── Guards de Rota ───────────────────────────────────────────────────────────

const RoleGuard = () => {
  const { user, loading, isAuthenticated } = useAuth()
  if (loading) return <Loader />
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role === 'entrepreneur') return <Navigate to="/entrepreneur/overview" replace />
  if (user.role === 'deliverer') return <Navigate to="/deliverer/dashboard" replace />
  return <Navigate to="/role-selection" replace />
}

const EntrepreneurGuard = () => {
  const { user, loading, isAuthenticated } = useAuth()
  if (loading) return <Loader />
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role !== 'entrepreneur') return <Navigate to="/deliverer/dashboard" replace />
  return null
}

const DelivererGuard = () => {
  const { user, loading, isAuthenticated } = useAuth()
  if (loading) return <Loader />
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role !== 'deliverer') return <Navigate to="/entrepreneur/overview" replace />
  return null
}

const AdminGuard = () => {
  const { user, loading, isAuthenticated } = useAuth()
  if (loading) return <Loader />
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return null
}

// ─── Rotas do Empreendedor ────────────────────────────────────────────────────

const EntrepreneurRoutes = () => (
  <EntrepreneurLayout>
    <Routes>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="dashboard" element={<Navigate to="/entrepreneur/overview" replace />} />
      <Route path="overview" element={<Overview />} />
      <Route path="active-deliveries" element={<ActiveDeliveries deliveries={[]} onReportProblem={() => {}} onViewDetails={() => {}} />} />
      <Route path="new-delivery" element={<NewDelivery />} />
      <Route path="delivery-history" element={<DeliveryHistory deliveries={[]} />} />
      <Route path="subscription" element={<SubscriptionPage />} />
      <Route path="profile" element={<Profile />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="settings" element={<Settings />} />
      <Route path="help" element={<HelpPage />} />
      <Route path="terms" element={<TermsPage />} />
      <Route path="delivery/:id" element={<DeliveryDetails />} />
      <Route path="*" element={<Navigate to="/entrepreneur/overview" replace />} />
    </Routes>
  </EntrepreneurLayout>
)

// ─── Rotas do Entregador ──────────────────────────────────────────────────────

const DelivererRoutes = () => (
  <DelivererLayout>
    <Routes>
      <Route index element={<DelivererDashboard />} />
      <Route path="dashboard" element={<DelivererDashboard />} />
      <Route path="available-deliveries" element={<AvailableDeliveries />} />
      <Route path="my-deliveries" element={<MyDeliveries />} />
      <Route path="earnings" element={<Earnings />} />
      <Route path="history" element={<DeliveryHistory deliveries={[]} />} />
      <Route path="profile" element={<DelivererProfile />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="settings" element={<Settings />} />
      <Route path="help" element={<HelpPage />} />
      <Route path="terms" element={<TermsPage />} />
      <Route path="delivery/:id" element={<DeliveryDetails />} />
      <Route path="*" element={<Navigate to="/deliverer/dashboard" replace />} />
    </Routes>
  </DelivererLayout>
)

// ─── Rotas do Admin ───────────────────────────────────────────────────────────

const AdminRoutes = () => (
  <Routes>
    <Route index element={<AdminDashboard />} />
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="users" element={<AdminUsers />} />
    <Route path="deliveries" element={<AdminDeliveries />} />
    <Route path="subscriptions" element={<AdminSubscriptions />} />
    <Route path="broadcast" element={<AdminBroadcast />} />
    <Route path="activity-log" element={<AdminActivityLog />} />
    <Route path="settings" element={<AdminSettings />} />
    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
  </Routes>
)

// ─── App Principal ────────────────────────────────────────────────────────────

export default function App() {
  const { loading } = useAuth()
  if (loading) return <Loader />

  return (
    <>
      {/* Banner PWA — aparece em todos os ecrãs, sobreposto */}
      <PWAInstallBanner />

      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/role-selection" element={<RoleSelection />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Redirect inteligente pela role */}
        <Route path="/dashboard" element={<RoleGuard />} />
        <Route path="/" element={<RoleGuard />} />

        {/* Área do Empreendedor */}
        <Route
          path="/entrepreneur/*"
          element={<><EntrepreneurGuard /><EntrepreneurRoutes /></>}
        />

        {/* Área do Entregador */}
        <Route
          path="/deliverer/*"
          element={<><DelivererGuard /><DelivererRoutes /></>}
        />

        {/* Área Admin */}
        <Route
          path="/admin/*"
          element={<><AdminGuard /><AdminRoutes /></>}
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-black to-gray-900">
              <div className="text-center p-8 bg-[#121212] rounded-2xl border border-white/5 max-w-md">
                <div className="text-6xl mb-4">🔍</div>
                <h1 className="text-3xl font-bold text-white mb-2">Página não encontrada</h1>
                <p className="text-gray-400 mb-6">A página que você procura não existe.</p>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl transition-all font-bold"
                >
                  Voltar ao início
                </button>
              </div>
            </div>
          }
        />
      </Routes>
    </>
  )
}