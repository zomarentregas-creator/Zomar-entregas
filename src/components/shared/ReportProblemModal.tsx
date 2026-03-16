'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  deliveryId: string;
  onClose: () => void;
  onReported: () => void;
}

export default function ReportProblemModal({ deliveryId, onClose, onReported }: Props) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState('other');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      // Inserir na tabela delivery_problems
      const { error: insertError } = await supabase
        .from('delivery_problems')
        .insert({
          delivery_id: deliveryId,
          reported_by: (await supabase.auth.getUser()).data.user?.id,
          problem_type: type,
          description: description.trim(),
          status: 'open'
        });

      if (insertError) throw insertError;

      // Opcional: atualizar status da entrega para 'problem'
      await supabase
        .from('deliveries')
        .update({ current_status: 'problem', updated_at: new Date().toISOString() })
        .eq('id', deliveryId);

      onReported();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#121212] rounded-2xl border border-white/10 w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-400" size={20} />
            <h2 className="text-lg font-bold text-white">Reportar Problema</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Tipo de problema
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
            >
              <option value="item_extraviado">Item extraviado</option>
              <option value="atraso_entrega">Atraso na entrega</option>
              <option value="dano_item">Item danificado</option>
              <option value="entregador_nao_localizado">Entregador não localizado</option>
              <option value="endereco_errado">Endereço errado</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Descrição detalhada
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
              placeholder="Descreva o que aconteceu..."
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}