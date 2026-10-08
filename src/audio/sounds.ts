/**
 * Hand-rolled WebAudio sound effects for The Smooshulator. No audio files, no deps.
 *
 * Usage from the UI:
 *   - Call `unlockAudio()` synchronously inside the first trusted user gesture
 *     (e.g. a `pointerdown` listener on `document`, registered with `{ once: true }`).
 *     iOS keeps the AudioContext suspended until `resume()` runs inside a gesture.
 *   - Then call `blip()`, `crunch()`, `discovery()`, `ew()`, `yawn()` freely.
 *
 * Every export is a no-op (never throws) when `window`/`AudioContext` are
 * missing (SSR, Vitest's node env, old browsers) or construction fails.
 */

type AudioContextCtor = new () => AudioContext;

/** Peak output level. Kid-friendly: never louder than this at the destination. */
const MASTER_GAIN = 0.25;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let visibilityHooked = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  try {
    const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    const created = new Ctor();
    const gain = created.createGain();
    gain.gain.value = MASTER_GAIN;
    gain.connect(created.destination);
    ctx = created;
    master = gain;
    hookVisibility();
    return ctx;
  } catch {
    return null;
  }
}

/** iOS/Safari suspend the context when the tab is backgrounded; re-resume on return. */
function hookVisibility(): void {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  try {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) unlockAudio();
    });
  } catch {
    // ignore
  }
}

/**
 * Create (if needed) and resume the AudioContext. Must run synchronously inside a
 * trusted user gesture the first time (pointerdown / touchend / click / keydown).
 * Safe to call repeatedly.
 */
export function unlockAudio(): void {
  const c = getContext();
  if (!c) return;
  try {
    if (c.state !== 'running') void c.resume().catch(() => undefined);
  } catch {
    // ignore
  }
}

/** Run a synth voice against a live context; swallow every failure. */
function play(fn: (c: AudioContext, out: AudioNode, t0: number) => void): void {
  if (muted) return;
  const c = getContext();
  if (!c || !master) return;
  try {
    // If we are suspended (no gesture yet), nudge resume; scheduled nodes will
    // sound once it starts, or be dropped harmlessly if it never does.
    if (c.state === 'suspended') void c.resume().catch(() => undefined);
    fn(c, master, c.currentTime);
  } catch {
    // Never let a sound effect break the game.
  }
}

/** One oscillator with an exponential decay envelope. `vol` is relative to MASTER_GAIN. */
function tone(
  c: AudioContext,
  out: AudioNode,
  opts: { type: OscillatorType; freq: number; at: number; dur: number; vol?: number; glideTo?: number },
): OscillatorNode {
  const { type, freq, at, dur, vol = 1, glideTo } = opts;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo !== undefined) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
  return o;
}

/** White-noise buffer with a quadratic fade-out, `dur` seconds long. */
function noiseBurst(c: AudioContext, dur: number): AudioBufferSourceNode {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = c.createBufferSource();
  s.buffer = buf;
  return s;
}

/** Short square-wave tap (~60 ms). Card picked / button pressed. */
export function blip(): void {
  play((c, out, t) => {
    tone(c, out, { type: 'square', freq: 880, at: t, dur: 0.06, vol: 0.6 });
  });
}

/** The SMOOSH: filtered noise burst plus a descending saw (~200 ms). */
export function crunch(): void {
  play((c, out, t) => {
    const noise = noiseBurst(c, 0.2);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.2);
    const g = c.createGain();
    g.gain.value = 0.7;
    noise.connect(f).connect(g).connect(out);
    noise.start(t);
    noise.stop(t + 0.2);
    tone(c, out, { type: 'sawtooth', freq: 220, glideTo: 55, at: t, dur: 0.2, vol: 0.5 });
  });
}

/** New discovery: bright 4-note major arpeggio + a sparkle on top (~500 ms). */
export function discovery(): void {
  play((c, out, t) => {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      tone(c, out, { type: 'triangle', freq, at: t + i * 0.09, dur: 0.18, vol: 0.6 });
    });
    // Sparkle: two quick high sine pings over the last note.
    tone(c, out, { type: 'sine', freq: 2093, at: t + 0.36, dur: 0.12, vol: 0.3 });
    tone(c, out, { type: 'sine', freq: 2637, at: t + 0.42, dur: 0.1, vol: 0.25 });
  });
}

/** "Ew": descending, wobbly wah-wah (~500 ms). For stinky/gross results. */
export function ew(): void {
  play((c, out, t) => {
    const dur = 0.5;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(140, t + dur);
    // Wobble: a slow LFO modulating pitch.
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 7;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain).connect(o.frequency);
    // Wah: lowpass cutoff sweeping down.
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(250, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.02);
    lfo.stop(t + dur + 0.02);
  });
}

/** Yawn: soft low sine slide (~600 ms). For sleepy/boring results. */
export function yawn(): void {
  play((c, out, t) => {
    const dur = 0.6;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    f.connect(out);
    tone(c, f, { type: 'sine', freq: 220, glideTo: 110, at: t, dur, vol: 0.5 });
  });
}
