/**
 * heads-up mock 핸들러 — 핸드/설정/통계/마일스톤.
 * 경로 prefix는 서버 마운트(`/api/play-lab/heads-up`)와 동일하게 매칭한다.
 */
import { http, HttpResponse } from "msw";
import { HEADS_UP_SETTINGS, HEADS_UP_STATS } from "../fixtures/heads-up.js";

export const headsUpHandlers = [
  // 핸드 목록 (빈 목록 — 로컬 IndexedDB가 실제 소스, 서버는 동기화용)
  http.get("*/play-lab/heads-up/hands", () => {
    return HttpResponse.json({ hands: [], total: 0 });
  }),

  // 핸드 저장
  http.post("*/play-lab/heads-up/hands", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { handId?: string };
    return HttpResponse.json({ handId: body.handId ?? "mock-hand-1" }, { status: 201 });
  }),

  // 단건 조회 — mock에는 저장된 핸드가 없으므로 404
  http.get("*/play-lab/heads-up/hands/:handId", () => {
    return HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  // postHandInsight 업데이트
  http.patch("*/play-lab/heads-up/hands/:handId/insight", () => {
    return HttpResponse.json({ success: true });
  }),

  // 통계
  http.get("*/play-lab/heads-up/stats", () => {
    return HttpResponse.json(HEADS_UP_STATS);
  }),

  // 설정 조회 / 저장
  http.get("*/play-lab/heads-up/settings", () => {
    return HttpResponse.json(HEADS_UP_SETTINGS);
  }),
  http.put("*/play-lab/heads-up/settings", () => {
    return HttpResponse.json({ success: true });
  }),

  // 마일스톤
  http.get("*/play-lab/heads-up/milestones", () => {
    return HttpResponse.json({ shown: [] });
  }),
  http.post("*/play-lab/heads-up/milestones/mark-shown", () => {
    return HttpResponse.json({ success: true });
  }),
];
