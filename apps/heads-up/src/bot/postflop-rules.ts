import type { Card } from '../engine/card';
import { HandRank } from '../engine/hand-evaluator';
import type { PlayerAction } from '../types/game';

export interface PostflopContext {
  equity: number;
  potOdds: number;
  potSize: number;
  toCall: number;
  stackSize: number;
  myCurrentBet: number;
  bluffRate: number;
  aggression: number;
  /** Optional hand-strength hint. When a player is on a strong draw we treat
   *  low-equity spots as semi-bluff candidates instead of pure folds. */
  strength?: HandStrength;
  /** callDownBias > 1 → 콜 에퀴티 기준 낮춤 (CALLING). default 1.0 */
  callDownBias?: number;
  /** showdownCuriosity > 1 → 특히 리버에서 콜 성향 증가 (CALLING). default 1.0 */
  showdownCuriosity?: number;
  /** trapBias > 1 → 강한 핸드 슬로우플레이 (NIT). default 1.0 */
  trapBias?: number;
  /** 현재 스트릿 — showdownCuriosity 리버 보정에 사용 */
  street?: string;
}

export interface PostflopDecision {
  action: PlayerAction;
  amount: number;
}

/** Structured hand strength — explicit "made hand + draw" classification. */
export interface HandStrength {
  /** Current best made hand (HIGH_CARD..ROYAL_FLUSH). */
  madeHand: HandRank;
  isPocketPair: boolean;
  /** Pocket pair strictly higher than every board card. */
  isOverpair: boolean;
  /** Paired the top unpaired board card with one hole card. */
  isTopPair: boolean;
  /** One pair total (rankCounts === 2 exactly once). */
  isPair: boolean;
  isTwoPair: boolean;
  /** Pocket pair plus one board match (trips from the set). */
  isSet: boolean;
  isStraight: boolean;
  isFlush: boolean;
  isFullHouse: boolean;
  /** 4 cards of same suit, missing the 5th for a flush. */
  isFlushDraw: boolean;
  /** Open-ended straight draw (~8 outs). */
  isOESD: boolean;
  /** Inside or one-ended straight draw (~4 outs). */
  isGutshot: boolean;
  /** Any draw (flush draw OR straight draw). Useful for semi-bluff logic. */
  hasDraw: boolean;
}

const SUITS = ['s', 'h', 'd', 'c'] as const;

export function classifyHand(hole: [Card, Card], board: Card[]): HandStrength {
  const isPocketPair = hole[0].rank === hole[1].rank;

  const rankCounts = new Uint8Array(15);
  const boardRankCounts = new Uint8Array(15);
  const suitCounts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  let rankBits = 0;

  for (const c of hole) {
    rankCounts[c.rank]++;
    suitCounts[c.suit]++;
    rankBits |= 1 << c.rank;
  }
  for (const c of board) {
    rankCounts[c.rank]++;
    boardRankCounts[c.rank]++;
    suitCounts[c.suit]++;
    rankBits |= 1 << c.rank;
  }

  let pairCount = 0;
  let tripCount = 0;
  let quadCount = 0;
  for (let r = 14; r >= 2; r--) {
    const c = rankCounts[r];
    if (c === 2) pairCount++;
    else if (c === 3) tripCount++;
    else if (c === 4) quadCount++;
  }

  // Flush & flush draw
  let maxSuit = 0;
  for (const s of SUITS) maxSuit = Math.max(maxSuit, suitCounts[s]);
  const isFlush = maxSuit >= 5;
  const isFlushDraw = !isFlush && maxSuit === 4;

  // Straight (include wheel)
  let straightBits = rankBits;
  if (straightBits & (1 << 14)) straightBits |= 1 << 1;
  let isStraight = false;
  for (let top = 14; top >= 5; top--) {
    const mask = 0x1f << (top - 4);
    if ((straightBits & mask) === mask) {
      isStraight = true;
      break;
    }
  }

  // Straight draws — scan 5-wide rank windows for exactly 4 set bits
  let isOESD = false;
  let isGutshot = false;
  if (!isStraight) {
    for (let low = 1; low <= 10; low++) {
      const mask = 0x1f << low;
      const masked = straightBits & mask;
      const pattern = (masked >> low) & 0x1f;
      if (popcount5(pattern) !== 4) continue;
      // 4-consecutive patterns → potentially OESD
      if (pattern === 0b11110) {
        // Ranks (low+1..low+4) set; extensions at low or low+5
        const lowExt = low >= 2;
        const highExt = low + 5 <= 14;
        if (lowExt && highExt) {
          isOESD = true;
        } else {
          isGutshot = true;
        }
      } else if (pattern === 0b01111) {
        // Ranks (low..low+3) set; extensions at low-1 or low+4
        const lowExt = low - 1 >= 2 || low === 2; // low=2 → wheel via A
        const highExt = low + 4 <= 14;
        if (lowExt && highExt) {
          isOESD = true;
        } else {
          isGutshot = true;
        }
      } else {
        // 4 bits with a gap → gutshot
        isGutshot = true;
      }
    }
  }

  // Made hand
  let madeHand: HandRank = HandRank.HIGH_CARD;
  if (quadCount > 0) madeHand = HandRank.FOUR_OF_A_KIND;
  else if (tripCount > 0 && (tripCount >= 2 || pairCount >= 1)) madeHand = HandRank.FULL_HOUSE;
  else if (isFlush) madeHand = HandRank.FLUSH;
  else if (isStraight) madeHand = HandRank.STRAIGHT;
  else if (tripCount > 0) madeHand = HandRank.THREE_OF_A_KIND;
  else if (pairCount >= 2) madeHand = HandRank.TWO_PAIR;
  else if (pairCount === 1) madeHand = HandRank.PAIR;

  // Pair qualifiers
  let maxBoardRank = 0;
  for (let r = 14; r >= 2; r--) {
    if (boardRankCounts[r] > 0) {
      maxBoardRank = r;
      break;
    }
  }
  const isSet = isPocketPair && rankCounts[hole[0].rank] === 3;
  const isOverpair = isPocketPair && !isSet && maxBoardRank > 0 && hole[0].rank > maxBoardRank;
  const isTopPair =
    !isPocketPair &&
    maxBoardRank > 0 &&
    boardRankCounts[maxBoardRank] === 1 &&
    (hole[0].rank === maxBoardRank || hole[1].rank === maxBoardRank);

  return {
    madeHand,
    isPocketPair,
    isOverpair,
    isTopPair,
    isPair: madeHand === HandRank.PAIR,
    isTwoPair: madeHand === HandRank.TWO_PAIR,
    isSet,
    isStraight,
    isFlush,
    isFullHouse: madeHand === HandRank.FULL_HOUSE,
    isFlushDraw,
    isOESD,
    isGutshot,
    hasDraw: isFlushDraw || isOESD || isGutshot,
  };
}

function popcount5(b: number): number {
  let n = 0;
  let x = b & 0x1f;
  while (x) {
    n++;
    x &= x - 1;
  }
  return n;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function roundChips(n: number): number {
  return Math.max(0, Math.round(n));
}

/**
 * Pot-odds required equity: toCall / (potAfterCall).
 */
export function potOddsFromBet(potSize: number, toCall: number): number {
  if (toCall <= 0) return 0;
  return toCall / (potSize + toCall);
}

export function decidePostflop(ctx: PostflopContext, rng: () => number): PostflopDecision {
  const { equity, potOdds, potSize, toCall, stackSize, aggression, bluffRate, strength } = ctx;

  // New bias fields — STANDARD=1.0 is no-op for all three
  const callDownBias      = ctx.callDownBias      ?? 1.0;
  const showdownCuriosity = ctx.showdownCuriosity ?? 1.0;
  const trapBias          = ctx.trapBias          ?? 1.0;
  const isRiver           = ctx.street === 'river';

  const canCheck      = toCall === 0;
  const effectiveStack = stackSize;

  // ── Adjusted call threshold ─────────────────────────────────────────────
  // callDownBias > 1 → divides required equity (CALLING calls with less equity)
  // showdownCuriosity > 1 on river → subtracts curiosity bonus
  const riverBonus = isRiver ? Math.max(0, (showdownCuriosity - 1.0) * 0.06) : 0;
  const adjustedCallThreshold = (potOdds / callDownBias) - riverBonus;

  // ── Very strong (≥75%): bet/raise — trapBias may slow-play ──────────────
  if (equity >= 0.75) {
    // trapBias > 1.0 → NIT-style slow-play. Only consumes RNG when trapBias > 1.0.
    // STANDARD/LAG/MANIAC (trapBias ≤ 1.0 in V2) → trapChance=0, no RNG call.
    const trapChance = trapBias > 1.0 ? (trapBias - 1.0) * 0.4 : 0;
    if (canCheck && trapChance > 0 && rng() < trapChance) {
      return { action: 'check', amount: 0 };
    }

    const sizing = roundChips(potSize * clamp(0.66 + rng() * 0.34, 0.5, 1.0) * aggression);
    if (canCheck) {
      return { action: 'bet', amount: Math.min(effectiveStack, Math.max(1, sizing)) };
    }
    if (rng() < 0.85) {
      const raiseTo = Math.max(
        ctx.myCurrentBet + toCall * 2,
        roundChips((potSize + toCall) * (1.5 + rng() * 0.8) * aggression),
      );
      return { action: 'raise', amount: Math.min(effectiveStack + ctx.myCurrentBet, raiseTo) };
    }
    return { action: 'call', amount: Math.min(effectiveStack, toCall) };
  }

  // ── Decent (55–75%): mid-sized bet or call ───────────────────────────────
  if (equity >= 0.55) {
    if (canCheck) {
      if (rng() < 0.6) {
        const sizing = roundChips(potSize * (0.4 + rng() * 0.25) * aggression);
        return { action: 'bet', amount: Math.min(effectiveStack, Math.max(1, sizing)) };
      }
      return { action: 'check', amount: 0 };
    }
    return { action: 'call', amount: Math.min(effectiveStack, toCall) };
  }

  // ── Marginal (35–55%): check/call on adjusted pot odds ───────────────────
  if (equity >= 0.35) {
    if (canCheck) {
      if (strength?.hasDraw && rng() < bluffRate * 2) {
        const sizing = roundChips(potSize * (0.35 + rng() * 0.25) * aggression);
        return { action: 'bet', amount: Math.min(effectiveStack, Math.max(1, sizing)) };
      }
      return { action: 'check', amount: 0 };
    }
    if (equity >= adjustedCallThreshold) return { action: 'call', amount: Math.min(effectiveStack, toCall) };
    return { action: 'fold', amount: 0 };
  }

  // ── Weak (<35%): fold or bluff; draws get semi-bluff boost ───────────────
  const draws = strength?.hasDraw === true;
  const effectiveBluff = draws ? Math.min(1, bluffRate * 2.5) : bluffRate;
  if (canCheck) {
    if (rng() < effectiveBluff) {
      const sizing = roundChips(potSize * (0.4 + rng() * 0.3) * aggression);
      return { action: 'bet', amount: Math.min(effectiveStack, Math.max(1, sizing)) };
    }
    return { action: 'check', amount: 0 };
  }
  // Draws: use adjustedCallThreshold with implied-odds slack
  const callThreshold = draws
    ? Math.min(adjustedCallThreshold, potOdds * 0.85)
    : adjustedCallThreshold * 1.1;
  if (equity >= callThreshold) {
    return { action: 'call', amount: Math.min(effectiveStack, toCall) };
  }
  return { action: 'fold', amount: 0 };
}
