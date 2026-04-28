import type {
  ActionEvaluation,
  CompletedHand,
  MistakeType,
  Street,
} from '../types/game';
import { listHands } from './history';

export type StatsRange = 'today' | 'week' | 'month' | 'all';

export interface MistakeBreakdown {
  type: MistakeType;
  label: string;
  count: number;
  /** Sum of (best-case - actual) for actions where this mistake was flagged. */
  avgScoreImpact: number;
}

export interface SpotPerformance {
  /** Stable spot identifier ("SB_OPEN", "BB_VS_RAISE", "POSTFLOP_VALUE_BET", …). */
  spotKey: string;
  /** Human-readable label for UI. */
  spotName: string;
  handsCount: number;
  avgScore: number;
  /** Number of times the user chose the recommended action exactly. */
  perfectCount: number;
}

export interface ScorePoint {
  /** Day-bucket timestamp (ms) at midnight local time. */
  bucket: number;
  /** Average GTO overall score in that bucket. */
  avgScore: number;
  handsCount: number;
}

export interface AggregateStats {
  range: StatsRange;
  totalHands: number;
  /** Hands that have a gtoAnalysis attached (delta from totalHands = analysis-pending). */
  evaluatedHands: number;
  wins: number;
  losses: number;
  splits: number;
  netChips: number;
  winRate: number;
  /** Average overallScore across evaluated hands. NaN-safe: 0 when no data. */
  avgGtoScore: number;
  /** Difference vs the previous comparable window (today vs yesterday, etc). */
  avgScoreDelta: number | null;
  /** Per-street averages (skipped when a street has no actions). */
  streetAvgScores: Partial<Record<Street, number>>;
  /** Sorted descending by `count`. */
  topMistakes: MistakeBreakdown[];
  /** Sorted descending by `handsCount`. */
  spotPerformance: SpotPerformance[];
  /** Daily score buckets, sorted ascending by bucket. */
  scoreTrend: ScorePoint[];
  /** Current consecutive-win streak ending on the most recent hand. */
  winStreak: number;
}

const MISTAKE_LABEL: Record<MistakeType, string> = {
  VALUE_MISS: '밸류 미스',
  BLUFF_TOO_OFTEN: '블러프 과다',
  SIZE_MISS: '사이즈 미스',
  RANGE_MISREAD: '레인지 오독',
};

/* ------------------------------------------------------------------ */
/*  Time bucketing                                                    */
/* ------------------------------------------------------------------ */

/** Local-midnight start of `ts`. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Inclusive lower bound for `range` measured against `now`. */
function rangeStart(range: StatsRange, now: number): number {
  if (range === 'all') return 0;
  if (range === 'today') return startOfDay(now);
  if (range === 'week') return startOfDay(now) - 6 * 86400_000;
  // month: last 30 days
  return startOfDay(now) - 29 * 86400_000;
}

/** The "previous" period of equal length, for delta comparison. */
function previousRange(
  range: StatsRange,
  now: number,
): { start: number; end: number } | null {
  if (range === 'all') return null;
  if (range === 'today') {
    const today = startOfDay(now);
    return { start: today - 86400_000, end: today };
  }
  if (range === 'week') {
    const cur = startOfDay(now) - 6 * 86400_000;
    return { start: cur - 7 * 86400_000, end: cur };
  }
  // month
  const cur = startOfDay(now) - 29 * 86400_000;
  return { start: cur - 30 * 86400_000, end: cur };
}

/* ------------------------------------------------------------------ */
/*  Spot classification                                               */
/* ------------------------------------------------------------------ */

/**
 * Map a single ActionEvaluation (in the context of its CompletedHand) to a
 * coarse "spot" name. We classify by the first decision a player faces in each
 * pre/postflop branch — keeps the breakdown digestible (~6-10 buckets).
 */
function classifySpot(
  hand: CompletedHand,
  evalu: ActionEvaluation,
): { key: string; name: string } | null {
  if (evalu.street === 'preflop') {
    // Reconstruct opp prior preflop actions before this index.
    const meId = findMyId(hand);
    if (!meId) return null;
    const before = hand.actionLog.slice(0, evalu.actionIndex);
    const oppPreflop = before.filter(
      (a) => a.street === 'preflop' && a.playerId !== meId,
    );
    const oppRaises = oppPreflop.filter((a) => a.action === 'raise').length;
    const oppCalls = oppPreflop.filter((a) => a.action === 'call').length;
    const myPos = hand.myPosition;

    if (myPos === 'SB') {
      if (oppRaises >= 2) return { key: 'SB_VS_4BET', name: 'SB · 4벳 대응' };
      if (oppRaises === 1) return { key: 'SB_VS_3BET', name: 'SB · 3벳 대응' };
      return { key: 'SB_OPEN', name: 'SB · 오픈' };
    }
    // BB
    if (oppRaises >= 2) return { key: 'BB_VS_4BET', name: 'BB · 4벳 대응' };
    if (oppRaises === 1) return { key: 'BB_VS_RAISE', name: 'BB · 오픈 대응' };
    if (oppCalls >= 1) return { key: 'BB_VS_LIMP', name: 'BB · 림프 대응' };
    return { key: 'BB_FREE_CHECK', name: 'BB · 옵션' };
  }

  // Postflop — bucket by street + situation (value/bluff/marginal)
  // Use the score itself to label: very high score on bet/raise = value bet,
  // low score on bet w/o equity = bluff. We don't have equity here, so be rough.
  const isAggressive = evalu.action === 'bet' || evalu.action === 'raise';
  const isPassive = evalu.action === 'check' || evalu.action === 'call';
  const isFold = evalu.action === 'fold';

  const streetLabel: Record<Street, string> = {
    preflop: '프리플랍',
    flop: '플랍',
    turn: '턴',
    river: '리버',
  };
  const sl = streetLabel[evalu.street];
  if (isAggressive) {
    return { key: `${evalu.street.toUpperCase()}_BET`, name: `${sl} · 베팅/레이즈` };
  }
  if (isFold) {
    return { key: `${evalu.street.toUpperCase()}_FOLD`, name: `${sl} · 폴드` };
  }
  if (isPassive) {
    return {
      key: `${evalu.street.toUpperCase()}_CHECKCALL`,
      name: `${sl} · 체크/콜`,
    };
  }
  return null;
}

function findMyId(hand: CompletedHand): string | null {
  for (const a of hand.actionLog) {
    if (a.playerLabel === '나') return a.playerId;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Aggregation                                                       */
/* ------------------------------------------------------------------ */

interface AggregateInputs {
  /** Hands within the requested range. */
  current: CompletedHand[];
  /** Hands from the previous comparable window (for delta), or empty. */
  previous: CompletedHand[];
  /** All hands (sorted newest-first), used for streak only. */
  all: CompletedHand[];
  range: StatsRange;
}

function aggregateInternal(input: AggregateInputs): AggregateStats {
  const { current, previous, all, range } = input;
  let wins = 0;
  let losses = 0;
  let splits = 0;
  let netChips = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const streetSums: Partial<Record<Street, { sum: number; count: number }>> = {};
  const mistakeCounts = new Map<MistakeType, number>();
  const mistakeImpactSum = new Map<MistakeType, number>();
  const spotMap = new Map<
    string,
    { name: string; sum: number; count: number; perfect: number }
  >();
  const trendBuckets = new Map<number, { sum: number; count: number }>();

  for (const h of current) {
    if (h.result === 'WIN') wins++;
    else if (h.result === 'LOSS') losses++;
    else splits++;
    netChips += h.myWinLoss;

    const a = h.gtoAnalysis;
    if (!a) continue;

    scoreSum += a.overallScore;
    scoreCount++;

    // Trend bucket (per-day).
    const bucket = startOfDay(h.playedAt);
    const existing = trendBuckets.get(bucket) ?? { sum: 0, count: 0 };
    existing.sum += a.overallScore;
    existing.count++;
    trendBuckets.set(bucket, existing);

    // Per-street
    for (const [stKey, score] of Object.entries(a.streetScores)) {
      if (typeof score !== 'number') continue;
      const st = stKey as Street;
      const acc = (streetSums[st] ??= { sum: 0, count: 0 });
      acc.sum += score;
      acc.count++;
    }

    // Mistakes & spots iterate per ActionEvaluation
    for (const evalu of a.actionEvaluations) {
      const spot = classifySpot(h, evalu);
      if (spot) {
        const cur = spotMap.get(spot.key) ?? {
          name: spot.name,
          sum: 0,
          count: 0,
          perfect: 0,
        };
        cur.sum += evalu.score;
        cur.count++;
        if (evalu.score >= 90) cur.perfect++;
        spotMap.set(spot.key, cur);
      }
    }
    for (const m of a.mistakes) {
      mistakeCounts.set(m.type, (mistakeCounts.get(m.type) ?? 0) + 1);
      // Find the action's score and use (100 - score) as the rough impact proxy.
      const ev = a.actionEvaluations[m.actionIndex] ??
        a.actionEvaluations.find((e) => e.actionIndex === m.actionIndex);
      const impact = ev ? 100 - ev.score : 50;
      mistakeImpactSum.set(
        m.type,
        (mistakeImpactSum.get(m.type) ?? 0) + impact,
      );
    }
  }

  const totalHands = current.length;
  const winRate = totalHands > 0 ? wins / totalHands : 0;
  const avgGtoScore = scoreCount > 0 ? scoreSum / scoreCount : 0;

  // Previous-window avg, for delta
  let avgScoreDelta: number | null = null;
  if (previous.length > 0) {
    let pSum = 0;
    let pCount = 0;
    for (const h of previous) {
      if (h.gtoAnalysis) {
        pSum += h.gtoAnalysis.overallScore;
        pCount++;
      }
    }
    if (pCount > 0 && scoreCount > 0) {
      avgScoreDelta = avgGtoScore - pSum / pCount;
    }
  }

  const streetAvgScores: Partial<Record<Street, number>> = {};
  for (const [st, acc] of Object.entries(streetSums)) {
    if (acc) streetAvgScores[st as Street] = acc.sum / acc.count;
  }

  const topMistakes: MistakeBreakdown[] = Array.from(mistakeCounts.entries())
    .map(([type, count]) => ({
      type,
      label: MISTAKE_LABEL[type],
      count,
      avgScoreImpact: (mistakeImpactSum.get(type) ?? 0) / count,
    }))
    .sort((a, b) => b.count - a.count);

  const spotPerformance: SpotPerformance[] = Array.from(spotMap.entries())
    .map(([key, v]) => ({
      spotKey: key,
      spotName: v.name,
      handsCount: v.count,
      avgScore: v.sum / v.count,
      perfectCount: v.perfect,
    }))
    .sort((a, b) => b.handsCount - a.handsCount);

  const scoreTrend: ScorePoint[] = Array.from(trendBuckets.entries())
    .map(([bucket, v]) => ({
      bucket,
      avgScore: v.sum / v.count,
      handsCount: v.count,
    }))
    .sort((a, b) => a.bucket - b.bucket);

  // Win streak — count consecutive WINs from the most recent hand backwards.
  // `all` is sorted newest-first.
  let winStreak = 0;
  for (const h of all) {
    if (h.result === 'WIN') winStreak++;
    else break;
  }

  return {
    range,
    totalHands,
    evaluatedHands: scoreCount,
    wins,
    losses,
    splits,
    netChips,
    winRate,
    avgGtoScore,
    avgScoreDelta,
    streetAvgScores,
    topMistakes,
    spotPerformance,
    scoreTrend,
    winStreak,
  };
}

/* ------------------------------------------------------------------ */
/*  Public entry                                                      */
/* ------------------------------------------------------------------ */

export interface GetStatsOptions {
  /** Override "now" — primarily for tests. */
  now?: number;
}

/**
 * Aggregate stats over a time range. Internally we load ALL hands once via
 * listHands (large limit), then partition. For a single-user practice app this
 * is fine up to ~10k hands; beyond that we'd want range-indexed cursors.
 */
export async function getAggregateStats(
  range: StatsRange,
  opts: GetStatsOptions = {},
): Promise<AggregateStats> {
  const now = opts.now ?? Date.now();
  // listHands is newest-first; pull a generous batch.
  const all = await listHands({ limit: 5000 });
  return aggregateFromHands(all, range, now);
}

/** Pure aggregation — exposed for testing without IDB. */
export function aggregateFromHands(
  all: CompletedHand[],
  range: StatsRange,
  now: number,
): AggregateStats {
  const cutoff = rangeStart(range, now);
  const current = all.filter((h) => h.playedAt >= cutoff);

  const prevWindow = previousRange(range, now);
  const previous = prevWindow
    ? all.filter(
        (h) => h.playedAt >= prevWindow.start && h.playedAt < prevWindow.end,
      )
    : [];

  return aggregateInternal({ current, previous, all, range });
}

/* ------------------------------------------------------------------ */
/*  Milestone detection                                               */
/* ------------------------------------------------------------------ */

export type MilestoneId =
  | 'FIRST_HAND'
  | 'FIRST_HIGH_SCORE'
  | 'HUNDRED_HANDS'
  | 'PREFLOP_MASTER'
  | 'WIN_STREAK_3'
  | 'WIN_STREAK_5'
  | 'PERFECT_HAND';

export interface Milestone {
  id: MilestoneId;
  emoji: string;
  title: string;
  detail: string;
}

/**
 * Compare cumulative stats *before* and *after* a hand to detect a freshly
 * unlocked milestone. Returns null if nothing new fired this hand.
 *
 * `before` may be omitted (treated as "no prior history"), useful when the
 * user starts a fresh session.
 */
export function detectMilestones(
  before: CompletedHand[],
  after: CompletedHand[],
  latest: CompletedHand,
): Milestone[] {
  const out: Milestone[] = [];
  const beforeAnalyzed = before.filter((h) => h.gtoAnalysis);
  const afterAnalyzed = after.filter((h) => h.gtoAnalysis);

  // FIRST_HAND
  if (before.length === 0 && after.length === 1) {
    out.push({
      id: 'FIRST_HAND',
      emoji: '🃏',
      title: '첫 핸드 완료',
      detail: '계속 플레이하면 본인 패턴을 발견할 수 있어요.',
    });
  }

  // 100 HANDS
  if (before.length < 100 && after.length >= 100) {
    out.push({
      id: 'HUNDRED_HANDS',
      emoji: '🏆',
      title: '100핸드 돌파',
      detail: '꾸준한 플레이가 가장 빠른 성장의 길입니다.',
    });
  }

  // FIRST_HIGH_SCORE (≥ 80)
  const beforeAny80 = beforeAnalyzed.some(
    (h) => (h.gtoAnalysis?.overallScore ?? 0) >= 80,
  );
  const latestScore = latest.gtoAnalysis?.overallScore ?? 0;
  if (!beforeAny80 && latestScore >= 80) {
    out.push({
      id: 'FIRST_HIGH_SCORE',
      emoji: '🎯',
      title: '첫 고득점!',
      detail: `이 핸드에서 ${latestScore}점을 받았습니다.`,
    });
  }

  // PERFECT_HAND (overallScore >= 95)
  if (latestScore >= 95) {
    out.push({
      id: 'PERFECT_HAND',
      emoji: '💯',
      title: '완벽에 가까운 플레이',
      detail: `이 핸드 점수 ${latestScore} — 권장 라인과 거의 일치.`,
    });
  }

  // PREFLOP_MASTER — at least 20 evaluated hands and avg preflop ≥ 90
  if (afterAnalyzed.length >= 20) {
    let pSum = 0;
    let pCount = 0;
    for (const h of afterAnalyzed) {
      const s = h.gtoAnalysis?.streetScores.preflop;
      if (typeof s === 'number') {
        pSum += s;
        pCount++;
      }
    }
    let pBeforeSum = 0;
    let pBeforeCount = 0;
    for (const h of beforeAnalyzed) {
      const s = h.gtoAnalysis?.streetScores.preflop;
      if (typeof s === 'number') {
        pBeforeSum += s;
        pBeforeCount++;
      }
    }
    const after = pCount > 0 ? pSum / pCount : 0;
    const before = pBeforeCount > 0 ? pBeforeSum / pBeforeCount : 0;
    if (before < 90 && after >= 90) {
      out.push({
        id: 'PREFLOP_MASTER',
        emoji: '💎',
        title: '프리플랍 마스터',
        detail: '프리플랍 평균 90점 달성.',
      });
    }
  }

  // WIN_STREAK
  // `after` is chronological (oldest → newest). Iterate from the END backward
  // to count consecutive WINs ending at the most recent hand.
  let streak = 0;
  for (let i = after.length - 1; i >= 0; i--) {
    if (after[i].result === 'WIN') streak++;
    else break;
  }
  let prevStreak = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i].result === 'WIN') prevStreak++;
    else break;
  }
  if (prevStreak < 3 && streak >= 3 && streak < 5) {
    out.push({
      id: 'WIN_STREAK_3',
      emoji: '🔥',
      title: '3연승!',
      detail: '연속 3핸드 승리.',
    });
  }
  if (prevStreak < 5 && streak >= 5) {
    out.push({
      id: 'WIN_STREAK_5',
      emoji: '🔥🔥',
      title: '5연승 폭주',
      detail: '5핸드 연속 승리 중!',
    });
  }

  return out;
}
