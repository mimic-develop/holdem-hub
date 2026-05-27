import { apiFetch } from "./client.js";

export interface PlayLapHomeData {
  accountId?: string;
  nutStreak: number;
  nutBestStreak: number;
  lastClearedCard: { category: string; difficulty: string } | null;
  updatedAt?: string;
}

/** 모듈 수준 캐시 — Hub App.tsx에서 fetch 후 sub-app이 소비 */
let cache: PlayLapHomeData | null = null;

export function getPlayLapHomeCache(): PlayLapHomeData | null {
  return cache;
}

export function setPlayLapHomeCache(data: PlayLapHomeData): void {
  cache = data;
}

export function clearPlayLapHomeCache(): void {
  cache = null;
}

/**
 * Hub 메인 홈 진입 시 호출.
 * concept-quiz 열릴 때 재요청 없이 캐시에서 바로 읽을 수 있게 미리 받아둔다.
 * @deprecated App.tsx에서 직접 fetch + setPlayLapHomeCache 사용 권장
 */
export async function prefetchPlayLapHome(token: string): Promise<void> {
  try {
    const res = await apiFetch<PlayLapHomeData>("/play-lap/home", {
      authToken: token,
    });
    cache = res;
  } catch {
    // prefetch 실패는 무음 처리 — concept-quiz에서 fallback fetch가 처리
  }
}
