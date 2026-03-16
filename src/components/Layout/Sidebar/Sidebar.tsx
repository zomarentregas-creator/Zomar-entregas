import { NavLink } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Home,
  Package,
  Truck,
  History,
  DollarSign,
  MapPin,
  TrendingUp,
  CreditCard,
  Settings,
  User,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Activity,
  Zap,
  Star,
  Calendar,
  Shield,
  LogOut
} from 'lucide-react';

type Role = 'entrepreneur' | 'deliverer' | 'admin';

type BadgeKey = 'activeDeliveries' | 'notifications' | 'pendingPayments';

type SidebarLink = {
  id: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: Role[];
  badgeKey?: BadgeKey;
  description?: string;
};

type SidebarSection = {
  id: string;
  title: string;
  links: SidebarLink[];
};

const SECTIONS: SidebarSection[] = [
  {
    id: 'main',
    title: 'Menu Principal',
    links: [
      {
        id: 'entrepreneur-dashboard',
        to: '/entrepreneur-dashboard',
        label: 'Dashboard',
        icon: Home,
        roles: ['entrepreneur'],
        description: 'Visão geral'
      },
      {
        id: 'deliverer-dashboard',
        to: '/deliverer/dashboard',
        label: 'Dashboard',
        icon: Home,
        roles: ['deliverer'],
        description: 'Estatísticas'
      },
      {
        id: 'active-deliveries',
        to: '/active-deliveries',
        label: 'Entregas Ativas',
        icon: Activity,
        roles: ['entrepreneur'],
        badgeKey: 'activeDeliveries',
        description: 'Em andamento'
      },
      {
        id: 'new-delivery',
        to: '/new-delivery',
        label: 'Nova Entrega',
        icon: Zap,
        roles: ['entrepreneur'],
        description: 'Criar'
      },
      {
        id: 'available-deliveries',
        to: '/deliverer/available-deliveries',
        label: 'Buscar Entregas',
        icon: Package,
        roles: ['deliverer'],
        description: 'Disponíveis'
      },
      {
        id: 'my-deliveries',
        to: '/deliverer/my-deliveries',
        label: 'Minhas Entregas',
        icon: Truck,
        roles: ['deliverer'],
        badgeKey: 'activeDeliveries',
        description: 'Em rota'
      },
      {
        id: 'earnings',
        to: '/deliverer/earnings',
        label: 'Meus Ganhos',
        icon: DollarSign,
        roles: ['deliverer'],
        badgeKey: 'pendingPayments',
        description: 'Rendimentos'
      },
      {
        id: 'history',
        to: '/delivery-history',
        label: 'Histórico',
        icon: History,
        roles: ['entrepreneur', 'deliverer'],
        description: 'Completo'
      },
      {
        id: 'overview',
        to: '/overview',
        label: 'Visão Geral',
        icon: TrendingUp,
        roles: ['entrepreneur'],
        description: 'Análises'
      },
      {
        id: 'subscription',
        to: '/subscription',
        label: 'Assinatura',
        icon: Star,
        roles: ['entrepreneur'],
        description: 'Plano'
      },
    ],
  },
  {
    id: 'account',
    title: 'Sua Conta',
    links: [
      {
        id: 'profile',
        to: '/profile',
        label: 'Meu Perfil',
        icon: User,
        roles: ['entrepreneur', 'deliverer', 'admin'],
        description: 'Personalizar'
      },
      {
        id: 'notifications',
        to: '/notifications',
        label: 'Notificações',
        icon: Bell,
        roles: ['entrepreneur', 'deliverer', 'admin'],
        badgeKey: 'notifications',
        description: 'Alertas'
      },
      {
        id: 'settings',
        to: '/settings',
        label: 'Configurações',
        icon: Settings,
        roles: ['entrepreneur', 'deliverer', 'admin'],
        description: 'Preferências'
      },
      {
        id: 'help',
        to: '/help',
        label: 'Ajuda',
        icon: HelpCircle,
        roles: ['entrepreneur', 'deliverer', 'admin'],
        description: 'Suporte'
      },
    ],
  },
];

type Props = {
  role: Role;
  badges?: Partial<Record<BadgeKey, number>>;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
};

export default function Sidebar({ role, badges = {}, isDarkMode = true, toggleTheme }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDeliverer = role === 'deliverer';
  const accentColor = isDarkMode 
    ? (role === 'entrepreneur' ? 'text-blue-400' : role === 'deliverer' ? 'text-emerald-400' : 'text-purple-400')
    : (role === 'entrepreneur' ? 'text-blue-600' : role === 'deliverer' ? 'text-emerald-600' : 'text-purple-600');

  const sections = useMemo(() => {
    return SECTIONS.map((section) => ({
      ...section,
      links: section.links.filter((link) => link.roles.includes(role)),
    })).filter((section) => section.links.length > 0);
  }, [role]);

  return (
    <>
      {/* Mobile top bar - Estilo GameX */}
      <div className={`md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-40 ${
        isDarkMode 
          ? 'bg-[#111] border-white/5 text-white' 
          : 'bg-white border-gray-200 text-gray-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${
            isDarkMode 
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
              : 'bg-gradient-to-br from-emerald-400 to-emerald-500'
          } text-white`}>
            <Package size={18} weight="bold" />
          </div>
          <span className="font-black tracking-tighter">ZOMAR</span>
        </div>
        <button 
          onClick={() => setMobileOpen(true)}
          className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
        >
          <Menu className={isDarkMode ? 'text-gray-300' : 'text-gray-700'} />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Estilo GameX */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 ${
          isDarkMode 
            ? 'bg-[#111] border-r border-white/5' 
            : 'bg-gray-50 border-r border-gray-200'
        } ${collapsed ? 'w-20' : 'w-72'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        
        {/* Header da Sidebar */}
        <div className={`p-6 flex items-center justify-between ${
          isDarkMode ? 'border-b border-white/5' : 'border-b border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isDarkMode 
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
                : 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg'
            } text-white transform transition-transform duration-300 hover:scale-105`}>
              <Package size={22} weight="bold" />
            </div>
            {!collapsed && (
              <div>
                <span className="text-2xl font-black italic tracking-tighter text-white">ZOMAR</span>
                <p className={`text-xs mt-0.5 ${
                  isDarkMode ? 'text-emerald-400/70' : 'text-emerald-600'
                }`}>
                  {role === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                </p>
              </div>
            )}
          </div>

          <button
            className="hidden md:flex p-2 rounded-xl hover:bg-white/5 transition-colors"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <ChevronRight className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} size={18} />
            ) : (
              <ChevronLeft className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} size={18} />
            )}
          </button>
        </div>

        {/* Seções de Navegação */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          {sections.map((section) => (
            <div key={section.id}>
              {!collapsed && (
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {section.title}
                </p>
              )}
              
              <nav className="space-y-1">
                {section.links.map((link) => (
                  <NavLink
                    key={link.id}
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 group ${
                        isActive
                          ? isDarkMode
                            ? `bg-emerald-500/10 ${accentColor} border border-emerald-500/30 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]`
                            : `bg-emerald-100 ${accentColor} border border-emerald-200 shadow-sm`
                          : isDarkMode
                            ? 'text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-300'
                      } border`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <link.icon 
                        size={20} 
                        className={isDarkMode ? 'group-hover:scale-110 transition-transform' : ''} 
                      />
                      {!collapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate">{link.label}</span>
                            {link.badgeKey && badges[link.badgeKey] && badges[link.badgeKey]! > 0 && (
                              <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-lg font-black ${
                                isDarkMode 
                                  ? 'bg-emerald-500 text-black' 
                                  : 'bg-emerald-500 text-white'
                              }`}>
                                {badges[link.badgeKey]}
                              </span>
                            )}
                          </div>
                          {link.description && (
                            <p className={`text-xs mt-0.5 truncate ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {link.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!collapsed && link.badgeKey && badges[link.badgeKey] && badges[link.badgeKey]! > 0 && (
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-lg font-black ${
                        isDarkMode 
                          ? 'bg-emerald-500 text-black' 
                          : 'bg-emerald-500 text-white'
                      }`}>
                        {badges[link.badgeKey]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer da Sidebar */}
        <div className={`p-4 border-t ${
          isDarkMode ? 'border-white/5' : 'border-gray-200'
        }`}>
          {toggleTheme && !collapsed && (
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {isDarkMode ? (
                <>
                  <Sun size={18} />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon size={18} />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>
          )}
          
          {!collapsed && (
            <div className={`mt-3 px-4 py-3 rounded-2xl ${
              isDarkMode 
                ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20' 
                : 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white' 
                    : 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white'
                }`}>
                  {role === 'entrepreneur' ? 'E' : role === 'deliverer' ? 'D' : 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {role === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                  </p>
                  <p className={`text-xs truncate ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  }`}>
                    Status: Online
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modal Mobile Fechar */}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed top-4 right-4 z-50 p-2 bg-[#111] rounded-xl text-white"
        >
          <X size={20} />
        </button>
      )}
    </>
  );
}

// Adicione os componentes Sun e Moon que faltam
const Sun = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2"/>
    <path d="M12 20v2"/>
    <path d="m4.93 4.93 1.41 1.41"/>
    <path d="m17.66 17.66 1.41 1.41"/>
    <path d="M2 12h2"/>
    <path d="M20 12h2"/>
    <path d="m6.34 17.66-1.41 1.41"/>
    <path d="m19.07 4.93-1.41 1.41"/>
  </svg>
);

const Moon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
);