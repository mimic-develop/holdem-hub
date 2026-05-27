import { useCallback, useEffect, useState } from 'react';
import { saveSettings } from '../storage/settings';
import { useSettingsStore } from '../store/settings-store';

type DisplayMode = 'bb' | 'chips';

const BIG_BLIND = 20; // SB=10, BB=20

// ── 모듈 레벨 공유 상태 ──────────────────────────────────────────────────────
// 모든 useChipDisplay 인스턴스가 동일 currentMode를 바라보며,
// toggle 호출 시 listeners를 통해 전체 컴포넌트에 동기 브로드캐스트.
// 초기값은 'bb' — 앱 마운트 시 initChipDisplayFromSettings()로 API 값 동기화.

let _currentMode: DisplayMode = 'bb';
const _listeners = new Set<(m: DisplayMode) => void>();

/** 앱 마운트 시 1회 호출 — settings 스토어의 displayUnit으로 초기값 동기화 */
export function initChipDisplayFromSettings(): void {
  const { settings } = useSettingsStore.getState();
  if (settings.displayUnit !== _currentMode) {
    _currentMode = settings.displayUnit;
    _listeners.forEach((fn) => fn(_currentMode));
  }
}

function _broadcast(next: DisplayMode) {
  _currentMode = next;
  _listeners.forEach((fn) => fn(next));
  // fire-and-forget: PUT /heads-up/settings { displayUnit: next }
  const current = useSettingsStore.getState().settings;
  void saveSettings({ ...current, displayUnit: next });
}
// ────────────────────────────────────────────────────────────────────────────

export function useChipDisplay(): {
  mode: DisplayMode;
  toggle: () => void;
  fmt: (chips: number) => string;
  fmtPot: (chips: number) => string;
} {
  const [mode, setMode] = useState<DisplayMode>(() => _currentMode);

  // 구독 등록 / 해제
  useEffect(() => {
    _listeners.add(setMode);
    return () => {
      _listeners.delete(setMode);
    };
  }, []);

  const toggle = useCallback(() => {
    _broadcast(_currentMode === 'bb' ? 'chips' : 'bb');
  }, []);

  const fmt = useCallback(
    (chips: number): string => {
      if (mode === 'chips') {
        return String(chips);
      }
      const val = chips / BIG_BLIND;
      return Number.isInteger(val) ? `${val}bb` : `${val.toFixed(1)}bb`;
    },
    [mode],
  );

  const fmtPot = useCallback(
    (chips: number): string => `Pot: ${fmt(chips)}`,
    [fmt],
  );

  return { mode, toggle, fmt, fmtPot };
}
