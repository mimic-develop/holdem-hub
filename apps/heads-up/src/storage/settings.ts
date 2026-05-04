export interface Settings {
  nickname: string;
  /** Sound effects on/off (chip clicks, win chime). Default: true. */
  soundEnabled: boolean;
  /** Haptic feedback on supported mobile devices. Default: true. */
  hapticEnabled: boolean;
  /** Bet/raise sizing preset fractions (multipliers of pot). e.g. [0.5, 0.67, 1.0] = 50%/67%/Pot. */
  betPresets: number[];
  /** Hands per match. 마스터 스펙 v2 §8.3 — 기본 12, 범위 10–15. */
  matchLength: number;
  /** Amount display unit. 'bb' = big blind (default), 'chips' = raw chip count. */
  displayUnit: 'bb' | 'chips';
}

// 모노레포 통합 시 localStorage 충돌 방지 prefix.
const KEY = 'heads-up:hs-settings';
export const DEFAULT_BET_PRESETS: number[] = [0.5, 0.67, 1.0];
export const MAX_BET_PRESETS = 5;
export const DEFAULT_MATCH_LENGTH = 12;
export const MIN_MATCH_LENGTH = 10;
export const MAX_MATCH_LENGTH = 15;
/** 시작 스택은 25BB 고정. 설정으로 노출하지 않음. */
export const DEFAULT_STACK_BB = 25;
const DEFAULT: Settings = {
  nickname: '익명',
  soundEnabled: true,
  hapticEnabled: true,
  betPresets: [...DEFAULT_BET_PRESETS],
  matchLength: DEFAULT_MATCH_LENGTH,
  displayUnit: 'bb',
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asBetPresets(v: unknown): number[] {
  if (!Array.isArray(v)) return [...DEFAULT_BET_PRESETS];
  const cleaned = v
    .map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 10)
    .slice(0, MAX_BET_PRESETS);
  return cleaned.length > 0 ? cleaned : [...DEFAULT_BET_PRESETS];
}

function asMatchLength(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_MATCH_LENGTH;
  return Math.max(MIN_MATCH_LENGTH, Math.min(MAX_MATCH_LENGTH, Math.round(v)));
}

export function getSettings(): Settings {
  try {
    const raw =
      typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, betPresets: [...DEFAULT.betPresets] };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      nickname:
        typeof parsed.nickname === 'string' && parsed.nickname.trim().length > 0
          ? parsed.nickname.trim().slice(0, 20)
          : DEFAULT.nickname,
      soundEnabled: asBool(parsed.soundEnabled, DEFAULT.soundEnabled),
      hapticEnabled: asBool(parsed.hapticEnabled, DEFAULT.hapticEnabled),
      betPresets: asBetPresets(parsed.betPresets),
      matchLength: asMatchLength(parsed.matchLength),
      displayUnit: parsed.displayUnit === 'chips' ? 'chips' : 'bb',
    };
  } catch {
    return { ...DEFAULT, betPresets: [...DEFAULT.betPresets] };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode, SSR) — silently ignore.
  }
}
