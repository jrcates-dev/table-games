import { AnimatePresence } from 'motion/react'
import { useCallback, useState, type ReactNode } from 'react'
import { play } from '../audio'
import { usePrefs } from '../prefs/prefsStore'
import { useAppStore } from '../store/appStore'
import { IconBack, IconMute, IconVolume } from './icons'
import { Money } from './Money'
import { RackMenu, type RackControl } from './RackMenu'

/**
 * The permanent chrome across the top of a table: the way back to the lobby,
 * the sign over the table, the rack, and the handful of panels.
 */
export function TopBar({
  game,
  placard,
  bankroll,
  session,
  extra,
  cents = false,
  rack,
  children,
}: {
  game: string
  placard: ReactNode
  bankroll: number
  /** The table pays in cents, so the rack is counted in them. */
  cents?: boolean
  /** Net since this session began. */
  session?: number
  /** A second line under the bankroll, e.g. chips on the felt. */
  extra?: ReactNode
  /** Given, the bankroll opens a menu to reset or top up the rack. */
  rack?: RackControl
  children?: ReactNode
}) {
  const go = useAppStore((s) => s.go)
  const [rackOpen, setRackOpen] = useState(false)
  const closeRack = useCallback(() => setRackOpen(false), [])

  const figures = (
    <>
      <span className="bankroll__label">Bankroll</span>
      <Money value={bankroll} className="bankroll__value" cents={cents} />
      {extra ??
        (session !== undefined && session !== 0 && (
          <span className={`bankroll__session ${session > 0 ? 'tone-win' : 'tone-lose'}`}>
            <Money value={session} signed flash={false} cents={cents} /> this session
          </span>
        ))}
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
          <span className="brand__name">ARENA</span>
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
              {rackOpen && <RackMenu game={game} bankroll={bankroll} rack={rack} onClose={closeRack} />}
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

/** The house mark: a gold A inside an Art Deco lozenge. */
export function Monogram({ size = 38 }: { size?: number }) {
  return (
    <svg className="monogram" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="8" width="48" height="48" rx="6" transform="rotate(45 32 32)" fill="#0d0c11" stroke="url(#gold-foil)" strokeWidth="2" />
      <rect x="14" y="14" width="36" height="36" rx="3" transform="rotate(45 32 32)" fill="none" stroke="url(#gold-foil)" strokeWidth="0.8" opacity="0.7" />
      <path d="M32 17 L44 46 H38.6 L36.3 40 H27.7 L25.4 46 H20 Z M32 26.5 L29.3 34.6 H34.7 Z" fill="url(#gold-foil)" />
    </svg>
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
