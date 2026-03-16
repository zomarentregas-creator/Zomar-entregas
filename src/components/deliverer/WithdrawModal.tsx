import { useState } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle, Phone, Building } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
  // paymentOptions?: string[]; // opcional, pode ser removido se não usar
}

export default function WithdrawModal({ availableBalance, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(availableBalance);
  const [method, setMethod] = useState<'m-pesa' | 'e-mola' | 'mkesh' | 'bank_transfer'>('m-pesa');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [bankInfo, setBankInfo] = useState({
    nib: '',
    bankName: '',
    accountHolder: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const FEE = 10;
  const MIN_WITHDRAWAL = 50;

  const currencyFormatter = new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 2,
  });

  const validatePhone = (phone: string) => /^\+258[0-9]{8,9}$/.test(phone.trim());
  const validateNIB = (nib: string) => /^[0-9]{21}$/.test(nib.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    if (amount < MIN_WITHDRAWAL || amount > availableBalance) {
      setError(`Valor deve estar entre ${currencyFormatter.format(MIN_WITHDRAWAL)} e ${currencyFormatter.format(availableBalance)}`);
      return;
    }

    if (amount - FEE < 0) {
      setError(`Valor insuficiente após taxa (${currencyFormatter.format(FEE)})`);
      return;
    }

    let valid = true;

    if (['m-pesa', 'e-mola', 'mkesh'].includes(method)) {
      if (!validatePhone(phoneNumber)) {
        setError(`Número inválido para ${method.toUpperCase()}. Use formato +258XXXXXXXXX`);
        valid = false;
      }
    } else if (method === 'bank_transfer') {
      if (!validateNIB(bankInfo.nib) || !bankInfo.bankName || !bankInfo.accountHolder) {
        setError('Preencha corretamente o NIB (21 dígitos), banco e titular');
        valid = false;
      }
    }

    if (!valid) return;

    setSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/withdraw`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.access_token || ''}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            amount,
            method,
            phoneNumber: ['m-pesa', 'e-mola', 'mkesh'].includes(method) ? phoneNumber : undefined,
            bankData: method === 'bank_transfer' ? bankInfo : undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao processar levantamento');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2200);

    } catch (err: any) {
      console.error('Erro no levantamento:', err);
      setError(err.message || 'Erro ao solicitar. Tente novamente ou contacte suporte.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-[#121212] rounded-2xl border border-white/10 w-full max-w-md p-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-400" size={48} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Levantamento Solicitado!</h2>
          <p className="text-gray-400 mb-6">
            Solicitação enviada com sucesso. Receberá notificação quando for processado.
          </p>
          <div className="bg-white/5 rounded-xl p-5 mb-6 border border-white/5">
            <p className="text-gray-400 text-sm mb-2">Valor a receber</p>
            <p className="text-4xl font-black text-emerald-400">
              {currencyFormatter.format(amount - FEE)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold text-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#121212] rounded-2xl border border-white/10 w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-black/40">
        {/* Header fixo */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#121212]">
          <div className="flex items-center gap-3">
            <DollarSign className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white">Solicitar Levantamento</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Conteúdo com scroll personalizado */}
        <div 
          className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar"
        >
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Saldo disponível */}
            <div className="bg-emerald-900/10 p-5 rounded-xl border border-emerald-800/30">
              <p className="text-sm text-gray-400 mb-1">Saldo disponível para levantamento</p>
              <p className="text-3xl font-black text-emerald-400">
                {currencyFormatter.format(availableBalance)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                * Disponível após 24h da conclusão da entrega
              </p>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor do levantamento (MZN) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">MZN</span>
                <input
                  type="number"
                  step="1"
                  min={MIN_WITHDRAWAL}
                  max={availableBalance}
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-16 pr-4 py-3.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAmount(Math.min(availableBalance, 1000))}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  disabled={submitting}
                >
                  1.000 MZN
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(availableBalance)}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  disabled={submitting}
                >
                  Tudo
                </button>
              </div>
            </div>

            {/* Método */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Método de levantamento *
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                disabled={submitting}
              >
                <option value="m-pesa">M-Pesa (Vodacom) – Mais rápido</option>
                <option value="e-mola">e-Mola (Movitel)</option>
                <option value="mkesh">mKesh (Tmcel)</option>
                <option value="bank_transfer">Transferência Bancária (1–2 dias)</option>
              </select>
            </div>

            {/* Campos condicionais */}
            {['m-pesa', 'e-mola', 'mkesh'].includes(method) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Phone size={18} className="text-emerald-400" />
                  Número da carteira *
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+258 84 XXX XXXX"
                  className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  required
                  disabled={submitting}
                />
              </div>
            )}

            {method === 'bank_transfer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Building size={18} className="text-emerald-400" />
                    Nome do Banco *
                  </label>
                  <input
                    type="text"
                    value={bankInfo.bankName}
                    onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                    placeholder="Ex: Millennium BIM, Moza, BCI"
                    className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    NIB/IBAN (21 dígitos) *
                  </label>
                  <input
                    type="text"
                    value={bankInfo.nib}
                    onChange={(e) => setBankInfo({ ...bankInfo, nib: e.target.value })}
                    placeholder="0000 0000 0000 0000 0000 0"
                    maxLength={21}
                    className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Titular da Conta *
                  </label>
                  <input
                    type="text"
                    value={bankInfo.accountHolder}
                    onChange={(e) => setBankInfo({ ...bankInfo, accountHolder: e.target.value })}
                    placeholder="Nome completo do titular"
                    className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-800/40 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 flex-1">{error}</p>
              </div>
            )}

            {/* Resumo */}
            <div className="bg-white/5 p-5 rounded-xl border border-white/10 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Valor solicitado:</span>
                <span className="text-white font-medium">{currencyFormatter.format(amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Taxa administrativa:</span>
                <span className="text-white font-medium">– {currencyFormatter.format(FEE)}</span>
              </div>
              <div className="pt-3 border-t border-white/10 flex justify-between text-base font-bold">
                <span className="text-gray-300">A receber:</span>
                <span className="text-emerald-400 text-xl">
                  {currencyFormatter.format(Math.max(0, amount - FEE))}
                </span>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-4 border border-white/15 text-gray-300 rounded-xl hover:bg-white/5 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || amount < MIN_WITHDRAWAL || amount > availableBalance}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Processando...
                  </span>
                ) : (
                  'Solicitar Levantamento'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Estilos do scroll personalizado */}
      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(52, 211, 153, 0.4) #121212;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #121212;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(52, 211, 153, 0.5);
          border-radius: 10px;
          border: 2px solid #121212;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(52, 211, 153, 0.8);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}