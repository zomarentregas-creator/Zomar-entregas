/**
 * ============================================================================
 * LOADER — ZOMAR
 * ============================================================================
 * Design: minimalismo urgente — moto em movimento, linhas de velocidade,
 * centrado com fixed inset-0 para garantir centro absoluto do ecrã.
 * Remove "RapidDash", corrige nome para ZOMAR.
 * @version 2.0
 */

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  fullscreen?: boolean
}

export default function Loader({
  size = 'md',
  text,
  fullscreen = true,
}: LoaderProps) {

  const scaleMap = { sm: 0.5, md: 0.75, lg: 1, xl: 1.25 }
  const scale = scaleMap[size]

  const content = (
    <div className="flex flex-col items-center justify-center gap-8 select-none">

      {/* ── Área da animação ── */}
      <div
        className="relative"
        style={{ width: 180 * scale, height: 80 * scale }}
      >
        {/* Trilha de fundo */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full opacity-10"
          style={{ height: 2 * scale, background: '#10b981' }}
        />

        {/* Linhas de velocidade — surgem da esquerda */}
        {[0.15, 0.35, 0.55].map((top, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${top * 100}%`,
              left: 0,
              height: Math.max(1, 1.5 * scale),
              background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
              animation: `speedLine ${0.8 + i * 0.15}s ease-in-out infinite`,
              animationDelay: `${i * 0.18}s`,
              opacity: 0.4 - i * 0.08,
              width: (60 - i * 12) * scale,
            }}
          />
        ))}

        {/* Moto SVG — atravessa da esquerda para direita e volta */}
        <div
          className="absolute"
          style={{
            bottom: 2 * scale,
            animation: 'bikeRide 1.8s cubic-bezier(0.45,0,0.55,1) infinite',
            transformOrigin: 'center bottom',
          }}
        >
          <svg
            width={48 * scale}
            height={32 * scale}
            viewBox="0 0 48 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Roda traseira */}
            <circle cx="10" cy="24" r="7" stroke="#10b981" strokeWidth="2" fill="none" />
            <circle cx="10" cy="24" r="2" fill="#10b981" opacity="0.6" />

            {/* Roda dianteira */}
            <circle cx="38" cy="24" r="7" stroke="#10b981" strokeWidth="2" fill="none" />
            <circle cx="38" cy="24" r="2" fill="#10b981" opacity="0.6" />

            {/* Chassis */}
            <path
              d="M10 24 L18 10 L28 10 L38 17 L38 24"
              stroke="#6ee7b7"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Motor / tanque */}
            <path
              d="M18 10 L26 10 L32 17 L20 17 Z"
              fill="#10b981"
              opacity="0.3"
            />

            {/* Guidão */}
            <path
              d="M34 10 L38 10 L40 14"
              stroke="#6ee7b7"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Capacete do entregador */}
            <ellipse cx="22" cy="8" rx="5" ry="4" fill="#10b981" opacity="0.9" />
            <ellipse cx="22" cy="9" rx="5" ry="2" fill="#064e3b" opacity="0.5" />

            {/* Caixa de entrega */}
            <rect x="12" y="13" width="8" height="6" rx="1" fill="#059669" opacity="0.8" />
            <line x1="16" y1="13" x2="16" y2="19" stroke="#34d399" strokeWidth="0.8" opacity="0.6" />
          </svg>
        </div>

        {/* Pulso de chegada — aparece no fim da trajetória */}
        <div
          className="absolute rounded-full"
          style={{
            right: 0,
            bottom: 4 * scale,
            width: 8 * scale,
            height: 8 * scale,
            background: '#10b981',
            animation: 'arrivalPulse 1.8s ease-out infinite',
            animationDelay: '1.4s',
          }}
        />
      </div>

      {/* ── Texto + barra ── */}
      <div className="flex flex-col items-center gap-3">
        <p
          className="font-bold tracking-[0.2em] uppercase text-emerald-400"
          style={{ fontSize: Math.max(10, 11 * scale), letterSpacing: '0.25em' }}
        >
          {text ?? 'A processar entrega...'}
        </p>

        {/* Barra de progresso indeterminada */}
        <div
          className="rounded-full overflow-hidden bg-white/5"
          style={{ width: 120 * scale, height: 2 * scale }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #10b981, #34d399, transparent)',
              animation: 'progressBar 1.6s ease-in-out infinite',
              width: '60%',
            }}
          />
        </div>

        {/* Marca */}
        {fullscreen && (
          <p
            className="text-gray-700 font-black italic tracking-widest uppercase mt-2"
            style={{ fontSize: Math.max(9, 10 * scale) }}
          >
            ZOMAR
          </p>
        )}
      </div>

      {/* Keyframes injetados inline */}
      <style>{`
        @keyframes bikeRide {
          0%   { transform: translateX(0px); }
          45%  { transform: translateX(${108 * scale}px); }
          50%  { transform: translateX(${108 * scale}px) scaleX(-1); }
          95%  { transform: translateX(0px) scaleX(-1); }
          100% { transform: translateX(0px) scaleX(1); }
        }

        @keyframes speedLine {
          0%   { transform: translateX(-20px); opacity: 0; }
          30%  { opacity: 0.4; }
          70%  { opacity: 0.2; }
          100% { transform: translateX(${160 * scale}px); opacity: 0; }
        }

        @keyframes progressBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }

        @keyframes arrivalPulse {
          0%   { transform: scale(0); opacity: 0.8; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
    </div>
  )

  if (!fullscreen) return content

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)',
        zIndex: 9999,
      }}
    >
      {/* Brilho ambiente central */}
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {content}
    </div>
  )
}