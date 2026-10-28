import { audio, burst, modal, tone, vary } from './context'
import { buzz } from '../lib/haptics'

/**
 * The sound library.
 *
 * Every voice is a small piece of physical modelling rather than a recording:
 * a clay chip is a few inharmonic partials struck hard and damped fast, a card
 * is a sweep of filtered air and a soft tap, a die is a brighter, harder
 * version of the chip. Each call is jittered, so a stack of ten chips is ten
 * slightly different clacks rather than one sample played ten times.
 *
 * Only the table makes a sound. There are no interface blips, no win bells and
 * no fanfares: the chips being paid or raked are the result.
 */
type TableVoice =
  | 'chip'
  | 'chipStack'
  | 'chipSlide'
  | 'card'
  | 'cardFlip'
  | 'cardSweep'
  | 'shuffle'
  | 'dice'
  | 'diceShake'
  | 'diceRelease'
  | 'puck'
  | 'ballRoll'
  | 'ballDrop'

/** Interface cues the controls still raise. A real table makes none: silent. */
type SilentVoice = 'click' | 'hover' | 'notice' | 'open' | 'close'

export type Voice = TableVoice | SilentVoice

export interface PlayOptions {
  /** Seconds from now. */
  at?: number
  /** 0..1 — for impacts, how hard. */
  strength?: number
  /** For stacks, how many chips. */
  count?: number
  pan?: number
  /** For the roulette ball, how long the roll or the rattle lasts, seconds. */
  duration?: number
}

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

/** One clay chip landing on another. */
function chip(at = 0, strength = 1, pan = 0) {
  const s = 0.55 + 0.45 * strength
  // The strike: a millisecond of bright air.
  burst({ at, duration: 0.012, gain: 0.3 * s, type: 'highpass', freq: 2200, pan })
  // The body: clay rings high and dies almost at once.
  const f = vary(0.06)
  modal({
    at,
    freqs: [2650 * f, 3820 * f * vary(0.02), 5310 * f * vary(0.02), 7240 * f],
    decays: [0.07, 0.05, 0.035, 0.022],
    gains: [0.16, 0.1, 0.065, 0.035],
    gain: s,
    pan,
  })
  // Felt underneath takes a little of the weight.
  tone({ at, freq: 540 * vary(0.08), freqTo: 360, duration: 0.05, gain: 0.05 * s, pan })
}

function chipStack(at = 0, count = 3, pan = 0) {
  let t = at
  const n = Math.max(1, Math.min(12, count))
  for (let i = 0; i < n; i++) {
    chip(t, 0.75 + Math.random() * 0.25 - i * 0.02, pan)
    t += 0.028 + Math.random() * 0.022
  }
}

/** Chips pushed across the felt — a dealer paying or taking. */
function chipSlide(at = 0, pan = 0) {
  burst({
    at,
    duration: 0.32,
    gain: 0.07,
    kind: 'pink',
    type: 'bandpass',
    freq: 1500,
    freqTo: 2300,
    q: 0.7,
    attack: 0.05,
    pan,
  })
  for (let i = 0; i < 4; i++) chip(at + 0.05 + Math.random() * 0.24, 0.25 + Math.random() * 0.2, pan)
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** A card pitched out of the shoe: the slide, then the snap onto felt. */
function card(at = 0, pan = 0) {
  burst({
    at,
    duration: 0.085,
    gain: 0.15,
    type: 'bandpass',
    freq: 5200,
    freqTo: 1600,
    q: 1.1,
    attack: 0.008,
    pan,
  })
  burst({ at: at + 0.075, duration: 0.03, gain: 0.24, type: 'lowpass', freq: 1100, pan })
  burst({ at: at + 0.076, duration: 0.008, gain: 0.1, type: 'highpass', freq: 3500, pan })
}

function cardFlip(at = 0, pan = 0) {
  burst({ at, duration: 0.03, gain: 0.12, type: 'highpass', freq: 2600, pan })
  burst({ at: at + 0.045, duration: 0.035, gain: 0.14, type: 'bandpass', freq: 1700, q: 0.9, pan })
}

/** The hand raked off the felt into the discard rack. */
function cardSweep(at = 0) {
  burst({
    at,
    duration: 0.42,
    gain: 0.17,
    kind: 'pink',
    type: 'bandpass',
    freq: 2600,
    freqTo: 1200,
    q: 0.6,
    attack: 0.06,
  })
  burst({ at: at + 0.4, duration: 0.03, gain: 0.16, type: 'lowpass', freq: 900 })
}

/**
 * A riffle: two halves of a deck interleaving, which is a few dozen tiny
 * card-edge clicks under a swell, then the bridge cascading down.
 */
function shuffle(at = 0) {
  const riffle = (start: number, pan: number) => {
    let t = start
    const clicks = 46
    for (let i = 0; i < clicks; i++) {
      const env = Math.sin((i / clicks) * Math.PI)
      burst({
        at: t,
        duration: 0.009,
        gain: 0.03 + 0.06 * env * Math.random(),
        type: 'highpass',
        freq: 2800 + Math.random() * 1800,
        pan,
      })
      t += 0.011 + Math.random() * 0.008
    }
    return t
  }
  const end = riffle(at, -0.25)
  burst({
    at: end + 0.05,
    duration: 0.3,
    gain: 0.06,
    kind: 'pink',
    type: 'bandpass',
    freq: 3000,
    freqTo: 1400,
    attack: 0.03,
  })
  const end2 = riffle(end + 0.45, 0.25)
  burst({ at: end2 + 0.08, duration: 0.05, gain: 0.14, type: 'lowpass', freq: 700 })
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

/** One die meeting something. The physics decides what, and how hard. */
export function diceHit(surface: 'felt' | 'wall' | 'die', strength: number, at = 0, pan = 0) {
  const s = Math.max(0.05, Math.min(1, strength))
  if (surface === 'felt') {
    burst({ at, duration: 0.05, gain: 0.26 * s, type: 'lowpass', freq: 760, pan })
    modal({
      at,
      freqs: [3100 * vary(0.08), 4900 * vary(0.08)],
      decays: [0.03, 0.02],
      gains: [0.05, 0.03],
      gain: s,
      pan,
    })
  } else if (surface === 'wall') {
    // Rubber pyramids: a dull knock with a short, woody ring.
    burst({ at, duration: 0.035, gain: 0.3 * s, type: 'bandpass', freq: 1900, q: 1.2, pan })
    modal({
      at,
      freqs: [310 * vary(0.05), 1180 * vary(0.05), 2150 * vary(0.05), 3350 * vary(0.05)],
      decays: [0.06, 0.05, 0.035, 0.02],
      gains: [0.12, 0.1, 0.07, 0.04],
      gain: s,
      pan,
    })
  } else {
    // Acetate on acetate is the brightest sound at the table.
    burst({ at, duration: 0.006, gain: 0.2 * s, type: 'highpass', freq: 4000, pan })
    modal({
      at,
      freqs: [5200 * vary(0.07), 7400 * vary(0.07), 9100 * vary(0.05)],
      decays: [0.028, 0.02, 0.012],
      gains: [0.1, 0.07, 0.04],
      gain: s,
      pan,
    })
  }
}

/** Two dice clicking together inside a closed hand. */
function diceShake(at = 0) {
  let t = at
  for (let i = 0; i < 9; i++) {
    const s = 0.35 + Math.random() * 0.45
    burst({ at: t, duration: 0.008, gain: 0.12 * s, type: 'bandpass', freq: 3200, q: 0.8, pan: -0.35 })
    modal({
      at: t,
      freqs: [4300 * vary(0.1), 6100 * vary(0.1)],
      decays: [0.018, 0.012],
      gains: [0.05, 0.03],
      gain: s * 1.3,
      pan: -0.35,
    })
    t += 0.035 + Math.random() * 0.05
  }
}

function diceRelease(at = 0) {
  burst({
    at,
    duration: 0.22,
    gain: 0.05,
    kind: 'pink',
    type: 'bandpass',
    freq: 900,
    freqTo: 2600,
    q: 0.6,
    attack: 0.03,
    pan: -0.3,
  })
}

// ---------------------------------------------------------------------------
// Table furniture
// ---------------------------------------------------------------------------

function puck(at = 0) {
  tone({ at, freq: 190, freqTo: 120, duration: 0.11, gain: 0.12 })
  burst({ at, duration: 0.03, gain: 0.12, type: 'lowpass', freq: 1400 })
  modal({ at, freqs: [2300, 3700], decays: [0.03, 0.02], gains: [0.05, 0.025] })
}

// ---------------------------------------------------------------------------
// The roulette ball
// ---------------------------------------------------------------------------

/**
 * The ball running round the track: a steady hiss of resin on hardwood that
 * drops in pitch as it slows, over a faint rumble from the wheel head.
 */
function ballRoll(at = 0, duration = 4) {
  burst({
    at,
    duration,
    gain: 0.055,
    kind: 'pink',
    type: 'bandpass',
    freq: 2400,
    freqTo: 900,
    q: 1.4,
    attack: 0.25,
    pan: -0.4,
  })
  tone({ at, freq: 82, freqTo: 54, duration, gain: 0.018, lowpass: 240, attack: 0.3, pan: -0.4 })
}

/** One click of resin on a chrome deflector or a pocket fret. */
function ballClick(at: number, strength: number, bright: boolean) {
  const f = vary(0.05)
  modal({
    at,
    freqs: bright ? [3600 * f, 5300 * f, 8100 * f] : [2500 * f, 3900 * f, 6100 * f],
    decays: bright ? [0.05, 0.035, 0.02] : [0.035, 0.025, 0.015],
    gains: [0.1, 0.06, 0.03],
    gain: strength,
    pan: -0.4,
  })
  burst({ at, duration: 0.012, gain: 0.12 * strength, type: 'highpass', freq: 3000, pan: -0.4 })
}

/**
 * The drop: a hard knock off a deflector, then the ball skittering across the
 * frets, each hop shorter and softer, until it settles with a dull tick.
 */
function ballDrop(at = 0, duration = 1.4) {
  ballClick(at, 0.9, true)
  const hops = 7
  let t = at + duration * 0.16
  for (let i = 0; i < hops; i++) {
    const s = 0.75 * Math.pow(0.78, i)
    ballClick(t, s, false)
    t += (duration * 0.6 * Math.pow(0.72, i)) / 2.6
  }
  burst({ at: Math.min(t, at + duration), duration: 0.05, gain: 0.08, type: 'lowpass', freq: 700, pan: -0.4 })
}

// ---------------------------------------------------------------------------

export function play(voice: Voice, options: PlayOptions = {}): void {
  // A chip put down is felt as well as heard, sound on or off.
  if (voice === 'chip' && !options.at) buzz()
  if (!audio()) return
  const at = options.at ?? 0
  const pan = options.pan ?? 0
  // Sound is dressing. Every table plays it in the middle of moving the game
  // on, so a voice that fails to schedule is dropped here rather than thrown
  // through to leave a round half-played.
  try {
    switch (voice) {
      case 'chip':
        return chip(at, options.strength ?? 1, pan)
      case 'chipStack':
        return chipStack(at, options.count ?? 3, pan)
      case 'chipSlide':
        return chipSlide(at, pan)
      case 'card':
        return card(at, pan)
      case 'cardFlip':
        return cardFlip(at, pan)
      case 'cardSweep':
        return cardSweep(at)
      case 'shuffle':
        return shuffle(at)
      case 'dice':
      case 'diceShake':
        diceShake(at)
        if (voice === 'dice') diceRelease(at + 0.38)
        return
      case 'diceRelease':
        return diceRelease(at)
      case 'puck':
        return puck(at)
      case 'ballRoll':
        return ballRoll(at, options.duration)
      case 'ballDrop':
        return ballDrop(at, options.duration)
      default:
        // An interface cue: silent by design.
        return
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error(`Sound '${voice}' failed`, error)
  }
}
