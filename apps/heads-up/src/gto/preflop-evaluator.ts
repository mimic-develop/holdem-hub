import type { Card } from '../engine/card';
import type { PlayerAction, Position } from '../types/game';
import {
  getFreq,
  type ActionFrequency,
  type PreflopSituation,
} from './preflop-chart';

export interface PreflopContext {
  situation: PreflopSituation;
  position: Position;
  /** Effective stack in big blinds. Charts assume 100bb. */
  stackBB: number;
  /** Current bet-to amount in BB the user is facing (if any). */
  facingBetBB?: number;
  /** Big-blind size in chips (for converting userAmount to BB). */
  bigBlindChips: number;
}

export type GtoAction = 'fold' | 'call' | 'raise';

export interface RecommendedAction {
  action: GtoAction;
  frequency: number;
  sizeInBB?: number;
}

export interface PreflopEvaluation {
  /** Numeric score 0–100 expressing how close the user's play is to GTO. */
  score: number;
  /** The single most-likely GTO action for this spot. */
  recommendedAction: RecommendedAction;
  /** The frequency (0–1) with which the GTO strategy takes the user's chosen action. */
  userFrequencyMatch: number;
  /** Canonical hand key (e.g. "AA", "AKs", "T7o") of the evaluated hand. */
  handKey: string;
  /** Human-readable Korean explanation. */
  commentary: string;
}

const RANK_CHAR: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

/** Convert two hole cards into the canonical 169-hand key. */
export function handToKey(c1: Card, c2: Card): string {
  const [hi, lo] = c1.rank >= c2.rank ? [c1, c2] : [c2, c1];
  const r1 = RANK_CHAR[hi.rank];
  const r2 = RANK_CHAR[lo.rank];
  if (hi.rank === lo.rank) return r1 + r2;
  return r1 + r2 + (hi.suit === lo.suit ? 's' : 'o');
}

/**
 * Collapse user's raw action into the chart's 3-way space.
 *   - preflop 'check' is equivalent to 'call' (BB's free option after SB limp).
 *   - 'bet' preflop only happens when currentBet === 0, which doesn't occur in
 *     standard HU preflop, but we map it to 'raise' for safety.
 */
function normalizeAction(action: PlayerAction): GtoAction {
  if (action === 'check') return 'call';
  if (action === 'bet') return 'raise';
  return action as GtoAction;
}

/**
 * Returns the action with the highest frequency. Ties are broken conservatively:
 *   call > raise > fold.
 * Rationale: for a genuinely mixed spot like QQ vs 3bet (~50/50 call/4bet at
 * 100bb), pros lean toward the lower-variance "call" pick, so recommending
 * call by default aligns with typical HU coaching.
 */
export function dominantAction(freq: ActionFrequency): RecommendedAction {
  const candidates: { action: GtoAction; f: number }[] = [
    { action: 'call', f: freq.call },
    { action: 'raise', f: freq.raise },
    { action: 'fold', f: freq.fold },
  ];
  // Stable sort: among ties, input order is preserved.
  candidates.sort((a, b) => b.f - a.f);
  const top = candidates[0];
  return {
    action: top.action,
    frequency: top.f,
    sizeInBB: top.action === 'raise' ? freq.raiseSize : undefined,
  };
}

const ACTION_KO: Record<GtoAction, string> = {
  fold: '폴드',
  call: '콜',
  raise: '레이즈',
};

/**
 * Score the user's action against the GTO chart.
 *
 * Tiers per spec:
 *   userFreq == topFreq (and > 0):  90–100 (drops to 80 if raise size is off)
 *   0.2 <= userFreq < topFreq:      70–89  (second-choice mix)
 *   0.05 <= userFreq < 0.2:         40–69  (rare but possible)
 *   0 < userFreq < 0.05:            10–39  (almost never)
 *   userFreq == 0:                   0–9   (not in distribution)
 */
export function evaluatePreflopAction(
  hand: [Card, Card],
  context: PreflopContext,
  userAction: PlayerAction,
  userAmount: number,
): PreflopEvaluation {
  const handKey = handToKey(hand[0], hand[1]);
  const freq = getFreq(context.situation, handKey);
  const action = normalizeAction(userAction);
  const recommended = dominantAction(freq);
  const userFreq = clampFreq(freq[action]);
  const topFreq = recommended.frequency;

  let score: number;
  let sizeOff = false;

  if (userFreq > 0 && Math.abs(userFreq - topFreq) < 1e-9) {
    // User picked the dominant action. Base 90–100 range.
    score = 90 + Math.round(userFreq * 10);
    // Size penalty — only meaningful when raising.
    if (action === 'raise' && freq.raiseSize && context.bigBlindChips > 0) {
      const userBB = userAmount / context.bigBlindChips;
      // Size tolerance ±30% of the recommended raise-to.
      const ratio = Math.abs(userBB - freq.raiseSize) / freq.raiseSize;
      if (ratio > 0.3) {
        score = Math.max(80, score - 10);
        sizeOff = true;
      }
    }
  } else if (userFreq >= 0.2) {
    // Second choice. Interpolate 70–89 across [0.2, topFreq).
    const span = Math.max(topFreq - 0.2, 0.01);
    score = 70 + Math.round(((userFreq - 0.2) / span) * 19);
  } else if (userFreq >= 0.05) {
    score = 40 + Math.round(((userFreq - 0.05) / 0.15) * 29);
  } else if (userFreq > 0) {
    score = 10 + Math.round((userFreq / 0.05) * 29);
  } else {
    score = 0;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    recommendedAction: recommended,
    userFrequencyMatch: userFreq,
    handKey,
    commentary: buildCommentary(handKey, action, score, recommended, sizeOff),
  };
}

function clampFreq(x: number | undefined): number {
  if (x === undefined) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function buildCommentary(
  handKey: string,
  action: GtoAction,
  score: number,
  rec: RecommendedAction,
  sizeOff: boolean,
): string {
  const userLabel = ACTION_KO[action];
  const recLabel = ACTION_KO[rec.action];
  if (score >= 95) {
    return `${handKey}로 ${userLabel}은 매우 표준적인 플레이입니다.`;
  }
  if (score >= 80) {
    const base = `${handKey}로 ${userLabel}은 권장되는 플레이입니다.`;
    return sizeOff
      ? `${base} 다만 레이즈 사이즈는 ${rec.sizeInBB}BB 근처가 더 표준적입니다.`
      : base;
  }
  if (score >= 50) {
    return `${handKey}로 ${userLabel}도 가능한 믹스입니다. 더 자주 선택되는 건 ${recLabel}입니다.`;
  }
  if (score >= 20) {
    return `${handKey}로 ${userLabel}은 권장 빈도가 매우 낮습니다. ${recLabel} 추천.`;
  }
  return `${handKey}로 ${userLabel}은 권장 분포에 거의 없습니다. ${recLabel} 추천.`;
}
