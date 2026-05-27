import { create } from 'zustand';
import {
  getSettings,
  saveSettings,
  DEFAULT_BET_PRESETS,
  DEFAULT_MATCH_LENGTH,
  type Settings,
} from '../storage/settings';

interface SettingsStoreState {
  settings: Settings;
  isLoaded: boolean;
  /** 앱 마운트 시 1회 호출 — API에서 설정을 로드. 이미 로드됐으면 no-op. */
  init: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  setNickname: (nickname: string) => void;
  setSoundEnabled: (v: boolean) => void;
  setHapticEnabled: (v: boolean) => void;
  setBetPresets: (v: number[]) => void;
  setMatchLength: (v: number) => void;
  setDisplayUnit: (v: 'bb' | 'chips') => void;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => {
  const updateSettings = (patch: Partial<Settings>) => {
    set((state) => {
      const next: Settings = { ...state.settings, ...patch };
      if (typeof patch.nickname === 'string') {
        next.nickname = patch.nickname.trim().slice(0, 20) || '익명';
      }
      void saveSettings(next);
      return { settings: next };
    });
  };

  return {
    settings: {
      nickname: '익명',
      soundEnabled: true,
      hapticEnabled: true,
      betPresets: [...DEFAULT_BET_PRESETS],
      matchLength: DEFAULT_MATCH_LENGTH,
      displayUnit: 'bb',
    },
    isLoaded: false,
    init: async () => {
      if (get().isLoaded) return;
      const s = await getSettings();
      set({ settings: s, isLoaded: true });
    },
    updateSettings,
    setNickname: (nickname) => updateSettings({ nickname }),
    setSoundEnabled: (v) => updateSettings({ soundEnabled: v }),
    setHapticEnabled: (v) => updateSettings({ hapticEnabled: v }),
    setBetPresets: (v) => updateSettings({ betPresets: v }),
    setMatchLength: (v) => updateSettings({ matchLength: v }),
    setDisplayUnit: (v) => updateSettings({ displayUnit: v }),
  };
});
