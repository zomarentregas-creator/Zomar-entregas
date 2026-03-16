/**
 * ============================================================================
 * LAYOUT PRINCIPAL — ZOMAR
 * ============================================================================
 *
 * Totalmente funcional:
 * - Tema sincronizado com localStorage (persistido entre sessões)
 * - Badges reais carregados do Supabase (entregas ativas, notificações, pagamentos)
 * - Stats do entregador calculadas a partir de dados reais do dia
 * - Realtime: badges e stats atualizam automaticamente
 * - Nome da marca corrigido para ZOMAR
 *
 * @version 4.0 (Fully Functional)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar/Sidebar';
import Header from './Header';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: React.ReactNode;
  userType: 'entrepreneur' | 'deliverer';
}

interface Badges {
  activeDeliveries: number;
  notifications: number;
  pendingPayments: number;
}

interface DelivererStats {
  deliveriesToday: number;
  earningsToday: number;
  activeTimeMinutes: number | null; // null = sem dados suficientes
  efficiencyRate: number | null;    // null = sem dados suficientes
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Início do dia atual em ISO string (meia-noite local → UTC) */
const startOfToday = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Formata minutos em "Xh Ym" */
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

/** Formata valor monetário em BRL */
const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function Layout({ children, userType }: LayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Tema persistido — mesma chave usada em EntrepreneurLayout e Overview ──
  const themeKey = userType === 'entrepreneur' ? 'entrepreneur_theme' : 'deliverer_theme';

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(themeKey) !== 'light';
  });

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem(themeKey, next ? 'dark' : 'light');
      return next;
    });
  }, [themeKey]);

  // Sincroniza se o tema mudar noutro componente/aba
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === themeKey) {
        setIsDarkMode(e.newValue !== 'light');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [themeKey]);

  // ── Badges reais ──────────────────────────────────────────────────────────

  const [badges, setBadges] = useState<Badges>({
    activeDeliveries: 0,
    notifications: 0,
    pendingPayments: 0,
  });

  const loadBadges = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (userType === 'entrepreneur') {
        // Entregas ativas do empreendedor
        const { count: activeCount } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('entrepreneur_id', user.id)
          .in('current_status', ['created', 'accepted', 'in_progress']);

        // Notificações não lidas
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        // Pagamentos/subscrições pendentes
        const { count: paymentCount } = await supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'pending');

        setBadges({
          activeDeliveries: activeCount ?? 0,
          notifications:    notifCount ?? 0,
          pendingPayments:  paymentCount ?? 0,
        });

      } else {
        // Entregas ativas do entregador
        const { count: activeCount } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('deliverer_id', user.id)
          .in('current_status', ['accepted', 'in_progress']);

        // Notificações não lidas
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        // Pagamentos pendentes do entregador (ex: saques em processamento)
        const { count: paymentCount } = await supabase
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('deliverer_id', user.id)
          .eq('status', 'pending')
          .catch(() => ({ count: 0 })); // tabela pode não existir ainda

        setBadges({
          activeDeliveries: activeCount ?? 0,
          notifications:    notifCount ?? 0,
          pendingPayments:  paymentCount ?? 0,
        });
      }
    } catch {
      // Falha silenciosa — badges ficam em 0
    }
  }, [user?.id, userType]);

  // ── Stats do entregador (apenas para userType === 'deliverer') ────────────

  const [delivererStats, setDelivererStats] = useState<DelivererStats>({
    deliveriesToday: 0,
    earningsToday: 0,
    activeTimeMinutes: null,
    efficiencyRate: null,
  });

  const loadDelivererStats = useCallback(async () => {
    if (!user?.id || userType !== 'deliverer') return;
    try {
      const today = startOfToday();

      // Entregas do dia
      const { data: todayDeliveries } = await supabase
        .from('deliveries')
        .select('id, current_status, estimated_value, deliverer_fee, created_at, updated_at')
        .eq('deliverer_id', user.id)
        .gte('updated_at', today);

      const all = todayDeliveries || [];
      const completed = all.filter(d => d.current_status === 'completed');
      const problematic = all.filter(d => ['problem', 'cancelled'].includes(d.current_status));

      // Ganhos do dia — usa deliverer_fee se existir, senão fallback para % do estimated_value
      const earningsToday = completed.reduce((sum, d) => {
        const fee = d.deliverer_fee ?? (d.estimated_value * 0.8); // 80% do valor como fallback
        return sum + fee;
      }, 0);

      // Tempo ativo — soma das durações das entregas concluídas hoje
      const activeTimeMinutes = completed.length > 0
        ? Math.round(
            completed.reduce((sum, d) => {
              const start = new Date(d.created_at).getTime();
              const end   = new Date(d.updated_at).getTime();
              return sum + (end - start) / (1000 * 60);
            }, 0)
          )
        : null;

      // Taxa de eficiência — concluídas / (concluídas + problemáticas)
      const relevant = completed.length + problematic.length;
      const efficiencyRate = relevant > 0
        ? Math.round((completed.length / relevant) * 100)
        : null;

      setDelivererStats({
        deliveriesToday: completed.length,
        earningsToday,
        activeTimeMinutes,
        efficiencyRate,
      });
    } catch {
      // Falha silenciosa
    }
  }, [user?.id, userType]);

  // ── Carregamento inicial ──────────────────────────────────────────────────

  useEffect(() => {
    loadBadges();
    loadDelivererStats();
  }, [loadBadges, loadDelivererStats]);

  // ── Realtime — atualiza badges e stats quando há mudanças ────────────────

  useEffect(() => {
    if (!user?.id) return;

    const deliveriesFilter = userType === 'entrepreneur'
      ? `entrepreneur_id=eq.${user.id}`
      : `deliverer_id=eq.${user.id}`;

    const deliveriesChannel = supabase
      .channel('layout-deliveries')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deliveries',
        filter: deliveriesFilter,
      }, () => {
        loadBadges();
        loadDelivererStats();
      })
      .subscribe();

    const notificationsChannel = supabase
      .channel('layout-notifications')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadBadges();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(deliveriesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user?.id, userType, loadBadges, loadDelivererStats]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`flex min-h-screen transition-colors duration-300 ${
      isDarkMode
        ? 'bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
    }`}>

      {/* Sidebar com badges reais */}
      <Sidebar
        role={userType}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        badges={badges}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col">
        <Header isDarkMode={isDarkMode} userType={userType} />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">

            {/* Container principal */}
            <div className={`rounded-[2rem] overflow-hidden ${
              isDarkMode
                ? 'bg-[#121212]/80 backdrop-blur-sm border border-white/5 shadow-2xl'
                : 'bg-white/80 backdrop-blur-sm border border-gray-200 shadow-xl'
            }`}>

              {/* Banner de cabeçalho */}
              <div className={`p-6 md:p-8 border-b ${
                isDarkMode
                  ? 'bg-gradient-to-r from-emerald-600/20 to-emerald-900/10 border-white/5'
                  : 'bg-gradient-to-r from-emerald-50 to-emerald-100/30 border-gray-200'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black italic tracking-tight">
                      {userType === 'deliverer' ? 'DASHBOARD ENTREGADOR' : 'DASHBOARD EMPREENDEDOR'}
                    </h1>
                    <p className={`text-sm mt-2 ${
                      isDarkMode ? 'text-emerald-200/70' : 'text-emerald-600'
                    }`}>
                      {userType === 'deliverer'
                        ? 'Gerencie suas entregas e maximize seus ganhos'
                        : 'Acompanhe suas encomendas e expanda seu negócio'}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest self-start md:self-auto ${
                    isDarkMode
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${
                        isDarkMode ? 'bg-emerald-400' : 'bg-emerald-500'
                      }`} />
                      <span>Online</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conteúdo children */}
              <div className="p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </div>

            {/* Stats do Entregador — dados reais */}
            {userType === 'deliverer' && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'ENTREGAS HOJE',
                    value: String(delivererStats.deliveriesToday),
                    color: 'emerald',
                    empty: delivererStats.deliveriesToday === 0,
                  },
                  {
                    label: 'GANHOS DIÁRIOS',
                    value: formatBRL(delivererStats.earningsToday),
                    color: 'emerald',
                    empty: delivererStats.earningsToday === 0,
                  },
                  {
                    label: 'TEMPO ATIVO',
                    value: delivererStats.activeTimeMinutes !== null
                      ? formatMinutes(delivererStats.activeTimeMinutes)
                      : '—',
                    color: 'blue',
                    empty: delivererStats.activeTimeMinutes === null,
                  },
                  {
                    label: 'EFICIÊNCIA',
                    value: delivererStats.efficiencyRate !== null
                      ? `${delivererStats.efficiencyRate}%`
                      : '—',
                    color: 'purple',
                    empty: delivererStats.efficiencyRate === null,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`p-4 rounded-2xl border transition-all ${
                      isDarkMode
                        ? `bg-[#121212] border-${stat.color}-500/20 hover:border-${stat.color}-500/50`
                        : `bg-white border-${stat.color}-200 hover:border-${stat.color}-300`
                    }`}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {stat.label}
                    </p>
                    <p className={`text-xl md:text-2xl font-black mt-2 ${
                      stat.empty
                        ? isDarkMode ? 'text-gray-600' : 'text-gray-300'
                        : isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {stat.value}
                    </p>
                    {stat.empty && (
                      <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-700' : 'text-gray-400'}`}>
                        sem dados hoje
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <footer className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-gray-200'}`}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  © {new Date().getFullYear()} ZOMAR • {userType === 'deliverer' ? 'Entregador' : 'Empreendedor'}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  {[
                    { label: 'Ajuda',    path: `/${userType}/help` },
                    { label: 'Suporte',  path: `/${userType}/help` },
                    { label: 'Termos',   path: `/${userType}/terms` },
                  ].map(({ label, path }) => (
                    <button
                      key={label}
                      onClick={() => navigate(path)}
                      className={`transition-colors ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </footer>

          </div>
        </main>
      </div>
    </div>
  );
}