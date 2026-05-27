// 연속 학습 보너스 — 홈 진입 일자를 기록하고 연속 일수를 계산.
// 모노레포 prefix `hub:` 준수.

const DATE_KEY  = 'hub:streak-last-date';
const COUNT_KEY = 'hub:streak-count';

/** 보너스 도달 목표 일수 — 디자인의 진행 점 5개와 동기화. */
export const STREAK_GOAL = 5;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getStreak(): number {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(COUNT_KEY);
    const n = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Home 마운트 시 1회 호출. 오늘이 처음이면 +1(어제 기록 있을 때) 또는 1(없을 때),
 * 오늘 이미 기록된 경우 그대로 유지.
 * 새 카운트를 반환.
 */
export function tickStreakOnVisit(): number {
  try {
    const today = todayKey();
    const last = localStorage.getItem(DATE_KEY);

    if (last === today) return getStreak();

    let next: number;
    if (last === yesterdayKey()) {
      next = getStreak() + 1;
    } else {
      next = 1;
    }
    localStorage.setItem(DATE_KEY, today);
    localStorage.setItem(COUNT_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}
