// src/hooks/useMotion.ts
// Pequenas utilidades de movimento (sem dependências). Funcionam com as classes "zm-*"
// definidas em src/styles/zomar-motion.css.

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/** true quando o sistema pede "reduzir movimento". */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    hasMatchMedia() ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  )

  useEffect(() => {
    if (!hasMatchMedia()) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return reduced
}

/**
 * Revela os elementos `.zm-reveal` quando entram no ecrã (adiciona `.zm-in`).
 * Devolve a ref a colocar no contentor. `deps` volta a procurar elementos quando mudam.
 */
export function useReveal<T extends HTMLElement>(deps: ReadonlyArray<unknown> = []) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.zm-reveal:not(.zm-in)'))
    if (items.length === 0) return

    if (typeof IntersectionObserver === 'undefined') {
      items.forEach(el => el.classList.add('zm-in'))
      return
    }

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('zm-in')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -5% 0px' },
    )
    items.forEach(el => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}

/**
 * Paralaxe suave: escreve --px e --py (de -1 a 1) no elemento, conforme a posição do rato.
 * Usado com a classe `.zm-parallax`. Desligado em ecrãs tácteis e com "reduzir movimento".
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced || !hasMatchMedia()) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        const x = ((e.clientX - r.left) / r.width) * 2 - 1
        const y = ((e.clientY - r.top) / r.height) * 2 - 1
        el.style.setProperty('--px', x.toFixed(3))
        el.style.setProperty('--py', y.toFixed(3))
      })
    }
    const onLeave = () => {
      el.style.setProperty('--px', '0')
      el.style.setProperty('--py', '0')
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced])

  return ref
}

/** Para `onPointerMove` em cartões com a classe `.zm-spot`: a luz segue o rato. */
export function spotlight(e: ReactPointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

/** Número que sobe de forma suave até ao valor. */
export function useCountUp(target: number, duration = 900): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState<number>(reduced ? target : 0)
  const from = useRef<number>(reduced ? target : 0)

  useEffect(() => {
    if (reduced) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(a + (target - a) * eased)
      from.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduced])

  return value
}
