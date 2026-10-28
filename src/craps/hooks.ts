import { useEffect } from 'react'
import { crapsDenominations } from '../components/chips'
import { useCrapsStore } from '../store/crapsStore'
import { useCrapsUiStore } from '../store/crapsUiStore'

/**
 * Space throws the dice — the one action worth never reaching for a mouse —
 * number keys pick a chip, O takes full odds, and Ctrl+Z steps a bet back.
 */
export function useCrapsKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const store = useCrapsStore.getState()
      const ui = useCrapsUiStore.getState()

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        store.undo()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      if (key === '?' || key === '/') {
        event.preventDefault()
        ui.togglePanel('reference')
        return
      }
      if (ui.panel && ui.panel !== 'reference') return

      if (key === ' ' || key === 'enter') {
        event.preventDefault()
        if (!event.repeat) store.roll()
        return
      }
      if (key === 'o') {
        store.takeMaxOdds()
        return
      }
      if (key === 'b') {
        ui.toggleRail()
        return
      }
      const index = Number(key)
      if (index >= 1 && index <= 7) {
        const chips = crapsDenominations(store.table().maxBet)
        const chip = chips[index - 1]
        if (chip && chip.value <= store.game.bankroll) store.setChip(chip.value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
