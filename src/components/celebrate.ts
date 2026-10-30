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

/** One frame of a particle's flight: drag, gravity, spin. */
export function advance(p: Particle) {
  p.life++
  const drag = p.kind === 'confetti' ? 0.965 : 0.975
  p.vx *= drag
  p.vy = p.vy * drag + (p.kind === 'sparks' ? 0.08 : 0.26)
  p.x += p.vx
  p.y += p.vy
  p.angle += p.spin
}

/** How much of a particle still shows: whole for most of its life, then fading out. */
export function fade(p: Particle): number {
  const t = p.life / p.max
  return Math.max(0, t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3)
}

/**
 * A particle's whole flight worked out ahead, as `samples` evenly spaced
 * moments from launch to the end of its life: where it is, which way it is
 * turned and how much of it shows. Leaves the particle as it found it.
 */
export function flightPath(start: Particle, samples: number): Array<{ x: number; y: number; angle: number; alpha: number }> {
  const p = { ...start }
  const frames = Math.ceil(p.max)
  const out = [{ x: p.x, y: p.y, angle: p.angle, alpha: 1 }]
  for (let i = 1; i < samples; i++) {
    const until = Math.round((i / (samples - 1)) * frames)
    while (p.life < until) advance(p)
    out.push({ x: p.x, y: p.y, angle: p.angle, alpha: fade(p) })
  }
  return out
}

/** Fire a burst centred on an element. */
export function burstAt(element: Element | null, kind: FxKind = 'sparks', count = 60) {
  if (!element) return
  const rect = element.getBoundingClientRect()
  burst(rect.left + rect.width / 2, rect.top + rect.height / 2, kind, count)
}
