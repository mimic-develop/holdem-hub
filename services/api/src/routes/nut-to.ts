/**
 * /api/nut-to — NUT TO 3 리더보드
 *
 * GET  /leaderboard         → Top N 전체 랭킹 조회
 * POST /leaderboard/submit  → 게임 결과 upsert (이전 최고 이상일 때만 갱신)
 *
 * 인증: Authorization: Bearer <JWT> 헤더에서 accountId 추출 (검증 없음, 서명 신뢰).
 * 저장: in-memory Map — 서버 재시작 시 초기화됨.
 */
import { Router, type Request, type Response } from "express";

export const nutToRouter = Router();

// ── 타입 ────────────────────────────────────────────────────────────────────

interface Entry {
  accountId: string;
  nickname: string;
  streak: number;
  totalCorrect: number;
  accuracy: number;       // 0–1
  avgResponseMs: number;
  score: number;
  recordedAt: number;     // Date.now()
  updatedAt: string;      // ISO 8601
}

interface RankedEntry extends Entry {
  rank: number;
}

// ── 저장소 ─────────────────────────────────────────────────────────────────

/** accountId → Entry */
const store = new Map<string, Entry>();

// ── 헬퍼 ───────────────────────────────────────────────────────────────────

function getRanked(): RankedEntry[] {
  return [...store.values()]
    .sort((a, b) => b.streak - a.streak || b.accuracy - a.accuracy || b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

function decodeJwtPayload(authHeader: string | undefined): { uid: string; nickname: string } | null {
  const token = authHeader?.split(" ")[1];
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as Record<string, unknown>;
    const uid = String(payload.uid ?? payload.sub ?? payload.accountId ?? "");
    if (!uid) return null;
    const nickname = String(payload.nickname ?? payload.name ?? payload.displayName ?? "익명");
    return { uid, nickname };
  } catch {
    return null;
  }
}

// ── 라우트 ─────────────────────────────────────────────────────────────────

/**
 * GET /api/nut-to/leaderboard
 * 응답: { entries: RankedEntry[] }
 */
nutToRouter.get("/leaderboard", (_req: Request, res: Response) => {
  res.json({ entries: getRanked() });
});

/**
 * POST /api/nut-to/leaderboard/submit
 * 요청 body: { streak, totalCorrect, accuracy, avgResponseMs, recordedAt }
 * 응답: SubmitResult — { wasUpdated, previousBest, newBest }
 */
nutToRouter.post("/leaderboard/submit", (req: Request, res: Response) => {
  const user = decodeJwtPayload(req.headers.authorization);
  if (!user) {
    return void res.status(401).json({ error: "Unauthorized" });
  }

  const { streak, totalCorrect, accuracy, avgResponseMs, recordedAt } = req.body as {
    streak: number;
    totalCorrect: number;
    accuracy: number;
    avgResponseMs: number;
    recordedAt: number;
  };

  const existing = store.get(user.uid) ?? null;

  // 이전 기록보다 나을 때만 갱신 (streak 우선, 동률이면 accuracy 비교)
  const isBetter =
    existing === null ||
    streak > existing.streak ||
    (streak === existing.streak && accuracy > existing.accuracy);

  if (isBetter) {
    store.set(user.uid, {
      accountId: user.uid,
      nickname: user.nickname,
      streak,
      totalCorrect,
      accuracy,
      avgResponseMs,
      score: totalCorrect * 100 + Math.round(streak * 50),
      recordedAt,
      updatedAt: new Date().toISOString(),
    });
  }

  const ranked = getRanked();
  const myEntry = ranked.find((e) => e.accountId === user.uid) ?? null;

  res.json({
    wasUpdated: isBetter,
    previousBest: existing
      ? {
          streak: existing.streak,
          accuracy: existing.accuracy,
          avgResponseMs: existing.avgResponseMs,
          score: existing.score,
        }
      : null,
    newBest: myEntry
      ? {
          streak: myEntry.streak,
          accuracy: myEntry.accuracy,
          avgResponseMs: myEntry.avgResponseMs,
          score: myEntry.score,
          rank: myEntry.rank,
        }
      : null,
  });
});
