import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { play } from '../audio'
import { RackChip } from '../components/ChipStack'
import { blackjackDenominations } from '../components/chips'
import {
  IconBook,
  IconClear,
  IconDouble,
  IconFlag,
  IconHand,
  IconPlusCard,
  IconShield,
  IconSplit,
} from '../components/icons'
import { Money } from '../components/Money'
import { tipHandlers, useTip } from '../components/tip'
import { availableActions } from '../engine/blackjack'
import { suggestedBetUnits } from '../engine/counting'
import { evaluate } from '../engine/hand'
import { DEFAULT_RULE_PRESET, RULE_PRESETS } from '../engine/rules'
import { basicStrategy, shouldTakeInsurance } from '../engine/strategy'
import type { Decision } from '../engine/ev'
import { money, signedMoney } from '../lib/format'
import { useCount, useGameStore } from '../store/gameStore'
import { useUiStore } from '../store/uiStore'
import { actionTipId, tipAction } from './prices'

/**
 * The player's side of the rail: the rack while betting, the decisions while
 * playing, and the way into the next hand once this one is settled. One
 * surface that changes what it offers, so the eye never has to go looking.
 */
export function Dock() {
  const phase = useGameStore((s) => s.game.round.phase)
  const mode =
    phase === 'betting'
      ? 'betting'
      : phase === 'playerTurn'
        ? 'play'
        : phase === 'insurance'
          ? 'insurance'
          : phase === 'roundOver'
            ? 'over'
            : 'wait'

  return (
    <div className="dock-wrap">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className={`dock dock--${mode}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          // On its way out it takes no clicks, so a fast second click can't act
          // on what comes next before it is on screen.
          exit={{ opacity: 0, y: 10, pointerEvents: 'none' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === 'betting' && <Betting />}
          {mode === 'play' && <Actions />}
          {mode === 'insurance' && <Insurance />}
          {mode === 'over' && <Settled />}
          {mode === 'wait' && <Waiting phase={phase} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Betting() {
  const game = useGameStore((s) => s.game)
  const table = useGameStore((s) => s.table())
  const addChip = useGameStore((s) => s.addChip)
  const removeChip = useGameStore((s) => s.removeChip)
  const clearBet = useGameStore((s) => s.clearBet)
  const doubleBet = useGameStore((s) => s.doubleBet)
  const deal = useGameStore((s) => s.dealRound)
  const rebuy = useGameStore((s) => s.rebuy)
  const showCount = useGameStore((s) => s.profile.settings.showCount)
  const rulePreset = useGameStore((s) => s.profile.settings.rulePreset)
  const count = useCount()

  const houseEdge = (RULE_PRESETS[rulePreset] ?? RULE_PRESETS[DEFAULT_RULE_PRESET]).houseEdge
  const denominations = blackjackDenominations(table.maxBet, game.bankroll)
  const bet = game.pendingBet
  const canDeal = bet >= table.minBet && bet <= game.bankroll
  const suggested = showCount ? Math.min(table.maxBet, suggestedBetUnits(count.true, houseEdge) * table.minBet) : 0
  const broke = game.bankroll + bet < table.minBet

  if (broke) {
    return (
      <div className="dock__row dock__row--center">
        <div className="dock__message">
          <span className="eyebrow">Out of chips</span>
          <p>The rack is empty. This run is filed with its peak bankroll — sit back down with a fresh stake.</p>
        </div>
        <button type="button" className="btn btn--gold btn--lg" onClick={rebuy}>
          Buy back in
        </button>
      </div>
    )
  }

  return (
    <div className="dock__row">
      <div className="rack" role="group" aria-label="Chips">
        {denominations.map((denom, i) => {
          const affordable = denom.value <= game.bankroll - bet && bet + denom.value <= table.maxBet
          return (
            <button
              key={denom.value}
              type="button"
              className="rack__chip"
              disabled={!affordable}
              onClick={() => addChip(denom.value)}
              onContextMenu={(event) => {
                event.preventDefault()
                removeChip(denom.value)
              }}
              onPointerEnter={() => affordable && play('hover')}
              title={`${money(denom.value)} · key ${i + 1} · right-click to take one back`}
            >
              <RackChip denom={denom} size={60} />
              <kbd>{i + 1}</kbd>
            </button>
          )
        })}
      </div>

      <div className="wager">
        <span className="eyebrow">Wager</span>
        <Money value={bet} className={`wager__value${bet > 0 ? ' is-set' : ''}`} flash={false} duration={0.35} />
        <span className="wager__hint">
          {bet > 0 && bet < table.minBet
            ? `Table minimum ${money(table.minBet)}`
            : `${money(table.minBet)} – ${money(table.maxBet)}`}
        </span>
      </div>

      <div className="dock__buttons">
        {/* Matched, it stays put and goes quiet: if it went, the rack would slide under the pointer. */}
        {suggested > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm count-suggest"
            disabled={suggested === bet}
            onClick={() => {
              clearBet()
              addChip(Math.min(suggested, game.bankroll))
            }}
            title="Hi-Lo bet spread for the current true count"
          >
            Count says {money(suggested)}
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={clearBet} disabled={bet === 0} title="Clear · C">
          Clear
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={doubleBet} disabled={bet === 0} title="Double the bet · X">
          ×2
        </button>
        <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={deal} disabled={!canDeal}>
          Deal <kbd>Space</kbd>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const ACTIONS: Array<{ action: Decision; label: string; key: string; icon: ReactNode }> = [
  { action: 'surrender', label: 'Surrender', key: 'R', icon: <IconFlag /> },
  { action: 'split', label: 'Split', key: 'P', icon: <IconSplit /> },
  { action: 'double', label: 'Double', key: 'D', icon: <IconDouble /> },
  { action: 'hit', label: 'Hit', key: 'H', icon: <IconPlusCard /> },
  { action: 'stand', label: 'Stand', key: 'S', icon: <IconHand /> },
]

function Actions() {
  const game = useGameStore((s) => s.game)
  const act = useGameStore((s) => s.act)
  const showCoach = useGameStore((s) => s.profile.settings.showCoach)
  const legal = useMemo(() => availableActions(game), [game])
  const { round } = game
  const hand = round.hands[round.activeHandIndex]

  const correct = useMemo(() => {
    if (!hand || legal.length === 0) return null
    return basicStrategy(hand, round.dealer[0], { rules: game.rules, legal })
  }, [game.rules, hand, legal, round.dealer])

  // A button that stops being a choice, or goes altogether, takes its hover
  // card with it: the pointer may never send the leave.
  useEffect(() => {
    const { id, hide } = useTip.getState()
    const action = tipAction(id)
    if (id && action && !legal.includes(action)) hide(id)
  }, [legal])
  useEffect(
    () => () => {
      const { id, hide } = useTip.getState()
      if (id && tipAction(id)) hide(id)
    },
    [],
  )

  if (!hand) return null
  const value = evaluate(hand.cards)

  return (
    <div className="dock__row">
      <div className="hand-info">
        <span className="eyebrow">
          {round.hands.length > 1 ? `Hand ${round.activeHandIndex + 1} of ${round.hands.length}` : 'Your hand'}
        </span>
        <strong className="hand-info__total num">
          {value.soft && value.hard !== value.total ? `Soft ${value.total}` : value.total}
        </strong>
        <span className="hand-info__bet">
          {money(hand.bet)} vs dealer <b>{round.dealer[0]?.rank}</b>
        </span>
      </div>

      <div className="actions">
        {ACTIONS.map(({ action, label, key, icon }) => {
          // Every play the table offers keeps its seat, live or not: a button
          // that came and went would slide Stand under a pointer parked on Hit.
          if (action === 'surrender' && game.rules.surrender === 'none') return null
          const enabled = legal.includes(action)
          const recommended = showCoach && correct === action
          // With the coach on, hovering a play prices it.
          const hover = showCoach && enabled ? tipHandlers(actionTipId(action)) : { onPointerEnter: () => enabled && play('hover') }
          return (
            <button
              key={action}
              type="button"
              className={`action action--${action}${recommended ? ' is-recommended' : ''}`}
              disabled={!enabled}
              onClick={() => act(action)}
              {...hover}
            >
              {recommended && <span className="action__book">Book</span>}
              <span className="action__icon">{icon}</span>
              <span className="action__label">{label}</span>
              <kbd>{key}</kbd>
            </button>
          )
        })}
      </div>

      <BookButton />
    </div>
  )
}

function Insurance() {
  const bet = useGameStore((s) => s.game.round.hands[0]?.bet ?? 0)
  const act = useGameStore((s) => s.act)
  const showCoach = useGameStore((s) => s.profile.settings.showCoach)
  const showCount = useGameStore((s) => s.profile.settings.showCount)
  const offered = useGameStore((s) => s.profile.settings.offerInsurance)
  const update = useGameStore((s) => s.updateSettings)
  const count = useCount()
  // Without the count on screen the coach shouldn't be reading it for them.
  const advise = shouldTakeInsurance(count.true, showCount)

  return (
    <div className="dock__row dock__row--center">
      <div className="dock__message">
        <span className="eyebrow">Dealer shows an ace</span>
        <p>
          Insurance costs <b>{money(bet / 2)}</b> and pays 2 to 1 if the dealer has blackjack.
          {showCoach && (
            <span className="dock__coach">
              {advise
                ? ` True count +${count.true.toFixed(1)} — enough tens left to make it pay.`
                : showCount
                  ? ' The book says no: it loses money at any true count below +3, even holding a blackjack.'
                  : ' The book says no: without counting cards it always loses money, even holding a blackjack.'}
            </span>
          )}
        </p>
        {/* Takes effect from the next ace; this one is still answered here. */}
        <label className="never-ask">
          <input
            type="checkbox"
            checked={!offered}
            onChange={(event) => {
              play('click')
              update({ offerInsurance: !event.target.checked })
              // Hand the keyboard back, so Space still declines rather than
              // unticking the box.
              event.target.blur()
            }}
          />
          <span>Never ask again</span>
          {!offered && <span className="never-ask__note">Turn it back on in Settings.</span>}
        </label>
      </div>
      <button
        type="button"
        className={`action action--wide${showCoach && advise ? ' is-recommended' : ''}`}
        onClick={() => act('insurance')}
      >
        <span className="action__icon">
          <IconShield />
        </span>
        <span className="action__label">Insure {money(bet / 2)}</span>
        <kbd>I</kbd>
      </button>
      <button
        type="button"
        className={`action action--wide${showCoach && !advise ? ' is-recommended' : ''}`}
        onClick={() => act('declineInsurance')}
      >
        <span className="action__label">No thanks</span>
        <kbd>Space</kbd>
      </button>
      <BookButton />
    </div>
  )
}

function Settled() {
  const lastNet = useGameStore((s) => s.lastNet)
  const nextRound = useGameStore((s) => s.nextRound)
  const clearBet = useGameStore((s) => s.clearBet)
  const deal = useGameStore((s) => s.dealRound)
  const game = useGameStore((s) => s.game)
  const bankroll = useGameStore((s) => s.profile.bankroll)
  const table = useGameStore((s) => s.table())
  const rebuy = useGameStore((s) => s.rebuy)

  const first = game.round.hands[0]
  const lastBet = first ? (first.doubled ? first.bet / 2 : first.bet) : game.pendingBet
  const rebet = Math.max(table.minBet, Math.min(lastBet, bankroll, table.maxBet))
  const broke = bankroll < table.minBet

  return (
    <div className="dock__row dock__row--center">
      <div className="settled">
        <span className="eyebrow">This hand</span>
        <strong className={`settled__net num ${lastNet === null ? '' : lastNet > 0 ? 'tone-win' : lastNet < 0 ? 'tone-lose' : 'tone-push'}`}>
          {lastNet === null || lastNet === 0 ? 'Push' : signedMoney(lastNet)}
        </strong>
      </div>
      {broke ? (
        <button type="button" className="btn btn--gold btn--lg" onClick={rebuy}>
          Buy back in
        </button>
      ) : (
        <>
          <button type="button" className="btn btn--ghost" onClick={clearBet} title="Start the next hand with an empty circle · C">
            <IconClear width={15} height={15} /> Clear bet <kbd>C</kbd>
          </button>
          <button type="button" className="btn btn--ghost" onClick={nextRound} title="Pick a new wager · N">
            New bet <kbd>N</kbd>
          </button>
          <button
            type="button"
            className="btn btn--gold btn--lg deal-btn"
            onClick={() => {
              nextRound()
              deal()
            }}
          >
            Rebet {money(rebet)} &amp; deal <kbd>Space</kbd>
          </button>
        </>
      )}
      <BookButton />
    </div>
  )
}

function Waiting({ phase }: { phase: string }) {
  return (
    <div className="dock__row dock__row--center">
      <div className="waiting">
        <span className="waiting__dots">
          <i />
          <i />
          <i />
        </span>
        {phase === 'dealerTurn' ? 'Dealer plays' : 'Dealing'}
      </div>
    </div>
  )
}

function BookButton() {
  const panel = useUiStore((s) => s.panel)
  const toggle = useUiStore((s) => s.togglePanel)
  return (
    <button
      type="button"
      className={`icon-btn book-btn${panel === 'chart' ? ' is-active' : ''}`}
      data-drawer-toggle
      onClick={() => {
        play('click')
        toggle('chart')
      }}
      title="The book — basic strategy · ?"
      aria-label="Basic strategy card"
    >
      <IconBook />
    </button>
  )
}
