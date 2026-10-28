import type { RuleSet } from '../engine/types'

/** "3 to 2", "6 to 5" — how a payout is printed on the felt. */
export function payoutWords(payout: number): string {
  if (payout === 1.5) return '3 to 2'
  if (payout === 1.2) return '6 to 5'
  if (payout === 1) return 'even money'
  return `${payout} to 1`
}

/** The rules as a dealer would recite them, most consequential first. */
export function ruleLines(rules: RuleSet): string[] {
  const lines = [
    `${rules.decks === 1 ? 'Single deck' : `${rules.decks} decks`}`,
    `Blackjack pays ${payoutWords(rules.blackjackPayout)}`,
    rules.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s',
    rules.doubleOn === 'any' ? 'Double any two cards' : `Double on ${rules.doubleOn}`,
  ]
  if (rules.doubleAfterSplit) lines.push('Double after split')
  if (rules.surrender === 'late') lines.push('Late surrender')
  if (rules.surrender === 'early') lines.push('Early surrender')
  lines.push(`Split to ${rules.maxSplitHands} hands`)
  if (rules.resplitAces) lines.push('Resplit aces')
  return lines
}

/** The sentence printed across the felt under the payout arc. */
export function dealerRuleText(rules: RuleSet): string {
  return rules.dealerHitsSoft17
    ? 'Dealer must hit soft 17 · Stand on hard 17'
    : 'Dealer must draw to 16 and stand on all 17s'
}
