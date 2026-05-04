/**
 * Web Audio synthesis for in-game sound effects — pleasant/soft palette.
 *
 * Design notes:
 * - Sine waves only (no square/sawtooth) — avoids harsh upper harmonics.
 * - Long, smooth envelopes (15–40ms attack, 200–500ms release) → no clicks.
 * - Low peak gains (0.04–0.12) and a master limiter → comfortable at any volume.
 * - Noise bursts are routed through a lowpass biquad filter → "wood/cloth" whoosh
 *   instead of harsh white-noise hiss.
 * - Chords use just intonation (3rd, 5th) — bell-like, no dissonance.
 *
 * All exports are no-op-safe: if WebAudio is unavailable (jsdom, SSR, locked-down
 * browser) every call silently returns. Each function takes `enabled` so callers
 * can wire `settings.soundEnabled` without an extra guard at every site.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let initFailed = false;

type Win = typeof window & { webkitAudioContext?: typeof AudioContext };

function getCtx(): AudioContext | null {
  if (initFailed) return null;
  if (ctx) return ctx;
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || (window as Win).webkitAudioContext;
    if (!Ctor) {
      initFailed = true;
      return null;
    }
    ctx = new Ctor();
    // Soft master bus — pulls every effect down a touch and adds gentle limiting headroom.
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    initFailed = true;
    return null;
  }
}

function dest(c: AudioContext): AudioNode {
  return masterGain ?? c.destination;
}

interface ToneSpec {
  freq: number;
  duration: number;       // total seconds (incl. release)
  gain?: number;          // peak gain (0..1)
  attack?: number;        // seconds; default 0.02
  release?: number;       // seconds; default 0.2 (or duration*0.6 if smaller)
  detune?: number;        // cents — slight detuning adds warmth
}

/**
 * Play a single sine tone with a smooth ADSR-ish envelope.
 * Returns the time when the tone finishes (so callers can schedule sequences).
 */
function playSineAt(c: AudioContext, spec: ToneSpec, startAt: number): number {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = spec.freq;
  if (spec.detune) osc.detune.value = spec.detune;

  const peak = spec.gain ?? 0.08;
  const attack = Math.max(0.005, spec.attack ?? 0.02);
  const release = Math.max(0.05, spec.release ?? Math.min(0.25, spec.duration * 0.6));
  const sustainEnd = Math.max(startAt + attack, startAt + spec.duration - release);

  // Use exponential curves where possible — perceived as smoother than linear.
  g.gain.setValueAtTime(0.0001, startAt);
  g.gain.exponentialRampToValueAtTime(peak, startAt + attack);
  g.gain.setValueAtTime(peak, sustainEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + spec.duration);

  osc.connect(g).connect(dest(c));
  osc.start(startAt);
  osc.stop(startAt + spec.duration + 0.05);
  return startAt + spec.duration;
}

/**
 * Play multiple sines simultaneously starting at `startAt` (chord), then return
 * the longest finish time.
 */
function playChordAt(c: AudioContext, specs: ToneSpec[], startAt: number): number {
  let end = startAt;
  for (const s of specs) {
    const t = playSineAt(c, s, startAt);
    if (t > end) end = t;
  }
  return end;
}

function playSequence(specs: ToneSpec[]): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  let t = c.currentTime + 0.005;
  for (const s of specs) t = playSineAt(c, s, t);
}

/**
 * Soft filtered noise burst. Routed through a lowpass biquad so the result is
 * a warm "whoosh" (like fabric or felt) rather than raw white-noise hiss.
 */
function playSoftNoise(durationSec: number, opts?: {
  cutoff?: number;   // Hz, default 1400
  q?: number;        // resonance, default 0.6
  gain?: number;     // 0..1, default 0.06
}): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  try {
    const sampleRate = c.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buf = c.createBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    // Pinkish noise: slight low-frequency emphasis via running average of two whites.
    let lastA = 0;
    let lastB = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      lastA = 0.7 * lastA + 0.3 * w;
      lastB = 0.5 * lastB + 0.5 * lastA;
      // Soft fade-in (5%) and fade-out (40%) for click-free start/end.
      const pct = i / length;
      let env = 1;
      if (pct < 0.05) env = pct / 0.05;
      else if (pct > 0.6) env = (1 - pct) / 0.4;
      data[i] = lastB * env;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = opts?.cutoff ?? 1400;
    filter.Q.value = opts?.q ?? 0.6;
    const g = c.createGain();
    g.gain.value = opts?.gain ?? 0.06;
    src.connect(filter).connect(g).connect(dest(c));
    src.start();
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public sound effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Your turn — soft two-note rising chime (perfect 4th: E5 → A5).
 * Bell-like attack, long release. Pleasant, attention-grabbing without being shrill.
 */
export function playYourTurnSound(enabled: boolean): void {
  if (!enabled) return;
  playSequence([
    { freq: 659.25, duration: 0.18, gain: 0.07, attack: 0.02, release: 0.14 }, // E5
    { freq: 880.00, duration: 0.32, gain: 0.08, attack: 0.02, release: 0.26 }, // A5
  ]);
}

/**
 * Card dealing — short, soft filtered whoosh. No raw hiss.
 */
export function playDealSound(enabled: boolean): void {
  if (!enabled) return;
  playSoftNoise(0.18, { cutoff: 1100, q: 0.5, gain: 0.05 });
}

/**
 * Bet/raise/call — gentle "pluck" tone. Single soft sine, fast release.
 * Replaces the previous harsh 1200Hz square wave.
 */
export function playChipSound(enabled: boolean): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  // Two-octave pluck (G4 + G5) — adds body without harshness.
  const t = c.currentTime + 0.005;
  playChordAt(c, [
    { freq: 392.00, duration: 0.18, gain: 0.06, attack: 0.005, release: 0.16 }, // G4
    { freq: 783.99, duration: 0.14, gain: 0.04, attack: 0.005, release: 0.12 }, // G5 (overtone)
  ], t);
}

/**
 * Check — single mellow mid tone (D5). Short and unobtrusive.
 */
export function playCheckSound(enabled: boolean): void {
  if (!enabled) return;
  playSequence([
    { freq: 587.33, duration: 0.16, gain: 0.05, attack: 0.02, release: 0.13 }, // D5
  ]);
}

/**
 * Fold — soft descending two-tone (A4 → E4). Gentle, not heavy.
 */
export function playFoldSound(enabled: boolean): void {
  if (!enabled) return;
  playSequence([
    { freq: 440.00, duration: 0.14, gain: 0.06, attack: 0.015, release: 0.11 }, // A4
    { freq: 329.63, duration: 0.28, gain: 0.06, attack: 0.015, release: 0.24 }, // E4
  ]);
}

/**
 * Win — major triad arpeggio C5–E5–G5, then sustained C6 sparkle. Bell-like.
 */
export function playWinSound(enabled: boolean): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  const t0 = c.currentTime + 0.005;
  // Arpeggio
  playSineAt(c, { freq: 523.25, duration: 0.4, gain: 0.07, release: 0.32 }, t0);          // C5
  playSineAt(c, { freq: 659.25, duration: 0.42, gain: 0.07, release: 0.34 }, t0 + 0.09); // E5
  playSineAt(c, { freq: 783.99, duration: 0.55, gain: 0.08, release: 0.45 }, t0 + 0.18); // G5
  // Sparkle on top
  playSineAt(c, { freq: 1046.5, duration: 0.6, gain: 0.05, attack: 0.04, release: 0.5 }, t0 + 0.28); // C6
}

/**
 * Decision-timer tick — short, precise sine click played once per second during
 * the last 5 seconds of the countdown. Clock-like without being harsh.
 */
export function playTickSound(enabled: boolean): void {
  if (!enabled) return;
  playSequence([
    { freq: 1200, duration: 0.04, gain: 0.045, attack: 0.003, release: 0.032 },
  ]);
}

/**
 * Matchup VS reveal — warm low chord (A2 + E3), no harsh sawtooth.
 * Sounds like a soft cinematic hit.
 */
export function playMatchupSound(enabled: boolean): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  const t = c.currentTime + 0.005;
  playChordAt(c, [
    { freq: 110.0, duration: 0.6, gain: 0.09, attack: 0.04, release: 0.45, detune: -3 }, // A2
    { freq: 164.8, duration: 0.6, gain: 0.07, attack: 0.04, release: 0.45, detune: +3 }, // E3
    { freq: 220.0, duration: 0.5, gain: 0.05, attack: 0.05, release: 0.4 },              // A3 (octave shimmer)
  ], t);
  // Soft whoosh layered on top for impact texture.
  playSoftNoise(0.35, { cutoff: 700, q: 0.4, gain: 0.04 });
}
