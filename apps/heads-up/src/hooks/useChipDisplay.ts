import { useCallback, useEffect, useState } from 'react';

type DisplayMode = 'bb' | 'chips';

const STORAGE_KEY = 'heads-up:chip-display';
const BIG_BLIND = 20; // SB=10, BB=20

// ── 모듈 레벨 공유 상태 ──────────────────────────────────────────────────────
// 모든 useChipDisplay 인스턴스가 동일 currentMode를 바라보며,
// toggle 호출 시 listeners를 통해 전체 컴포넌트에 동기 브로드캐스트.

function readStoredMode(): DisplayMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'bb' || stored === 'chips') return stored;
  } catch {
    // private browsing or storage unavailable
  }
  return 'bb';
}

let _currentMode: DisplayMode = readStoredMode();
const _listeners = new Set<(m: DisplayMode) => void>();

function _broadcast(next: DisplayMode) {
  _currentMode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // private browsing
  }
  _listeners.forEach((fn) => fn(next));
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
