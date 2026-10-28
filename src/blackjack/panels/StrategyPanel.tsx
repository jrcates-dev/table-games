import { useMemo } from 'react'
import { availableActions } from '../../engine/blackjack'
import { formatTotal, isNatural } from '../../engine/hand'
import { DEFAULT_RULE_PRESET, RULE_PRESETS } from '../../engine/rules'
import {
  ACTION_LABELS,
  basicStrategy,
  CELL_LABELS,
  CELL_LEGEND,
  CHART_COLUMNS,
  chartIsExact,
  chartPosition,
  strategyChart,
  type ChartPosition,
} from '../../engine/strategy'
import type { Card, PlayerAction, PlayerHand } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'

/**
 * The book: basic strategy, with the player's own square lit.
 *
 * The tables are imported from the engine rather than retyped here, so the card
 * on screen and the coach that grades each decision are literally reading the
 * same arrays and cannot disagree.
 */
interface Live {
  hand: PlayerHand
  upcard: Card
  position: ChartPosition
  advice: PlayerAction
  /** Still waiting on the insurance answer; the play shown comes after it. */
  insurance: boolean
}

function describe({ hand, position }: Live): string {
  if (position.section === 'pairs') {
    const rank = hand.cards[0].rank
    return rank === 'A' ? 'A pair of aces' : `A pair of ${rank}s`
  }
  if (position.section === 'soft') return `Soft ${position.key + 11}`
  return `Hard ${formatTotal(hand.cards)}`
}

export function StrategyPanel() {
  const game = useGameStore((s) => s.game)
  const rulePreset = useGameStore((s) => s.profile.settings.rulePreset)
  const { round } = game

  const live = useMemo<Live | null>(() => {
    // An ace up holds the round on insurance before any other decision, which
    // is exactly when a player reaches for the book. Light the square then too,
    // advising the play that will be on offer once insurance is answered.
    const insurance = round.phase === 'insurance'
    if (round.phase !== 'playerTurn' && !insurance) return null
    const hand = round.hands[round.activeHandIndex]
    if (!hand || round.dealer.length === 0) return null
    // Holding a natural there is nothing left to decide after insurance.
    if (insurance && isNatural(hand)) return null
    const upcard = round.dealer[0]
    const legal = availableActions(insurance ? { ...game, round: { ...round, phase: 'playerTurn' } } : game)
    return {
      hand,
      upcard,
      position: chartPosition(hand, upcard, game.rules),
      advice: basicStrategy(hand, upcard, { rules: game.rules, legal }),
      insurance,
    }
  }, [game, round])

  const preset = RULE_PRESETS[rulePreset] ?? RULE_PRESETS[DEFAULT_RULE_PRESET]
  const exact = chartIsExact(game.rules)
  const chart = useMemo(() => strategyChart(game.rules), [game.rules])
  // Only the codes this card actually uses go in its key.
  const used = new Set(chart.flatMap((section) => section.rows.flatMap((row) => row.cells)))

  return (
    <div className={`chart${live ? ' is-focused' : ''}`}>
      <div className={`chart__live${live ? ' is-on' : ''}`}>
        {live ? (
          <>
            <span className="eyebrow">{live.insurance ? 'Your hand · after insurance' : 'Your hand'}</span>
            <p>
              <strong>{describe(live)}</strong> against a dealer <strong>{live.upcard.rank}</strong>
            </p>
            <span className={`chart__advice cell--${live.position.cell}`}>{ACTION_LABELS[live.advice]}</span>
          </>
        ) : (
          <p className="chart__idle">Deal a hand and your square lights up here while you decide.</p>
        )}
      </div>

      {chart.map((section) => (
        <section className="chart__section" key={section.id}>
          <header className="chart__head">
            <h3>{section.title}</h3>
            <span>{section.caption} vs dealer upcard</span>
          </header>
          <table className="chart__table">
            <thead>
              <tr>
                <th aria-label={section.caption} />
                {CHART_COLUMNS.map((label, col) => (
                  <th key={label} className={live && live.position.column === col ? 'is-col' : undefined}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => {
                const rowLive = live !== null && live.position.section === row.section && row.keys.includes(live.position.key)
                return (
                  <tr key={row.label} className={rowLive ? 'is-row' : undefined}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, col) => {
                      const isLive = rowLive && live!.position.column === col
                      return (
                        <td
                          key={col}
                          className={`cell cell--${cell}${isLive ? ' is-live' : ''}`}
                          title={`${row.label} vs ${CHART_COLUMNS[col]}: ${CELL_LEGEND.find((l) => l.cell === cell)?.name ?? cell}`}
                        >
                          {CELL_LABELS[cell]}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}

      <div className="chart__legend">
        {CELL_LEGEND.filter((entry) => used.has(entry.cell)).map((entry) => (
          <div className="chart__legend-row" key={entry.cell}>
            <span className={`cell cell--${entry.cell}`}>{CELL_LABELS[entry.cell]}</span>
            <strong>{entry.name}</strong>
            <span>{entry.note}</span>
          </div>
        ))}
      </div>

      <p className="chart__foot">
        {deckLabel(game.rules.decks)}, {game.rules.dealerHitsSoft17 ? 'dealer hits soft 17' : 'dealer stands on soft 17'}
        {exact ? ' — exact for the table you are at.' : '.'}
        {!exact && (
          <>
            {' '}
            You are playing <strong>{preset.name}</strong>, whose rules shift a few squares from this card; the
            coach still grades against it.
          </>
        )}{' '}
        Surrender squares apply only where surrender is offered.
      </p>
    </div>
  )
}

function deckLabel(decks: number): string {
  if (decks === 1) return 'Single deck'
  if (decks === 2) return 'Double deck'
  return `${decks} decks`
}
