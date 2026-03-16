import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { deleteAccount } from '../../lib/deleteAccount';

interface Props {
  userEmail: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteAccountModal({ userEmail, onClose, onDeleted }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setError('');
    setLoading(true);

    // Verificar senha
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });
    if (signInError) {
      setError('Senha incorreta');
      setLoading(false);
      return;
    }

    try {
      await deleteAccount();
      onDeleted();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#121212] rounded-2xl border border-red-500/30 w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold text-white">Excluir Conta</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-gray-300 text-sm">
            Esta ação é <span className="text-red-400 font-bold">irreversível</span>. Todos os seus dados serão permanentemente removidos.
          </p>
          <p className="text-gray-300 text-sm">
            Para confirmar, digite sua senha:
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-red-500/50"
            placeholder="Sua senha"
            autoFocus
          />
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
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !password}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Excluindo...' : 'Excluir Permanentemente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}