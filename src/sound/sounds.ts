/**
 * Every sound on the site, synthesised with Web Audio. No files: a move is a
 * short band-passed noise burst (the click of felt on wood) over a falling
 * low body (the board resonating); judgements are small tuned figures on
 * top. Nothing here knows about chess.js or React.
 */

export type SoundKind =
  | 'move'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'start'
  | 'end'
  | 'tick'
  | 'illegal'
  // review judgements
  | 'brilliant'
  | 'great'
  | 'best'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'done'

const STORAGE_KEY = 'counterplay.sound'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = readMuted()
const listeners = new Set<() => void>()
const lastPlayed = new Map<SoundKind, number>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'off' : 'on')
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  if (!next) unlock()
  for (const l of listeners) l()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor({ latencyHint: 'interactive' })
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 8
  comp.ratio.value = 4
  comp.attack.value = 0.002
  comp.release.value = 0.12
  master = ctx.createGain()
  master.gain.value = 0.7 * volume
  master.connect(comp).connect(ctx.destination)
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

let volume = 1
/** Master volume, 0 to 1 (on top of the mute switch). */
export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v))
  if (master) master.gain.value = 0.7 * volume
}

/** Browsers keep audio suspended until a gesture. Call from any pointer or key handler. */
export function unlock() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume()
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlock()
    window.removeEventListener('pointerdown', once, true)
    window.removeEventListener('keydown', once, true)
  }
  window.addEventListener('pointerdown', once, true)
  window.addEventListener('keydown', once, true)
}

// ---------------------------------------------------------------- voices

interface KnockOptions {
  /** Centre of the noise band: higher is a harder, brighter click. */
  click?: number
  clickQ?: number
  clickDecay?: number
  /** Starting pitch of the body resonance. */
  body?: number
  bodyDecay?: number
  gain?: number
}

/** One piece set down on the board. */
function knock(c: AudioContext, out: AudioNode, t: number, o: KnockOptions = {}) {
  const { click = 1700, clickQ = 1.1, clickDecay = 0.05, body = 190, bodyDecay = 0.09, gain = 1 } = o

  const src = c.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = click * (0.96 + Math.random() * 0.08)
  bp.Q.value = clickQ
  const ng = c.createGain()
  ng.gain.setValueAtTime(0, t)
  ng.gain.linearRampToValueAtTime(0.9 * gain, t + 0.0015)
  ng.gain.exponentialRampToValueAtTime(0.001, t + clickDecay)
  src.connect(bp).connect(ng).connect(out)
  src.start(t)
  src.stop(t + clickDecay + 0.02)

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(body, t)
  osc.frequency.exponentialRampToValueAtTime(body * 0.55, t + bodyDecay)
  const og = c.createGain()
  og.gain.setValueAtTime(0, t)
  og.gain.linearRampToValueAtTime(0.55 * gain, t + 0.003)
  og.gain.exponentialRampToValueAtTime(0.001, t + bodyDecay)
  osc.connect(og).connect(out)
  osc.start(t)
  osc.stop(t + bodyDecay + 0.02)
}

interface ToneOptions {
  type?: OscillatorType
  decay?: number
  gain?: number
  /** Glide to this frequency over the tone's length. */
  to?: number
  attack?: number
  /** Add a quiet octave partial: a bell rather than a beep. */
  bell?: boolean
}

function tone(c: AudioContext, out: AudioNode, t: number, freq: number, o: ToneOptions = {}) {
  const { type = 'triangle', decay = 0.35, gain = 0.3, to, attack = 0.004, bell = false } = o
  const voices: [number, number][] = bell ? [[1, 1], [2.01, 0.28], [3.02, 0.08]] : [[1, 1]]
  for (const [mult, g] of voices) {
    const osc = c.createOscillator()
    osc.type = mult === 1 ? type : 'sine'
    osc.frequency.setValueAtTime(freq * mult, t)
    if (to) osc.frequency.exponentialRampToValueAtTime(to * mult, t + decay * 0.8)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(gain * g, t + attack)
    env.gain.exponentialRampToValueAtTime(0.0008, t + decay)
    osc.connect(env).connect(out)
    osc.start(t)
    osc.stop(t + decay + 0.03)
  }
}

/** Filtered noise sweep: a turned page, a breath of air. */
function sweep(c: AudioContext, out: AudioNode, t: number, from: number, to: number, dur: number, gain = 0.25, q = 0.8) {
  const src = c.createBufferSource()
  src.buffer = noise
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(from, t)
  bp.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(bp).connect(g).connect(out)
  src.start(t)
  src.stop(t + dur + 0.02)
}

// Note frequencies used below.
const N = {
  F3: 174.61, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1567.98, C7: 2093,
}

const voices: Record<SoundKind, (c: AudioContext, out: AudioNode, t: number) => void> = {
  move: (c, o, t) => knock(c, o, t),
  capture: (c, o, t) => {
    knock(c, o, t, { click: 2600, clickQ: 0.8, clickDecay: 0.045, body: 150, bodyDecay: 0.11, gain: 1.25 })
    // the taken piece knocked against the one arriving
    knock(c, o, t + 0.022, { click: 3400, clickQ: 1.6, clickDecay: 0.03, body: 260, bodyDecay: 0.04, gain: 0.45 })
  },
  castle: (c, o, t) => {
    knock(c, o, t, { body: 175 })
    knock(c, o, t + 0.095, { click: 1500, body: 205, gain: 0.85 })
  },
  check: (c, o, t) => {
    knock(c, o, t, { click: 2100, gain: 1.1 })
    tone(c, o, t + 0.035, N.A5, { decay: 0.32, gain: 0.16, bell: true })
  },
  promote: (c, o, t) => {
    knock(c, o, t)
    tone(c, o, t + 0.05, N.E5, { decay: 0.2, gain: 0.14 })
    tone(c, o, t + 0.12, N.B5, { decay: 0.4, gain: 0.16, bell: true })
  },
  start: (c, o, t) => {
    tone(c, o, t, N.G4, { decay: 0.25, gain: 0.14, bell: true })
    tone(c, o, t + 0.09, N.D5, { decay: 0.45, gain: 0.16, bell: true })
  },
  end: (c, o, t) => {
    tone(c, o, t, N.G5, { decay: 0.7, gain: 0.15, bell: true })
    tone(c, o, t + 0.16, N.E5, { decay: 0.7, gain: 0.15, bell: true })
    tone(c, o, t + 0.32, N.C5, { decay: 1.3, gain: 0.18, bell: true })
  },
  tick: (c, o, t) => knock(c, o, t, { click: 4200, clickQ: 2, clickDecay: 0.018, body: 900, bodyDecay: 0.015, gain: 0.35 }),
  illegal: (c, o, t) => {
    tone(c, o, t, N.A3, { type: 'square', decay: 0.09, gain: 0.05 })
    tone(c, o, t + 0.085, N.F3, { type: 'square', decay: 0.12, gain: 0.05 })
  },

  brilliant: (c, o, t) => {
    const run = [N.C6, N.E6, N.G6, N.C7]
    run.forEach((f, i) => tone(c, o, t + i * 0.045, f, { type: 'sine', decay: 0.55 + i * 0.12, gain: 0.12, bell: true }))
    sweep(c, o, t + 0.05, 5000, 9000, 0.45, 0.05, 0.6)
  },
  great: (c, o, t) => {
    tone(c, o, t, N.E5, { type: 'sine', decay: 0.3, gain: 0.15, bell: true })
    tone(c, o, t + 0.08, N.B5, { type: 'sine', decay: 0.55, gain: 0.16, bell: true })
  },
  best: (c, o, t) => tone(c, o, t, N.G5, { type: 'sine', decay: 0.45, gain: 0.12, bell: true }),
  book: (c, o, t) => sweep(c, o, t, 900, 2800, 0.16, 0.16, 0.9),
  inaccuracy: (c, o, t) => tone(c, o, t, N.D4, { decay: 0.22, gain: 0.14 }),
  mistake: (c, o, t) => {
    tone(c, o, t, N.E4, { decay: 0.18, gain: 0.15 })
    tone(c, o, t + 0.11, N.C4, { decay: 0.3, gain: 0.15 })
  },
  miss: (c, o, t) => {
    sweep(c, o, t, 2400, 500, 0.24, 0.12, 1.2)
    tone(c, o, t + 0.02, N.A4, { type: 'sine', to: N.D4, decay: 0.32, gain: 0.12 })
  },
  blunder: (c, o, t) => {
    knock(c, o, t, { click: 700, clickQ: 0.7, clickDecay: 0.08, body: 110, bodyDecay: 0.22, gain: 1.2 })
    tone(c, o, t + 0.04, N.D4, { type: 'sawtooth', decay: 0.22, gain: 0.06 })
    tone(c, o, t + 0.17, N.A3, { type: 'sawtooth', decay: 0.26, gain: 0.06 })
    tone(c, o, t + 0.3, N.F3, { type: 'sawtooth', decay: 0.55, gain: 0.07, to: 165 })
  },
  done: (c, o, t) => {
    ;[N.C5, N.E5, N.G5].forEach((f, i) => tone(c, o, t + i * 0.06, f, { type: 'sine', decay: 0.9, gain: 0.1, bell: true }))
  },
}

/**
 * Play a sound `delayMs` from now. Repeats of the same kind closer than 45ms
 * are dropped, so holding an arrow key through a game does not turn to noise.
 */
export function play(kind: SoundKind, delayMs = 0) {
  if (muted) return
  const c = audio()
  if (!c || !master) return
  if (c.state === 'suspended') void c.resume()
  const now = performance.now() + delayMs
  const last = lastPlayed.get(kind) ?? -Infinity
  if (now - last < 45) return
  lastPlayed.set(kind, now)
  voices[kind](c, master, c.currentTime + 0.005 + delayMs / 1000)
}

/** The board sound for a move, read from its SAN alone. */
export function moveSound(san: string): SoundKind {
  if (san.includes('#') || san.includes('+')) return 'check'
  if (san.includes('=')) return 'promote'
  if (san.startsWith('O-O')) return 'castle'
  if (san.includes('x')) return 'capture'
  return 'move'
}
