import { memo, type CSSProperties } from 'react'
import { roomTextures, SLOTS, SLOTS_W, type TablePicture } from './room/textures'

/** The slot bank's proportions, so the CSS can stand it on the floor line and tile it. */
const SLOT_VARS = {
  '--slots-ratio': SLOTS_W / SLOTS.h,
  '--slots-base': SLOTS.base / SLOTS.h,
} as CSSProperties

/**
 * Where each table stands: the middle of its footprint, in vh from the centre
 * of the room and the top of the screen, and the height of its picture. Both
 * are drawn to the same scale, about a vh to every 5cm, which is the room's
 * own at that depth: the slot machines behind them stand two metres tall.
 */
const TABLE_PLACES = {
  blackjack: { x: -68, y: 78, h: 35 },
  craps: { x: 66, y: 80, h: 49.8 },
}

function tableStyle(art: TablePicture, place: { x: number; y: number; h: number }): CSSProperties {
  const w = (place.h * art.width) / art.height
  return {
    backgroundImage: art.url,
    width: `${w.toFixed(2)}vh`,
    height: `${place.h}vh`,
    left: `calc(50% + ${(place.x - art.anchorX * w).toFixed(2)}vh)`,
    top: `${(place.y - art.anchorY * place.h).toFixed(2)}vh`,
  }
}

const TOPPER_COLOURS = ['255, 140, 130', '255, 222, 140', '214, 170, 255', '140, 255, 220']

/** Light on two of each bank's four toppers; the other two flash in turn. */
function toppers(...cabinets: number[]): string {
  const y = ((18 / SLOTS.h) * 100).toFixed(2)
  return cabinets
    .map((i) => {
      const x = (((SLOTS.aisle / 2 + i * (SLOTS.cab + SLOTS.gap) + SLOTS.cab / 2) / SLOTS_W) * 100).toFixed(2)
      return `radial-gradient(ellipse 2.4vh 1.3vh at ${x}% ${y}%, rgba(${TOPPER_COLOURS[i]}, 0.8), transparent)`
    })
    .join(', ')
}

/**
 * The casino around the table.
 *
 * A real room, not an abstraction of one: gilt-panelled walls with sconces on
 * every pilaster, a bank of slot machines glowing along the far wall,
 * chandeliers overhead and the loud, ornate carpet every casino floor is laid
 * with. The lobby looks across the room; sitting down at a table, the camera
 * tilts down — the room slides up and away while the carpet under the table
 * rises into view, leaving the table in its own pool of light. Only
 * transforms and opacity change, so the move is smooth.
 *
 * Everything is static apart from a few lights, and none of it is blurred or
 * blended while it moves, so the room costs next to nothing once painted.
 *
 * Sideways on a phone there is no space to spare for a room. Sitting down
 * there, felt comes up over it from edge to edge of the screen instead, and
 * the table is drawn on it without its walnut and leather, so the game is
 * all there is to see.
 */
export const Backdrop = memo(function Backdrop({ variant = 'table' }: { variant?: 'table' | 'lobby' }) {
  const tex = roomTextures()

  return (
    <div className={`room room--${variant}`} aria-hidden="true">
      <div className="room__world">
        <div className="room__wall" style={{ backgroundImage: tex.wall } as CSSProperties} />
        <div className="room__sconces" />
        <div className="room__ceiling" />
        <div className="room__floor">
          <div className="room__carpet" style={{ backgroundImage: tex.carpet } as CSSProperties} />
        </div>
        <div className="room__floor-shade" />
        <div className="room__slots" style={SLOT_VARS}>
          <div className="room__slots-glow" />
          <div className="room__slots-art" style={{ backgroundImage: tex.slots } as CSSProperties} />
          <div className="room__slots-blink" style={{ backgroundImage: toppers(0, 2) }} />
          <div className="room__slots-blink room__slots-blink--late" style={{ backgroundImage: toppers(1, 3) }} />
        </div>
        <div className="room__table" style={tableStyle(tex.blackjack, TABLE_PLACES.blackjack)} />
        <div className="room__table" style={tableStyle(tex.craps, TABLE_PLACES.craps)} />
        <Chandelier className="room__chandelier room__chandelier--left" />
        <Chandelier className="room__chandelier room__chandelier--right" />
      </div>
      <div className="room__ground">
        <div className="room__ground-carpet" style={{ backgroundImage: tex.carpet } as CSSProperties} />
      </div>
      <div className="room__pool" />
      <div className="room__vignette" />
      <div className="room__felt" />
    </div>
  )
})

const CHANDELIER_TIERS = [
  { y: 92, rx: 96, ry: 16, count: 16, size: 3.4 },
  { y: 66, rx: 70, ry: 12, count: 12, size: 3 },
  { y: 44, rx: 44, ry: 8, count: 8, size: 2.6 },
]

/** Every drop on the frame: where it hangs, and which of three moments it catches the light in, if it does. */
const CRYSTALS = (() => {
  const out: Array<{ key: string; x: number; y: number; ti: number; size: number; front: boolean; glint: number | null }> = []
  CHANDELIER_TIERS.forEach((t, ti) => {
    for (let i = 0; i < t.count; i++) {
      const a = (i / t.count) * Math.PI * 2
      out.push({
        key: `${ti}-${i}`,
        x: Math.cos(a) * t.rx,
        y: t.y + Math.sin(a) * t.ry,
        ti,
        size: t.size,
        front: Math.sin(a) > -0.2,
        glint: i % 5 === ti ? Math.floor((i * 0.37 + ti) % 3) : null,
      })
    }
  })
  return out
})()

const DROP_BOTTOM = 'M 0 104 l 7 12 l -7 12 l -7 -12 Z'

function dropPath(c: (typeof CRYSTALS)[number]): string {
  const top = c.y + 12 + c.ti * 2
  return `M ${c.x} ${top} l ${c.size} ${c.size * 1.6} l ${-c.size} ${c.size * 1.6} l ${-c.size} ${-c.size * 1.6} Z`
}

/**
 * Crystal on a tiered brass frame, a few drops catching the light.
 *
 * The frame is drawn once. The drops that glint are drawn again in gold on
 * three layers over it, and each layer fades in and out in turn, so the
 * twinkle is the compositor changing three opacities, not the chandelier
 * repainted every frame. It never changes, so the room moving between the
 * lobby and a table does not rebuild it either.
 */
const Chandelier = memo(function Chandelier({ className }: { className: string }) {
  return (
    <div className={className}>
      <svg viewBox="-130 -160 260 300" aria-hidden="true">
        <defs>
          <radialGradient id="chand-halo">
            <stop offset="0" stopColor="#ffe7b0" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#ffc56e" stopOpacity="0.18" />
            <stop offset="1" stopColor="#ffb050" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="chand-bulb">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.4" stopColor="#ffe9b8" />
            <stop offset="1" stopColor="#ffbf60" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="0" cy="60" rx="128" ry="96" fill="url(#chand-halo)" />
        <line x1="0" y1="-160" x2="0" y2="20" stroke="#8a6526" strokeWidth="2" />
        <path d="M -10 20 L 10 20 L 6 40 L -6 40 Z" fill="#c99c45" />
        {CHANDELIER_TIERS.map((t, ti) => (
          <g key={ti}>
            <ellipse cx="0" cy={t.y} rx={t.rx} ry={t.ry} fill="none" stroke="#d9b46a" strokeWidth="1.6" opacity="0.8" />
            {CRYSTALS.filter((c) => c.ti === ti).map((c) => (
              <g key={c.key} opacity={c.front ? 1 : 0.55}>
                <line x1={c.x} y1={c.y} x2={c.x} y2={c.y + 14 + ti * 2} stroke="#fff6dc" strokeOpacity="0.5" strokeWidth="0.8" />
                <path d={dropPath(c)} fill="#fffaf0" />
              </g>
            ))}
            {Array.from({ length: Math.round(t.count / 2) }, (_, i) => {
              const a = (i / Math.round(t.count / 2)) * Math.PI * 2 + 0.2
              return <circle key={i} cx={Math.cos(a) * t.rx * 0.9} cy={t.y - 6 + Math.sin(a) * t.ry * 0.9} r="7" fill="url(#chand-bulb)" />
            })}
          </g>
        ))}
        <path d={DROP_BOTTOM} fill="#fffaf0" />
      </svg>
      {[0, 1, 2].map((glint) => (
        <svg key={glint} className="room__glints" viewBox="-130 -160 260 300" style={{ animationDelay: `${-glint}s` }} aria-hidden="true">
          {CRYSTALS.filter((c) => c.glint === glint).map((c) => (
            <path key={c.key} d={dropPath(c)} fill="#ffd27a" opacity={c.front ? 1 : 0.55} />
          ))}
          {glint === 0 && <path d={DROP_BOTTOM} fill="#ffd27a" />}
        </svg>
      ))}
    </div>
  )
})
