/**
 * Web Audio synth helper — 외부 sample 의존 없이 짧은 효과음 생성.
 *
 * 브라우저 자동재생 정책: 사용자 인터랙션 후 첫 호출에 한해 AudioContext init.
 * 음소거 상태는 localStorage `pot-quiz:muted` 에 영속.
 */

const MUTED_KEY = 'pot-quiz:muted';

let ctx: AudioContext | null = null;
let muted = readMutedFromStorage();

function readMutedFromStorage(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTED_KEY, value ? '1' : '0');
  } catch {
    // ignore quota
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

interface ToneOpts {
  freq: number;
  duration: number;       // seconds
  type?: OscillatorType;  // default 'sine'
  gain?: number;          // peak gain 0..1
  delay?: number;         // start offset seconds
  freqEnd?: number;       // optional slide
}

function playTone({ freq, duration, type = 'sine', gain = 0.08, delay = 0, freqEnd }: ToneOpts) {
  const c = getCtx();
  if (!c) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), start + duration);
  }
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** 칩이 한 위치에서 다른 위치로 이동하는 짧은 'click' — forming(좌석 → 팟) / awarding(팟 → 좌석) 모두 사용 */
export function playChipMove(): void {
  if (muted) return;
  playTone({ freq: 1400, freqEnd: 800, duration: 0.06, type: 'triangle', gain: 0.08 });
}

/** 데드머니가 메인팟에 합쳐지는 묵직한 톤 */
export function playDeadMerge(): void {
  if (muted) return;
  playTone({ freq: 220, duration: 0.18, type: 'sawtooth', gain: 0.07 });
  playTone({ freq: 440, duration: 0.12, type: 'sine', gain: 0.06, delay: 0.04 });
}

/** sub-step 정답 통과 — 짧은 상승 chime */
export function playSuccess(): void {
  if (muted) return;
  playTone({ freq: 660, duration: 0.08, type: 'sine', gain: 0.06 });
  playTone({ freq: 990, duration: 0.10, type: 'sine', gain: 0.06, delay: 0.06 });
}

/** 오답 — 낮은 buzz */
export function playError(): void {
  if (muted) return;
  playTone({ freq: 180, duration: 0.18, type: 'square', gain: 0.06 });
}

/** 결과(완벽 정답) — 더 길고 화려한 두 톤 chime */
export function playWin(): void {
  if (muted) return;
  playTone({ freq: 660, duration: 0.10, type: 'sine', gain: 0.07 });
  playTone({ freq: 880, duration: 0.10, type: 'sine', gain: 0.07, delay: 0.08 });
  playTone({ freq: 1320, duration: 0.18, type: 'sine', gain: 0.07, delay: 0.16 });
}
