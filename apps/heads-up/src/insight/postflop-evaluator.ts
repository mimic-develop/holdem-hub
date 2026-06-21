import { classifyHand, type HandStrength } from '../bot/postflop-rules';
import type { Card } from '../engine/card';
import type { AiPersonaId } from '../types/ai';
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
  /** Preflop aggressor (last preflop raiser). 'none' for limped pots. Used to
   *  avoid recommending donk bets (the OOP caller leading into the aggressor). */
  preflopAggressor?: 'me' | 'opp' | 'none';
  /** True if I act first postflop (heads-up: the BB is out of position). */
  isOOP?: boolean;
  /** AI opponent persona — enables persona-aware exploitative commentary. */
  opponentPersona?: AiPersonaId;
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
  const recommended = labelForContext(
    deriveRecommendation(ctx, equity, potOdds, strength),
    ctx,
  );

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

  // Donk-bet guard: as the out-of-position preflop caller, the standard line is
  // to check to the preflop aggressor. Leading out (a "donk bet") is non-standard
  // and should not be recommended — strong hands plan a check-raise, marginal
  // hands check-call, weak hands check-fold.
  if (canCheck && ctx.isOOP === true && ctx.preflopAggressor === 'opp') {
    if (equity >= 0.75) {
      return { action: 'check', label: '체크 (어그레서에게 체크 → 체크-레이즈 계획)' };
    }
    if (strength.hasDraw) {
      return { action: 'check', label: '체크 (어그레서에게 체크, 드로우는 체크-콜)' };
    }
    return { action: 'check', label: '체크 (어그레서에게 체크)' };
  }

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

/**
 * HU-theory framing for the recommendation label. A first-in flop bet by the
 * preflop aggressor is a continuation bet (c-bet) — the standard heads-up
 * aggressor line — so label it accordingly. This mirrors the OOP caller's
 * "체크 (어그레서에게 체크)" line so the review reflects position/aggressor theory
 * on both sides.
 */
function labelForContext(
  rec: RecommendedPostflopAction,
  ctx: PostflopContext,
): RecommendedPostflopAction {
  if (
    rec.action === 'bet' &&
    ctx.toCall === 0 &&
    ctx.preflopAggressor === 'me' &&
    rec.label.includes('벳')
  ) {
    return { ...rec, label: rec.label.replace('벳', 'C-벳') };
  }
  return rec;
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

  // --- Strategic context first (theory-grounded), not just raw equity.
  const board = describeBoard(ctx.board);
  const line = describeOpponentLine(ctx);
  const ctxBits = [board, line ? `${line}에 직면` : ''].filter(Boolean);
  if (ctxBits.length > 0) reasoning.push(`${ctxBits.join(' · ')}.`);
  const theory = lineTheory(line);
  if (theory) reasoning.push(theory);

  reasoning.push(
    `에쿼티 ${(equity * 100).toFixed(1)}% · 상대 레인지 ${input.inferred.label}`,
  );

  const personaNote = ctx.opponentPersona
    ? PERSONA_NOTE[ctx.opponentPersona]
    : undefined;
  if (personaNote) reasoning.push(personaNote);

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
  // Donk-betting when the recommended line is to check to the aggressor. Only
  // forgive it as a sub-optimal (not catastrophic) line when it's a value lead;
  // betting air here is a bluff and should fall through to mistake detection.
  if (user === 'bet' && rec === 'check') return equity >= 0.5 ? 42 : null;
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
/*  Strategic (theory-grounded) commentary                            */
/* ------------------------------------------------------------------ */

/** Short board-texture descriptor (flop+). */
function describeBoard(board: Card[]): string {
  if (board.length < 3) return '';
  const suitCounts: Record<string, number> = {};
  for (const c of board) suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCounts));
  const ranks = board.map((c) => c.rank);
  const uniq = [...new Set(ranks)].sort((a, b) => a - b);
  const paired = uniq.length < ranks.length;
  const span = uniq[uniq.length - 1] - uniq[0];
  const connected = uniq.length >= 3 && span <= 4;

  if (maxSuit >= 3) return '모노톤(플러시 위험) 보드';
  if (maxSuit === 2 && connected) return '드로우 많은(투톤·커넥티드) 보드';
  if (maxSuit === 2) return '투톤(플러시 드로우) 보드';
  if (paired) return '페어 보드';
  if (connected) return '커넥티드(스트레이트 드로우) 보드';
  return '드라이(레인보우) 보드';
}

/** Describe the opponent's bet I'm facing — distinguishes c-bet vs donk bet.
 *  Returns null when I'm not facing a bet (toCall === 0). */
function describeOpponentLine(ctx: PostflopContext): string | null {
  if (ctx.toCall <= 0) return null;
  if (ctx.preflopAggressor === 'opp') return '상대 c벳';
  if (ctx.preflopAggressor === 'me' && ctx.isOOP === false) return '상대 동크벳';
  return '상대 베팅';
}

/** What the opponent's line typically represents (theory). */
function lineTheory(line: string | null): string | null {
  if (line === '상대 동크벳') {
    return '동크벳 레인지는 보통 폴라(드로우·약한 메이드 또는 강한 핸드)라 넓은 편 — 에쿼티가 충분하면 콜/레이즈가 표준입니다.';
  }
  if (line === '상대 c벳') {
    return 'c벳은 어그레서의 표준 라인이라 레인지가 넓습니다 — 적정 에쿼티·드로우면 계속 갑니다.';
  }
  return null;
}

/** Persona-specific exploit reminder, grounded in player-type theory. */
const PERSONA_NOTE: Partial<Record<AiPersonaId, string>> = {
  LAG: '루즈 어그로 상대 — 블러프·동크 빈도가 높아 콜다운/인듀스 가치가 큽니다.',
  MANIAC: '매니악 상대 — 과잉 공격이므로 폴드를 줄이고 밸류로 콜다운하세요.',
  CALLING: '콜링 스테이션 상대 — 블러프가 거의 없으니 약한 핸드는 접고 강한 핸드는 크게 밸류하세요.',
  NIT: '니트 상대 — 공격은 대부분 강한 핸드라 마지널 핸드는 접는 게 표준입니다.',
};

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
