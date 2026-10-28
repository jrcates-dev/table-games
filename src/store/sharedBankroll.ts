import { create } from 'zustand'

/**
 * Whether the floor shares one bankroll, and the figure it stands at.
 *
 * Only the choice and the figure live here, so the table chrome can read them
 * without loading every table's store. Keeping the racks in step is the floor's
 * job, in `racks.ts`.
 */
export interface SharedBankroll {
  /** One bankroll carried from table to table, rather than one waiting at each. */
  shared: boolean
  /** What every rack stands at while the bankroll is shared. */
  bankroll: number
}

const KEY = 'cta:bankroll:v1'

function stored(): SharedBankroll {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SharedBankroll> | null
    const bankroll = Number(value?.bankroll)
    return bankroll >= 0 ? { shared: value?.shared === true, bankroll } : { shared: false, bankroll: 0 }
  } catch {
    return { shared: false, bankroll: 0 }
  }
}

export const useSharedBankroll = create<SharedBankroll>(() => stored())

useSharedBankroll.subscribe(({ shared, bankroll }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ shared, bankroll }))
  } catch {
    // Blocked storage: the floor stays as it is until the page closes.
  }
})
