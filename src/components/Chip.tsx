import { memo } from 'react'
import type { Denomination } from './chips'

/** Path for a ring segment between two radii, angles in degrees. */
function annularSector(r0: number, r1: number, a0: number, a1: number): string {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180
  const p = (r: number, a: number) => `${(r * Math.cos(rad(a))).toFixed(2)} ${(r * Math.sin(rad(a))).toFixed(2)}`
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`
}

const INSERT_ANGLES = [0, 60, 120, 180, 240, 300]

function labelSize(label: string): number {
  if (label.length === 1) return 36
  if (label.length === 2) return 31
  if (label === '25K') return 24
  return 26
}

/**
 * A clay chip seen from above, drawn in a -50…50 box.
 *
 * Six edge inserts split by a hairline of body colour, a printed dotted ring,
 * and a cream inlay carrying the denomination — the anatomy of a real Nevada
 * chip, and the thing that makes a stack read as money rather than as discs.
 */
export const ChipFace = memo(function ChipFace({
  denom,
  rotate = 0,
  labelRotate = rotate,
  outlined = true,
}: {
  denom: Denomination
  rotate?: number
  /** The denomination's own turn; it follows the chip unless given. */
  labelRotate?: number
  /** A dark rim round the face, for a chip seen flat. Off when the chip's edge shows below it. */
  outlined?: boolean
}) {
  const labelTurn = labelRotate - rotate
  return (
    <g transform={rotate ? `rotate(${rotate.toFixed(1)})` : undefined}>
      <circle r="50" fill={denom.body} />
      {INSERT_ANGLES.map((a) => (
        <g key={a}>
          <path d={annularSector(39.5, 50, a - 11, a + 11)} fill={denom.insert} />
          <path d={annularSector(39.5, 50, a - 1.1, a + 1.1)} fill={denom.body} />
        </g>
      ))}
      <circle r="44.5" fill="none" stroke={denom.insert} strokeOpacity="0.5" strokeWidth="1.1" strokeDasharray="1.6 3.1" />
      <circle r="36.5" fill="none" stroke={denom.shade} strokeOpacity="0.55" strokeWidth="1.6" />
      <circle r="33" fill="url(#chip-inlay)" />
      <circle r="33" fill="none" stroke={denom.shade} strokeWidth="1.8" />
      <circle r="29" fill="none" stroke={denom.body} strokeOpacity="0.45" strokeWidth="0.8" />
      <text
        x="0"
        y="1"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontWeight="700"
        fontSize={labelSize(denom.label)}
        fill={denom.ink}
        letterSpacing="-0.5"
        transform={labelTurn ? `rotate(${labelTurn.toFixed(1)})` : undefined}
        style={{ fontVariantNumeric: 'lining-nums' }}
      >
        {denom.label}
      </text>
      <circle r="50" fill="url(#chip-shine)" />
      {outlined && <circle r="49.3" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />}
    </g>
  )
})

/** A chip as a standalone image — rack buttons, the lobby, anywhere off the felt. */
export function ChipImage({
  denom,
  size = 56,
  rotate = 0,
  className,
}: {
  denom: Denomination
  size?: number
  rotate?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-51 -51 102 102"
      aria-hidden="true"
      focusable="false"
    >
      <ChipFace denom={denom} rotate={rotate} />
    </svg>
  )
}
