// Utilitário para gerenciar modo desenvolvimento
export const DevMode = {
  isEnabled(): boolean {
    return localStorage.getItem('dev_mode') === 'true'
  },

  enable(): void {
    localStorage.setItem('dev_mode', 'true')
    console.log('🚀 Modo desenvolvimento ativado')
  },

  disable(): void {
    localStorage.removeItem('dev_mode')
    console.log('🔧 Modo desenvolvimento desativado')
  },

  getMockUser() {
    return {
      id: 'dev-user-' + Date.now(),
      email: 'dev@exemplo.com',
      full_name: 'Usuário Desenvolvimento',
      role: 'entrepreneur' as const,
      phone: '(11) 99999-9999',
      created_at: new Date().toISOString()
    }
  }
}

// Delay simulado para desenvolvimento
export const simulateDelay = (ms: number) => 
  new Promise(resolve => setTimeout(resolve, ms))