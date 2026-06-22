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

/** 세션 메모리 설정 — PUT으로 갱신해 GET/리더보드가 동일 닉네임을 쓰도록 한다. */
let mockSettings = { ...HEADS_UP_SETTINGS };

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
      evaluatedHands: scores.length,
      ...(avgGtoScore !== undefined ? { avgGtoScore } : {}),
    });
  }),

  // 리더보드 — 본인(저장된 핸드) 집계 + 시드 경쟁자로 보드 구성.
  // (목은 단일 유저만 보관 → 프리뷰에서 보드가 비지 않도록 가상 경쟁자를 섞는다)
  // ?persona= 가 오면 해당 페르소나 핸드만 집계하고, 시드 점수도 페르소나별로 흔들어
  // 탭마다 보드가 구분돼 보이게 한다.
  http.get("*/play-lab/heads-up/leaderboard", ({ request }) => {
    const MIN_QUALIFY = 50;
    const WINDOW = 200;
    const BIG_BLIND = 20;
    const persona = new URL(request.url).searchParams.get("persona") || undefined;

    const evaluated = [...hands.values()]
      .filter(
        (h) =>
          h.mode === "AI" &&
          typeof h.postHandInsight?.overallScore === "number" &&
          (persona ? h.aiPersona === persona : true),
      )
      .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0));
    const win = evaluated.slice(0, WINDOW);
    let scoreSum = 0;
    let net = 0;
    let wins = 0;
    for (const h of win) {
      scoreSum += h.postHandInsight!.overallScore!;
      net += h.myWinLoss ?? 0;
      if (h.result === "WIN") wins++;
    }
    const n = win.length;

    const pLen = persona?.length ?? 0;
    const delta = persona ? ((pLen * 5) % 13) - 6 : 0; // 페르소나별 점수 이동
    const seeded = [
      { nickname: "샤크K", avgScore: 88, bbPerHand: 3.2, winRate: 0.61, handsCounted: 180 },
      { nickname: "GTO_라인", avgScore: 81, bbPerHand: 2.0, winRate: 0.54, handsCounted: 200 },
      { nickname: "리버레이크", avgScore: 73, bbPerHand: 0.8, winRate: 0.5, handsCounted: 96 },
      { nickname: "콜링스테이션", avgScore: 64, bbPerHand: -0.5, winRate: 0.46, handsCounted: 120 },
      { nickname: "폴드마스터", avgScore: 57, bbPerHand: -1.2, winRate: 0.41, handsCounted: 58 },
      { nickname: "뉴비짱", avgScore: 48, bbPerHand: -2.4, winRate: 0.37, handsCounted: 72 },
    ].map((e, i) => ({
      ...e,
      avgScore: Math.max(30, Math.min(96, e.avgScore + delta + ((i * pLen) % 5) - 2)),
      rank: 0,
      isMe: false,
    }));

    let myProgress: { handsCounted: number; needed: number } | null = null;
    if (n >= MIN_QUALIFY) {
      seeded.push({
        rank: 0,
        nickname: mockSettings.nickname,
        avgScore: Math.round(scoreSum / n),
        bbPerHand: Math.round((net / BIG_BLIND / n) * 100) / 100,
        winRate: wins / n,
        handsCounted: n,
        isMe: true,
      });
    } else {
      myProgress = {
        handsCounted: evaluated.length,
        needed: Math.max(0, MIN_QUALIFY - evaluated.length),
      };
    }

    seeded.sort((a, b) => b.avgScore - a.avgScore || b.handsCounted - a.handsCounted);
    seeded.forEach((e, i) => (e.rank = i + 1));
    const me = seeded.find((e) => e.isMe) ?? null;

    return HttpResponse.json({
      persona: persona ?? null,
      entries: seeded.slice(0, 100),
      me,
      myProgress,
      minQualifyHands: MIN_QUALIFY,
      window: WINDOW,
    });
  }),

  // 설정 조회 / 저장 (PUT을 세션 메모리에 반영)
  http.get("*/play-lab/heads-up/settings", () => {
    return HttpResponse.json(mockSettings);
  }),
  http.put("*/play-lab/heads-up/settings", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Partial<typeof HEADS_UP_SETTINGS>;
    mockSettings = { ...mockSettings, ...body };
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
