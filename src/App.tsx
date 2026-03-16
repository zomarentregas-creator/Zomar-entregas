import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Loader from './components/Common/Loader';
import DeliveryDetails from './components/Common/Deliverydetails';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import RoleSelection from './pages/RoleSelection/RoleSelection';

// ========== EMPREENDEDOR ==========
// REMOVIDO: EntrepreneurDashboard (era monolítico com tabs internas —
//           substituído pelas rotas individuais abaixo)
import ActiveDeliveries from './components/entrepreneur/ActiveDeliveries';
import NewDelivery from './components/entrepreneur/NewDelivery';
import DeliveryHistory from './components/entrepreneur/DeliveryHistory';
import Overview from './components/entrepreneur/Overview';
import SubscriptionPage from './pages/Subscriptionpage';

// ========== ENTREGADOR ==========
import DelivererDashboard from './components/deliverer/Delivererdashboard';
import AvailableDeliveries from './components/deliverer/AvailableDeliveries';
import MyDeliveries from './components/deliverer/MyDeliveries';
import Earnings from './components/deliverer/Earnings';
import DelivererProfile from './components/deliverer/Profile';

// ========== ADMIN ==========
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDeliveries from './pages/admin/AdminDeliveries';
import AdminSettings from './pages/admin/AdminSettings';
import AdminSubscriptions from './pages/Adminsubscriptions';
import AdminActivityLog from './pages/admin/AdminActivityLog';
import AdminBroadcast from './pages/admin/AdminBroadcast';

// ========== COMPARTILHADOS ==========
import Profile from './components/shared/Profile';
import Notifications from './components/shared/Notifications';
import Settings from './components/shared/Settings';
// HelpPage e TermsPage — ajusta o path conforme onde colocaste os ficheiros:
// Se estão em src/components/shared/ usa './components/shared/HelpPage'
// Se estão em src/pages/            usa './pages/HelpPage'
import HelpPage from './components/shared/HelpPage';
import TermsPage from './components/shared/TermsPage';

// ========== LAYOUTS ==========
import EntrepreneurLayout from './components/layouts/EntrepreneurLayout';
import DelivererLayout from './components/layouts/DelivererLayout';

// ─── Guards de Rota ───────────────────────────────────────────────────────────

const RoleGuard = () => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'entrepreneur') return <Navigate to="/entrepreneur/overview" replace />;
  if (user.role === 'deliverer') return <Navigate to="/deliverer/dashboard" replace />;
  return <Navigate to="/role-selection" replace />;
};

const EntrepreneurGuard = () => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role !== 'entrepreneur') return <Navigate to="/deliverer/dashboard" replace />;
  return null;
};

const DelivererGuard = () => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role !== 'deliverer') return <Navigate to="/entrepreneur/overview" replace />;
  return null;
};

const AdminGuard = () => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return null;
};

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
);

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
);

// ─── Rotas do Admin ───────────────────────────────────────────────────────────

const AdminRoutes = () => (
  <Routes>
    <Route index element={<AdminDashboard />} />
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="users" element={<AdminUsers />} />
    <Route path="deliveries" element={<AdminDeliveries />} />
    <Route path="subscriptions" element={<AdminSubscriptions />} />
    <Route path="broadcast"     element={<AdminBroadcast />} />
    <Route path="activity-log"  element={<AdminActivityLog />} />
    <Route path="settings"      element={<AdminSettings />} />
    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
  </Routes>
);

// ─── App Principal ────────────────────────────────────────────────────────────

export default function App() {
  const { loading } = useAuth();
  if (loading) return <Loader />;

  return (
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
  );
}