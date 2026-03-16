/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Adicionado para suportar tema dark/light
  theme: {
    extend: {
      // Cores customizadas para o tema GameX
      colors: {
        gamex: {
          black: '#0a0a0a',
          dark: '#111',
          darker: '#121212',
          card: '#1a1a1a',
          border: 'rgba(255, 255, 255, 0.05)',
          'border-light': 'rgba(255, 255, 255, 0.1)',
          'border-emerald': 'rgba(16, 185, 129, 0.2)',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
      },
      
      // Gradientes customizados
      backgroundImage: {
        'gradient-gamex': 'linear-gradient(to bottom right, #0a0a0a, #111, #121212)',
        'gradient-emerald': 'linear-gradient(to bottom right, #10b981, #059669)',
        'gradient-card': 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
        'gradient-border': 'linear-gradient(to right, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
      },
      
      // Sombras customizadas
      boxShadow: {
        'gamex': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'gamex-lg': '0 15px 50px rgba(0, 0, 0, 0.4)',
        'gamex-xl': '0 25px 75px rgba(0, 0, 0, 0.5)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.5)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.5)',
        'inner-gamex': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)',
      },
      
      // Animações customizadas
      animation: {
        'loading': 'loading 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-out': 'slide-out 0.3s ease-in',
      },
      
      // Keyframes para as animações
      keyframes: {
        loading: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { 
            opacity: '1',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
          },
          '50%': { 
            opacity: '0.8',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.8)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
      
      // Bordas arredondadas customizadas
      borderRadius: {
        'gamex-sm': '0.5rem',
        'gamex': '1rem',
        'gamex-lg': '1.5rem',
        'gamex-xl': '2rem',
        'gamex-2xl': '2.5rem',
        'gamex-full': '9999px',
      },
      
      // Fontes customizadas (opcional)
      fontFamily: {
        'gamex': ['Inter', 'system-ui', 'sans-serif'],
        'gamex-mono': ['JetBrains Mono', 'monospace'],
      },
      
      // Espaçamentos customizados
      spacing: {
        'gamex-xs': '0.125rem',
        'gamex-sm': '0.25rem',
        'gamex': '0.5rem',
        'gamex-lg': '0.75rem',
        'gamex-xl': '1rem',
        'gamex-2xl': '1.25rem',
      },
      
      // Z-index customizado
      zIndex: {
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
      },
    },
  },
  
  // Plugins
  plugins: [
    // Plugin para suportar backdrop-blur com cores personalizadas
    function({ addUtilities }) {
      addUtilities({
        '.backdrop-blur-gamex': {
          'backdrop-filter': 'blur(8px)',
          '-webkit-backdrop-filter': 'blur(8px)',
        },
        '.backdrop-blur-gamex-lg': {
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
        },
        '.backdrop-blur-gamex-xl': {
          'backdrop-filter': 'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
        },
      })
    },
  ],
};