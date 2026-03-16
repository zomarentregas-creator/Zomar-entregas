'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, MapPin, DollarSign, Clock, User, Phone,
  Truck, Navigation, AlertCircle, CheckCircle, XCircle,
  Shield, Camera, MessageCircle, ArrowLeft, Calendar,
  Hash, FileText, Flag
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { createNotification } from '../../lib/Notificationservice';
import ReportProblemModal from './ReportProblemModal';

interface Checkpoint {
  id: string;
  status: string;
  location: string | null;
  description: string | null;
  created_at: string;
}

export default function DeliveryDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showProblemModal, setShowProblemModal] = useState(false);

  useEffect(() => {
    if (id) loadDelivery();
  }, [id]);

  const loadDelivery = async () => {
    try {
      setLoading(true);
      // Buscar entrega com dados do empreendedor e entregador
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          entrepreneur:profiles!deliveries_entrepreneur_id_fkey (
            full_name, phone, email
          ),
          deliverer:profiles!deliveries_deliverer_id_fkey (
            full_name, phone, email
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setDelivery(data);

      // Buscar checkpoints
      const { data: points, error: pointsError } = await supabase
        .from('delivery_checkpoints')
        .select('*')
        .eq('delivery_id', id)
        .order('created_at', { ascending: true });

      if (!pointsError) setCheckpoints(points || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!delivery || !user) return;
    setUpdating(true);
    try {
      const updates: any = {
        current_status: newStatus,
        updated_at: new Date().toISOString()
      };
      if (newStatus === 'in_progress') updates.picked_up_at = new Date().toISOString();
      if (newStatus === 'completed') updates.delivered_at = new Date().toISOString();

      const { error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', delivery.id);

      if (error) throw error;

      // Adicionar checkpoint automático
      await supabase.from('delivery_checkpoints').insert({
        delivery_id: delivery.id,
        status: newStatus,
        description: `Status atualizado para: ${getStatusText(newStatus)}`,
        created_at: new Date().toISOString()
      });

      // Notificar a outra parte
      const recipientId = user.role === 'deliverer' 
        ? delivery.entrepreneur_id 
        : delivery.deliverer_id;
      if (recipientId) {
        await createNotification({
          user_id: recipientId,
          type: 'delivery_status',
          title: 'Atualização na entrega',
          message: `A entrega #${delivery.id.slice(0,8)} mudou para ${getStatusText(newStatus)}`,
          data: { delivery_id: delivery.id, status: newStatus }
        });
      }

      await loadDelivery(); // recarrega
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      created: 'Criada',
      accepted: 'Aceita',
      in_progress: 'Em andamento',
      completed: 'Concluída',
      problem: 'Problema',
      cancelled: 'Cancelada'
    };
    return map[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="text-emerald-400" size={20} />;
      case 'in_progress': return <Truck className="text-blue-400" size={20} />;
      case 'accepted': return <Clock className="text-yellow-400" size={20} />;
      case 'problem': return <AlertCircle className="text-red-400" size={20} />;
      default: return <Package className="text-gray-400" size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-3" size={48} />
        <h3 className="text-lg font-bold text-white mb-2">Erro ao carregar entrega</h3>
        <p className="text-gray-400">{error || 'Entrega não encontrada'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10"
        >
          Voltar
        </button>
      </div>
    );
  }

  const isEntrepreneur = user?.role === 'entrepreneur' && user.id === delivery.entrepreneur_id;
  const isDeliverer = user?.role === 'deliverer' && user.id === delivery.deliverer_id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho com botão voltar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Detalhes da Entrega</h1>
          <p className="text-gray-400 text-sm">ID: {delivery.id.slice(0,8)}...</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(delivery.current_status)}`}>
            {getStatusText(delivery.current_status)}
          </span>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda - informações principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card de item e valores */}
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <Package className="text-emerald-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{delivery.item_type}</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Criada em {new Date(delivery.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-emerald-500">
                  R$ {delivery.estimated_value.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Valor total</p>
              </div>
            </div>

            {delivery.notes && (
              <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-sm text-gray-300">{delivery.notes}</p>
              </div>
            )}

            {/* Códigos de coleta/entrega */}
            {(delivery.pickup_code || delivery.delivery_code) && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                {delivery.pickup_code && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Código de Coleta</p>
                    <p className="font-mono font-bold text-white text-2xl tracking-widest">
                      {delivery.pickup_code}
                    </p>
                  </div>
                )}
                {delivery.delivery_code && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Código de Entrega</p>
                    <p className="font-mono font-bold text-white text-2xl tracking-widest">
                      {delivery.delivery_code}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mapa de rota */}
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-emerald-400" />
              Rota da Entrega
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                  <div className="w-0.5 h-12 bg-emerald-400/30"></div>
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 uppercase font-bold">ORIGEM</p>
                    <p className="font-medium text-white">{delivery.origin_address}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">DESTINO</p>
                    <p className="font-medium text-white">{delivery.destination_address}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Checkpoints */}
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-emerald-400" />
              Histórico de Status
            </h3>
            {checkpoints.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum checkpoint registrado.</p>
            ) : (
              <div className="space-y-3">
                {checkpoints.map((cp, idx) => (
                  <div key={cp.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      {getStatusIcon(cp.status)}
                      {idx < checkpoints.length - 1 && (
                        <div className="w-0.5 h-8 bg-white/10"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{cp.description || getStatusText(cp.status)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(cp.created_at).toLocaleString('pt-BR')}
                      </p>
                      {cp.location && (
                        <p className="text-xs text-gray-400 mt-1">📍 {cp.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita - pessoas e ações */}
        <div className="space-y-6">
          {/* Empreendedor */}
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <User size={18} className="text-emerald-400" />
              Empreendedor
            </h3>
            <div className="space-y-3">
              <p className="font-medium text-white">{delivery.entrepreneur?.full_name || 'N/I'}</p>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-gray-500" />
                <span className="text-gray-300">{delivery.entrepreneur?.phone || 'Não informado'}</span>
              </div>
              {isEntrepreneur && (
                <button
                  onClick={() => navigate('/entrepreneur/profile')}
                  className="w-full mt-2 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  Editar perfil
                </button>
              )}
            </div>
          </div>

          {/* Entregador (se houver) */}
          {delivery.deliverer && (
            <div className="bg-[#121212] rounded-2xl border border-white/5 p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Truck size={18} className="text-emerald-400" />
                Entregador
              </h3>
              <div className="space-y-3">
                <p className="font-medium text-white">{delivery.deliverer.full_name}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-gray-500" />
                  <span className="text-gray-300">{delivery.deliverer.phone || 'Não informado'}</span>
                </div>
                {isDeliverer && (
                  <button
                    onClick={() => navigate('/deliverer/profile')}
                    className="w-full mt-2 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm"
                  >
                    Editar perfil
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Ações disponíveis */}
          <div className="bg-[#121212] rounded-2xl border border-white/5 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Navigation size={18} className="text-emerald-400" />
              Ações
            </h3>

            {/* Ações para entregador */}
            {isDeliverer && delivery.current_status === 'accepted' && (
              <button
                onClick={() => updateStatus('in_progress')}
                disabled={updating}
                className="w-full mb-2 py-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl font-bold hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {updating ? 'Atualizando...' : 'INICIAR COLETA'}
              </button>
            )}

            {isDeliverer && delivery.current_status === 'in_progress' && (
              <button
                onClick={() => updateStatus('completed')}
                disabled={updating}
                className="w-full mb-2 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                {updating ? 'Atualizando...' : 'CONFIRMAR ENTREGA'}
              </button>
            )}

            {/* Ações para empreendedor (cancelar antes de aceitar) */}
            {isEntrepreneur && delivery.current_status === 'created' && (
              <button
                onClick={() => updateStatus('cancelled')}
                disabled={updating}
                className="w-full mb-2 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                CANCELAR ENTREGA
              </button>
            )}

            {/* Botão reportar problema (sempre visível se não concluída/cancelada) */}
            {!['completed', 'cancelled'].includes(delivery.current_status) && (
              <button
                onClick={() => setShowProblemModal(true)}
                className="w-full py-3 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl font-bold hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Flag size={18} />
                REPORTAR PROBLEMA
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de reportar problema */}
      {showProblemModal && (
        <ReportProblemModal
          deliveryId={delivery.id}
          onClose={() => setShowProblemModal(false)}
          onReported={() => {
            setShowProblemModal(false);
            loadDelivery(); // recarrega para mostrar novo status se mudou para 'problem'
          }}
        />
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'in_progress': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'accepted': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    case 'problem': return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'cancelled': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    default: return 'bg-white/5 text-gray-400 border-white/10';
  }
}