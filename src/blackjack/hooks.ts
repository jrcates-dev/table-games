import { useEffect } from 'react'
import { blackjackDenominations } from '../components/chips'
import type { PlayerAction } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { useUiStore } from '../store/uiStore'

/**
 * Keyboard play. Blackjack is a fast game, and reaching for the mouse between
 * every decision is what makes most implementations feel sluggish.
 */
export function useBlackjackKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      const ui = useUiStore.getState()
      if (key === '?' || key === '/') {
        event.preventDefault()
        ui.togglePanel('chart')
        return
      }
      // Every panel but the strategy card takes the keyboard: nobody wants
      // Space dealing a hand while they read their statistics.
      if (ui.panel && ui.panel !== 'chart') return
      // So does the reshuffle question, until it is answered.
      if (ui.shuffleAsk) return

      const store = useGameStore.getState()
      const { phase } = store.game.round
      if (store.challenge) return

      if (key === ' ' || key === 'enter') {
        event.preventDefault()
        if (event.repeat) return
        if (phase === 'betting') store.dealRound()
        else if (phase === 'roundOver') {
          if (store.profile.bankroll < store.table().minBet) return
          store.nextRound()
          store.dealRound()
        } else if (phase === 'insurance') store.act('declineInsurance')
        return
      }

      if (phase === 'insurance' && key === 'i') {
        store.act('insurance')
        return
      }

      if (phase === 'roundOver' && key === 'n') {
        store.nextRound()
        return
      }

      if (phase === 'roundOver' && key === 'c') {
        store.clearBet()
        return
      }

      if (phase === 'playerTurn') {
        const map: Record<string, PlayerAction> = { h: 'hit', s: 'stand', d: 'double', p: 'split', r: 'surrender' }
        const action = map[key]
        if (action && !event.repeat) {
          event.preventDefault()
          store.act(action)
        }
        return
      }

      if (phase === 'betting') {
        const index = Number(key)
        if (index >= 1 && index <= 6) {
          event.preventDefault()
          // The same rack the dock draws, so key 3 is always the third chip shown.
          const chips = blackjackDenominations(store.table().maxBet, store.game.bankroll)
          const chip = chips[index - 1]
          if (chip) store.addChip(chip.value)
        } else if (key === 'c') store.clearBet()
        else if (key === 'x') store.doubleBet()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
