import { currentPrefs, usePrefs, type Prefs } from '../prefs/prefsStore'

/**
 * The mixing desk.
 *
 * Every sound in the building is synthesised at runtime — there are no audio
 * files — so this module owns the one AudioContext, the buses everything is
 * routed through, a generated room reverb, and the handful of primitives the
 * sound library is built from: noise bursts, decaying modal partials and plain
 * tones. The only thing on the desk is the table itself — no floor ambience,
 * no music, no voices.
 *
 *   sfx ──┬───────────────► master ─► glue compressor ─► speakers
 *         └─► reverb send ─┘
 */

export interface Buses {
  ctx: AudioContext
  master: GainNode
  sfx: GainNode
  /** Feeds the shared room reverb. */
  reverb: GainNode
}

let buses: Buses | null = null
let noise: { white: AudioBuffer; pink: AudioBuffer } | null = null
const unlockListeners = new Set<() => void>()

/** Seconds of noise per buffer. Bursts start at random offsets into it. */
const NOISE_SECONDS = 3

/** Gain of the table bus under the master volume. */
const TABLE_LEVEL = 0.85

function makeNoise(ctx: AudioContext) {
  const length = ctx.sampleRate * NOISE_SECONDS
  const white = ctx.createBuffer(1, length, ctx.sampleRate)
  const pink = ctx.createBuffer(1, length, ctx.sampleRate)
  const w = white.getChannelData(0)
  const p = pink.getChannelData(0)

  // Paul Kellet's economy pink filter.
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < length; i++) {
    const x = Math.random() * 2 - 1
    w[i] = x
    b0 = 0.99765 * b0 + x * 0.099046
    b1 = 0.963 * b1 + x * 0.2965164
    b2 = 0.57 * b2 + x * 1.0526913
    p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2
  }
  return { white, pink }
}

/**
 * A room, generated rather than recorded: stereo noise under an exponential
 * decay, darkened as it rings so the tail sounds like carpet and upholstery
 * rather than a tiled bathroom.
 */
function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let smooth = 0
    for (let i = 0; i < length; i++) {
      const t = i / length
      // One-pole lowpass whose cutoff falls over the tail.
      const k = 0.55 - 0.45 * t
      smooth = smooth + k * (Math.random() * 2 - 1 - smooth)
      const preDelay = i < ctx.sampleRate * 0.012 ? 0 : 1
      data[i] = smooth * Math.pow(1 - t, decay) * preDelay
    }
  }
  return buffer
}

function build(): Buses | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  const ctx = new Ctor({ latencyHint: 'interactive' })
  const master = ctx.createGain()
  const glue = ctx.createDynamicsCompressor()
  glue.threshold.value = -16
  glue.knee.value = 12
  glue.ratio.value = 3
  glue.attack.value = 0.004
  glue.release.value = 0.2
  master.connect(glue).connect(ctx.destination)

  const convolver = ctx.createConvolver()
  convolver.buffer = makeImpulse(ctx, 2.4, 3.2)
  const reverbReturn = ctx.createGain()
  reverbReturn.gain.value = 0.9
  const reverb = ctx.createGain()
  reverb.connect(convolver).connect(reverbReturn).connect(master)

  const sfx = ctx.createGain()
  sfx.gain.value = TABLE_LEVEL
  sfx.connect(master)
  const sfxSend = ctx.createGain()
  sfxSend.gain.value = 0.14
  sfx.connect(sfxSend).connect(reverb)

  noise = makeNoise(ctx)
  return { ctx, master, sfx, reverb }
}

function applyPrefs(prefs: Prefs) {
  if (!buses) return
  const { ctx } = buses
  const now = ctx.currentTime
  const ramp = (param: AudioParam, value: number) => {
    param.cancelScheduledValues(now)
    param.setTargetAtTime(value, now, 0.08)
  }
  ramp(buses.master.gain, prefs.muted ? 0 : prefs.master)
}

/**
 * The mixer, created lazily. Browsers refuse to start audio before the page
 * has been touched, so the context is built on the first gesture and every
 * sound requested before then is simply dropped. So is every sound requested
 * while the player has the sound off: nothing is synthesised just to be
 * thrown away at the master fader.
 */
export function audio(): Buses | null {
  if (!buses || usePrefs.getState().muted) return null
  if (buses.ctx.state === 'suspended') void buses.ctx.resume()
  return buses
}

export function noiseBuffer(kind: 'white' | 'pink'): AudioBuffer | null {
  return noise ? noise[kind] : null
}

/** Run `fn` once audio is actually available (immediately, if it already is). */
export function onAudioUnlocked(fn: () => void): () => void {
  if (buses && buses.ctx.state === 'running') {
    fn()
    return () => {}
  }
  unlockListeners.add(fn)
  return () => unlockListeners.delete(fn)
}

export function isAudioRunning(): boolean {
  return Boolean(buses && buses.ctx.state === 'running')
}

/**
 * Wire the first-gesture unlock. Idempotent; call once at startup.
 */
export function installAudioUnlock() {
  if (typeof window === 'undefined') return
  const unlock = () => {
    if (!buses) {
      buses = build()
      if (!buses) return
      applyPrefs(currentPrefs())
    }
    const fire = () => {
      for (const fn of unlockListeners) fn()
      unlockListeners.clear()
    }
    if (buses.ctx.state === 'running') fire()
    else void buses.ctx.resume().then(fire)
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
  usePrefs.subscribe((state) => applyPrefs(state))

  // A hidden tab goes quiet. Browsers throttle timers in the background, and a
  // scheduler that wakes up late would otherwise play everything it missed at
  // once; suspending the context stops the clock along with the sound.
  document.addEventListener('visibilitychange', () => {
    if (!buses) return
    if (document.hidden) void buses.ctx.suspend()
    else void buses.ctx.resume()
  })
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export interface Out {
  /** Where the voice ends up. Defaults to the sfx bus. */
  dest?: AudioNode
  /** -1 (left) … 1 (right). */
  pan?: number
}

function route(b: Buses, node: AudioNode, out: Out): void {
  const dest = out.dest ?? b.sfx
  if (out.pan !== undefined && out.pan !== 0) {
    const panner = b.ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, out.pan))
    node.connect(panner).connect(dest)
  } else {
    node.connect(dest)
  }
}

export interface BurstOptions extends Out {
  at?: number
  duration: number
  gain: number
  kind?: 'white' | 'pink'
  type?: BiquadFilterType
  freq?: number
  /** Filter frequency the burst sweeps to over its length. */
  freqTo?: number
  q?: number
  attack?: number
  /** Second filter in series, for shaping a band out of a burst. */
  type2?: BiquadFilterType
  freq2?: number
}

/** A filtered slice of noise with a fast attack and an exponential tail. */
export function burst(o: BurstOptions): void {
  const b = audio()
  const buf = noiseBuffer(o.kind ?? 'white')
  if (!b || !buf) return
  const { ctx } = b
  const t = ctx.currentTime + (o.at ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  // A burst longer than the buffer — the roulette ball's roll — loops it. Left
  // to the arithmetic below, its offset would come out negative, and start()
  // throws on a negative offset.
  const long = o.duration + 0.05 >= NOISE_SECONDS
  src.loop = long
  const offset = Math.random() * (long ? NOISE_SECONDS : NOISE_SECONDS - o.duration - 0.05)

  let node: AudioNode = src
  if (o.type) {
    const f = ctx.createBiquadFilter()
    f.type = o.type
    f.frequency.setValueAtTime(o.freq ?? 1000, t)
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + o.duration)
    f.Q.value = o.q ?? 0.8
    node.connect(f)
    node = f
  }
  if (o.type2) {
    const f2 = ctx.createBiquadFilter()
    f2.type = o.type2
    f2.frequency.value = o.freq2 ?? 1000
    f2.Q.value = 0.7
    node.connect(f2)
    node = f2
  }

  const amp = ctx.createGain()
  const attack = Math.max(0.001, o.attack ?? 0.002)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.duration)
  node.connect(amp)
  route(b, amp, o)

  src.start(t, offset, o.duration + 0.02)
}

export interface ModalOptions extends Out {
  at?: number
  /** Partial frequencies, Hz. */
  freqs: number[]
  /** Per-partial decay time constants, seconds. */
  decays: number[]
  gains: number[]
  /** Overall multiplier. */
  gain?: number
  type?: OscillatorType
}

/**
 * A struck object: a handful of sine partials, each ringing down on its own
 * time constant. Chips, dice and puck are all this with different numbers —
 * which is roughly what they are physically.
 */
export function modal(o: ModalOptions): void {
  const b = audio()
  if (!b) return
  const { ctx } = b
  const t = ctx.currentTime + (o.at ?? 0)
  const bus = ctx.createGain()
  bus.gain.value = o.gain ?? 1
  route(b, bus, o)

  o.freqs.forEach((freq, i) => {
    // A partial above Nyquist would only alias back down as a whistle.
    if (freq >= ctx.sampleRate * 0.45) return
    const osc = ctx.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.value = freq
    const amp = ctx.createGain()
    const peak = Math.max(0.0002, o.gains[i] ?? 0.05)
    const decay = o.decays[i] ?? 0.05
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.0015)
    amp.gain.setTargetAtTime(0.0001, t + 0.0015, decay / 3)
    osc.connect(amp).connect(bus)
    osc.start(t)
    osc.stop(t + decay * 2.2 + 0.05)
  })
}

export interface ToneOptions extends Out {
  at?: number
  freq: number
  freqTo?: number
  duration: number
  gain: number
  type?: OscillatorType
  attack?: number
  lowpass?: number
}

/** A plain enveloped oscillator, optionally gliding. */
export function tone(o: ToneOptions): void {
  const b = audio()
  if (!b) return
  const { ctx } = b
  const t = ctx.currentTime + (o.at ?? 0)
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t)
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, t + o.duration)
  const amp = ctx.createGain()
  const attack = o.attack ?? 0.004
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.duration)
  let node: AudioNode = osc
  if (o.lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lowpass
    node.connect(f)
    node = f
  }
  node.connect(amp)
  route(b, amp, o)
  osc.start(t)
  osc.stop(t + o.duration + 0.05)
}

/** ±`spread` jitter around 1, so repeated sounds never repeat exactly. */
export function vary(spread = 0.05): number {
  return 1 + (Math.random() * 2 - 1) * spread
}
