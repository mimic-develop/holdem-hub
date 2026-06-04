/**
 * nut-to mock 핸들러 — 게임 생성 + 리더보드.
 *
 * 경로 매칭은 `*` 와일드카드로 host/baseUrl 무관하게 path 끝부분만 매칭한다.
 * (apiFetch baseUrl이 dev/prod/MIMIC에 따라 다르므로 절대 host를 고정하지 않는다.)
 */
import { http, HttpResponse } from "msw";
import { NUT_TO_NEW_FIXTURES } from "../fixtures/nut-to.js";

// 호출마다 fixture를 순환 반환해 단조로움을 줄인다.
let nutToCursor = 0;

export const nutToHandlers = [
  // GET /api/nut-to/new — 새 게임 보드 + 3 스트릿 너트 티어
  http.get("*/nut-to/new", () => {
    const fixture = NUT_TO_NEW_FIXTURES[nutToCursor % NUT_TO_NEW_FIXTURES.length];
    nutToCursor += 1;
    return HttpResponse.json(fixture);
  }),

  // GET /api/nut-to/leaderboard — 더미 랭킹
  http.get("*/nut-to/leaderboard", () => {
    return HttpResponse.json({
      entries: [
        { rank: 1, accountId: "mock-1", nickname: "목보스", streak: 12, totalCorrect: 48, accuracy: 0.96, avgResponseMs: 3200, score: 5400, recordedAt: 0, updatedAt: "2026-01-01T00:00:00.000Z" },
        { rank: 2, accountId: "mock-2", nickname: "허수아비", streak: 9, totalCorrect: 40, accuracy: 0.91, avgResponseMs: 4100, score: 4450, recordedAt: 0, updatedAt: "2026-01-01T00:00:00.000Z" },
        { rank: 3, accountId: "mock-user-1", nickname: "목유저", streak: 7, totalCorrect: 33, accuracy: 0.88, avgResponseMs: 4500, score: 3650, recordedAt: 0, updatedAt: "2026-01-01T00:00:00.000Z" },
        { rank: 4, accountId: "mock-4", nickname: "초보러", streak: 4, totalCorrect: 20, accuracy: 0.80, avgResponseMs: 6000, score: 2200, recordedAt: 0, updatedAt: "2026-01-01T00:00:00.000Z" },
        { rank: 5, accountId: "mock-5", nickname: "뉴비", streak: 2, totalCorrect: 10, accuracy: 0.70, avgResponseMs: 7000, score: 1100, recordedAt: 0, updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
  }),

  // POST /api/nut-to/leaderboard/submit — 항상 갱신된 것으로 응답
  http.post("*/nut-to/leaderboard/submit", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const streak = Number(body.streak ?? 0);
    const totalCorrect = Number(body.totalCorrect ?? 0);
    const accuracy = Number(body.accuracy ?? 0);
    const avgResponseMs = Number(body.avgResponseMs ?? 0);
    const score = totalCorrect * 100 + Math.round(streak * 50);
    return HttpResponse.json({
      wasUpdated: true,
      previousBest: null,
      newBest: { streak, accuracy, avgResponseMs, score, rank: 1 },
    });
  }),
];
