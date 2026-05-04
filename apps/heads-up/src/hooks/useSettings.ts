import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings, type Settings } from '../storage/settings';

export function useSettings(): {
  settings: Settings;
  setNickname: (nickname: string) => void;
  setSoundEnabled: (v: boolean) => void;
  setHapticEnabled: (v: boolean) => void;
  setBetPresets: (v: number[]) => void;
  setMatchLength: (v: number) => void;
  setDisplayUnit: (v: 'bb' | 'chips') => void;
  updateSettings: (patch: Partial<Settings>) => void;
} {
  const [settings, setSettings] = useState<Settings>(() => getSettings());

  // Sync across tabs if another tab updates settings.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hs-settings') setSettings(getSettings());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next: Settings = { ...prev, ...patch };
      if (typeof patch.nickname === 'string') {
        next.nickname = patch.nickname.trim().slice(0, 20) || '익명';
      }
      saveSettings(next);
      return next;
    });
  }, []);

  const setNickname = useCallback(
    (nickname: string) => updateSettings({ nickname }),
    [updateSettings],
  );
  const setSoundEnabled = useCallback(
    (v: boolean) => updateSettings({ soundEnabled: v }),
    [updateSettings],
  );
  const setHapticEnabled = useCallback(
    (v: boolean) => updateSettings({ hapticEnabled: v }),
    [updateSettings],
  );
  const setBetPresets = useCallback(
    (v: number[]) => updateSettings({ betPresets: v }),
    [updateSettings],
  );
  const setMatchLength = useCallback(
    (v: number) => updateSettings({ matchLength: v }),
    [updateSettings],
  );
  const setDisplayUnit = useCallback(
    (v: 'bb' | 'chips') => updateSettings({ displayUnit: v }),
    [updateSettings],
  );

  return {
    settings,
    setNickname,
    setSoundEnabled,
    setHapticEnabled,
    setBetPresets,
    setMatchLength,
    setDisplayUnit,
    updateSettings,
  };
}
