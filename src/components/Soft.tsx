import { cloneElement, useId, type ReactElement, type SVGProps } from 'react'
import { useEffectsLevel } from '../lib/effects'

/**
 * The soft parts of a felt: a table's shadow on the carpet, the dark where a
 * rail overhangs the cloth, the glow along a padded edge.
 *
 * With full effects they are what they look like, shapes run through a
 * Gaussian blur. That blur is most of the cost of painting a table, and a
 * table is painted whole whenever it opens, is zoomed or the phone turns, so
 * with lighter effects the same shapes are drawn without it: a round shadow
 * as a radial gradient that falls off the way the blur would, anything else
 * as a few copies of itself, each with a wider stroke and a share of its
 * opacity. At a phone's size the two read the same, and the felt paints in a
 * fraction of the time. Blending goes too, the grain and the lamplight laid
 * on plainly: each blended shape is painted on its own and then mixed in.
 */

type Shape = ReactElement<SVGProps<SVGElement>>

/** How far past its edge a blurred shape still shows, in blur radii. */
const REACH = 2.5
/** Copies stacked to stand in for a blurred edge: enough that no step shows. */
const STEPS = 8

export function Soft({ blur, filter, children }: { blur: number; filter: string; children: Shape }) {
  const light = useEffectsLevel() === 'reduced'
  const id = `soft-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  if (!light) return cloneElement(children, { filter })
  const { fill } = children.props
  const round = children.type === 'ellipse' || children.type === 'circle'
  return round && fill && fill !== 'none' ? <Falloff id={id} blur={blur} shape={children} /> : <Stacked blur={blur} shape={children} />
}

/** The share of a blurred edge still showing `k` blur radii outside it. */
function edge(k: number): number {
  // The normal distribution's tail, close enough for a shadow.
  const t = 1 / (1 + 0.2316419 * Math.abs(k))
  const tail = 0.3989423 * Math.exp((-k * k) / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return k > 0 ? tail : 1 - tail
}

function Falloff({ id, blur, shape }: { id: string; blur: number; shape: Shape }) {
  const p = shape.props as SVGProps<SVGEllipseElement> & SVGProps<SVGCircleElement>
  const rx = Number(p.rx ?? p.r)
  const ry = Number(p.ry ?? p.r)
  const reach = REACH * blur
  // The falloff is measured along the mean radius; an ellipse's gradient stretches with it.
  const r = Math.sqrt(rx * ry)
  const stops = [-2, -1, -0.5, 0, 0.5, 1, 2, REACH].map((k) => ({ at: Math.max(0, (r + k * blur) / (r + reach)), a: edge(k) }))
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={p.fill} />
          {stops.map((s) => (
            <stop key={s.at} offset={s.at.toFixed(4)} stopColor={p.fill} stopOpacity={s.a.toFixed(3)} />
          ))}
        </radialGradient>
      </defs>
      <ellipse cx={p.cx} cy={p.cy} rx={rx + reach} ry={ry + reach} fill={`url(#${id})`} opacity={p.opacity} />
    </g>
  )
}

function Stacked({ blur, shape }: { blur: number; shape: Shape }) {
  const p = shape.props
  const stroked = p.stroke !== undefined && p.stroke !== 'none'
  const color = stroked ? p.stroke : p.fill
  const width = stroked ? Number(p.strokeWidth ?? 1) : 0
  const total = Number(p.opacity ?? 1) * Number((stroked ? p.strokeOpacity : p.fillOpacity) ?? 1)
  const each = 1 - Math.pow(1 - total, 1 / STEPS)
  return (
    <g>
      {Array.from({ length: STEPS }, (_, i) =>
        cloneElement(shape, {
          key: i,
          stroke: color,
          strokeOpacity: 1,
          fillOpacity: stroked ? undefined : 1,
          strokeWidth: width + (4 * blur * (STEPS - i)) / STEPS,
          opacity: each,
        }),
      )}
    </g>
  )
}
