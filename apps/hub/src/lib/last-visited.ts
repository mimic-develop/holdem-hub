// 사용자가 최근에 진입한 sub-app 추적 — 홈의 "최근 플레이" / "지금 바로 시작" CTA에 사용.
// localStorage 키 prefix는 모노레포 컨벤션(`hub:`) 따른다.

const KEY = 'hub:last-visited';

export interface LastVisit {
  /** sub-app id — Home APPS 배열의 id와 동일 */
  id: string;
  /** epoch ms */
  ts: number;
}

export function getLastVisit(): LastVisit | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastVisit>;
    if (typeof parsed.id !== 'string' || typeof parsed.ts !== 'number') return null;
    return { id: parsed.id, ts: parsed.ts };
  } catch {
    return null;
  }
}

export function recordVisit(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, ts: Date.now() }));
  } catch {
    // localStorage 미사용 가능 환경 — 무시
  }
}
