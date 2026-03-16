import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const TestLayout = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teste de Layout</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Informações do Usuário</h2>
          <div className="space-y-2">
            <p><strong>Email:</strong> {user?.email || 'Não disponível'}</p>
            <p><strong>Nome:</strong> {user?.full_name || 'Não disponível'}</p>
            <p><strong>Role:</strong> {user?.role || 'Não definido'}</p>
            <p><strong>ID:</strong> {user?.id ? `${user.id.substring(0, 8)}...` : 'Não disponível'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Layout Status</h2>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span>Layout carregado: Sim</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span>Autenticação: {user ? 'Autenticado' : 'Não autenticado'}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span>URL atual: {window.location.pathname}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">Ações de Teste</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => console.log('Auth Context:', useAuth())}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Log Auth Context
          </button>
          <button
            onClick={() => localStorage.clear()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Limpar LocalStorage
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestLayout;