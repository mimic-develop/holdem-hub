/**
 * hub mock 핸들러 — 홈 화면 데이터.
 * 응답 구조는 PlayLapHomeData (packages/shared/src/api/playLapCache.ts)와 일치.
 */
import { http, HttpResponse } from "msw";

export const hubHandlers = [
  // GET /play-lab/home — 홈 진입 시 prefetch되는 통합 데이터
  http.get("*/play-lab/home", () => {
    return HttpResponse.json({
      accountId: "mock-user-1",
      nutStreak: 3,
      nutBestStreak: 7,
      lastClearedCard: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }),
];
