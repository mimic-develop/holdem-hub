/**
 * concept-quiz mock 핸들러 — 카드 클리어 기록 저장.
 */
import { http, HttpResponse } from "msw";

export const conceptQuizHandlers = [
  // POST /play-lab/quiz-clear — 진행률 저장 (fire-and-forget)
  http.post("*/play-lab/quiz-clear", () => {
    return HttpResponse.json({ success: true });
  }),
];
