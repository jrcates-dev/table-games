import { AnimatePresence, motion, useReducedMotion, useSpring, type MotionStyle } from 'motion/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { play } from '../audio'
import { ruleLines } from '../blackjack/rulesText'
import { CardFace } from '../components/PlayingCard'
import { ChipStack } from '../components/ChipStack'
import { MoneyInput } from '../components/controls'
import { CssDie } from '../components/CssDie'
import { Money } from '../components/Money'
import { MuteButton, Monogram } from '../components/TopBar'
import { DEFAULT_RULE_PRESET, RULE_PRESETS, STARTING_BANKROLL } from '../engine/rules'
import { houseEdge } from '../engine/roulette/bets'
import { TRIPS_TABLES } from '../engine/uth/rules'
import { money, percent } from '../lib/format'
import { gameMeta, useAppStore, type GameId } from '../store/appStore'
import { selectBaccaratHasRun, selectCanChooseBaccaratBankroll, useBaccaratStore } from '../store/baccaratStore'
import { selectCanChooseCrapsBankroll, selectCrapsBankrollHasRun, useCrapsStore } from '../store/crapsStore'
import { selectBankrollHasRun, selectCanChooseBankroll, useGameStore } from '../store/gameStore'
import { resetAllRacks, setSharedBankroll } from '../store/racks'
import { selectCanChooseRouletteBankroll, selectRouletteHasRun, useRouletteStore } from '../store/rouletteStore'
import { useSharedBankroll } from '../store/sharedBankroll'
import { clampStartingBankroll, MAX_STARTING_BANKROLL, MIN_STARTING_BANKROLL } from '../store/stake'
import { selectCanChooseUthBankroll, selectUthHasRun, useUthStore } from '../store/uthStore'
import { BaccaratArt, RouletteArt, UthArt } from './TableArt'

/**
 * Whether the lobby has already risen into view this visit. The tables rise
 * one by one the first time; standing up from one and walking back finds them
 * already standing, with only the room's own move between the two.
 */
let entered = false

/**
 * The lobby.
 *
 * The first thing anyone sees, so it carries the whole identity: the name in
 * lights on a Vegas marquee, the casino floor behind it, and five tables to
 * choose between — each with its limit sign lit, its rules, and your own rack
 * before you sit down.
 */
export function Lobby() {
  const [entrance] = useState(() => !entered)
  useEffect(() => {
    entered = true
  }, [])
  const go = useAppStore((s) => s.go)
  const lastGame = useAppStore((s) => s.lastGame)
  const bjBankroll = useGameStore((s) => s.profile.bankroll)
  const bjReady = useGameStore((s) => s.ready)
  const rulePreset = useGameStore((s) => s.profile.settings.rulePreset)
  const crapsBankroll = useCrapsStore((s) => s.profile.bankroll)
  const crapsReady = useCrapsStore((s) => s.ready)
  const bjTable = useGameStore((s) => s.table())
  const crapsTable = useCrapsStore((s) => s.table())
  const bjChoosing = useGameStore(selectCanChooseBankroll)
  const crapsChoosing = useCrapsStore(selectCanChooseCrapsBankroll)
  const bjHasRun = useGameStore(selectBankrollHasRun)
  const crapsHasRun = useCrapsStore(selectCrapsBankrollHasRun)
  const chooseBj = useGameStore((s) => s.chooseBankroll)
  const chooseCraps = useCrapsStore((s) => s.chooseBankroll)
  const baBankroll = useBaccaratStore((s) => s.profile.bankroll)
  const baReady = useBaccaratStore((s) => s.ready)
  const baLimits = useBaccaratStore((s) => s.game.limits)
  const baChoosing = useBaccaratStore(selectCanChooseBaccaratBankroll)
  const baHasRun = useBaccaratStore(selectBaccaratHasRun)
  const chooseBa = useBaccaratStore((s) => s.chooseBankroll)
  const roBankroll = useRouletteStore((s) => s.profile.bankroll)
  const roReady = useRouletteStore((s) => s.ready)
  const roWheel = useRouletteStore((s) => s.game.wheel)
  const roLimits = useRouletteStore((s) => s.game.limits)
  const roChoosing = useRouletteStore(selectCanChooseRouletteBankroll)
  const roHasRun = useRouletteStore(selectRouletteHasRun)
  const chooseRo = useRouletteStore((s) => s.chooseBankroll)
  const uthBankroll = useUthStore((s) => s.profile.bankroll)
  const uthReady = useUthStore((s) => s.ready)
  const uthLimits = useUthStore((s) => s.game.limits)
  const uthTrips = useUthStore((s) => s.game.tripsTable)
  const uthChoosing = useUthStore(selectCanChooseUthBankroll)
  const uthHasRun = useUthStore(selectUthHasRun)
  const chooseUth = useUthStore((s) => s.chooseBankroll)
  const shared = useSharedBankroll((s) => s.shared)
  const sharedBankroll = useSharedBankroll((s) => s.bankroll)

  const preset = RULE_PRESETS[rulePreset] ?? RULE_PRESETS[DEFAULT_RULE_PRESET]
  const bjRules = ruleLines(preset.rules)
  const allReady = bjReady && crapsReady && baReady && roReady && uthReady
  const played = [
    bjHasRun && 'Blackjack',
    crapsHasRun && 'Craps',
    baHasRun && 'Baccarat',
    roHasRun && 'Roulette',
    uthHasRun && "Hold'em",
  ].filter((name) => name !== false)

  // While the bankroll is shared every card shows the one rack, and it is set
  // from the reset under the tables rather than card by card.
  const rack = (ready: boolean, own: number) => (ready ? (shared ? sharedBankroll : own) : null)
  const choose = (can: boolean, fn: (amount: number) => void) => (can && !shared ? fn : undefined)

  const sit = (id: GameId) => {
    play('chipStack', { count: 3 })
    go(id)
  }

  return (
    <main className="lobby">
      <div className="lobby__corner">
        <MuteButton />
      </div>

      <motion.header
        className="lobby__head"
        initial={entrance ? { opacity: 0, y: -14 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="marquee">
          <MarqueeBulbs />
          <div className="marquee__crest">
            <Monogram size={58} />
          </div>
          <h1 className="lobby__title">
            <span className="lobby__title-word">
              <span className="lobby__title-text">ARENA</span>
              <span className="lobby__glint" aria-hidden="true">
                <span>ARENA</span>
              </span>
            </span>
          </h1>
          <p className="lobby__subtitle">
            <span className="lobby__rule" />
            Las Vegas Table Games
            <span className="lobby__rule" />
          </p>
        </div>
      </motion.header>

      <div className="lobby__games">
        <GameCard
          id="blackjack"
          index={0}
          entrance={entrance}
          title="Blackjack"
          tagline={preset.name.split('·')[0].trim()}
          lines={bjRules.slice(0, 5)}
          bankroll={rack(bjReady, bjBankroll)}
          onChooseBankroll={choose(bjChoosing, chooseBj)}
          shared={shared}
          hasRun={bjHasRun}
          featured={lastGame === 'blackjack'}
          onSit={() => sit('blackjack')}
          art={<BlackjackArt />}
          limits={`${money(bjTable.minBet)}–${money(bjTable.maxBet)}`}
        />
        <GameCard
          id="craps"
          index={1}
          entrance={entrance}
          title="Craps"
          tagline="Aria Main Pit"
          lines={['3-4-5x odds', 'Field pays double on 2, triple on 12', 'All · Tall · Small', 'Fire Bet', 'Buy the 4 & 10 for 5%']}
          bankroll={rack(crapsReady, crapsBankroll)}
          onChooseBankroll={choose(crapsChoosing, chooseCraps)}
          shared={shared}
          hasRun={crapsHasRun}
          featured={lastGame === 'craps'}
          onSit={() => sit('craps')}
          art={<CrapsArt />}
          limits={`${money(crapsTable.minBet)}–${money(crapsTable.maxBet)}`}
        />
        <GameCard
          id="baccarat"
          index={2}
          entrance={entrance}
          title="Baccarat"
          tagline="Aria Mini-Baccarat"
          lines={['Eight-deck shoe', 'Banker pays 5% commission', 'Tie pays 8 to 1', 'Pairs 11 to 1 · Dragon Bonus', 'Bead plate & live shoe odds']}
          bankroll={rack(baReady, baBankroll)}
          onChooseBankroll={choose(baChoosing, chooseBa)}
          shared={shared}
          hasRun={baHasRun}
          featured={lastGame === 'baccarat'}
          onSit={() => sit('baccarat')}
          art={<BaccaratArt />}
          limits={`${money(baLimits.minBet)}–${money(baLimits.maxBet)}`}
        />
        <GameCard
          id="roulette"
          index={3}
          entrance={entrance}
          title="Roulette"
          tagline={roWheel === 'double' ? 'Aria Main Floor' : 'Aria High Limit'}
          lines={[
            roWheel === 'double' ? 'Double-zero wheel' : 'Single-zero wheel',
            roWheel === 'double' ? 'Single zero in the high-limit room' : 'Double zero on the main floor',
            `Every bet ${percent(houseEdge({ kind: 'straight', numbers: [1] }, roWheel), 2)}${roWheel === 'double' ? ' but the Top Line' : ''}`,
            'Splits, corners, streets & lines',
            'Tote board of the last spins',
          ]}
          bankroll={rack(roReady, roBankroll)}
          onChooseBankroll={choose(roChoosing, chooseRo)}
          shared={shared}
          hasRun={roHasRun}
          featured={lastGame === 'roulette'}
          onSit={() => sit('roulette')}
          art={<RouletteArt />}
          limits={`${money(roLimits.tableMin)}–${money(roLimits.maxOutside)}`}
        />
        <GameCard
          id="uth"
          index={4}
          entrance={entrance}
          title="Hold'em"
          tagline="Ultimate Texas"
          lines={['Ante · Blind · Play · Trips', 'Raise 4x, 2x, then 1x', 'Dealer opens with a pair', `Trips ${TRIPS_TABLES[uthTrips].name}`, 'A coach for every decision']}
          bankroll={rack(uthReady, uthBankroll)}
          onChooseBankroll={choose(uthChoosing, chooseUth)}
          shared={shared}
          hasRun={uthHasRun}
          featured={lastGame === 'uth'}
          onSit={() => sit('uth')}
          art={<UthArt />}
          limits={`${money(uthLimits.minAnte)}–${money(uthLimits.maxAnte)}`}
        />
      </div>

      <RackReset ready={allReady} played={played} entrance={entrance} />
    </main>
  )
}

const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' })

/**
 * One figure for every rack on the floor — or, with the bankroll shared, for
 * the one rack every table plays from. Each table still files its own runs, so
 * this is the choice on each card made five times at once — and it asks first,
 * because a table that has been played closes its run on the way and anything
 * left in play is swept off. The question comes up in the middle of the screen
 * over the whole floor, wherever the lobby is scrolled to.
 *
 * Under it, the choice between the two: a bankroll at each table, or one
 * carried between them.
 */
function RackReset({ ready, played, entrance }: { ready: boolean; played: string[]; entrance: boolean }) {
  const [amount, setAmount] = useState(STARTING_BANKROLL)
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)
  const shared = useSharedBankroll((s) => s.shared)
  const lastGame = useAppStore((s) => s.lastGame)

  useEffect(() => {
    if (!asking) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAsking(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [asking])

  // The racks on the cards change as it happens; the button says so for a moment.
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(false), 2400)
    return () => clearTimeout(timer)
  }, [done])

  return (
    <>
      <motion.div
        className="rack-reset-bar"
        initial={entrance ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
      >
        <div className="rack-reset">
          <label
            className="rack-reset__field"
            title={`Between ${money(MIN_STARTING_BANKROLL)} and ${money(MAX_STARTING_BANKROLL)}, for ${shared ? 'the bankroll every table shares' : 'every table at once'}`}
          >
            <span className="eyebrow">{shared ? 'Reset your bankroll to' : 'Reset every rack to'}</span>
            <MoneyInput value={amount} onCommit={(next) => setAmount(clampStartingBankroll(next))} />
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!ready}
            onClick={() => {
              play('click')
              setDone(false)
              setAsking(true)
            }}
          >
            {done ? (shared ? 'Bankroll reset' : 'Racks reset') : shared ? 'Reset bankroll' : 'Reset racks'}
          </button>
        </div>
        <label
          className="rack-reset__share"
          title={
            shared
              ? 'Every table plays from one bankroll. Turned off, each table keeps the figure it has then as its own rack.'
              : `Carry one bankroll from table to table, starting from your ${gameMeta(lastGame ?? 'blackjack').name} rack.`
          }
        >
          <input
            type="checkbox"
            checked={shared}
            disabled={!ready}
            onChange={(event) => {
              play('click')
              setSharedBankroll(event.target.checked)
            }}
          />
          One bankroll for every table
        </label>
      </motion.div>

      <AnimatePresence>
        {asking && (
          <motion.div
            className="rack-reset__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setAsking(false)}
          >
            <motion.div
              className="rack-reset__dialog"
              role="alertdialog"
              aria-modal="true"
              aria-label={shared ? 'Reset your bankroll' : 'Reset every rack'}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="eyebrow">{shared ? 'Shared by every table' : 'Every table'}</span>
              <p className="rack-reset__text">
                <strong>{shared ? `Reset your bankroll to ${money(amount)}?` : `Reset every rack to ${money(amount)}?`}</strong>
                <br />
                {played.length > 0 &&
                  `${LIST.format(played)} ${played.length === 1 ? 'closes its run' : 'close their runs'}, saved to your history like a buy-back. `}
                Chips on the felt and any hand in play are cleared.
              </p>
              <div className="rack-reset__buttons">
                <button
                  type="button"
                  className="btn btn--gold"
                  autoFocus
                  onClick={() => {
                    resetAllRacks(amount)
                    play('chipStack', { count: 4 })
                    setAsking(false)
                    setDone(true)
                  }}
                >
                  {shared ? 'Reset bankroll' : 'Reset all racks'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * The bulbs round the sign, laid out clockwise from the top-left so that a
 * three-phase chase runs round the frame the way a theatre marquee's does.
 */
const BULBS = (() => {
  const across = 24
  const down = 6
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= across; i++) out.push({ x: (i / across) * 100, y: 0 })
  for (let i = 1; i <= down; i++) out.push({ x: 100, y: (i / (down + 1)) * 100 })
  for (let i = across; i >= 0; i--) out.push({ x: (i / across) * 100, y: 100 })
  for (let i = down; i >= 1; i--) out.push({ x: 0, y: (i / (down + 1)) * 100 })
  return out
})()

/**
 * The sockets, and the lamps lit in three banks — every third bulb in each —
 * so the chase is three layers fading in turn rather than sixty bulbs each
 * animated on its own.
 */
function MarqueeBulbs() {
  return (
    <div className="marquee__bulbs" aria-hidden="true">
      {BULBS.map((bulb, i) => (
        <span key={i} className="marquee__bulb" style={{ left: `${bulb.x}%`, top: `${bulb.y}%` }} />
      ))}
      {[0, 1, 2].map((phase) => (
        <div key={phase} className="marquee__lights" style={{ '--phase': phase } as CSSProperties}>
          {BULBS.map((bulb, i) =>
            i % 3 === phase ? <span key={i} className="marquee__lamp" style={{ left: `${bulb.x}%`, top: `${bulb.y}%` }} /> : null,
          )}
        </div>
      ))}
    </div>
  )
}

function GameCard({
  id,
  index,
  entrance,
  title,
  tagline,
  lines,
  bankroll,
  onChooseBankroll,
  shared,
  hasRun,
  featured,
  onSit,
  art,
  limits,
}: {
  id: GameId
  index: number
  /** Rise into place in turn, rather than simply be there. */
  entrance: boolean
  title: string
  tagline: string
  lines: string[]
  bankroll: number | null
  /**
   * Present whenever no hand or roll is in play: the rack is the player's to
   * choose before they sit down, rather than a number the house picked.
   */
  onChooseBankroll?(amount: number): void
  /** The rack is the one bankroll every table plays from. */
  shared: boolean
  /** The table has been played, so a new amount ends the run under way. */
  hasRun: boolean
  featured: boolean
  onSit(): void
  art: ReactNode
  /** What the limit sign at the table reads. */
  limits: string
}) {
  // The card itself holds still, so its words stay sharp and its button stays
  // where the pointer is aiming. Only the picture answers the pointer: what
  // lies on the felt leans a few pixels toward it and the felt away, from -1
  // to 1 across the card. A mouse only, and never with reduced motion asked for.
  const reduceMotion = useReducedMotion()
  const px = useSpring(0, { stiffness: 150, damping: 20 })
  const py = useSpring(0, { stiffness: 150, damping: 20 })

  return (
    <motion.article
      className={`game-card game-card--${id}${featured ? ' is-featured' : ''}`}
      initial={entrance ? { opacity: 0, y: 40 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + index * 0.14, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      onPointerMove={(event) => {
        if (reduceMotion || event.pointerType !== 'mouse') return
        const rect = event.currentTarget.getBoundingClientRect()
        px.set(((event.clientX - rect.left) / rect.width) * 2 - 1)
        py.set(((event.clientY - rect.top) / rect.height) * 2 - 1)
      }}
      onPointerEnter={() => play('hover')}
      onPointerLeave={() => {
        px.set(0)
        py.set(0)
      }}
      onClick={onSit}
    >
      <motion.div className="game-card__art" style={{ '--px': px, '--py': py } as MotionStyle}>
        {art}
        <div className="limit-sign" aria-label={`Table limits ${limits}`}>
          <span className="limit-sign__label">Limits</span>
          <span className="limit-sign__value">{limits}</span>
        </div>
      </motion.div>
      <div className="game-card__body">
        <span className="eyebrow game-card__tagline">{tagline}</span>
        <h2 className="game-card__title">{title}</h2>
        <ul className="game-card__rules">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="game-card__foot">
          {bankroll !== null && onChooseBankroll ? (
            // Typing in the field must not also sit the player down.
            <div
              className="game-card__bankroll game-card__stake"
              onClick={(event) => event.stopPropagation()}
              title={
                hasRun
                  ? `A new amount, ${money(MIN_STARTING_BANKROLL)} – ${money(MAX_STARTING_BANKROLL)}, ends this run (saved to your history like a buy-back) and starts a fresh one.`
                  : undefined
              }
            >
              <span className="eyebrow">{hasRun ? 'Your rack' : 'Buy in for'}</span>
              <MoneyInput value={bankroll} onCommit={onChooseBankroll} label={`${title}: ${hasRun ? 'your rack' : 'buy in for'}`} />
              <span className="game-card__stake-hint">
                {hasRun
                  ? 'Change it to start a new run'
                  : `${money(MIN_STARTING_BANKROLL)} – ${money(MAX_STARTING_BANKROLL)}`}
              </span>
            </div>
          ) : bankroll === null ? (
            // Still being read from storage: the space is held, so nothing moves when it arrives.
            <div className="game-card__bankroll" aria-busy="true" />
          ) : (
            <div className="game-card__bankroll">
              <span className="eyebrow">{shared ? 'Shared rack' : 'Your rack'}</span>
              <Money value={bankroll} />
            </div>
          )}
          <button
            type="button"
            className="btn btn--gold"
            onClick={(event) => {
              event.stopPropagation()
              onSit()
            }}
          >
            {featured ? 'Return to table' : 'Take a seat'}
          </button>
        </div>
      </div>
    </motion.article>
  )
}

function BlackjackArt() {
  return (
    <div className="art art--blackjack">
      <div className="art__felt" />
      <div className="art__cards">
        <div className="art__card art__card--a">
          <CardFace rank="A" suit="S" />
        </div>
        <div className="art__card art__card--b">
          <CardFace rank="K" suit="H" />
        </div>
      </div>
      <div className="art__chips art__chips--left">
        <div className="art__stack">
          <ChipStack amount={125} size={56} tilt={40} seed={4} billboard={false} />
        </div>
      </div>
      <div className="art__chips art__chips--right">
        <div className="art__stack">
          <ChipStack amount={1500} size={56} tilt={40} seed={9} billboard={false} />
        </div>
      </div>
    </div>
  )
}

function CrapsArt() {
  return (
    <div className="art art--craps">
      <div className="art__felt" />
      <div className="art__dice">
        <CssDie size={58} className="art__die art__die--a" />
        <CssDie size={58} className="art__die art__die--b" />
      </div>
      <div className="art__puck">ON</div>
      <div className="art__chips">
        <div className="art__stack" style={{ left: -34 }}>
          <ChipStack amount={60} size={58} tilt={40} seed={2} billboard={false} />
        </div>
      </div>
    </div>
  )
}
