// Lightweight, zero-dependency Web Audio API synthesizer for causal tactile feedback.
// Respects browser autoplay policies (lazy-init on first user gesture) and store mute state.

let audioCtx: AudioContext | null = null
let lastHoverTime = 0

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function isSoundAllowed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    // Lazy import avoidance: read persisted or global flag if needed, or check store via setter
    return soundEnabled
  } catch {
    return true
  }
}

let soundEnabled = true

export function setSpatialSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

/** Ultra-soft, high-frequency glass tap (~25ms), throttled so rapid hover never spams audio. */
export function playHoverTick(): void {
  if (!isSoundAllowed()) return
  const nowMs = performance.now()
  if (nowMs - lastHoverTime < 65) return
  lastHoverTime = nowMs

  const ctx = getAudioContext()
  if (!ctx) return

  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(1680, t)
  osc.frequency.exponentialRampToValueAtTime(1180, t + 0.024)

  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(0.018, t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.028)
}

/** Crisp damped glass click (~45ms) when selecting a 3D token, orb, or hub volume. */
export function playSelectClick(): void {
  if (!isSoundAllowed()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(920, t)
  osc.frequency.exponentialRampToValueAtTime(420, t + 0.042)

  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(0.055, t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.05)
}

/** Warm two-note harmonic glass chime when completing a manual merge or stepping forward. */
export function playMergeChime(): void {
  if (!isSoundAllowed()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const t = ctx.currentTime
  const notes = [587.33, 880] // D5 -> A5 fifth
  notes.forEach((freq, idx) => {
    const start = t + idx * 0.055
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(0.048, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.24)
  })
}

/** Subtle filtered air-glide (~180ms) when flying between Shared Space and a Full Space Volume. */
export function playSpaceWhoosh(): void {
  if (!isSoundAllowed()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const t = ctx.currentTime
  const bufferSize = Math.floor(ctx.sampleRate * 0.18)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI)
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(360, t)
  filter.frequency.exponentialRampToValueAtTime(1100, t + 0.16)
  filter.Q.value = 1.6

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(0.035, t + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  noise.start(t)
  noise.stop(t + 0.185)
}
