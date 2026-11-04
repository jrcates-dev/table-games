import type { ReactNode, SVGProps } from 'react'
import { DENOMINATIONS, type Denomination } from './chips'
import { SUIT_PATH } from './suits'

/**
 * The table's own pictures for its plays, drawn in a 48 box.
 *
 * Where a casino has a gesture for a play, the button shows the gesture: a tap
 * on the felt to hit, a raised palm to stand, two fingers to split, a knuckle
 * rap to check. Where the play is money, it shows the money: a double is the
 * bet with its twin set down beside it, the bets of Hold'em are stacks as tall
 * as their multiple. The rest are the things themselves — dice, cards, the
 * wheel. Each is filled, not outlined, in the table's materials (ivory, clay
 * chips, gold), with the button's own accent picked up by `currentColor` so a
 * picture still belongs to the button it sits on.
 */

type ArtProps = SVGProps<SVGSVGElement>

function Art({ children, className, ...props }: ArtProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
      className={className ? `art-icon ${className}` : 'art-icon'}
      {...props}
    >
      {children}
    </svg>
  )
}

const LINE = '#2a1a11'
const SKIN = '#f8ebd5'
const SKIN_SHADE = '#e6cba5'
const CREASE = '#b38a63'
const GOLD = '#e6bd62'
const GOLD_DEEP = '#9c6c22'
const GOLD_LIGHT = '#fff2c8'
const CREAM = '#f6efe0'
const FELT_RED = '#c4262e'
const BACK = '#8e1a30'

const chip = (value: number): Denomination => DENOMINATIONS.find((d) => d.value === value) ?? DENOMINATIONS[1]
const RED_CHIP = chip(5)
const GREEN_CHIP = chip(25)
const BLACK_CHIP = chip(100)

const f = (n: number) => +n.toFixed(2)

/**
 * Shapes drawn twice — once fattened in the outline colour, once in their fill
 * — so a group of overlapping parts (a palm and its fingers) reads as one
 * silhouette with no seams inside it. Children must not set fill or stroke.
 */
function Solid({ fill, line = LINE, width = 2.4, children }: { fill: string; line?: string; width?: number; children: ReactNode }) {
  return (
    <>
      <g fill={line} stroke={line} strokeWidth={width} strokeLinejoin="round">
        {children}
      </g>
      <g fill={fill}>{children}</g>
    </>
  )
}

/** A finger, or anything rounded at both ends, from one point to another. */
function Capsule({ x1, y1, x2, y2, w }: { x1: number; y1: number; x2: number; y2: number; w: number }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const angle = (Math.atan2(-dx, dy) * 180) / Math.PI
  return <rect x={-w / 2} y={-w / 2} width={w} height={len + w} rx={w / 2} transform={`translate(${x1} ${y1}) rotate(${f(angle)})`} />
}

/** A shirt cuff for a hand to come out of, in the button's colour. */
function Cuff({ x, y, w, h = 8 }: { x: number; y: number; w: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.6" fill="currentColor" stroke={LINE} strokeWidth="1.6" />
      <rect x={x} y={y} width={w} height={h} rx="1.6" fill="#000" fillOpacity="0.28" />
      <path d={`M${x + 1.5} ${y + 2.4}h${w - 3}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  )
}

/**
 * A stack of clay chips seen from a little above, `x` and `y` the centre of
 * the bottom chip's underside. Only the top chip shows its face; the rest show
 * their edges, with the inserts staggered the way a real stack never lines up.
 */
function ChipPile({ x, y, n, r = 10, t = 3.4, denom = RED_CHIP }: { x: number; y: number; n: number; r?: number; t?: number; denom?: Denomination }) {
  const ry = r * 0.42
  const top = y - n * t
  const arcY = (level: number, at: number) => level + ry * Math.sqrt(Math.max(0, 1 - ((at - x) / r) ** 2))
  const silhouette = `M${f(x - r)} ${f(top)}V${f(y)}A${f(r)} ${f(ry)} 0 0 0 ${f(x + r)} ${f(y)}V${f(top)}A${f(r)} ${f(ry)} 0 0 0 ${f(x - r)} ${f(top)}Z`
  const stripes: string[] = []
  for (let i = 0; i < n; i++) {
    const level = y - (i + 1) * t
    const angles = i % 2 === 0 ? [150, 90, 30] : [120, 60]
    for (const a of angles) {
      const rad = (a * Math.PI) / 180
      const cx = x + r * Math.cos(rad)
      const half = 0.15 * r * Math.sin(rad)
      const x0 = cx - half
      const x1 = cx + half
      stripes.push(`M${f(x0)} ${f(arcY(level, x0))}L${f(x1)} ${f(arcY(level, x1))}v${t}L${f(x0)} ${f(arcY(level, x0) + t)}Z`)
    }
  }
  const seams = Array.from({ length: n - 1 }, (_, i) => {
    const level = y - (i + 1) * t
    return `M${f(x - r)} ${f(level)}A${f(r)} ${f(ry)} 0 0 0 ${f(x + r)} ${f(level)}`
  }).join('')
  return (
    <g>
      <path d={silhouette} fill={denom.shade} stroke={LINE} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={silhouette} fill={denom.body} fillOpacity="0.55" />
      <path d={stripes.join('')} fill={denom.insert} />
      {seams && <path d={seams} fill="none" stroke={LINE} strokeOpacity="0.55" strokeWidth="0.9" />}
      <ellipse cx={x} cy={top} rx={r} ry={ry} fill={denom.body} />
      <ellipse
        cx={x}
        cy={top}
        rx={f(r * 0.8)}
        ry={f(ry * 0.8)}
        fill="none"
        stroke={denom.insert}
        strokeWidth={f(r * 0.2)}
        pathLength={12}
        strokeDasharray="1 1"
        strokeDashoffset="0.5"
      />
      <ellipse cx={x} cy={top} rx={f(r * 0.5)} ry={f(ry * 0.5)} fill={CREAM} stroke={denom.shade} strokeWidth="0.8" />
      <path
        d={`M${f(x - r)} ${f(top)}A${f(r)} ${f(ry)} 0 0 0 ${f(x + r)} ${f(top)}`}
        fill="none"
        stroke={LINE}
        strokeOpacity="0.5"
        strokeWidth="0.9"
      />
      <path
        d={`M${f(x - r * 0.78)} ${f(top - ry * 0.35)}A${f(r * 0.9)} ${f(ry * 0.9)} 0 0 1 ${f(x - r * 0.1)} ${f(top - ry * 0.88)}`}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </g>
  )
}

/** A four-pointed glint. */
function Sparkle({ x, y, r }: { x: number; y: number; r: number }) {
  const k = r * 0.22
  return (
    <path
      d={`M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`}
      fill={GOLD_LIGHT}
      stroke={GOLD_DEEP}
      strokeWidth="0.6"
    />
  )
}

/** Ripples on the felt where a hand comes down on it. */
function Ripple({ x, y, wide = 1 }: { x: number; y: number; wide?: number }) {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <ellipse cx={x} cy={y} rx={6 * wide} ry={1.9 * wide} strokeWidth="1.7" />
      <ellipse cx={x} cy={y} rx={10.5 * wide} ry={3.3 * wide} strokeWidth="1.3" strokeOpacity="0.5" />
    </g>
  )
}

/** A card, face down in the house colour or face up as an ace. */
function Card({ x, y, rotate, back = false, w = 17, h = 24 }: { x: number; y: number; rotate: number; back?: boolean; w?: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2.4" fill={back ? BACK : SKIN} stroke={LINE} strokeWidth="1.8" />
      {back ? (
        <>
          <rect x={-w / 2 + 2.2} y={-h / 2 + 2.2} width={w - 4.4} height={h - 4.4} rx="1.2" fill="none" stroke={GOLD} strokeWidth="0.9" />
          <path d={`M0 ${-h / 2 + 5}L${w / 2 - 4.6} 0L0 ${h / 2 - 5}L${-w / 2 + 4.6} 0Z`} fill="none" stroke={GOLD} strokeOpacity="0.7" strokeWidth="0.8" />
          <circle r="1.6" fill={GOLD} />
        </>
      ) : (
        <>
          <path d={SUIT_PATH.S} fill="#17161f" transform={`translate(${-w * 0.3} ${-h * 0.22}) scale(${f((w * 0.6) / 100)})`} />
          <text
            x={-w / 2 + 2}
            y={-h / 2 + 6.2}
            fontFamily="'Cormorant Garamond', Georgia, serif"
            fontWeight="700"
            fontSize="6.6"
            fill="#17161f"
          >
            A
          </text>
        </>
      )}
    </g>
  )
}

/** A die drawn in isometric view, `x`,`y` the top of its front edge. */
function Die({ x, y, s, top, left, right, tilt = 0 }: { x: number; y: number; s: number; top: number; left: number; right: number; tilt?: number }) {
  const c = 0.866 * s
  const h = 0.5 * s
  const faces: Array<{ m: number[]; fill: string; pips: number }> = [
    { m: [c, h, c, -h, x - c, y - h], fill: '#e5444d', pips: top },
    { m: [c, h, 0, s, x - c, y - h], fill: '#c4262e', pips: left },
    { m: [c, -h, 0, s, x, y], fill: '#8f171e', pips: right },
  ]
  const outline = `M${f(x)} ${f(y - s)}L${f(x + c)} ${f(y - h)}V${f(y + h)}L${f(x)} ${f(y + s)}L${f(x - c)} ${f(y + h)}V${f(y - h)}Z`
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}>
      <path d={outline} fill={LINE} stroke={LINE} strokeWidth="2.2" strokeLinejoin="round" />
      {faces.map((face, i) => (
        <g key={i} transform={`matrix(${face.m.map(f).join(' ')})`}>
          <rect width="1" height="1" fill={face.fill} />
          {PIPS[face.pips].map(([px, py], j) => (
            <circle key={j} cx={px} cy={py} r="0.105" fill={CREAM} />
          ))}
        </g>
      ))}
      <path
        d={`M${f(x - c)} ${f(y - h)}L${f(x)} ${f(y)}L${f(x + c)} ${f(y - h)}M${f(x)} ${f(y)}V${f(y + s)}`}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
    </g>
  )
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.24],
    [0.27, 0.5],
    [0.27, 0.76],
    [0.73, 0.24],
    [0.73, 0.5],
    [0.73, 0.76],
  ],
}

function annularSector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => {
    const rad = ((a - 90) * Math.PI) / 180
    return `${f(cx + r * Math.cos(rad))} ${f(cy + r * Math.sin(rad))}`
  }
  return `M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`
}

// ---------------------------------------------------------------------------
// Blackjack

/** Hit: a fingertip tapped on the felt. */
export const ArtHit = (p: ArtProps) => (
  <Art {...p}>
    <Ripple x={18.5} y={42} />
    <Cuff x={13.5} y={-2} w={22.5} h={7.5} />
    <Solid fill={SKIN}>
      <rect x="13" y="4" width="23.5" height="19" rx="7" />
      <Capsule x1={18.4} y1={16} x2={18.4} y2={39.2} w={6.6} />
      <Capsule x1={24.6} y1={19.5} x2={24.6} y2={26.2} w={5.6} />
      <Capsule x1={30.1} y1={19} x2={30.1} y2={25} w={5.4} />
      <Capsule x1={34.6} y1={17.5} x2={34.6} y2={22} w={4.4} />
    </Solid>
    <path d="M21.7 21v6.4M27.35 21v5.8M32.5 20v4.2" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
    <rect x="16.3" y="33" width="4.2" height="5.4" rx="2.1" fill={SKIN_SHADE} stroke={CREASE} strokeWidth="0.8" />
    <path d="M16.5 14.5c4.5 1.4 13.5 1.4 18 0" stroke={CREASE} strokeWidth="1.1" strokeLinecap="round" fill="none" />
  </Art>
)

/** Stand: the open palm that waves the dealer past. */
export const ArtStand = (p: ArtProps) => (
  <Art {...p}>
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M8.2 9.5c-2.2 3.2-2.2 7.6 0 10.8" strokeWidth="1.9" />
      <path d="M4.2 7c-3.3 4.8-3.3 11 0 15.8" strokeWidth="1.5" strokeOpacity="0.55" />
      <path d="M39.8 9.5c2.2 3.2 2.2 7.6 0 10.8" strokeWidth="1.9" />
      <path d="M43.8 7c3.3 4.8 3.3 11 0 15.8" strokeWidth="1.5" strokeOpacity="0.55" />
    </g>
    <Cuff x={14.5} y={41} w={19} />
    <Solid fill={SKIN}>
      <rect x="14" y="21" width="20.5" height="22" rx="7" />
      <Capsule x1={17.4} y1={25} x2={16} y2={9.5} w={5.3} />
      <Capsule x1={22.4} y1={24} x2={22.4} y2={6.5} w={5.5} />
      <Capsule x1={27.4} y1={24} x2={28.6} y2={8} w={5.3} />
      <Capsule x1={31.6} y1={27} x2={34} y2={13.5} w={4.8} />
      <Capsule x1={16.5} y1={35} x2={8.6} y2={24.5} w={6} />
    </Solid>
    <path d="M19 37.5c3 1.6 7 1.6 10.5-0.6" stroke={CREASE} strokeWidth="1.1" strokeLinecap="round" fill="none" />
    <path d="M30.5 24.5c1.5 4 1.5 9.5-0.5 14" stroke={SKIN_SHADE} strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </Art>
)

/** Split: two fingers held apart, the signal a dealer reads for a split. */
export const ArtSplit = (p: ArtProps) => (
  <Art {...p}>
    <Cuff x={14.5} y={41} w={19} />
    <Solid fill={SKIN}>
      <rect x="14" y="23" width="20" height="21" rx="7" />
      <Capsule x1={19.5} y1={28} x2={13.4} y2={6.5} w={6.2} />
      <Capsule x1={27.5} y1={28} x2={33.6} y2={6} w={6.2} />
    </Solid>
    <Solid fill={SKIN}>
      <Capsule x1={23.5} y1={27.4} x2={32.6} y2={27.4} w={5.4} />
    </Solid>
    <Solid fill={SKIN}>
      <Capsule x1={23.8} y1={32.4} x2={31.8} y2={32.4} w={5} />
    </Solid>
    <Solid fill={SKIN}>
      <Capsule x1={15.2} y1={37.5} x2={24.6} y2={33.4} w={6} />
    </Solid>
    <path d="M14.6 9.5l1.4 5M32.4 9l-1.4 5" stroke={SKIN_SHADE} strokeWidth="1.8" strokeLinecap="round" />
  </Art>
)

/** Double: the bet in its circle, and its twin set down right beside it. */
export const ArtDouble = (p: ArtProps) => (
  <Art {...p}>
    <ellipse cx="14" cy="38.6" rx="12.6" ry="5.8" fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.4" />
    <ChipPile x={14} y={38.6} n={4} r={9.6} />
    <ChipPile x={34} y={41.4} n={4} r={9.6} />
    <Sparkle x={41.5} y={11} r={4.6} />
  </Art>
)

/** Surrender: the white flag. */
export const ArtSurrender = (p: ArtProps) => (
  <Art {...p}>
    <rect x="10.6" y="6" width="3" height="40" rx="1.5" fill={GOLD} stroke={LINE} strokeWidth="1.4" />
    <circle cx="12.1" cy="5.4" r="3" fill={GOLD_LIGHT} stroke={LINE} strokeWidth="1.4" />
    <path
      d="M13.8 9c5.5-2.6 10.6 1.6 15.6-0.4 4.4-1.7 8.2-2.4 12.4-0.8v17.6c-4.2-1.6-8-0.9-12.4 0.8-5 2-10.1-2.2-15.6 0.4Z"
      fill={SKIN}
      stroke={LINE}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M29.4 8.6c-1.2 5.8-1.2 11.8 0 17.6" stroke={SKIN_SHADE} strokeWidth="2.4" fill="none" />
    <path d="M13.8 26.6c5.5-2.6 10.6 1.6 15.6-0.4" stroke={SKIN_SHADE} strokeWidth="0" fill="none" />
  </Art>
)

/** Insurance: a shield against the dealer's ace. */
export const ArtInsure = (p: ArtProps) => (
  <Art {...p}>
    <path d="M24 3.5 40.5 9.2V22c0 10.6-7.2 18.6-16.5 22.5C14.7 40.6 7.5 32.6 7.5 22V9.2Z" fill={GOLD} stroke={LINE} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M24 7.8 36.6 12.2V22.3c0 8.3-5.5 14.8-12.6 18-7.1-3.2-12.6-9.7-12.6-18V12.2Z" fill={SKIN} />
    <path d={SUIT_PATH.S} fill="#17161f" transform="translate(16 15.5) scale(0.16)" />
    <path d="M10.2 11.2 24 6.4" stroke={GOLD_LIGHT} strokeWidth="1.2" strokeLinecap="round" />
  </Art>
)

/** Declining insurance: the same shield, struck through. */
export const ArtDecline = (p: ArtProps) => (
  <Art {...p}>
    <path d="M24 3.5 40.5 9.2V22c0 10.6-7.2 18.6-16.5 22.5C14.7 40.6 7.5 32.6 7.5 22V9.2Z" fill="#8d8795" stroke={LINE} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M24 7.8 36.6 12.2V22.3c0 8.3-5.5 14.8-12.6 18-7.1-3.2-12.6-9.7-12.6-18V12.2Z" fill="#3a3540" />
    <path d={SUIT_PATH.S} fill="#8d8795" transform="translate(16 15.5) scale(0.16)" />
    <path d="M9 39 39 9" stroke={LINE} strokeWidth="6" strokeLinecap="round" />
    <path d="M9 39 39 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </Art>
)

// ---------------------------------------------------------------------------
// Dealing, rolling, spinning

/** Deal: a card down and an ace turned up. */
export const ArtDeal = (p: ArtProps) => (
  <Art {...p}>
    <Card x={18} y={25} rotate={-15} back />
    <Card x={29.5} y={24} rotate={12} />
  </Art>
)

/** Roll: two dice showing a seven. */
export const ArtRoll = (p: ArtProps) => (
  <Art {...p}>
    <Die x={16.5} y={21} s={12} top={5} left={1} right={3} />
    <Die x={34} y={28.5} s={10} top={2} left={6} right={3} tilt={14} />
  </Art>
)

const WHEEL_POCKETS = 18

/** Spin: the wheel from above, the ball dropped in a pocket. */
export const ArtSpin = (p: ArtProps) => (
  <Art {...p}>
    <circle cx="24" cy="24" r="22" fill="#4b2b15" stroke={LINE} strokeWidth="1.6" />
    <circle cx="24" cy="24" r="20.4" fill="none" stroke={GOLD} strokeWidth="1.1" />
    <circle cx="24" cy="24" r="18.8" fill={GOLD_DEEP} />
    {Array.from({ length: WHEEL_POCKETS }, (_, i) => {
      const step = 360 / WHEEL_POCKETS
      const fill = i === 0 ? '#1b7d4a' : i % 2 ? FELT_RED : '#17161f'
      return <path key={i} d={annularSector(24, 24, 12.6, 18.4, i * step + 0.7, (i + 1) * step - 0.7)} fill={fill} />
    })}
    <circle cx="24" cy="24" r="12.6" fill="#6b3f1d" stroke={GOLD_DEEP} strokeWidth="0.8" />
    <circle cx="24" cy="24" r="9.2" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="0.8" />
    <g stroke={GOLD_LIGHT} strokeWidth="1.5" strokeLinecap="round">
      <path d="M18.3 18.3 29.7 29.7M29.7 18.3 18.3 29.7" />
    </g>
    <g fill={GOLD_LIGHT} stroke={GOLD_DEEP} strokeWidth="0.6">
      <circle cx="18.3" cy="18.3" r="1.5" />
      <circle cx="29.7" cy="18.3" r="1.5" />
      <circle cx="18.3" cy="29.7" r="1.5" />
      <circle cx="29.7" cy="29.7" r="1.5" />
      <circle cx="24" cy="24" r="2.6" />
    </g>
    <circle cx="35.2" cy="12.8" r="2.3" fill="#fff" stroke={LINE} strokeWidth="0.9" />
    <path d="M8 12.5A19 19 0 0 1 14 6.8" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
  </Art>
)

// ---------------------------------------------------------------------------
// The chips: making, repeating and taking back bets

/** Take every bet back down. */
export const ArtClear = (p: ArtProps) => (
  <Art {...p}>
    <ChipPile x={20} y={41} n={3} r={12} t={4} />
    <circle cx="36" cy="14" r="8" fill="#d33f49" stroke={LINE} strokeWidth="1.8" />
    <path d="m32.6 10.6 6.8 6.8m0-6.8-6.8 6.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
  </Art>
)

/** Step back one bet. */
export const ArtUndo = (p: ArtProps) => (
  <Art {...p}>
    <ChipPile x={27} y={41} n={1} r={13} t={4.4} />
    <path d="M37 25C37 13 22 8 13.5 16.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    <path d="m11.5 9.5 1.6 8.2 8-1.8" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </Art>
)

/** The last bets again. */
export const ArtRebet = (p: ArtProps) => (
  <Art {...p}>
    <path d="M8.5 30A15.5 15.5 0 0 1 38.6 22" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    <path d="m32.6 21.4 6.4 1.6 1.8-6.6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    <ChipPile x={24} y={42} n={3} r={11} t={3.8} />
  </Art>
)

/** Craps' free odds: a taller stack set behind the line bet. */
export const ArtOdds = (p: ArtProps) => (
  <Art {...p}>
    <ChipPile x={30} y={37} n={6} r={10} t={3.4} denom={GREEN_CHIP} />
    <ChipPile x={17} y={43} n={2} r={10} t={3.4} />
    <Sparkle x={10.5} y={12} r={5} />
  </Art>
)

/** A new wager: a chip dropping into an empty circle. */
export const ArtNewBet = (p: ArtProps) => (
  <Art {...p}>
    <ellipse cx="24" cy="38" rx="18" ry="7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.6" />
    <g stroke="currentColor" strokeLinecap="round" strokeWidth="1.8">
      <path d="M17 6.5v5M24 3.5v6M31 6.5v5" />
    </g>
    <ChipPile x={24} y={27} n={1} r={12.5} t={4.6} />
  </Art>
)

/** A fresh stake: three new stacks. */
export const ArtBuyIn = (p: ArtProps) => (
  <Art {...p}>
    <ChipPile x={15} y={36} n={5} r={9} t={3.2} denom={BLACK_CHIP} />
    <ChipPile x={33} y={36} n={6} r={9} t={3.2} denom={GREEN_CHIP} />
    <ChipPile x={24} y={44} n={3} r={9} t={3.2} />
    <Sparkle x={41} y={9} r={4.4} />
  </Art>
)

// ---------------------------------------------------------------------------
// Hold'em

/** Check: a knuckle rap on the felt. */
export const ArtCheck = (p: ArtProps) => (
  <Art {...p}>
    <Ripple x={24} y={40.5} wide={1.3} />
    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8.5 31.5 5 29M39.5 31.5 43 29" />
    </g>
    <Cuff x={15} y={-2} w={19} h={7.5} />
    <Solid fill={SKIN}>
      <rect x="12.5" y="4" width="23.5" height="26" rx="7.5" />
      <Capsule x1={15.2} y1={13} x2={13.6} y2={24} w={6} />
    </Solid>
    <Solid fill={SKIN}>
      <Capsule x1={17.4} y1={29} x2={17.4} y2={32.6} w={5.6} />
      <Capsule x1={23} y1={29.5} x2={23} y2={34} w={5.6} />
      <Capsule x1={28.6} y1={29.5} x2={28.6} y2={33.4} w={5.6} />
      <Capsule x1={33.6} y1={28.5} x2={33.6} y2={31.4} w={4.8} />
    </Solid>
    <path d="M20.2 29.5v4.6M25.8 29.5v5M31.3 29v3.8" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M16 24.5c4.5 1.6 13.5 1.6 18 0" stroke={CREASE} strokeWidth="1.1" strokeLinecap="round" fill="none" />
    <path d="M32 9c1.6 4 1.6 10 0 14" stroke={SKIN_SHADE} strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </Art>
)

/** A Hold'em raise: a stack as tall as its multiple of the Ante. */
export const ArtBet = ({ multiple, ...p }: ArtProps & { multiple: number }) => (
  <Art {...p}>
    <ellipse cx="24" cy="40" rx="18" ry="6.8" fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />
    <ChipPile x={24} y={40.5} n={multiple} r={12.5} t={5} />
  </Art>
)

/** Fold: the hand pushed face down into the muck. */
export const ArtFold = (p: ArtProps) => (
  <Art {...p}>
    <g stroke="currentColor" strokeLinecap="round">
      <path d="m33.5 35.5 9 6" strokeWidth="2.2" />
      <path d="m29 41 7.5 5" strokeWidth="1.8" strokeOpacity="0.6" />
      <path d="m38.5 30.5 6 4" strokeWidth="1.6" strokeOpacity="0.45" />
    </g>
    <Card x={19} y={22} rotate={-26} back w={18} h={25} />
    <Card x={26.5} y={19.5} rotate={-6} back w={18} h={25} />
  </Art>
)
