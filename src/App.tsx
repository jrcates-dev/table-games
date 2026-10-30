import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { installAudio } from './audio'
import { Backdrop } from './components/Backdrop'
import { FxLayer } from './components/Fx'
import { useEffectsLevel } from './lib/effects'
import { installNoise } from './lib/noise'
import { installTouch } from './lib/touch'
import { Lobby } from './lobby/Lobby'
import { usePrefs } from './prefs/prefsStore'
import { useAppStore } from './store/appStore'
import { useBaccaratStore } from './store/baccaratStore'
import { useRouletteStore } from './store/rouletteStore'
import { useUthStore } from './store/uthStore'
import { useCrapsStore } from './store/crapsStore'
import { useGameStore } from './store/gameStore'

// Each table is its own chunk: the lobby paints before either has loaded.
const BlackjackView = lazy(() => import('./blackjack/BlackjackView'))
const CrapsView = lazy(() => import('./craps/CrapsView'))
const BaccaratView = lazy(() => import('./baccarat/BaccaratView'))
const RouletteView = lazy(() => import('./roulette/RouletteView'))
const UthView = lazy(() => import('./uth/UthView'))
// A sheet of every card and chip for checking the artwork: ?gallery, in development only.
const Gallery = lazy(() => import('./dev/Gallery').then((m) => ({ default: m.Gallery })))
const showGallery = import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')

/**
 * The floor.
 *
 * One screen at a time — the lobby, or a table. Every game is initialised up
 * front so the lobby can show each bankroll, and so walking away from a table
 * and back again finds it exactly as it was left.
 */
export default function App() {
  const screen = useAppStore((s) => s.screen)
  const felt = usePrefs((s) => s.felt)
  const effects = useEffectsLevel()

  useEffect(() => {
    installAudio()
    installNoise()
    installTouch()
    void useGameStore.getState().init()
    void useCrapsStore.getState().init()
    void useBaccaratStore.getState().init()
    void useRouletteStore.getState().init()
    void useUthStore.getState().init()
  }, [])

  useGlobalShortcuts()

  if (showGallery) {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    )
  }

  // Sitting down tilts the camera down: the lobby lifts away and the table
  // rises into view as the room does behind it. Standing up runs it in reverse.
  const direction = screen === 'lobby' ? -1 : 1

  // Respect the system reduced-motion setting everywhere motion animates.
  return (
    <MotionConfig reducedMotion="user">
      <div className="app" data-felt={felt} data-screen={screen} data-effects={effects}>
        <Backdrop variant={screen === 'lobby' ? 'lobby' : 'table'} />
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screen}
            className="screen"
            custom={direction}
            variants={effects === 'reduced' ? SCREEN_MOTION_LIGHT : SCREEN_MOTION}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Suspense fallback={<div className="screen-loading" />}>
              {screen === 'lobby' && <Lobby />}
              {screen === 'blackjack' && <BlackjackView />}
              {screen === 'craps' && <CrapsView />}
              {screen === 'baccarat' && <BaccaratView />}
              {screen === 'roulette' && <RouletteView />}
              {screen === 'uth' && <UthView />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
        <FxLayer />
        {screen !== 'lobby' && <RotateHint />}
      </div>
    </MotionConfig>
  )
}

// Whole transforms, so the browser runs the move itself: moved a property at a
// time by script, the screen coming in is repainted at every frame. Each one
// comes to rest written out in full, as motion reads `none` as all zeros.
const SCREEN_MOTION: Variants = {
  enter: (d: number) => ({ opacity: 0, transform: `translateY(${d * 80}px) scale(0.985)` }),
  center: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
  exit: (d: number) => ({ opacity: 0, transform: `translateY(${d * -60}px) scale(1.01)`, transition: { duration: 0.38, ease: [0.4, 0, 1, 1] } }),
}

/** Lighter effects: the same move, shorter, smaller and over sooner. */
const SCREEN_MOTION_LIGHT: Variants = {
  enter: (d: number) => ({ opacity: 0, transform: `translateY(${d * 24}px)` }),
  center: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: (d: number) => ({ opacity: 0, transform: `translateY(${d * -16}px)`, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
}

/**
 * A table is laid out for a landscape screen. Held upright, a phone shows this
 * instead (responsive.css decides when), with the way back to the lobby, which
 * does work upright.
 */
function RotateHint() {
  const go = useAppStore((s) => s.go)
  return (
    <div className="rotate-hint" role="dialog" aria-label="Turn your phone sideways">
      <div className="rotate-hint__phone" aria-hidden="true" />
      <p className="rotate-hint__text">Turn your phone sideways</p>
      <p className="rotate-hint__sub">The tables are laid out for a landscape screen.</p>
      <button type="button" className="btn btn--ghost" onClick={() => go('lobby')}>
        Back to the lobby
      </button>
    </div>
  )
}

/** `M` mutes from anywhere; typing in a field is never a shortcut. */
function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() === 'm') usePrefs.getState().toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
