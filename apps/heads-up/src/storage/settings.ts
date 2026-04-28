export interface Settings {
  nickname: string;
  /** Sound effects on/off (chip clicks, win chime). Default: true. */
  soundEnabled: boolean;
  /** Haptic feedback on supported mobile devices. Default: true. */
  hapticEnabled: boolean;
}

// 모노레포 통합 시 localStorage 충돌 방지 prefix.
const KEY = 'heads-up:hs-settings';
const DEFAULT: Settings = {
  nickname: '익명',
  soundEnabled: true,
  hapticEnabled: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function getSettings(): Settings {
  try {
    const raw =
      typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      nickname:
        typeof parsed.nickname === 'string' && parsed.nickname.trim().length > 0
          ? parsed.nickname.trim().slice(0, 20)
          : DEFAULT.nickname,
      soundEnabled: asBool(parsed.soundEnabled, DEFAULT.soundEnabled),
      hapticEnabled: asBool(parsed.hapticEnabled, DEFAULT.hapticEnabled),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode, SSR) — silently ignore.
  }
}
