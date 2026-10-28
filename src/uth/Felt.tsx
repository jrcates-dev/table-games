import { memo } from 'react'
import { CARD } from '../blackjack/geometry'
import { DTable, FeltText } from '../components/DTable'
import { CATEGORY_LABEL, type Category } from '../engine/uth/poker'
import { BLIND_PAYS, TRIPS_TABLES, type TripsTableId } from '../engine/uth/rules'
import { boardSpot, CARD_SCALE, dealerSpot, SPOT_ORDER, SPOTS } from './geometry'

/**
 * The printing on an Ultimate Texas Hold'em felt: outlines for the dealer's
 * cards and the board, your four circles, and both pay tables — the Blind's on
 * the left, Trips on the right, as the layouts on the Strip print them.
 */

const ORDER: Category[] = ['royal', 'straightFlush', 'quads', 'fullHouse', 'flush', 'straight', 'trips']

const pays = (n: number) => (n === 1.5 ? '3 TO 2' : `${n} TO 1`)

export const UthFelt = memo(function UthFelt({ tripsTable }: { tripsTable: TripsTableId }) {
  const w = CARD.w * CARD_SCALE
  const h = CARD.h * CARD_SCALE
  return (
    <DTable id="uth">
      <g className="uth-print">
        {[0, 1].map((i) => {
          const [x, y] = dealerSpot(i)
          return <rect key={`d${i}`} x={x - w / 2} y={y - h / 2} width={w} height={h} rx="9" fill="none" stroke="#e3c170" strokeOpacity="0.32" strokeWidth="1.4" strokeDasharray="3 5" />
        })}
        {[0, 1, 2, 3, 4].map((i) => {
          const [x, y] = boardSpot(i)
          return <rect key={`b${i}`} x={x - w / 2} y={y - h / 2} width={w} height={h} rx="9" fill="#000" fillOpacity="0.08" stroke="#e3c170" strokeOpacity="0.4" strokeWidth="1.4" />
        })}

        <PayTable
          x0={232}
          x1={442}
          y={262}
          title="BLIND PAYS"
          rows={[
            ...ORDER.filter((c) => BLIND_PAYS[c] !== undefined).map((c) => [CATEGORY_LABEL[c].toUpperCase(), pays(BLIND_PAYS[c]!)] as [string, string]),
            ['ALL OTHERS', 'PUSH'],
          ]}
          foot={['DEALER OPENS', 'WITH A PAIR OR BETTER']}
        />
        <PayTable
          x0={1034}
          x1={1228}
          y={318}
          title="TRIPS PAYS"
          rows={ORDER.map((c) => [CATEGORY_LABEL[c].toUpperCase(), pays(TRIPS_TABLES[tripsTable].pays[c]!)] as [string, string])}
          foot={['PAID WIN, LOSE OR FOLD']}
        />

        {SPOT_ORDER.map((kind) => {
          const s = SPOTS[kind]
          return (
            <g key={kind}>
              <circle cx={s.x} cy={s.y} r={s.r} fill="#000" fillOpacity="0.1" stroke="url(#gold-foil)" strokeWidth="2.6" />
              <circle cx={s.x} cy={s.y} r={s.r - 7} fill="none" stroke="#e3c170" strokeOpacity="0.32" strokeWidth="1" strokeDasharray="2 4" />
              <FeltText x={s.x} y={s.y + 6} size={kind === 'trips' ? 14 : 15} spacing={3} opacity={0.8}>
                {s.label}
              </FeltText>
            </g>
          )
        })}
        <FeltText x={(SPOTS.ante.x + SPOTS.blind.x) / 2} y={SPOTS.ante.y + 10} size={30} spacing={0} opacity={0.75} gold>
          =
        </FeltText>
      </g>
    </DTable>
  )
})

/** Rows a finger's width apart at the felt's design size, and never smaller than it can read zoomed in. */
const ROW = 20

function PayTable({ x0, x1, y, title, rows, foot }: { x0: number; x1: number; y: number; title: string; rows: Array<[string, string]>; foot: string[] }) {
  const mid = (x0 + x1) / 2
  return (
    <g>
      <FeltText x={mid} y={y} size={15} spacing={4} gold opacity={0.9}>
        {title}
      </FeltText>
      <line x1={x0} y1={y + 9} x2={x1} y2={y + 9} stroke="#e3c170" strokeOpacity="0.4" strokeWidth="1" />
      {rows.map(([name, value], i) => (
        <g key={name}>
          <FeltText x={x0} y={y + 30 + i * ROW} size={12} spacing={1} anchor="start" opacity={0.72}>
            {name}
          </FeltText>
          <FeltText x={x1} y={y + 30 + i * ROW} size={12} spacing={1} anchor="end" opacity={0.85}>
            {value}
          </FeltText>
        </g>
      ))}
      {foot.map((line, i) => (
        <FeltText key={line} x={mid} y={y + 30 + rows.length * ROW + 8 + i * 16} size={12} spacing={1} opacity={0.55}>
          {line}
        </FeltText>
      ))}
    </g>
  )
}
