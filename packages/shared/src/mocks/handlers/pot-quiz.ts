/**
 * pot-quiz mock 핸들러 — 난이도별 최고 점수 / 연속 기록.
 */
import { http, HttpResponse } from "msw";

export const potQuizHandlers = [
  // GET /play-lab/pot-quiz/stats — 더미 최고 기록
  http.get("*/play-lab/pot-quiz/stats", () => {
    return HttpResponse.json({
      bestScore: { easy: 1200, medium: 800, hard: 400 },
      bestStreak: { easy: 8, medium: 5, hard: 3 },
    });
  }),

  // POST /play-lab/pot-quiz/stats — 결과 저장 (fire-and-forget)
  http.post("*/play-lab/pot-quiz/stats", () => {
    return HttpResponse.json({ success: true });
  }),
];
