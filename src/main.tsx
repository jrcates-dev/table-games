import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource-variable/manrope'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/lobby.css'
import './styles/dock.css'
import './styles/panels.css'
import './styles/blackjack.css'
import './styles/craps.css'
import './styles/tables.css'
import './styles/baccarat.css'
import './styles/roulette.css'
import './styles/uth.css'
import './styles/responsive.css'
import App from './App.tsx'
import { SvgDefs } from './components/SvgDefs'

// Development only: a handle on the stores for scripted walkthroughs of
// specific hands and rolls. Stripped from production builds.
if (import.meta.env.DEV) {
  void Promise.all([
    import('./store/gameStore'),
    import('./store/crapsStore'),
    import('./store/baccaratStore'),
    import('./store/rouletteStore'),
    import('./store/uthStore'),
    import('./store/appStore'),
    import('./audio/context'),
    import('./audio/sfx'),
  ]).then(([bj, craps, baccarat, roulette, uthStore, app, audioContext, sfx]) => {
    ;(window as unknown as Record<string, unknown>).__arena = {
      bj: bj.useGameStore,
      craps: craps.useCrapsStore,
      baccarat: baccarat.useBaccaratStore,
      roulette: roulette.useRouletteStore,
      uth: uthStore.useUthStore,
      app: app.useAppStore,
      audio: audioContext.audio,
      play: sfx.play,
      diceHit: sfx.diceHit,
    }
  })
}

// Production only: cache every file so the app installed on a phone's home
// screen opens offline. See pwa.ts. A failed registration just means no cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SvgDefs />
    <App />
  </StrictMode>,
)
