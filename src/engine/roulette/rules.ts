import type { RouletteLimits } from './types'
import type { WheelType } from './wheel'

/**
 * Roulette on the Strip: the double-zero wheel on the main floor, and the
 * single-zero wheel the high-limit salon keeps for players who know the
 * difference. No en prison and no la partage on either — Las Vegas pays the
 * zero against every even-money bet.
 */
export const ROULETTE_LIMITS: Record<WheelType, RouletteLimits> = {
  double: { tableMin: 15, maxStraight: 500, maxOutside: 10_000 },
  single: { tableMin: 100, maxStraight: 2_500, maxOutside: 50_000 },
}

export const ROULETTE_STARTING_BANKROLL = 1_000

export const WHEEL_NAME: Record<WheelType, string> = {
  double: 'Double zero',
  single: 'Single zero',
}

export const WHEEL_ROOM: Record<WheelType, string> = {
  double: 'Main floor',
  single: 'High-limit salon',
}
