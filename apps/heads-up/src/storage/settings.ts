import { apiFetch } from '@hh/shared';

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

function parseSettings(raw: Partial<Settings>): Settings {
  return {
    nickname:
      typeof raw.nickname === 'string' && raw.nickname.trim().length > 0
        ? raw.nickname.trim().slice(0, 20)
        : DEFAULT.nickname,
    soundEnabled:  asBool(raw.soundEnabled,  DEFAULT.soundEnabled),
    hapticEnabled: asBool(raw.hapticEnabled, DEFAULT.hapticEnabled),
    betPresets:    asBetPresets(raw.betPresets),
    matchLength:   asMatchLength(raw.matchLength),
    displayUnit:   raw.displayUnit === 'chips' ? 'chips' : 'bb',
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const data = await apiFetch<Partial<Settings>>('/heads-up/settings');
    return parseSettings(data);
  } catch {
    return { ...DEFAULT, betPresets: [...DEFAULT.betPresets] };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await apiFetch('/heads-up/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
  } catch {
    // 비로그인/네트워크 실패 시 무시
  }
}
