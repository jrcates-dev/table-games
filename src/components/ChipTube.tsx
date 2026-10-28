import { memo } from 'react'
import type { Denomination } from './chips'

/** A well-mixed integer hash to 0–1, so neighbouring chips never fall into a pattern. */
function hash(n: number): number {
  let t = Math.imul(n | 0, 0x9e3779b1)
  t ^= t >>> 15
  t = Math.imul(t, 0x2c1b3c6d)
  t ^= t >>> 12
  t = Math.imul(t, 0x297a2d39)
  t ^= t >>> 15
  return (t >>> 0) / 4294967296
}

/** Half the angular width of an edge insert, degrees. */
const INSERT_HALF = 11

/**
 * One tube of a dealer's tray, seen from above: chips lying on their edges in
 * a rounded channel, running down the tube from `y`.
 *
 * Each chip is turned at random, so its edge inserts land where they fall and
 * are foreshortened as they wrap round the curve of the stack — the detail
 * that makes a tray of chips read as a row of cylinders rather than stripes.
 * A column is a handful of paths whatever its length.
 */
export const ChipTube = memo(function ChipTube({
  x,
  y,
  w,
  len,
  denom,
  fill = 1,
  seed = 1,
}: {
  x: number
  y: number
  /** The tube's width; the chips are a little narrower. */
  w: number
  len: number
  denom: Denomination
  /** How full the tube is, 0–1. */
  fill?: number
  seed?: number
}) {
  const pad = w * 0.06
  const cw = w - pad * 2
  const r = cw / 2
  const cx = x + w / 2
  // A real chip is about 0.085 of its diameter thick.
  const t = cw * 0.09
  const count = Math.max(1, Math.floor(((len - 2) * fill) / t))
  const top = y + 1

  const inserts: string[] = []
  const seams: string[] = []
  const bevels: string[] = []
  for (let i = 0; i < count; i++) {
    const y0 = top + i * t
    const turn = hash(seed * 1009 + i) * 60
    // Angles from the crown of the stack; ±90° is where it meets the tube.
    for (let k = -2; k <= 2; k++) {
      const centre = turn + k * 60 - 30
      const a0 = Math.max(-88, centre - INSERT_HALF)
      const a1 = Math.min(88, centre + INSERT_HALF)
      if (a1 <= a0) continue
      const x0 = cx + r * Math.sin((a0 * Math.PI) / 180)
      const x1 = cx + r * Math.sin((a1 * Math.PI) / 180)
      inserts.push(`M${x0.toFixed(2)} ${(y0 + t * 0.14).toFixed(2)}H${x1.toFixed(2)}V${(y0 + t * 0.86).toFixed(2)}H${x0.toFixed(2)}Z`)
    }
    if (i > 0) seams.push(`M${(cx - r).toFixed(2)} ${y0.toFixed(2)}H${(cx + r).toFixed(2)}`)
    bevels.push(`M${(cx - r * 0.9).toFixed(2)} ${(y0 + t * 0.3).toFixed(2)}H${(cx + r * 0.9).toFixed(2)}`)
  }
  const end = top + count * t

  return (
    <g>
      {/* The channel: dark, curving away at its sides, a lip at either end. */}
      <rect x={x} y={y - 2} width={w} height={len + 4} rx={w * 0.22} fill="#2a2530" />
      <rect x={x} y={y - 2} width={w} height={len + 4} rx={w * 0.22} fill="url(#chip-tube)" />
      {/* The chips' shadow in the channel. */}
      <rect x={cx - r - 1} y={top} width={cw + 2} height={end - top + 3} rx="3" fill="#000" opacity="0.55" />
      <rect x={cx - r} y={top} width={cw} height={end - top} fill={denom.body} />
      <path d={inserts.join('')} fill={denom.insert} opacity="0.9" />
      <path d={bevels.join('')} stroke="#fff" strokeOpacity="0.16" strokeWidth={Math.max(0.4, t * 0.18)} />
      <path d={seams.join('')} stroke="#000" strokeOpacity="0.5" strokeWidth={Math.max(0.5, t * 0.16)} />
      {/* Round: dark where the stack turns away, a soft highlight along its crown. */}
      <rect x={cx - r} y={top} width={cw} height={end - top} fill="url(#chip-tube)" />
      {/* The last chip's face, just catching the light at the open end. */}
      <rect x={cx - r} y={end - t * 0.5} width={cw} height={t * 0.9} rx={t * 0.45} fill={denom.body} />
      <rect x={cx - r} y={end - t * 0.5} width={cw} height={t * 0.9} rx={t * 0.45} fill="url(#chip-tube)" />
      <rect x={cx - r * 0.75} y={end} width={r * 1.5} height={t * 0.35} rx={t * 0.18} fill="#fff" opacity="0.18" />
      {/* Shade where the tube's lip overhangs the far end. */}
      <rect x={x} y={y - 2} width={w} height={Math.min(8, len * 0.2)} rx={w * 0.22} fill="url(#chip-tube-lip)" />
    </g>
  )
})
