import { memo } from 'react'
import type { Rank, Suit } from '../engine/types'
import type { CardBack as CardBackTheme } from '../prefs/prefsStore'
import { isRed, SUIT_PATH, suitInk } from './suits'

/**
 * The deck.
 *
 * Every card is drawn at 250×350 — the 2.5 × 3.5 inch proportion of a real
 * casino card — and scales cleanly to whatever size the table wants. Number
 * cards use the traditional pip arrangements; the face cards are an Art Deco set
 * of monograms in keeping with the room, because a pastiche of the 19th-century
 * French face cards drawn in SVG would look like exactly that.
 */

export const CARD_W = 250
export const CARD_H = 350

function Pip({ suit, x, y, size, flip = false }: { suit: Suit; x: number; y: number; size: number; flip?: boolean }) {
  const s = size / 100
  const transform = `translate(${x} ${y}) ${flip ? 'rotate(180)' : ''} scale(${s}) translate(-50 -50)`
  return <path d={SUIT_PATH[suit]} transform={transform} fill={suitInk(suit)} />
}

// ---------------------------------------------------------------------------
// Pip layouts — the arrangements every deck since the 1800s has used.
// ---------------------------------------------------------------------------

const L = 84
const C = 125
const R = 166
const TOP = 74
const BOT = 276
const MID = 175

const PIPS: Record<string, Array<[number, number]>> = {
  '2': [[C, TOP], [C, BOT]],
  '3': [[C, TOP], [C, MID], [C, BOT]],
  '4': [[L, TOP], [R, TOP], [L, BOT], [R, BOT]],
  '5': [[L, TOP], [R, TOP], [C, MID], [L, BOT], [R, BOT]],
  '6': [[L, TOP], [R, TOP], [L, MID], [R, MID], [L, BOT], [R, BOT]],
  '7': [[L, TOP], [R, TOP], [C, 124], [L, MID], [R, MID], [L, BOT], [R, BOT]],
  '8': [[L, TOP], [R, TOP], [C, 124], [L, MID], [R, MID], [C, 226], [L, BOT], [R, BOT]],
  '9': [[L, TOP], [R, TOP], [L, 141], [R, 141], [C, MID], [L, 209], [R, 209], [L, BOT], [R, BOT]],
  '10': [[L, TOP], [R, TOP], [C, 107], [L, 141], [R, 141], [L, 209], [R, 209], [C, 243], [L, BOT], [R, BOT]],
}

/**
 * Corner index. Set in a bold Garamond rather than the Deco display face: the
 * display face draws its 1 as a Roman I, and a ten that reads "IO" is a card
 * nobody can play quickly.
 */
function Index({ rank, suit }: { rank: Rank; suit: Suit }) {
  const ink = suitInk(suit)
  const ten = rank === '10'
  return (
    <g>
      <text
        x="31"
        y="56"
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontWeight="700"
        fontSize={ten ? 47 : 54}
        letterSpacing={ten ? -3.5 : 0}
        style={{ fontVariantNumeric: 'lining-nums' }}
        fill={ink}
      >
        {rank}
      </text>
      <Pip suit={suit} x={31} y={81} size={27} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// The face cards
// ---------------------------------------------------------------------------

const CROWN = 'M -32 12 L -37 -20 L -19 -5 L 0 -29 L 19 -5 L 37 -20 L 32 12 Z M -32 15 H 32 V 23 H -32 Z'
const TIARA =
  'M -34 16 C -26 -2, -14 -10, 0 -12 C 14 -10, 26 -2, 34 16 C 22 9, 11 6, 0 6 C -11 6, -22 9, -34 16 Z M -6 -12 L 0 -26 L 6 -12 Z'
const FLEUR = [
  'M 0 -32 C 9 -20, 11 -6, 0 8 C -11 -6, -9 -20, 0 -32 Z',
  'M -3 6 C -8 -6, -20 -10, -29 -3 C -35 3, -31 14, -22 13 C -26 7, -20 2, -12 7 Z',
  'M 3 6 C 8 -6, 20 -10, 29 -3 C 35 3, 31 14, 22 13 C 26 7, 20 2, 12 7 Z',
  'M -16 8 H 16 V 14 H -16 Z',
  'M -5 14 L 0 26 L 5 14 Z',
].join(' ')

function Emblem({ rank }: { rank: 'J' | 'Q' | 'K' }) {
  const pearls: Array<[number, number]> =
    rank === 'K' ? [[-37, -20], [0, -29], [37, -20]] : rank === 'Q' ? [[0, -27], [-24, 0], [24, 0]] : []
  return (
    <g transform="translate(125 98)">
      <path d={rank === 'K' ? CROWN : rank === 'Q' ? TIARA : FLEUR} fill="url(#gold-foil)" stroke="#7a5a1c" strokeWidth="1.2" />
      {pearls.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.6" fill="#fff8e6" stroke="#7a5a1c" strokeWidth="1" />
      ))}
    </g>
  )
}

function Sunburst({ cx, cy, rays, r0, r1, color, opacity }: { cx: number; cy: number; rays: number; r0: number; r1: number; color: string; opacity: number }) {
  const paths: string[] = []
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2
    const w = (Math.PI / rays) * 0.42
    const p = (r: number, ang: number) => `${(cx + r * Math.cos(ang)).toFixed(1)} ${(cy + r * Math.sin(ang)).toFixed(1)}`
    paths.push(`M ${p(r0, a)} L ${p(r1, a - w)} L ${p(r1, a + w)} Z`)
  }
  return <path d={paths.join(' ')} fill={color} opacity={opacity} />
}

function FaceCard({ rank, suit }: { rank: 'J' | 'Q' | 'K'; suit: Suit }) {
  const ink = suitInk(suit)
  const red = isRed(suit)
  const tint = red ? ['#fff6f0', '#f6dfd6'] : ['#f5f6fb', '#dfe2ec']
  const gradient = `face-card-${red ? 'r' : 'b'}`
  return (
    <g>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint[0]} />
          <stop offset="1" stopColor={tint[1]} />
        </linearGradient>
        <clipPath id={`face-card-clip-${red ? 'r' : 'b'}`}>
          <rect x="52" y="40" width="146" height="270" rx="9" />
        </clipPath>
      </defs>
      <rect x="52" y="40" width="146" height="270" rx="9" fill={`url(#${gradient})`} />
      <g clipPath={`url(#face-card-clip-${red ? 'r' : 'b'})`}>
        <Sunburst cx={125} cy={196} rays={36} r0={20} r1={230} color="#c99c45" opacity={0.17} />
      </g>
      <rect x="52" y="40" width="146" height="270" rx="9" fill="none" stroke={ink} strokeWidth="2.4" />
      <rect x="58" y="46" width="134" height="258" rx="6" fill="none" stroke="#c99c45" strokeWidth="1.2" />
      {/* Stepped Deco corners */}
      {[
        [58, 46, 1, 1],
        [192, 46, -1, 1],
        [58, 304, 1, -1],
        [192, 304, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <path
          key={i}
          d={`M ${x} ${y + sy * 18} L ${x + sx * 6} ${y + sy * 18} L ${x + sx * 6} ${y + sy * 6} L ${x + sx * 18} ${y + sy * 6} L ${x + sx * 18} ${y}`}
          fill="none"
          stroke="#c99c45"
          strokeWidth="1.2"
        />
      ))}
      <Emblem rank={rank} />
      <text
        // The Q's tail sweeps right; nudge it back so it stays inside the frame.
        x={rank === 'Q' ? 119 : 125}
        y="222"
        textAnchor="middle"
        fontFamily="Cinzel, Georgia, serif"
        fontWeight="700"
        fontSize="106"
        fill={ink}
        stroke="#c99c45"
        strokeWidth="1.4"
        paintOrder="stroke"
      >
        {rank}
      </text>
      <Pip suit={suit} x={125} y={268} size={36} />
    </g>
  )
}

function Ace({ suit }: { suit: Suit }) {
  const spade = suit === 'S'
  return (
    <g>
      <circle cx="125" cy="175" r={spade ? 78 : 66} fill="none" stroke="#c99c45" strokeWidth="1.3" opacity="0.8" />
      <circle cx="125" cy="175" r={spade ? 72 : 60} fill="none" stroke="#c99c45" strokeWidth="0.6" opacity="0.6" strokeDasharray="1.5 4" />
      {spade && <Sunburst cx={125} cy={175} rays={48} r0={80} r1={96} color="#c99c45" opacity={0.55} />}
      <Pip suit={suit} x={125} y={spade ? 172 : 175} size={spade ? 118 : 92} />
      {spade && (
        <text x="125" y="276" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="600" fontSize="12" letterSpacing="5" fill="#9a7630">
          ARENA
        </text>
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------

export const CardFace = memo(function CardFace({ rank, suit }: { rank: Rank; suit: Suit }) {
  const faceCard = rank === 'J' || rank === 'Q' || rank === 'K'
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width={CARD_W - 1} height={CARD_H - 1} rx="17" fill="url(#card-paper)" />
      <rect x="0.5" y="0.5" width={CARD_W - 1} height={CARD_H - 1} rx="17" fill="none" stroke="#d9cfba" strokeWidth="1.2" />
      {rank === 'A' ? (
        <Ace suit={suit} />
      ) : faceCard ? (
        <FaceCard rank={rank} suit={suit} />
      ) : (
        PIPS[rank].map(([x, y], i) => <Pip key={i} suit={suit} x={x} y={y} size={44} flip={y > MID + 1} />)
      )}
      <Index rank={rank} suit={suit} />
      <g transform={`rotate(180 ${CARD_W / 2} ${CARD_H / 2})`}>
        <Index rank={rank} suit={suit} />
      </g>
    </svg>
  )
})

const BACK_COLORS: Record<CardBackTheme, [string, string]> = {
  crimson: ['#8e1a30', '#4d0a18'],
  navy: ['#1c3264', '#0a1430'],
  emerald: ['#11583f', '#05281c'],
  onyx: ['#26252e', '#0c0c10'],
}

export const CardBackFace = memo(function CardBackFace({ theme }: { theme: CardBackTheme }) {
  const [hi, lo] = BACK_COLORS[theme]
  const id = `back-${theme}`
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-g`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor={hi} />
          <stop offset="1" stopColor={lo} />
        </radialGradient>
        <pattern id={`${id}-lattice`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M 0 0 H 22 M 0 0 V 22" stroke="#e3c170" strokeWidth="0.9" opacity="0.34" />
          <circle cx="11" cy="11" r="1.4" fill="#e3c170" opacity="0.4" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <rect x="13" y="13" width="224" height="324" rx="10" />
        </clipPath>
      </defs>
      <rect x="0.5" y="0.5" width={CARD_W - 1} height={CARD_H - 1} rx="17" fill="#f3eee3" />
      <rect x="0.5" y="0.5" width={CARD_W - 1} height={CARD_H - 1} rx="17" fill="none" stroke="#d9cfba" strokeWidth="1.2" />
      <rect x="13" y="13" width="224" height="324" rx="10" fill={`url(#${id}-g)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="13" y="13" width="224" height="324" fill={`url(#${id}-lattice)`} />
        <Sunburst cx={125} cy={175} rays={40} r0={54} r1={150} color="#e3c170" opacity={0.18} />
      </g>
      <rect x="21" y="21" width="208" height="308" rx="6" fill="none" stroke="#e3c170" strokeWidth="1.4" opacity="0.85" />
      <rect x="26" y="26" width="198" height="298" rx="4" fill="none" stroke="#e3c170" strokeWidth="0.6" opacity="0.6" />
      {/* Deco fans in the corners */}
      {[
        [26, 26, 0],
        [224, 26, 90],
        [224, 324, 180],
        [26, 324, 270],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          {[0, 1, 2].map((k) => (
            <path key={k} d={`M ${10 + k * 7} 0 A ${10 + k * 7} ${10 + k * 7} 0 0 1 0 ${10 + k * 7}`} fill="none" stroke="#e3c170" strokeWidth="1" opacity={0.75 - k * 0.18} />
          ))}
        </g>
      ))}
      <circle cx="125" cy="175" r="44" fill={lo} stroke="#e3c170" strokeWidth="2" />
      <circle cx="125" cy="175" r="38" fill="none" stroke="#e3c170" strokeWidth="0.8" opacity="0.7" />
      <path
        d="M125 144 L 146 200 H 138 L 133 186 H 117 L 112 200 H 104 Z M 125 160 L 119 179 H 131 Z"
        fill="url(#gold-foil)"
      />
    </svg>
  )
})
