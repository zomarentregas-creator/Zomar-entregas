import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, User, LogOut, Package, Truck, 
  Menu, X, Settings, HelpCircle, Search,
  Sun, Moon, ChevronDown, Zap
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface HeaderProps {
  userType: 'entrepreneur' | 'deliverer'
  isDarkMode?: boolean
  toggleTheme?: () => void
}

export default function Header({ userType, isDarkMode = true, toggleTheme }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const getUserName = (): string => {
    if (user?.full_name) return user.full_name
    if (user?.email) return user.email.split('@')[0]
    return 'Usuário'
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-lg ${
      isDarkMode 
        ? 'bg-[#121212]/95 border-white/5' 
        : 'bg-white/95 border-gray-200'
    }`}>
      <div className="px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo e Título - Esquerda */}
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              {menuOpen ? (
                <X className={isDarkMode ? 'text-gray-300' : 'text-gray-700'} size={20} />
              ) : (
                <Menu className={isDarkMode ? 'text-gray-300' : 'text-gray-700'} size={20} />
              )}
            </button>
            
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30' 
                  : 'bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-200'
              }`}>
                {userType === 'entrepreneur' ? (
                  <Package className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} size={22} />
                ) : (
                  <Truck className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} size={22} />
                )}
              </div>
              
              <div className="hidden md:block">
                <h1 className="text-lg font-black tracking-tight italic">
                  {userType === 'entrepreneur' ? 'DASHBOARD EMPREENDEDOR' : 'DASHBOARD ENTREGADOR'}
                </h1>
                <p className={`text-xs mt-0.5 ${
                  isDarkMode ? 'text-emerald-400/70' : 'text-emerald-600'
                }`}>
                  {userType === 'entrepreneur' ? 'Gerencie suas entregas' : 'Maximize seus ganhos'}
                </p>
              </div>
            </div>
          </div>

          {/* Barra de Busca - Centro */}
          <div className="hidden lg:flex flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`} size={18} />
              <input
                type="text"
                placeholder={userType === 'entrepreneur' 
                  ? 'Buscar encomendas, clientes...' 
                  : 'Buscar entregas, localizações...'
                }
                className={`w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm font-medium ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-emerald-500/50' 
                    : 'bg-gray-50/80 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-emerald-400'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all`}
              />
            </div>
          </div>

          {/* Botão de Busca Mobile */}
          <button
            onClick={() => setSearchOpen(true)}
            className="lg:hidden p-2.5 rounded-xl hover:bg-white/5 transition-colors"
          >
            <Search className={isDarkMode ? 'text-gray-300' : 'text-gray-600'} size={20} />
          </button>

          {/* Ações - Direita */}
          <div className="flex items-center gap-2">
            
            {/* Tema */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-xl border ${
                  isDarkMode 
                    ? 'border-white/10 bg-white/5 hover:bg-white/10' 
                    : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
                } transition-colors`}
                title={isDarkMode ? 'Modo claro' : 'Modo escuro'}
              >
                {isDarkMode ? (
                  <Sun className="text-yellow-400" size={18} />
                ) : (
                  <Moon className="text-gray-700" size={18} />
                )}
              </button>
            )}

            {/* Notificações */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`p-2.5 rounded-xl border relative ${
                  isDarkMode 
                    ? 'border-white/10 bg-white/5 hover:bg-white/10' 
                    : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
                } transition-colors`}
              >
                <Bell className={isDarkMode ? 'text-gray-300' : 'text-gray-700'} size={18} />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#121212]">
                  3
                </span>
              </button>
              
              {notificationsOpen && (
                <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border z-50 ${
                  isDarkMode 
                    ? 'bg-[#1a1a1a] border-white/10' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="p-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">Notificações</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        3 novas
                      </span>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    <div className={`p-4 border-b ${
                      isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
                    } cursor-pointer`}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Zap className="text-emerald-400" size={16} />
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            Nova entrega disponível
                          </p>
                          <p className={`text-xs mt-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Há 5 minutos • R$ 45,80
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`p-4 border-b ${
                      isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
                    } cursor-pointer`}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Package className="text-green-400" size={16} />
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            Entrega concluída com sucesso
                          </p>
                          <p className={`text-xs mt-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Há 2 horas • Avaliação: 5.0
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-4 border-t ${
                    isDarkMode ? 'border-white/5' : 'border-gray-200'
                  }`}>
                    <button className={`w-full text-center text-sm font-medium ${
                      isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                    } transition-colors`}>
                      Ver todas as notificações
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Perfil */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  menuOpen 
                    ? 'border-emerald-500/50 bg-emerald-500/10' 
                    : isDarkMode 
                      ? 'border-white/10 bg-white/5 hover:border-emerald-500/30' 
                      : 'border-gray-300 bg-gray-100 hover:border-emerald-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
                  isDarkMode 
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white' 
                    : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                }`}>
                  {getUserName().charAt(0).toUpperCase()}
                </div>
                
                <div className="hidden md:block text-left">
                  <p className={`text-sm font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {getUserName()}
                  </p>
                  <p className={`text-xs ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  } flex items-center gap-1`}>
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    {userType === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                  </p>
                </div>
                
                <ChevronDown className={`hidden md:block transition-transform ${
                  menuOpen ? 'rotate-180' : ''
                } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} size={16} />
              </button>

              {menuOpen && (
                <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border z-50 ${
                  isDarkMode 
                    ? 'bg-[#1a1a1a] border-white/10' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="p-4 border-b border-white/5">
                    <p className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {getUserName()}
                    </p>
                    <p className={`text-sm mt-1 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {user?.email}
                    </p>
                  </div>
                  
                  <div className="py-2">
                    <button
                      onClick={() => {
                        navigate('/profile')
                        setMenuOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${
                        isDarkMode 
                          ? 'text-gray-300 hover:bg-white/5' 
                          : 'text-gray-700 hover:bg-gray-100'
                      } transition-colors`}
                    >
                      <User size={16} />
                      Meu Perfil
                    </button>
                    
                    {userType === 'entrepreneur' && (
                      <button
                        onClick={() => {
                          navigate('/subscription')
                          setMenuOpen(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${
                          isDarkMode 
                            ? 'text-gray-300 hover:bg-white/5' 
                            : 'text-gray-700 hover:bg-gray-100'
                        } transition-colors`}
                      >
                        <Package size={16} />
                        Minha Assinatura
                      </button>
                    )}
                    
                    {userType === 'deliverer' && (
                      <button
                        onClick={() => {
                          navigate('/earnings')
                          setMenuOpen(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${
                          isDarkMode 
                            ? 'text-gray-300 hover:bg-white/5' 
                            : 'text-gray-700 hover:bg-gray-100'
                        } transition-colors`}
                      >
                        <Truck size={16} />
                        Meus Ganhos
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setMenuOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${
                        isDarkMode 
                          ? 'text-gray-300 hover:bg-white/5' 
                          : 'text-gray-700 hover:bg-gray-100'
                      } transition-colors`}
                    >
                      <Settings size={16} />
                      Configurações
                    </button>
                    
                    <button
                      onClick={() => {
                        navigate('/help')
                        setMenuOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${
                        isDarkMode 
                          ? 'text-gray-300 hover:bg-white/5' 
                          : 'text-gray-700 hover:bg-gray-100'
                      } transition-colors`}
                    >
                      <HelpCircle size={16} />
                      Ajuda
                    </button>
                  </div>
                  
                  <div className={`border-t py-2 ${
                    isDarkMode ? 'border-white/5' : 'border-gray-200'
                  }`}>
                    <button
                      onClick={handleLogout}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${
                        isDarkMode 
                          ? 'text-red-400 hover:bg-red-500/10' 
                          : 'text-red-600 hover:bg-red-50'
                      } transition-colors`}
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Busca Mobile */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden">
          <div className={`p-4 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <Search className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} size={20} />
              <input
                type="text"
                placeholder="Buscar..."
                className={`flex-1 py-3 bg-transparent border-0 focus:outline-none text-lg ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}
                autoFocus
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="p-2"
              >
                <X className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}