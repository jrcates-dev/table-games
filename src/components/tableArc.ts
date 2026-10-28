import { TABLE } from '../blackjack/geometry'

const { cx } = TABLE

/** An arc of printing, concentric-ish with the rail but flatter. */
export const ARC_CY = -230
export function arcPath(rx: number, ry: number, spread = 52): string {
  const a = (spread * Math.PI) / 180
  const x0 = cx - rx * Math.sin(a)
  const x1 = cx + rx * Math.sin(a)
  const y = ARC_CY + ry * Math.cos(a)
  return `M ${x0.toFixed(1)} ${y.toFixed(1)} A ${rx} ${ry} 0 0 0 ${x1.toFixed(1)} ${y.toFixed(1)}`
}
