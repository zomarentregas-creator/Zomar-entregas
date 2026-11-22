// src/components/Common/MotionKit.tsx
// Peças partilhadas de movimento para as páginas: número animado, esqueleto de carregamento
// e atraso em cascata. Usa as classes zm-* (src/styles/zomar-motion.css) e o hook de src/hooks/useMotion.ts.

import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { usePrefersReducedMotion } from "../../hooks/useMotion"
import "../../styles/zomar-motion.css"

/** Atraso (ms) de uma animação zm-* em cascata: style={stagger(i)} */
export const stagger = (index: number, step = 60, base = 0): CSSProperties =>
  ({ "--zm-d": `${base + index * step}ms` }) as CSSProperties

/** Número que sobe de forma suave até ao valor (aceita decimais e formatação, ex.: moeda). */
export function AnimatedNumber({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 900,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState<number>(reduced ? value : 0)
  const from = useRef<number>(reduced ? value : 0)

  useEffect(() => {
    if (reduced) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = a + (value - a) * eased
      from.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduced])

  return <span className="tabular-nums">{format(shown)}</span>
}

/** Esqueleto de carregamento (substitui o círculo a rodar): cabeçalho, indicadores e lista. */
export function PageSkeleton({ dark = true, rows = 3 }: { dark?: boolean; rows?: number }) {
  const sk = `zm-skeleton ${dark ? "" : "is-light"}`
  return (
    <div className="space-y-5" aria-busy="true" aria-label="A carregar">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`${sk} h-7 w-48 rounded-lg`} />
          <div className={`${sk} h-4 w-32 rounded-md`} />
        </div>
        <div className={`${sk} h-10 w-10 rounded-xl`} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <div key={i} className={`${sk} h-24 rounded-2xl`} />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => <div key={i} className={`${sk} h-28 rounded-2xl`} />)}
      </div>
    </div>
  )
}
