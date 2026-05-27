import { apiFetch } from "./client.js";

interface PlayLapHomeData {
  lastClearedCard: { category: string; difficulty: string } | null;
}

/** 모듈 수준 캐시 — Hub 메인 홈에서 prefetch 후 concept-quiz useProgress가 소비 */
let cache: PlayLapHomeData | null = null;

export function getPlayLapHomeCache(): PlayLapHomeData | null {
  return cache;
}

export function clearPlayLapHomeCache(): void {
  cache = null;
}

/**
 * Hub 메인 홈 진입 시 호출.
 * concept-quiz 열릴 때 재요청 없이 캐시에서 바로 읽을 수 있게 미리 받아둔다.
 */
export async function prefetchPlayLapHome(token: string): Promise<void> {
  try {
    const res = await apiFetch<PlayLapHomeData>("/api/play-lap/home", {
      authToken: token,
    });
    cache = res;
  } catch {
    // prefetch 실패는 무음 처리 — concept-quiz에서 fallback fetch가 처리
  }
}
