/**
 * Chip denominations, in the colours a Nevada casino actually uses, so a
 * stack reads correctly at a glance to anyone who has played.
 */
export interface Denomination {
  value: number
  /** Chip body. */
  body: string
  /** A darker shade of the body, for the edge of the stack. */
  shade: string
  /** Edge inserts. */
  insert: string
  /** The printed denomination. */
  ink: string
  label: string
}

export const DENOMINATIONS: Denomination[] = [
  // Craps needs dollar chips — a place bet on the six has to be a multiple of
  // $6, and the props take a buck. Blackjack never offers this one.
  { value: 1, body: '#ece5d3', shade: '#b8ae98', insert: '#2f5fa8', ink: '#1f3f73', label: '1' },
  { value: 5, body: '#c4262e', shade: '#7e1419', insert: '#f6efe0', ink: '#8f1a20', label: '5' },
  { value: 25, body: '#1b7d4a', shade: '#0e4a2b', insert: '#f6efe0', ink: '#0f5231', label: '25' },
  { value: 100, body: '#18171d', shade: '#050507', insert: '#f6efe0', ink: '#18171d', label: '100' },
  { value: 500, body: '#5d2b8c', shade: '#34164f', insert: '#f3cf62', ink: '#43196a', label: '500' },
  { value: 1_000, body: '#e3a72a', shade: '#9a6b0f', insert: '#7d1a22', ink: '#6b3d02', label: '1K' },
  { value: 5_000, body: '#7a5846', shade: '#473024', insert: '#f6efe0', ink: '#4a3226', label: '5K' },
  { value: 25_000, body: '#0f7d8b', shade: '#07464f', insert: '#f6efe0', ink: '#08505a', label: '25K' },
]

export function denomination(value: number): Denomination {
  return DENOMINATIONS.find((d) => d.value === value) ?? DENOMINATIONS[1]
}

/**
 * Break an amount into physical chips, largest first — the way a dealer
 * colours a bet up. Capped so a huge wager becomes a believable stack rather
 * than a tower of hundreds; anything left over below the smallest chip is
 * simply not drawn (it is always less than a dollar).
 */
export function chipBreakdown(amount: number, maxChips = 24): Denomination[] {
  const chips: Denomination[] = []
  let remaining = Math.round(amount)
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    const denom = DENOMINATIONS[i]
    while (remaining >= denom.value && chips.length < maxChips) {
      chips.push(denom)
      remaining -= denom.value
    }
  }
  return chips
}

/**
 * The chips a blackjack player can click, filtered to what the table and rack
 * allow. Dollar chips are excluded: no blackjack bet ever needs one.
 */
export function blackjackDenominations(maxBet: number, bankroll: number): Denomination[] {
  const usable = DENOMINATIONS.filter((d) => d.value >= 5 && d.value <= maxBet)
  const shown = usable.slice(-6)
  // Keep the rack stable as the bankroll moves; unaffordable chips grey out
  // rather than vanish, so the keyboard shortcuts never shift under a finger.
  return shown.length > 0 ? shown : [DENOMINATIONS[1]].filter((d) => d.value <= Math.max(5, bankroll))
}

/**
 * The craps rack runs from the bottom up: a craps player needs the small chips
 * constantly — a $6 place bet, a $1 horn, an odd dollar to make odds pay — and
 * reaches for the large ones rarely.
 */
export function crapsDenominations(maxBet: number): Denomination[] {
  const usable = DENOMINATIONS.filter((d) => d.value <= maxBet)
  return usable.slice(0, 7)
}

/**
 * The rack for the newer tables, bottom up from the smallest chip any of their
 * bets can use: dollars at roulette, where inside chips build a $15 minimum
 * between them, and reds and up wherever the smallest bet is $5.
 */
export function tableDenominations(smallestBet: number, maxBet: number, count = 6): Denomination[] {
  const floor = smallestBet >= 5 ? 5 : 1
  return DENOMINATIONS.filter((d) => d.value >= floor && d.value <= maxBet).slice(0, count)
}

/** Number keys pick a chip from the rack the dock is showing. */
export function chipForKey(key: string, denominations: Denomination[], bankroll: number): number | null {
  const index = Number(key)
  if (!Number.isInteger(index) || index < 1 || index > denominations.length) return null
  const chip = denominations[index - 1]
  return chip && chip.value <= bankroll ? chip.value : null
}
