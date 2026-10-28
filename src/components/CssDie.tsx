import type { CSSProperties } from 'react'

/**
 * A casino die as a CSS cube — translucent red acetate with flush white pips —
 * for the places that do not warrant a WebGL canvas: the lobby, the roll
 * history, the settlement strip.
 */

const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[27, 23], [73, 23], [27, 50], [73, 50], [27, 77], [73, 77]],
}

/** Face transforms for a cube of side `s`; opposite faces sum to seven. */
const FACES: Array<{ value: number; transform: (h: number) => string }> = [
  { value: 1, transform: (h) => `translateZ(${h}px)` },
  { value: 6, transform: (h) => `rotateY(180deg) translateZ(${h}px)` },
  { value: 2, transform: (h) => `rotateY(90deg) translateZ(${h}px)` },
  { value: 5, transform: (h) => `rotateY(-90deg) translateZ(${h}px)` },
  { value: 3, transform: (h) => `rotateX(90deg) translateZ(${h}px)` },
  { value: 4, transform: (h) => `rotateX(-90deg) translateZ(${h}px)` },
]

export function DieFace({ value, size }: { value: number; size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      {(PIP_LAYOUT[value] ?? []).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={value === 1 ? 11 : 9.5} fill="#fff" />
          <circle cx={x - 1.5} cy={y - 1.5} r={value === 1 ? 5 : 4} fill="#fff" opacity="0.8" />
        </g>
      ))}
    </svg>
  )
}

export function CssDie({
  size = 44,
  className,
  style,
}: {
  size?: number
  className?: string
  style?: CSSProperties
}) {
  const h = size / 2
  return (
    <div className={`css-die${className ? ` ${className}` : ''}`} style={{ width: size, height: size, ...style }}>
      {FACES.map((face) => (
        <div key={face.value} className="css-die__face" style={{ transform: face.transform(h) }}>
          <DieFace value={face.value} size={size} />
        </div>
      ))}
    </div>
  )
}

/** A flat die for strips and lists: one face, lit from the top left. */
export function FlatDie({ value, size = 22, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`flat-die${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <DieFace value={value} size={size} />
    </span>
  )
}
