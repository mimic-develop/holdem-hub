/**
 * /api/heads-up — Heads-Up 트레이너 데이터
 *
 * POST   /hands                    → 핸드 저장 (upsert by handId)
 * GET    /hands?limit&offset&mode  → 핸드 목록 (최신순)
 * GET    /hands/:handId            → 단건 조회
 * PATCH  /hands/:handId/insight    → postHandInsight 2단계 업데이트
 * GET    /settings                 → 설정 조회
 * PUT    /settings                 → 설정 저장
 * GET    /milestones               → 표시된 마일스톤 ID 목록
 * POST   /milestones/mark-shown    → 마일스톤 표시 기록
 *
 * 인증: Authorization: Bearer <JWT> 헤더에서 accountId 추출.
 * 저장: in-memory Map — 서버 재시작 시 초기화됨.
 * 미인증 요청: 빈 데이터 반환 (비로그인 상태에서도 앱 동작 보장).
 */
import { Router, type Request, type Response } from "express";

export const headsUpRouter = Router();

// ── 타입 ────────────────────────────────────────────────────────────────────

// CompletedHand의 핵심 필드만 인라인 정의 (타입 공유 없이 독립 유지)
type GameMode = "AI" | "REMOTE";
type HandResult = "WIN" | "LOSS" | "SPLIT";
type Card = { rank: number; suit: string };

interface CompletedHand {
  handId: string;
  sessionId?: string;
  playedAt: number;
  handNumber: number;
  mode: GameMode;
  aiDifficulty?: string;
  opponentName: string;
  myPosition: "SB" | "BB";
  initialStacks: [number, number];
  finalStacks: [number, number];
  result: HandResult;
  myWinLoss: number;
  board: Card[];
  myCards: [Card, Card];
  opponentCards?: [Card, Card];
  wentToShowdown: boolean;
  winningHand?: unknown;
  actionLog: unknown[];
  deckSnapshot: Card[];
  seed?: number;
  postHandInsight?: unknown;
}

interface Settings {
  nickname: string;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  betPresets: number[];
  matchLength: number;
  displayUnit: "bb" | "chips";
}

const DEFAULT_SETTINGS: Settings = {
  nickname: "익명",
  soundEnabled: true,
  hapticEnabled: true,
  betPresets: [0.5, 0.67, 1.0],
  matchLength: 12,
  displayUnit: "bb",
};

// ── 저장소 ─────────────────────────────────────────────────────────────────

/** uid → (handId → hand) */
const handsStore = new Map<string, Map<string, CompletedHand>>();
/** uid → settings */
const settingsStore = new Map<string, Settings>();
/** uid → Set<milestoneId> */
const milestonesStore = new Map<string, Set<string>>();

// ── 헬퍼 ───────────────────────────────────────────────────────────────────

function decodeJwtPayload(authHeader: string | undefined): string | null {
  const token = authHeader?.split(" ")[1];
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as Record<string, unknown>;
    const uid = String(payload.uid ?? payload.sub ?? payload.accountId ?? "");
    return uid || null;
  } catch {
    return null;
  }
}

function getHandsMap(uid: string): Map<string, CompletedHand> {
  if (!handsStore.has(uid)) handsStore.set(uid, new Map());
  return handsStore.get(uid)!;
}

// ── 핸드 라우트 ─────────────────────────────────────────────────────────────

/**
 * POST /api/heads-up/hands
 * body: CompletedHand
 * 응답: { handId: string }
 */
headsUpRouter.post("/hands", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.status(401).json({ error: "Unauthorized" });

  const hand = req.body as CompletedHand;
  if (!hand?.handId) return void res.status(400).json({ error: "handId required" });

  getHandsMap(uid).set(hand.handId, hand);
  res.status(201).json({ handId: hand.handId });
});

/**
 * GET /api/heads-up/hands?limit=N&offset=N&mode=AI|REMOTE
 * 응답: { hands: CompletedHand[], total: number }
 */
headsUpRouter.get("/hands", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.json({ hands: [], total: 0 });

  const allHands = [...getHandsMap(uid).values()].sort((a, b) => b.playedAt - a.playedAt);
  const modeRaw = req.query.mode;
  const mode = typeof modeRaw === "string" ? (modeRaw as GameMode) : undefined;
  const filtered = mode ? allHands.filter((h) => h.mode === mode) : allHands;
  const total = filtered.length;
  const offset = Number(typeof req.query.offset === "string" ? req.query.offset : "0");
  const limitRaw = req.query.limit;
  const limit = typeof limitRaw === "string" ? Number(limitRaw) : filtered.length;
  const hands = filtered.slice(offset, offset + limit);
  res.json({ hands, total });
});

/**
 * GET /api/heads-up/hands/:handId
 * 응답: CompletedHand 전체
 */
headsUpRouter.get("/hands/:handId", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.status(401).json({ error: "Unauthorized" });

  const handId = String(req.params["handId"]);
  const hand = getHandsMap(uid).get(handId);
  if (!hand) return void res.status(404).json({ error: "Not Found" });
  res.json(hand);
});

/**
 * PATCH /api/heads-up/hands/:handId/insight
 * body: { postHandInsight: ... }
 * 응답: { success: true }
 */
headsUpRouter.patch("/hands/:handId/insight", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.status(401).json({ error: "Unauthorized" });

  const handId = String(req.params["handId"]);
  const map = getHandsMap(uid);
  const hand = map.get(handId);
  if (!hand) return void res.status(404).json({ error: "Not Found" });
  map.set(handId, { ...hand, postHandInsight: req.body.postHandInsight });
  res.json({ success: true });
});

// ── 통계 라우트 ─────────────────────────────────────────────────────────────

/** postHandInsight(unknown 저장)에서 overallScore를 안전 추출. */
function insightScore(insight: unknown): number | null {
  if (insight && typeof insight === "object" && "overallScore" in insight) {
    const s = (insight as { overallScore?: unknown }).overallScore;
    return typeof s === "number" ? s : null;
  }
  return null;
}

/**
 * GET /api/play-lab/heads-up/stats
 * 응답: HandStats — 전체 통계 집계 (avgGtoScore·evaluatedHands 포함)
 */
headsUpRouter.get("/stats", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) {
    return void res.json({ total: 0, wins: 0, losses: 0, splits: 0, netChips: 0, evaluatedHands: 0, winRate: 0 });
  }
  const all = [...getHandsMap(uid).values()];
  const total = all.length;
  const wins = all.filter((h) => h.result === "WIN").length;
  const losses = all.filter((h) => h.result === "LOSS").length;
  const splits = all.filter((h) => h.result === "SPLIT").length;
  const netChips = all.reduce((s, h) => s + h.myWinLoss, 0);
  const scores = all
    .map((h) => insightScore(h.postHandInsight))
    .filter((n): n is number => n !== null);
  const evaluatedHands = scores.length;
  const avgGtoScore =
    evaluatedHands > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / evaluatedHands) : undefined;
  res.json({
    total,
    wins,
    losses,
    splits,
    netChips,
    winRate: total > 0 ? wins / total : 0,
    evaluatedHands,
    ...(avgGtoScore !== undefined ? { avgGtoScore } : {}),
  });
});

// ── 설정 라우트 ─────────────────────────────────────────────────────────────

/**
 * GET /api/heads-up/settings
 * 응답: Settings
 */
headsUpRouter.get("/settings", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.json({ ...DEFAULT_SETTINGS });
  res.json(settingsStore.get(uid) ?? { ...DEFAULT_SETTINGS });
});

/**
 * PUT /api/heads-up/settings
 * body: Partial<Settings>
 * 응답: { success: true }
 */
headsUpRouter.put("/settings", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.status(401).json({ error: "Unauthorized" });

  const current = settingsStore.get(uid) ?? { ...DEFAULT_SETTINGS };
  settingsStore.set(uid, { ...current, ...req.body } as Settings);
  res.json({ success: true });
});

// ── 마일스톤 라우트 ─────────────────────────────────────────────────────────

/**
 * GET /api/heads-up/milestones
 * 응답: { shown: string[] }
 */
headsUpRouter.get("/milestones", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.json({ shown: [] });
  const shown = [...(milestonesStore.get(uid) ?? new Set())];
  res.json({ shown });
});

/**
 * POST /api/heads-up/milestones/mark-shown
 * body: { milestoneId: string }
 * 응답: { success: true }
 */
headsUpRouter.post("/milestones/mark-shown", (req: Request, res: Response) => {
  const uid = decodeJwtPayload(req.headers.authorization);
  if (!uid) return void res.status(401).json({ error: "Unauthorized" });

  const { milestoneId } = req.body as { milestoneId: string };
  if (!milestoneId) return void res.status(400).json({ error: "milestoneId required" });
  if (!milestonesStore.has(uid)) milestonesStore.set(uid, new Set());
  milestonesStore.get(uid)!.add(milestoneId);
  res.json({ success: true });
});
