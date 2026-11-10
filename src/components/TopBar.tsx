import { AnimatePresence } from 'motion/react'
import { useCallback, useState, type ReactNode } from 'react'
import { play } from '../audio'
import { usePrefs } from '../prefs/prefsStore'
import { useAppStore, type GameId } from '../store/appStore'
import { sessionTotal, useSessionNets } from '../store/sessionNets'
import { useSharedBankroll } from '../store/sharedBankroll'
import { IconBack, IconMute, IconVolume } from './icons'
import { Money } from './Money'
import { RackMenu, type RackControl } from './RackMenu'
import { SUIT_PATH } from './suits'

/**
 * The permanent chrome across the top of a table: the way back to the lobby,
 * the sign over the table, the rack, and the handful of panels.
 */
export function TopBar({
  id,
  game,
  placard,
  bankroll,
  extra,
  cents = false,
  rack,
  children,
}: {
  /** Which table this is, for its results this session. */
  id: GameId
  game: string
  placard: ReactNode
  bankroll: number
  /** The table pays in cents, so the rack is counted in them. */
  cents?: boolean
  /**
   * A second line under the bankroll, e.g. chips on the felt. With the bankroll
   * shared the session's results take its place; the rail still shows the felt.
   */
  extra?: ReactNode
  /** Given, the bankroll opens a menu to reset or top up the rack. */
  rack?: RackControl
  children?: ReactNode
}) {
  const go = useAppStore((s) => s.go)
  const shared = useSharedBankroll((s) => s.shared)
  // What this table has settled since the visit began (see sessionNets.ts).
  const session = useSessionNets((s) => s[id])
  const [rackOpen, setRackOpen] = useState(false)
  const closeRack = useCallback(() => setRackOpen(false), [])

  const figures = (
    <>
      <span className="bankroll__label">Bankroll</span>
      <Money value={bankroll} className="bankroll__value" cents={cents} />
      {shared ? (
        <SharedSession id={id} />
      ) : (
        (extra ??
          (session !== 0 && (
            <span className={`bankroll__session ${session > 0 ? 'tone-win' : 'tone-lose'}`}>
              <Money value={session} signed flash={false} cents={cents} /> this session
            </span>
          )))
      )}
    </>
  )

  return (
    <header className="topbar">
      <button
        type="button"
        className="brand"
        onClick={() => {
          play('click')
          go('lobby')
        }}
        title="Back to the lobby"
      >
        <span className="brand__back">
          <IconBack />
        </span>
        <Monogram />
        <span className="brand__text">
          <span className="brand__name">ARIA</span>
          <span className="brand__game">{game}</span>
        </span>
      </button>

      <div className="placard">{placard}</div>

      <div className="topbar__right">
        {rack ? (
          <div className="bankroll-wrap">
            <button
              type="button"
              className={`bankroll bankroll--button${rackOpen ? ' is-open' : ''}`}
              aria-expanded={rackOpen}
              title="Reset or top up your bankroll"
              onClick={() => {
                play('click')
                setRackOpen((open) => !open)
              }}
            >
              {figures}
            </button>
            <AnimatePresence>
              {rackOpen && <RackMenu id={id} game={game} bankroll={bankroll} rack={rack} onClose={closeRack} />}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bankroll">{figures}</div>
        )}
        <div className="topbar__actions">
          {children}
          <MuteButton />
        </div>
      </div>
    </header>
  )
}

/**
 * With one bankroll carried between the tables, the rack alone cannot say how
 * this table is going: it moves with every other table's play too. So the top
 * bar says both — what this table has won or lost this session, and what every
 * table has, taken together. Neither counts a buy-back or a top-up, and a
 * reset starts both again.
 *
 * One line, hung under the rack without taking room of its own, so the top bar
 * stays the height the rails and drawers below it are placed against.
 */
function SharedSession({ id }: { id: GameId }) {
  const here = useSessionNets((s) => s[id])
  const total = useSessionNets(sessionTotal)
  return (
    <span className="bankroll__results">
      <span className="bankroll__results-line" title="Won or lost since you came in: at this table, and at every table together">
        <SessionNet label="This table" value={here} />{' '}
        <span className="bankroll__results-sep" aria-hidden="true" />{' '}
        <SessionNet label="Session" value={total} />
      </span>
    </span>
  )
}

function SessionNet({ label, value }: { label: string; value: number }) {
  const tone = value > 0 ? 'tone-win' : value < 0 ? 'tone-lose' : 'tone-push'
  return (
    <span className="bankroll__result">
      {label} <Money value={value} signed flash={false} cents className={tone} />
    </span>
  )
}

export function MuteButton() {
  const muted = usePrefs((s) => s.muted)
  const toggle = usePrefs((s) => s.toggleMute)
  return (
    <button
      type="button"
      className={`icon-btn${muted ? '' : ' is-quiet-active'}`}
      onClick={() => {
        toggle()
        if (muted) play('click')
      }}
      aria-label={muted ? 'Unmute' : 'Mute'}
      title={muted ? 'Sound off · M' : 'Sound on · M'}
    >
      {muted ? <IconMute /> : <IconVolume />}
    </button>
  )
}

/**
 * The house mark: a blackjack — the ace of spades over the king of hearts —
 * on a crimson chip. It is the app's own icon (public/favicon.svg), so the
 * mark in the corner of every table is the one on the home screen.
 */
export function Monogram({ size = 38 }: { size?: number }) {
  return (
    <img
      className="monogram"
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  )
}

/**
 * The same mark printed in gold on the felt: two cards fanned, a spade on the
 * ace and a heart in the king's corner, drawn in a 64-unit box for use inside
 * a table's SVG.
 */
export function MonogramPrint() {
  const card = (deg: number) => `rotate(${deg} 32 60)`
  return (
    <g>
      <g transform={card(-15)}>
        <rect x="18.5" y="11" width="27" height="38" rx="3.5" fill="#0d0c11" stroke="url(#gold-foil)" strokeWidth="1.8" />
        <path d={SUIT_PATH.H} transform="translate(21.5 14) scale(0.07)" fill="url(#gold-foil)" />
      </g>
      <g transform={card(13)}>
        <rect x="18.5" y="11" width="27" height="38" rx="3.5" fill="#0d0c11" stroke="url(#gold-foil)" strokeWidth="1.8" />
        <path d={SUIT_PATH.S} transform="translate(23 21) scale(0.18)" fill="url(#gold-foil)" />
      </g>
    </g>
  )
}

export function TopBarButton({
  label,
  active,
  onClick,
  children,
  shortcut,
}: {
  label: string
  active?: boolean
  onClick(): void
  children: ReactNode
  shortcut?: string
}) {
  return (
    <button
      type="button"
      className={`icon-btn${active ? ' is-active' : ''}`}
      data-drawer-toggle
      onClick={() => {
        play('click')
        onClick()
      }}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} · ${shortcut}` : label}
    >
      {children}
    </button>
  )
}
