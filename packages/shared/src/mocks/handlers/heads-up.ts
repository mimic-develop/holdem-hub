/**
 * heads-up mock 핸들러 — 핸드/설정/통계/마일스톤.
 * 경로 prefix는 서버 마운트(`/api/play-lab/heads-up`)와 동일하게 매칭한다.
 *
 * 핸드는 모듈 수준 Map에 세션 동안 저장한다(전체 새로고침 시 초기화). 이렇게 해야
 * 저장(POST) → 목록(GET) → 단건(GET) → 리뷰 페이지가 mock 모드에서도 정상 동작한다.
 * (history.ts가 IndexedDB→서버 API로 바뀐 뒤, 기존 stub은 항상 빈 목록을 반환해
 *  핸드 기록/리뷰가 보이지 않는 버그가 있었다.)
 */
import { http, HttpResponse } from "msw";
import { HEADS_UP_SETTINGS } from "../fixtures/heads-up.js";

interface StoredHand {
  handId: string;
  playedAt?: number;
  mode?: string;
  result?: "WIN" | "LOSS" | "SPLIT";
  myWinLoss?: number;
  postHandInsight?: { overallScore?: number } | null;
  [key: string]: unknown;
}

/** 세션 메모리 — POST된 핸드를 그대로 보관. */
const hands = new Map<string, StoredHand>();

function sortedHands(): StoredHand[] {
  return [...hands.values()].sort(
    (a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0),
  );
}

export const headsUpHandlers = [
  // 핸드 목록 (limit/offset/mode 쿼리 지원)
  http.get("*/play-lab/heads-up/hands", ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const mode = url.searchParams.get("mode");
    let all = sortedHands();
    if (mode) all = all.filter((h) => h.mode === mode);
    const total = all.length;
    const page = all.slice(offset, offset + (Number.isFinite(limit) ? limit : 50));
    return HttpResponse.json({ hands: page, total });
  }),

  // 핸드 저장 (insight 보강 재저장도 동일 경로로 덮어씀)
  http.post("*/play-lab/heads-up/hands", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as StoredHand | null;
    if (body?.handId) hands.set(body.handId, body);
    return HttpResponse.json({ handId: body?.handId ?? "mock-hand-1" }, { status: 201 });
  }),

  // 단건 조회
  http.get("*/play-lab/heads-up/hands/:handId", ({ params }) => {
    const hand = hands.get(String(params.handId));
    return hand
      ? HttpResponse.json(hand)
      : HttpResponse.json({ error: "Not Found" }, { status: 404 });
  }),

  // postHandInsight 업데이트 (저장된 핸드에 병합)
  http.patch("*/play-lab/heads-up/hands/:handId/insight", async ({ params, request }) => {
    const existing = hands.get(String(params.handId));
    if (existing) {
      const body = (await request.json().catch(() => ({}))) as {
        postHandInsight?: StoredHand["postHandInsight"];
      };
      if (body?.postHandInsight !== undefined) {
        existing.postHandInsight = body.postHandInsight;
        hands.set(existing.handId, existing);
      }
    }
    return HttpResponse.json({ success: true });
  }),

  // 통계 — 저장된 핸드에서 산출
  http.get("*/play-lab/heads-up/stats", () => {
    const all = [...hands.values()];
    const total = all.length;
    const wins = all.filter((h) => h.result === "WIN").length;
    const losses = all.filter((h) => h.result === "LOSS").length;
    const splits = all.filter((h) => h.result === "SPLIT").length;
    const netChips = all.reduce((s, h) => s + (h.myWinLoss ?? 0), 0);
    const scores = all
      .map((h) => h.postHandInsight?.overallScore)
      .filter((n): n is number => typeof n === "number");
    const avgGtoScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : undefined;
    return HttpResponse.json({
      total,
      wins,
      losses,
      splits,
      netChips,
      winRate: total > 0 ? wins / total : 0,
      ...(avgGtoScore !== undefined ? { avgGtoScore } : {}),
    });
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
