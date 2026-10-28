/**
 * Celebration, in moderation — the imperative half.
 *
 * Anything can fire a burst at a screen position; the one `FxLayer` canvas on
 * the page draws it. Kept apart from the canvas component so callers depend on
 * a tiny function, not on a React module.
 */

export type FxKind = 'sparks' | 'confetti' | 'coins'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  spin: number
  angle: number
  kind: FxKind
}

const GOLDS = ['#fff4d2', '#f5dfa0', '#e3c170', '#c99c45', '#ffe9a8']
const CONFETTI = ['#f5dfa0', '#e3c170', '#fff8ea', '#4fe0a0', '#c99c45', '#ff9aa2']

let emit: ((p: Particle[]) => void) | null = null

/** The canvas registers itself here while it is mounted. */
export function registerEmitter(fn: ((p: Particle[]) => void) | null) {
  emit = fn
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Fire a burst at a screen position. */
export function burst(x: number, y: number, kind: FxKind = 'sparks', count = 60) {
  if (!emit || reducedMotion()) return
  const palette = kind === 'confetti' ? CONFETTI : GOLDS
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const speed = kind === 'confetti' ? 4 + Math.random() * 9 : kind === 'coins' ? 5 + Math.random() * 8 : 2 + Math.random() * 7
    out.push({
      x,
      y,
      vx: Math.cos(a) * speed * (kind === 'confetti' ? 1.3 : 1),
      vy: Math.sin(a) * speed - (kind === 'sparks' ? 1.5 : 5.5),
      life: 0,
      max: kind === 'sparks' ? 45 + Math.random() * 40 : 90 + Math.random() * 70,
      size: kind === 'confetti' ? 5 + Math.random() * 6 : kind === 'coins' ? 4.5 + Math.random() * 3.5 : 1.4 + Math.random() * 2.6,
      color: palette[Math.floor(Math.random() * palette.length)],
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      kind,
    })
  }
  emit(out)
}

/** Fire a burst centred on an element. */
export function burstAt(element: Element | null, kind: FxKind = 'sparks', count = 60) {
  if (!element) return
  const rect = element.getBoundingClientRect()
  burst(rect.left + rect.width / 2, rect.top + rect.height / 2, kind, count)
}
