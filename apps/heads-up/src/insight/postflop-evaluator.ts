import { classifyHand, type HandStrength } from '../bot/postflop-rules';
import type { Card } from '../engine/card';
import type {
  ActionRecord,
  MistakeType,
  PlayerAction,
  Street,
} from '../types/game';
import {
  equityVsInferredRange,
  inferOpponentRange,
  potOddsRequired,
  type OpponentRangeInference,
} from './equity-calculator';

export interface PostflopContext {
  street: Street;
  board: Card[];
  myHand: [Card, Card];
  /** Pot size right before my action (INCLUDES any outstanding bet to call). */
  pot: number;
  /** Amount I need to put in to call. 0 means I can check. */
  toCall: number;
  bigBlind: number;
  myStack: number;
  oppStack: number;
  /** Opponent's entire action record this hand (used for range inference). */
  opponentHistory: ReadonlyArray<Pick<ActionRecord, 'action' | 'street'>>;
}

export type GtoPostflopAction = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface RecommendedPostflopAction {
  action: GtoPostflopAction;
  /** Recommended bet-size range in chips ([min, max]). Present for bet/raise. */
  sizingRange?: [number, number];
  /** Short label for the recommendation. */
  label: string;
}

export interface PostflopEvaluation {
  score: number;
  equity: number;
  potOdds: number;
  inferredRange: OpponentRangeInference;
  strength: HandStrength;
  recommendedAction: RecommendedPostflopAction;
  reasoning: string[];
  mistakeType: MistakeType | null;
}

const DEFAULT_ITERATIONS = 400;

/**
 * Score a single postflop decision against an equity/pot-odds heuristic.
 *
 * This is explicitly NOT a solver — it catches obvious errors (folding the
 * nuts, bluff-calling air, betting way off-size) and awards points based on
 * proximity to the heuristic recommendation.
 */
export function evaluatePostflopAction(
  ctx: PostflopContext,
  userAction: PlayerAction,
  userAmount: number,
  options: { iterations?: number } = {},
): PostflopEvaluation {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const strength = classifyHand(ctx.myHand, ctx.board);
  const inferred = inferOpponentRange(ctx.opponentHistory);
  const equity = equityVsInferredRange(ctx.myHand, ctx.board, inferred, {
    iterations,
  });
  const potOdds = potOddsRequired(ctx.pot, ctx.toCall);
  const recommended = deriveRecommendation(ctx, equity, potOdds, strength);

  const normalizedUser = normalizeAction(userAction, ctx.toCall);
  const { score, mistakeType, reasoning } = scoreAction({
    ctx,
    userAction: normalizedUser,
    userAmount,
    recommended,
    equity,
    potOdds,
    strength,
    inferred,
  });

  return {
    score,
    equity,
    potOdds,
    inferredRange: inferred,
    strength,
    recommendedAction: recommended,
    reasoning,
    mistakeType,
  };
}

/* ------------------------------------------------------------------ */
/*  Action normalization                                              */
/* ------------------------------------------------------------------ */

function normalizeAction(
  action: PlayerAction,
  toCall: number,
): GtoPostflopAction {
  // Postflop engine rule: 'check' when toCall=0, 'call' when toCall>0.
  // An engine-recorded action will always be legal (the engine coerces on
  // input), but external callers may pass raw user intent. Normalize defensively.
  if (action === 'check' && toCall > 0) {
    // User tried to check but owed chips. Engine coerces this to 'fold', which
    // is what a scored hand-log will show; this branch is mostly unreachable in
    // replay but guards against direct API misuse.
    return 'fold';
  }
  if (action === 'bet' && toCall > 0) return 'raise';
  if (action === 'raise' && toCall === 0) return 'bet';
  return action;
}

/* ------------------------------------------------------------------ */
/*  Recommendation                                                    */
/* ------------------------------------------------------------------ */

function deriveRecommendation(
  ctx: PostflopContext,
  equity: number,
  potOdds: number,
  strength: HandStrength,
): RecommendedPostflopAction {
  const canCheck = ctx.toCall === 0;
  const pot = ctx.pot;

  // Extra-strong made hands — always try to bet/raise for value.
  if (equity >= 0.75) {
    if (canCheck) {
      return {
        action: 'bet',
        sizingRange: [Math.round(pot * 0.66), Math.round(pot * 1.0)],
        label: `${Math.round(pot * 0.66)}~${Math.round(pot * 1.0)} 벳 (가치)`,
      };
    }
    // Facing a bet. Standard raise: 2.5x–4x the opponent's bet (= toCall when
    // we haven't committed chips on this street yet). Avoids the previous bug
    // where (pot+toCall)*2.5 produced absurd ~8x sizings.
    const minRaise = Math.max(
      Math.round(ctx.toCall * 2.5),
      ctx.bigBlind * 2,
    );
    const maxRaise = Math.round(ctx.toCall * 4);
    return {
      action: 'raise',
      sizingRange: [minRaise, Math.max(minRaise, maxRaise)],
      label: `${minRaise}~${Math.max(minRaise, maxRaise)} 레이즈 (가치)`,
    };
  }

  // Decent value — small bet or call.
  if (equity >= 0.55) {
    if (canCheck) {
      return {
        action: 'bet',
        sizingRange: [Math.round(pot * 0.33), Math.round(pot * 0.66)],
        label: `${Math.round(pot * 0.33)}~${Math.round(pot * 0.66)} 벳 (밸류)`,
      };
    }
    return { action: 'call', label: '콜 (밸류)' };
  }

  // Marginal — pot-odds driven.
  if (equity >= 0.35) {
    if (canCheck) {
      if (strength.hasDraw) {
        return {
          action: 'bet',
          sizingRange: [Math.round(pot * 0.33), Math.round(pot * 0.5)],
          label: '세미블러프 벳',
        };
      }
      return { action: 'check', label: '체크 (pot control)' };
    }
    if (equity >= potOdds) return { action: 'call', label: '콜 (팟오즈 충족)' };
    return { action: 'fold', label: '폴드 (팟오즈 미달)' };
  }

  // Weak — usually fold, sometimes semi-bluff with a draw.
  if (canCheck) {
    if (strength.hasDraw) {
      return {
        action: 'bet',
        sizingRange: [Math.round(pot * 0.33), Math.round(pot * 0.5)],
        label: '세미블러프 벳',
      };
    }
    return { action: 'check', label: '체크' };
  }
  // Facing a bet with weak equity — usually fold unless we have a draw with
  // implied odds.
  if (strength.hasDraw && equity >= potOdds * 0.85) {
    return { action: 'call', label: '드로우 콜 (implied odds)' };
  }
  return { action: 'fold', label: '폴드' };
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

interface ScoreInputs {
  ctx: PostflopContext;
  userAction: GtoPostflopAction;
  userAmount: number;
  recommended: RecommendedPostflopAction;
  equity: number;
  potOdds: number;
  strength: HandStrength;
  inferred: OpponentRangeInference;
}

function scoreAction(input: ScoreInputs): {
  score: number;
  mistakeType: MistakeType | null;
  reasoning: string[];
} {
  const { userAction, userAmount, recommended, equity, strength, ctx } = input;
  const reasoning: string[] = [];
  reasoning.push(
    `에쿼티 ${(equity * 100).toFixed(1)}% · 상대 레인지 ${input.inferred.label}`,
  );

  // --- 1. Exact-action match
  if (userAction === recommended.action) {
    // Map equity ∈ [0, 1] → score bonus ∈ [0, 15], giving final range 85-100.
    // equity=1 (nuts) → 100; equity=0 → 85.
    const equityBonus = Math.round(15 * clamp01(equity));
    if (recommended.sizingRange) {
      const [lo, hi] = recommended.sizingRange;
      const within = userAmount >= lo * 0.85 && userAmount <= hi * 1.2;
      if (within) {
        reasoning.push(`권장 액션/사이즈 범위 안에서 플레이.`);
        return {
          score: clampScore(85 + equityBonus),
          mistakeType: null,
          reasoning,
        };
      }
      // Size miss.
      const severelyOff = userAmount < lo * 0.4 || userAmount > hi * 2;
      reasoning.push(
        `액션은 맞지만 사이즈 (${userAmount})가 권장 ${lo}~${hi} 범위를 벗어남.`,
      );
      return {
        score: severelyOff ? 55 : 72,
        mistakeType: 'SIZE_MISS',
        reasoning,
      };
    }
    reasoning.push(`권장 액션과 일치.`);
    return {
      score: clampScore(85 + equityBonus),
      mistakeType: null,
      reasoning,
    };
  }

  // --- 2. Close-but-not-exact alternatives
  const substituteScore = substituteActionScore(
    userAction,
    recommended.action,
    equity,
  );
  if (substituteScore !== null) {
    reasoning.push(
      `권장(${recLabel(recommended.action)})과 다르지만 "${actLabel(userAction)}"도 가능한 대안.`,
    );
    // Detect common mistake patterns even within substitutes.
    const mistake = detectMistakeType({
      userAction,
      equity,
      strength,
      ctx,
      recommended,
    });
    return { score: substituteScore, mistakeType: mistake, reasoning };
  }

  // --- 3. Clear error — score low & label mistake
  const mistake = detectMistakeType({
    userAction,
    equity,
    strength,
    ctx,
    recommended,
  });
  reasoning.push(
    `권장(${recLabel(recommended.action)})과 다른 "${actLabel(userAction)}" — 명백한 실수.`,
  );

  // Tune the low-band score: worst = value-miss with nuts.
  let score = 10;
  if (mistake === 'VALUE_MISS') score = 0;
  else if (mistake === 'RANGE_MISREAD') score = 15;
  else if (mistake === 'BLUFF_TOO_OFTEN') score = 12;
  else score = 20;

  return { score, mistakeType: mistake, reasoning };
}

function substituteActionScore(
  user: GtoPostflopAction,
  rec: GtoPostflopAction,
  equity: number,
): number | null {
  // bet↔raise are cousins; check↔call are cousins.
  if (
    (user === 'bet' && rec === 'raise') ||
    (user === 'raise' && rec === 'bet')
  ) {
    return 50;
  }
  if ((user === 'check' && rec === 'call') || (user === 'call' && rec === 'check')) {
    return 55;
  }
  // Folding when check was free — engine coerces to check in practice, but
  // if we ever see a raw 'fold' here where rec='check', treat as semi-error.
  if (user === 'fold' && rec === 'check') return 45;
  // Aggressive when rec is passive (e.g., bet into check).
  if (user === 'bet' && rec === 'call') return 45;
  // Passive-when-aggressive: this covers "call instead of raise for value",
  // which is spec-wise "나쁘지 않은 대안" (40-59). But when we have very
  // strong equity, a slow-play/call is a near-zero-EV concession (missed
  // value without being a mistake) and deserves the upper band.
  if (
    (user === 'check' || user === 'call') &&
    (rec === 'bet' || rec === 'raise')
  ) {
    // Slow-play / flat with strong hand — acceptable line.
    if (equity >= 0.7) return 58;
    if (equity >= 0.55) return 50;
    return 42;
  }
  return null;
}

function detectMistakeType(input: {
  userAction: GtoPostflopAction;
  equity: number;
  strength: HandStrength;
  ctx: PostflopContext;
  recommended: RecommendedPostflopAction;
}): MistakeType | null {
  const { userAction, equity, strength } = input;

  // Value miss: strong made hand not betting.
  const nutsish =
    strength.isFullHouse ||
    strength.madeHand >= 3 /* THREE_OF_A_KIND */ ||
    strength.isFlush ||
    strength.isStraight ||
    strength.isTwoPair;
  if (
    nutsish &&
    (userAction === 'check' || userAction === 'fold') &&
    (input.recommended.action === 'bet' || input.recommended.action === 'raise')
  ) {
    return 'VALUE_MISS';
  }

  // Bluffing air.
  if (
    equity < 0.3 &&
    !strength.hasDraw &&
    (userAction === 'bet' || userAction === 'raise')
  ) {
    return 'BLUFF_TOO_OFTEN';
  }

  // Range misread: folding with meaningful equity.
  if (userAction === 'fold' && equity >= 0.5) {
    return 'RANGE_MISREAD';
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Pretty labels                                                     */
/* ------------------------------------------------------------------ */

const ACTION_KO: Record<GtoPostflopAction, string> = {
  fold: '폴드',
  check: '체크',
  call: '콜',
  bet: '벳',
  raise: '레이즈',
};

function actLabel(a: GtoPostflopAction): string {
  return ACTION_KO[a];
}
function recLabel(a: GtoPostflopAction): string {
  return ACTION_KO[a];
}

/* ------------------------------------------------------------------ */
/*  Utils                                                             */
/* ------------------------------------------------------------------ */

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function clampScore(x: number): number {
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}
