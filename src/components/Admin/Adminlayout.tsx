// src/components/Admin/Adminlayout.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import {
  LayoutDashboard, Users, Package, Settings, LogOut,
  Menu, X, Shield, ChevronRight, Sun, Moon, Bell,
  CreditCard, Activity,
} from 'lucide-react'

interface AdminLayoutProps { children: React.ReactNode }

const navItems = [
  { path: '/admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/admin/users',         label: 'Utilizadores',  icon: Users           },
  { path: '/admin/deliveries',    label: 'Entregas',      icon: Package         },
  { path: '/admin/subscriptions', label: 'Subscrições',   icon: CreditCard      },
  { path: '/admin/broadcast',     label: 'Notificações',  icon: Bell            },
  { path: '/admin/activity-log',  label: 'Actividade',    icon: Activity        },
  { path: '/admin/settings',      label: 'Configurações', icon: Settings        },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isDark, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, signOut } = useAuth()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const isActive = (p: string) =>
    location.pathname === p || location.pathname.startsWith(p + '/')

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const active = isActive(item.path)
    const Icon   = item.icon
    return (
      <button
        onClick={() => navigate(item.path)}
        className={`
          group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200 relative
          ${active
            ? isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'
            : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }
        `}
      >
        {active && (
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full ${isDark ? 'bg-orange-400' : 'bg-orange-500'}`}/>
        )}
        <Icon size={17} className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? (isDark ? 'text-orange-400' : 'text-orange-500') : ''}`}/>
        <span className="flex-1 text-left">{item.label}</span>
        {active && <ChevronRight size={13} className={isDark ? 'text-orange-400/50' : 'text-orange-400/60'}/>}
      </button>
    )
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`p-5 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Shield size={17} className="text-white"/>
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"
              style={{ boxShadow: `0 0 0 2px ${isDark ? '#0d0d0d' : '#ffffff'}` }}/>
          </div>
          <div>
            <p className={`font-black tracking-widest text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>ZOMAR</p>
            <p className="text-orange-400 text-[10px] font-bold uppercase tracking-widest -mt-0.5">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto zomar-scrollbar">
        <p className={`px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Menu
        </p>
        {navItems.map(item => <NavItem key={item.path} item={item}/>)}
      </nav>

      {/* Bottom */}
      <div className={`p-3 space-y-1 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <button onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            isDark ? 'text-gray-400 hover:text-yellow-300 hover:bg-yellow-400/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}>
          {isDark
            ? <Sun size={17} className="text-yellow-400"/>
            : <Moon size={17}/>
          }
          {isDark ? 'Modo Claro' : 'Modo Escuro'}
        </button>

        {user && (
          <div className={`px-3 py-2.5 rounded-xl ${isDark ? 'bg-white/3' : 'bg-gray-50 border border-gray-100'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {(user.full_name || user.email || 'A').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {user.full_name || user.email}
                </p>
                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Administrador</p>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSignOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/8' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
          }`}>
          <LogOut size={17}/> Terminar Sessão
        </button>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        .zomar-scrollbar { scrollbar-width:thin; scrollbar-color:${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'} transparent; }
        .zomar-scrollbar::-webkit-scrollbar { width:4px; height:4px; }
        .zomar-scrollbar::-webkit-scrollbar-track { background:transparent; }
        .zomar-scrollbar::-webkit-scrollbar-thumb { background:${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'}; border-radius:99px; }
        .zomar-scrollbar::-webkit-scrollbar-thumb:hover { background:rgba(249,115,22,0.4); }
        .zomar-select option { background:${isDark ? '#1a1a1a' : '#ffffff'}; color:${isDark ? '#f3f4f6' : '#111827'}; }
        @keyframes pageIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .page-enter { animation:pageIn 0.22s ease-out forwards; }
      `}</style>

      <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-[#111111] text-white' : 'bg-gray-50 text-gray-900'}`}>

        {/* Desktop sidebar */}
        <aside className={`hidden lg:flex flex-col w-60 flex-shrink-0 border-r sticky top-0 h-screen transition-colors duration-300 ${isDark ? 'bg-[#0d0d0d] border-white/5' : 'bg-white border-gray-200'}`}>
          <Sidebar/>
        </aside>

        {/* Mobile overlay */}
        <div className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}/>
          <aside className={`relative z-10 w-60 h-full flex flex-col border-r transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDark ? 'bg-[#0d0d0d] border-white/5' : 'bg-white border-gray-200'}`}>
            <button className={`absolute top-4 right-4 p-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setSidebarOpen(false)}>
              <X size={18}/>
            </button>
            <Sidebar/>
          </aside>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className={`sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md transition-colors duration-300 ${isDark ? 'bg-[#111111]/90 border-white/5' : 'bg-white/90 border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)}
                className={`lg:hidden p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Menu size={20}/>
              </button>
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-orange-400"/>
                <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {navItems.find(n => isActive(n.path))?.label || 'Admin'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleTheme}
                className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-all ${isDark ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/8' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                {isDark ? <Sun size={17}/> : <Moon size={17}/>}
              </button>
              <button onClick={() => navigate('/admin/broadcast')}
                className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Bell size={17}/>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full"/>
              </button>
            </div>
          </header>

          {/* Page */}
          <main key={location.pathname}
            className={`flex-1 p-4 md:p-6 overflow-auto zomar-scrollbar ${mounted ? 'page-enter' : 'opacity-0'}`}>
            {children}
          </main>
        </div>
      </div>
    </>
  )
}