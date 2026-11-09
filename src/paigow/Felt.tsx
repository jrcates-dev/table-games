import { memo } from 'react'
import { DTable, FeltText } from '../components/DTable'
import { FORTUNE_ORDER, FORTUNE_PAYS, type FortuneHand } from '../engine/paigow/fortune'
import { BOX_Y, CARD_H, CARD_W, DEALER_Y, HIGH_X, LOW_X, SPOT_ORDER, SPOTS } from './geometry'

/**
 * The printing on a pai gow felt: the dealer's two hands under the tray, the
 * Fortune pay table across the middle where the cards are dealt, your low and
 * high hand boxes, and the bet and Fortune circles on the rail.
 */

const SHORT: Record<FortuneHand, string> = {
  natural7SF: '7-CARD STR FLUSH',
  royalMatch: 'ROYAL + ROYAL MATCH',
  joker7SF: '7-CARD SF + JOKER',
  fiveAces: 'FIVE ACES',
  royal: 'ROYAL FLUSH',
  straightFlush: 'STRAIGHT FLUSH',
  quads: 'FOUR OF A KIND',
  fullHouse: 'FULL HOUSE',
  flush: 'FLUSH',
  trips: 'THREE OF A KIND',
  straight: 'STRAIGHT',
}

const ROW = 19

export const PaiGowFelt = memo(function PaiGowFelt({ commissionFree }: { commissionFree: boolean }) {
  const columns = [FORTUNE_ORDER.slice(0, 6), FORTUNE_ORDER.slice(6)]
  return (
    <DTable id="paigow">
      <g className="pg-print">
        {/* The dealer's hands: outlined, as the player's are. */}
        <Box x0={LOW_X[0]} x1={LOW_X[1]} y={DEALER_Y} dashed />
        <Box x0={HIGH_X[0]} x1={HIGH_X[4]} y={DEALER_Y} dashed />

        <FeltText x={750} y={338} size={12} spacing={3} opacity={0.55}>
          {commissionFree ? 'NO COMMISSION · DEALER QUEEN-HIGH PAI GOW PUSHES' : 'DEALER SETS THE HOUSE WAY · COPIES GO TO THE DEALER'}
        </FeltText>
        <FeltText x={750} y={366} size={15} spacing={5} gold opacity={0.9}>
          FORTUNE BONUS
        </FeltText>
        {columns.map((rows, c) => {
          const x0 = c === 0 ? 452 : 790
          const x1 = c === 0 ? 710 : 1048
          return (
            <g key={c}>
              {rows.map((hand, i) => (
                <g key={hand}>
                  <FeltText x={x0} y={392 + i * ROW} size={11.5} spacing={1} anchor="start" opacity={0.7}>
                    {SHORT[hand]}
                  </FeltText>
                  <FeltText x={x1} y={392 + i * ROW} size={11.5} spacing={1} anchor="end" opacity={0.85}>
                    {`${FORTUNE_PAYS[hand].toLocaleString()} TO 1`}
                  </FeltText>
                </g>
              ))}
            </g>
          )
        })}
        <FeltText x={919} y={392 + 5 * ROW} size={11} spacing={1} opacity={0.5}>
          PAID ON YOUR SEVEN CARDS
        </FeltText>
        <line x1={452} y1={374} x2={1048} y2={374} stroke="#e3c170" strokeOpacity="0.35" strokeWidth="1" />

        {/* Your two boxes. */}
        <Box x0={LOW_X[0]} x1={LOW_X[1]} y={BOX_Y} />
        <Box x0={HIGH_X[0]} x1={HIGH_X[4]} y={BOX_Y} />
        <FeltText x={(LOW_X[0] + LOW_X[1]) / 2} y={BOX_Y + CARD_H / 2 + 26} size={13} spacing={4} gold opacity={0.8}>
          LOW HAND
        </FeltText>
        <FeltText x={HIGH_X[2]} y={BOX_Y + CARD_H / 2 + 26} size={13} spacing={4} gold opacity={0.8}>
          HIGH HAND
        </FeltText>

        {SPOT_ORDER.map((kind) => {
          const s = SPOTS[kind]
          return (
            <g key={kind}>
              <circle cx={s.x} cy={s.y} r={s.r} fill="#000" fillOpacity="0.1" stroke="url(#gold-foil)" strokeWidth="2.6" />
              <circle cx={s.x} cy={s.y} r={s.r - 7} fill="none" stroke="#e3c170" strokeOpacity="0.32" strokeWidth="1" strokeDasharray="2 4" />
              <FeltText x={s.x} y={s.y + 5} size={kind === 'fortune' ? 12 : 17} spacing={kind === 'fortune' ? 2 : 4} opacity={0.8}>
                {s.label}
              </FeltText>
            </g>
          )
        })}
      </g>
    </DTable>
  )
})

/** A hand's box: the slots it holds, outlined as one. */
function Box({ x0, x1, y, dashed = false }: { x0: number; x1: number; y: number; dashed?: boolean }) {
  const pad = 8
  return (
    <rect
      x={x0 - CARD_W / 2 - pad}
      y={y - CARD_H / 2 - pad}
      width={x1 - x0 + CARD_W + pad * 2}
      height={CARD_H + pad * 2}
      rx="12"
      fill={dashed ? 'none' : '#000'}
      fillOpacity={dashed ? 0 : 0.08}
      stroke="#e3c170"
      strokeOpacity={dashed ? 0.3 : 0.45}
      strokeWidth="1.4"
      strokeDasharray={dashed ? '3 5' : undefined}
    />
  )
}
