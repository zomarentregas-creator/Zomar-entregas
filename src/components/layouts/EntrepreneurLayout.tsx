'use client';

import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Package, History, PlusCircle, Bell,
  User, Settings, HelpCircle, CreditCard, BarChart,
  LogOut, Menu, X, ChevronDown, ChevronRight,
  Sun, Moon, Store, Bot, Phone, Mail, Send,
  Loader2, MessageCircle, Minimize2,
} from 'lucide-react';

interface EntrepreneurLayoutProps { children: React.ReactNode }

/* ─── inline SupportButton ─── */
interface SupportMsg { id: string; role: 'user' | 'assistant'; content: string }

function SupportButton({ isDarkMode }: { isDarkMode: boolean }) {
  const { user } = useAuth() as any;
  const [open, setOpen]       = useState(false);
  const [view, setView]       = useState<'menu' | 'chat'>('menu');
  const [msgs, setMsgs]       = useState<SupportMsg[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [mini, setMini]       = useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const dk = (d: string, l: string) => isDarkMode ? d : l;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs]);

  const openChat = () => {
    setView('chat');
    if (msgs.length === 0) setMsgs([{ id: '0', role: 'assistant',
      content: `Olá${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}! 👋 Sou o assistente ZOMAR. Como posso ajudar?` }]);
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: SupportMsg = { id: Date.now().toString(), role: 'user', content: text.trim() };
    setMsgs(p => [...p, userMsg]); setInput(''); setLoading(true);
    try {
      const history = [...msgs, userMsg].filter(m => m.id !== '0').map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: 'És o assistente virtual da ZOMAR, plataforma de entregas em Moçambique. Respondes em Português, és conciso e útil. Máximo 3 parágrafos por resposta.',
          messages: history }),
      });
      const data = await res.json();
      const reply = data.content?.find((b: any) => b.type === 'text')?.text || 'Desculpa, tenta novamente.';
      setMsgs(p => [...p, { id: (Date.now()+1).toString(), role: 'assistant', content: reply }]);
    } catch {
      setMsgs(p => [...p, { id: (Date.now()+1).toString(), role: 'assistant', content: 'Erro de ligação. Tenta via WhatsApp.' }]);
    } finally { setLoading(false); }
  };

  const QUICK = ['Como criar uma entrega?', 'Como alterar o meu plano?', 'Problemas com pagamento'];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && !mini && (
        <div className={`w-80 rounded-2xl border shadow-2xl overflow-hidden ${dk('bg-[#141414] border-white/10','bg-white border-gray-200')}`}
          style={{ maxHeight: view === 'chat' ? 480 : 'auto' }}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${dk('border-white/8 bg-[#1a1a1a]','border-gray-100 bg-gray-50')}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Bot size={15} className="text-white" />
              </div>
              <div>
                <p className={`text-sm font-bold ${dk('text-white','text-gray-900')}`}>Suporte ZOMAR</p>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><p className={`text-[10px] ${dk('text-gray-500','text-gray-500')}`}>Online</p></div>
              </div>
            </div>
            <div className="flex gap-1">
              {view === 'chat' && <button onClick={() => setView('menu')} className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8','text-gray-500 hover:bg-gray-100')}`}><ChevronRight size={13} className="rotate-180" /></button>}
              <button onClick={() => setMini(true)} className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8','text-gray-500 hover:bg-gray-100')}`}><Minimize2 size={13} /></button>
              <button onClick={() => { setOpen(false); setView('menu'); }} className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8','text-gray-500 hover:bg-gray-100')}`}><X size={13} /></button>
            </div>
          </div>

          {view === 'menu' && (
            <div className="p-4 space-y-2.5">
              <p className={`text-xs ${dk('text-gray-400','text-gray-500')}`}>Como preferes ser atendido?</p>
              {[
                { icon: <Bot size={17} className="text-emerald-400"/>, bg:'bg-emerald-500/15', title:'Assistente Virtual', sub:'Respostas instantâneas com IA', action: openChat },
                { icon: <Phone size={17} className="text-green-400"/>, bg:'bg-green-500/15',   title:'WhatsApp', sub:'+258 84 258 9799', action:() => window.open('https://wa.me/258842589799','_blank') },
                { icon: <Mail size={17} className="text-blue-400"/>,  bg:'bg-blue-500/15',    title:'Email', sub:'zomarentregas@gmail.com', action:() => window.open('mailto:zomarentregas@gmail.com','_blank') },
              ].map(opt => (
                <button key={opt.title} onClick={opt.action}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${dk('border-white/8 hover:border-white/18 hover:bg-white/5','border-gray-200 hover:border-gray-300 hover:bg-gray-50')}`}>
                  <div className={`p-2 rounded-lg ${opt.bg}`}>{opt.icon}</div>
                  <div><p className={`text-sm font-bold ${dk('text-white','text-gray-900')}`}>{opt.title}</p><p className={`text-xs ${dk('text-gray-500','text-gray-500')}`}>{opt.sub}</p></div>
                  <ChevronRight size={13} className={`ml-auto ${dk('text-gray-600','text-gray-400')}`} />
                </button>
              ))}
            </div>
          )}

          {view === 'chat' && (
            <div className="flex flex-col" style={{ height:380 }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth:'none' }}>
                {msgs.length <= 1 && (
                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${dk('text-gray-600','text-gray-400')}`}>Perguntas rápidas</p>
                    {QUICK.map(q => (
                      <button key={q} onClick={() => send(q)}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${dk('border-white/8 text-gray-300 hover:bg-white/5','border-gray-200 text-gray-600 hover:bg-gray-50')}`}>{q}</button>
                    ))}
                  </div>
                )}
                {msgs.map(m => (
                  <div key={m.id} className={`flex gap-2 ${m.role==='user'?'justify-end':'justify-start'}`}>
                    {m.role==='assistant' && <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex-shrink-0 flex items-center justify-center mt-0.5"><Bot size={11} className="text-white" /></div>}
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${m.role==='user'?'bg-emerald-500 text-black rounded-br-sm':dk('bg-white/8 text-gray-200 rounded-bl-sm','bg-gray-100 text-gray-700 rounded-bl-sm')}`}>{m.content}</div>
                  </div>
                ))}
                {loading && <div className="flex gap-2"><div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center"><Bot size={11} className="text-white"/></div><div className={`px-3 py-2 rounded-xl ${dk('bg-white/8','bg-gray-100')}`}><Loader2 size={13} className={`animate-spin ${dk('text-gray-400','text-gray-500')}`}/></div></div>}
                <div ref={endRef} />
              </div>
              <div className={`p-3 border-t ${dk('border-white/8','border-gray-100')}`}>
                <div className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send(input)}
                    placeholder="Escreve uma mensagem..."
                    className={`flex-1 px-3 py-2 rounded-xl text-xs border focus:outline-none transition-all ${dk('bg-white/8 border-white/10 text-white placeholder-gray-600 focus:border-white/25','bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300')}`} />
                  <button onClick={() => send(input)} disabled={!input.trim()||loading}
                    className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40"><Send size={13}/></button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {open && mini && (
        <button onClick={() => setMini(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg ${dk('bg-[#1a1a1a] border-white/10 text-white','bg-white border-gray-200 text-gray-900')}`}>
          <MessageCircle size={15} className="text-emerald-400"/><span className="text-sm font-medium">Suporte</span>
        </button>
      )}

      {!mini && (
        <button onClick={() => { setOpen(p=>!p); setMini(false); if (!open) setView('menu'); }}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all">
          {open ? <X size={22} className="text-white"/> : <MessageCircle size={22} className="text-white"/>}
          {!open && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-black flex items-center justify-center"><span className="text-[8px] text-white font-black">!</span></span>}
        </button>
      )}
    </div>
  );
}

/* ─── main layout ─── */
const EntrepreneurLayout: React.FC<EntrepreneurLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    localStorage.getItem('entrepreneur_theme') !== 'light'
  );
  useEffect(() => {
    const h = (e: StorageEvent) => { if (e.key==='entrepreneur_theme') setIsDarkMode(e.newValue!=='light'); };
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h);
  }, []);
  const toggleTheme = () => { setIsDarkMode(p => { const n=!p; localStorage.setItem('entrepreneur_theme', n?'dark':'light'); return n; }); };

  const styles = `
    .zomar-scrollbar::-webkit-scrollbar{width:5px}
    .zomar-scrollbar::-webkit-scrollbar-track{background:transparent}
    .zomar-scrollbar::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#10b981,#059669);border-radius:10px}
    [data-tip]{position:relative}
    [data-tip]::after{
      content:attr(data-tip);
      position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);
      background:#1a1a1a;color:#e5e5e5;font-size:11px;font-weight:600;
      padding:5px 10px;border-radius:7px;white-space:nowrap;pointer-events:none;
      border:1px solid rgba(255,255,255,.1);z-index:9999;
      opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s;
      box-shadow:0 4px 12px rgba(0,0,0,.5);
    }
    [data-tip]::before{
      content:'';position:absolute;left:calc(100% + 5px);top:50%;transform:translateY(-50%);
      border:5px solid transparent;border-right-color:#1a1a1a;
      opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s;z-index:9999;
    }
    [data-tip]:hover::after,[data-tip]:hover::before{opacity:1;visibility:visible}
  `;

  const menuItems = [
    { path:'/entrepreneur/overview',          icon:<BarChart size={17}/>,   label:'Visão Geral',    tip:'Resumo das suas actividades' },
    { path:'/entrepreneur/active-deliveries', icon:<Package size={17}/>,    label:'Entregas Ativas', tip:'Entregas em andamento' },
    { path:'/entrepreneur/new-delivery',      icon:<PlusCircle size={17}/>, label:'Nova Entrega',   tip:'Criar uma nova entrega' },
    { path:'/entrepreneur/delivery-history',  icon:<History size={17}/>,    label:'Histórico',      tip:'Entregas concluídas' },
    { path:'/entrepreneur/subscription',      icon:<CreditCard size={17}/>, label:'Plano',          tip:'Gerir subscrição' },
  ];

  const accountItems = [
    { path:'/entrepreneur/profile',       icon:<User size={17}/>,       label:'Perfil',        tip:'Informações pessoais e foto' },
    { path:'/entrepreneur/notifications', icon:<Bell size={17}/>,       label:'Notificações',  tip:'Ver todas as notificações' },
    { path:'/entrepreneur/settings',      icon:<Settings size={17}/>,   label:'Configurações', tip:'Preferências da conta' },
    { path:'/entrepreneur/help',          icon:<HelpCircle size={17}/>, label:'Ajuda',         tip:'Centro de ajuda e suporte' },
  ];

  const handleLogout = async () => {
    try { await signOut(); localStorage.clear(); sessionStorage.clear(); navigate('/login',{replace:true}); }
    catch { window.location.href='/login'; }
  };

  const getCurrentPageTitle = () =>
    [...menuItems,...accountItems].find(i => location.pathname===i.path)?.label ?? 'Dashboard';

  const { notifications, unreadCount, markAsRead } = useNotifications(user?.id);
  const dk = (d: string, l: string) => isDarkMode ? d : l;

  const NavLink = ({ item }: { item: typeof menuItems[0] }) => {
    const active = location.pathname === item.path;
    return (
      <Link to={item.path} onClick={() => setSidebarOpen(false)}
        data-tip={item.tip}
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-150 group text-sm font-medium ${
          active
            ? dk('bg-emerald-500/10 text-emerald-400 border-emerald-500/30','bg-emerald-100 text-emerald-700 border-emerald-200')
            : dk('border-transparent text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/8','border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-200')
        }`}>
        <div className="flex items-center gap-2.5">
          <span className={`transition-transform duration-150 ${active?'scale-110':'group-hover:scale-105'}`}>{item.icon}</span>
          <span>{item.label}</span>
        </div>
        {active && <ChevronRight size={11} className="opacity-40"/>}
      </Link>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${dk('bg-[#0a0a0a] text-white','bg-gray-50 text-gray-900')}`}>
      <style>{styles}</style>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)}/>}

      {/* ══ SIDEBAR ══ */}
      <aside className={`fixed left-0 top-0 h-full w-60 flex flex-col z-50 transform transition-transform duration-300 ${
        dk('bg-[#0f0f0f] border-r border-white/5','bg-white border-r border-gray-200')
      } ${sidebarOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}`}>

        <div className={`p-4 flex items-center justify-between border-b ${dk('border-white/5','border-gray-100')}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${dk('bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_0_14px_rgba(16,185,129,.4)]','bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-md')}`}>
              <Store size={17}/>
            </div>
            <div>
              <h1 className={`text-base font-black italic ${dk('text-white','text-gray-900')}`}>ZOMAR</h1>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${dk('text-emerald-500','text-emerald-600')}`}>Empreendedor</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5">
            <X size={15} className={dk('text-gray-400','text-gray-500')}/>
          </button>
        </div>

        <div className="flex-1 px-2.5 py-3 overflow-y-auto zomar-scrollbar space-y-4">
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-widest px-2 mb-1.5 ${dk('text-gray-600','text-gray-400')}`}>Menu</p>
            <nav className="space-y-0.5">
              {menuItems.map(item => <NavLink key={item.path} item={item}/>)}
            </nav>
          </div>
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-widest px-2 mb-1.5 ${dk('text-gray-600','text-gray-400')}`}>Conta</p>
            <nav className="space-y-0.5">
              {accountItems.map(item => <NavLink key={item.path} item={item}/>)}
            </nav>
          </div>
        </div>

        <div className={`p-2.5 border-t space-y-1 ${dk('border-white/5','border-gray-100')}`}>
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${dk('bg-white/4 border border-white/6','bg-gray-50 border border-gray-200')}`}>
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black ${dk('bg-gradient-to-br from-emerald-500 to-emerald-600 text-white','bg-gradient-to-br from-emerald-400 to-emerald-500 text-white')}`}>
              {(user?.full_name||user?.email||'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold truncate ${dk('text-white','text-gray-900')}`}>{user?.full_name?.split(' ')[0]||'Utilizador'}</p>
              <p className={`text-[9px] ${dk('text-emerald-400','text-emerald-600')}`}>Empreendedor</p>
            </div>
          </div>
          <button onClick={toggleTheme}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${dk('text-gray-400 hover:text-white hover:bg-white/5','text-gray-600 hover:text-gray-900 hover:bg-gray-100')}`}>
            {isDarkMode?<><Sun size={13}/><span>Modo Claro</span></>:<><Moon size={13}/><span>Modo Escuro</span></>}
          </button>
          <button onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${dk('text-red-400 hover:bg-red-500/10','text-red-600 hover:bg-red-50')}`}>
            <LogOut size={13}/><span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="lg:pl-60">
        <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${dk('bg-black/50 border-white/5','bg-white/95 border-gray-200')}`}>
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/5">
                <Menu size={17} className={dk('text-gray-300','text-gray-700')}/>
              </button>
              <div>
                <h2 className={`text-sm font-bold ${dk('text-white','text-gray-900')}`}>{getCurrentPageTitle()}</h2>
                <p className={`text-[10px] ${dk('text-gray-500','text-gray-500')}`}>Gerencie as suas entregas</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${dk('bg-emerald-500/15 text-emerald-400 border border-emerald-500/20','bg-emerald-50 text-emerald-700 border border-emerald-200')}`}>
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Ativo
              </span>

              {/* Bell */}
              <div className="relative">
                <button data-tip="Notificações" onClick={() => setNotificationsOpen(p=>!p)}
                  className={`p-2 rounded-lg border relative transition-colors ${dk('border-white/10 bg-white/5 hover:bg-white/10','border-gray-200 bg-gray-50 hover:bg-gray-100')}`}>
                  <Bell size={15} className={dk('text-gray-300','text-gray-600')}/>
                  {unreadCount>0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">{unreadCount>9?'9+':unreadCount}</span>}
                </button>

                {notificationsOpen && (
                  <div className={`absolute right-0 mt-2 w-76 rounded-xl shadow-2xl border z-50 overflow-hidden ${dk('bg-[#111]/95 border-white/10 backdrop-blur-sm','bg-white border-gray-200')}`}>
                    <div className={`p-3 border-b flex items-center justify-between ${dk('border-white/5','border-gray-100')}`}>
                      <h3 className={`font-bold text-sm ${dk('text-white','text-gray-900')}`}>Notificações</h3>
                      {unreadCount>0 && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">{unreadCount} novas</span>}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length===0
                        ? <div className="p-8 text-center"><Bell size={24} className={`mx-auto mb-2 ${dk('text-gray-600','text-gray-300')}`}/><p className={`text-sm ${dk('text-gray-400','text-gray-600')}`}>Sem notificações</p></div>
                        : notifications.slice(0,5).map(n => (
                          <div key={n.id} onClick={() => { markAsRead(n.id); setNotificationsOpen(false); navigate('/entrepreneur/notifications'); }}
                            className={`px-4 py-3 border-b cursor-pointer transition-colors ${dk('border-white/5 hover:bg-white/5','border-gray-100 hover:bg-gray-50')} ${!n.read?dk('bg-orange-500/5','bg-orange-50/50'):''}`}>
                            <div className="flex items-start gap-2">
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5"/>}
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold truncate ${dk('text-white','text-gray-900')}`}>{n.title}</p>
                                <p className={`text-[11px] mt-0.5 truncate ${dk('text-gray-400','text-gray-500')}`}>{n.message}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    <div className={`p-2.5 border-t ${dk('border-white/5','border-gray-100')}`}>
                      <button onClick={() => { navigate('/entrepreneur/notifications'); setNotificationsOpen(false); }}
                        className={`w-full text-center text-xs font-medium py-1.5 rounded-lg transition-colors ${dk('text-emerald-400 hover:bg-white/5','text-emerald-600 hover:bg-gray-50')}`}>
                        Ver todas →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* User */}
              <div className="relative">
                <button data-tip="Menu do utilizador" onClick={() => setUserMenuOpen(p=>!p)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${
                    userMenuOpen?'border-emerald-500/50 bg-emerald-500/10'
                    :dk('border-white/10 bg-white/5 hover:border-emerald-500/30','border-gray-200 bg-gray-50 hover:border-emerald-300')
                  }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${dk('bg-gradient-to-br from-emerald-500 to-emerald-600 text-white','bg-gradient-to-br from-emerald-400 to-emerald-600 text-white')}`}>
                    {(user?.full_name||user?.email||'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className={`text-xs font-bold leading-tight ${dk('text-white','text-gray-900')}`}>{(user?.full_name||user?.email||'Utilizador').split(' ')[0]}</p>
                    <p className={`text-[9px] ${dk('text-emerald-400','text-emerald-600')}`}>Empreendedor</p>
                  </div>
                  <ChevronDown size={12} className={`hidden md:block transition-transform ${userMenuOpen?'rotate-180':''} ${dk('text-gray-400','text-gray-500')}`}/>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)}/>
                    <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-2xl border z-40 py-1 overflow-hidden ${dk('bg-[#111]/95 border-white/10 backdrop-blur-sm','bg-white border-gray-200')}`}>
                      {[
                        { to:'/entrepreneur/profile',   icon:<User size={13}/>,     label:'Meu Perfil' },
                        { to:'/entrepreneur/settings',  icon:<Settings size={13}/>, label:'Configurações' },
                      ].map(i => (
                        <Link key={i.to} to={i.to} onClick={() => setUserMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${dk('text-gray-300 hover:bg-white/5','text-gray-700 hover:bg-gray-100')}`}>
                          {i.icon}<span>{i.label}</span>
                        </Link>
                      ))}
                      <div className={`my-1 border-t ${dk('border-white/5','border-gray-100')}`}/>
                      <button onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${dk('text-red-400 hover:bg-red-500/10','text-red-600 hover:bg-red-50')}`}>
                        <LogOut size={13}/><span>Sair</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-4 lg:p-6">{children}</main>

        <footer className={`px-6 py-4 border-t text-xs ${dk('border-white/5 bg-black/20','border-gray-200')}`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <p className={dk('text-gray-500','text-gray-600')}>© {new Date().getFullYear()} ZOMAR • Empreendedor</p>
            <div className="flex items-center gap-4">
              {[
                { label:'Ajuda',  action:() => navigate('/entrepreneur/help') },
                { label:'Termos', action:() => navigate('/entrepreneur/terms') },
              ].map(b => (
                <button key={b.label} onClick={b.action} className={`transition-colors ${dk('text-gray-400 hover:text-white','text-gray-600 hover:text-gray-900')}`}>{b.label}</button>
              ))}
              <a href="https://wa.me/258842589799" target="_blank" rel="noopener noreferrer"
                className={`transition-colors ${dk('text-gray-400 hover:text-white','text-gray-600 hover:text-gray-900')}`}>Suporte</a>
            </div>
          </div>
        </footer>
      </div>

      {/* ══ SUPPORT BUTTON ══ */}
      <SupportButton isDarkMode={isDarkMode}/>
    </div>
  );
};

export default EntrepreneurLayout;