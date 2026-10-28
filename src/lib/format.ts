/**
 * Money is shown whole — except at the two tables that really do pay in
 * cents, where `cents` keeps them: a Banker win less its 5%, and a flush on the
 * Ultimate Texas Hold'em Blind at 3 to 2. Whole amounts still print whole.
 */
export function money(amount: number, cents = false): string {
  if (cents) {
    const hundredths = Math.round(Math.abs(amount) * 100)
    if (hundredths % 100 !== 0) {
      return `$${(hundredths / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }
  const rounded = Math.round(amount)
  return `$${Math.abs(rounded).toLocaleString('en-US')}`
}

export function signedMoney(amount: number, cents = false): string {
  const rounded = cents ? Math.round(amount * 100) / 100 : Math.round(amount)
  if (rounded === 0) return '$0'
  return `${rounded > 0 ? '+' : '−'}${money(rounded, cents)}`
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function compactMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 10_000) return `$${(amount / 1_000).toFixed(0)}K`
  return money(amount)
}

export function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
