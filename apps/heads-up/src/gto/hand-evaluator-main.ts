import type {
  ActionEvaluation,
  ActionLogEntry,
  ActionRecord,
  CompletedHand,
  GtoAnalysis,
  Mistake,
  Street,
} from '../types/game';
import { evaluatePreflopAction } from './preflop-evaluator';
import {
  evaluatePostflopAction,
  type PostflopContext,
} from './postflop-evaluator';

const STREET_BOARD_COUNT: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

const SMALL_BLIND = 1;
const BIG_BLIND = 2;

/**
 * End-to-end evaluation of a completed hand.
 *
 * Replays the action log, reconstructs game state snapshots, invokes the
 * preflop chart evaluator for preflop actions and the postflop heuristic for
 * flop/turn/river actions. Aggregates per-action scores into street scores and
 * an overall score.
 */
export function evaluateHand(
  hand: CompletedHand,
  options: { iterations?: number } = {},
): GtoAnalysis {
  const actionEvaluations: ActionEvaluation[] = [];
  const mistakes: Mistake[] = [];
  const strengths: string[] = [];
  const streetScoreAccumulator: Partial<Record<Street, number[]>> = {};

  const ids = determinePlayerIds(hand);
  if (!ids) {
    return emptyAnalysis(
      '이 핸드에는 평가할 내 액션이 없습니다 (상대가 즉시 폴드).',
    );
  }

  const replay = replayActions(hand, ids);

  for (const step of replay) {
    if (step.action.playerId !== ids.my) continue;

    if (step.snapshot.street === 'preflop') {
      const ev = evaluatePreflopAction(
        hand.myCards,
        {
          situation: derivePreflopSituation(step.oppPriorActions),
          position: step.snapshot.myPosition,
          stackBB: step.snapshot.myStack / BIG_BLIND,
          bigBlindChips: BIG_BLIND,
        },
        step.action.action,
        step.action.amount,
      );
      const eval1: ActionEvaluation = {
        actionIndex: step.actionIndex,
        street: 'preflop',
        action: step.action.action,
        amount: step.action.amount,
        score: ev.score,
        recommended: `${ev.recommendedAction.action} (freq ${(ev.recommendedAction.frequency * 100).toFixed(0)}%)`,
        reasoning: ev.commentary,
      };
      actionEvaluations.push(eval1);
      pushStreet(streetScoreAccumulator, 'preflop', ev.score);
      if (ev.score >= 90) strengths.push(`프리플랍 ${ev.handKey}: ${ev.commentary}`);
      continue;
    }

    const ctx: PostflopContext = {
      street: step.snapshot.street,
      board: hand.board.slice(0, STREET_BOARD_COUNT[step.snapshot.street]),
      myHand: hand.myCards,
      pot: step.snapshot.pot,
      toCall: step.snapshot.toCall,
      bigBlind: BIG_BLIND,
      myStack: step.snapshot.myStack,
      oppStack: step.snapshot.oppStack,
      opponentHistory: step.oppPriorActions,
    };
    const ev = evaluatePostflopAction(
      ctx,
      step.action.action,
      step.action.amount,
      { iterations: options.iterations },
    );
    const eval1: ActionEvaluation = {
      actionIndex: step.actionIndex,
      street: step.snapshot.street,
      action: step.action.action,
      amount: step.action.amount,
      score: ev.score,
      recommended: ev.recommendedAction.label,
      reasoning: ev.reasoning.join(' '),
      equity: ev.equity,
    };
    actionEvaluations.push(eval1);
    pushStreet(streetScoreAccumulator, step.snapshot.street, ev.score);
    if (ev.mistakeType) {
      mistakes.push({
        actionIndex: step.actionIndex,
        street: step.snapshot.street,
        type: ev.mistakeType,
        description: ev.reasoning[ev.reasoning.length - 1] ?? ev.mistakeType,
      });
    }
    if (ev.score >= 90) {
      strengths.push(
        `${streetLabel(step.snapshot.street)} ${ev.recommendedAction.label}`,
      );
    }
  }

  const streetScores: Partial<Record<Street, number>> = {};
  for (const st of Object.keys(streetScoreAccumulator) as Street[]) {
    const arr = streetScoreAccumulator[st]!;
    streetScores[st] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  const overallScore =
    actionEvaluations.length === 0
      ? 0
      : Math.round(
          actionEvaluations.reduce((sum, e) => sum + e.score, 0) /
            actionEvaluations.length,
        );

  const summary = buildSummary(overallScore, mistakes, strengths);

  return {
    overallScore,
    streetScores,
    actionEvaluations,
    mistakes,
    strengths: dedupe(strengths).slice(0, 3),
    summary,
  };
}

/* ------------------------------------------------------------------ */
/*  Replay engine                                                     */
/* ------------------------------------------------------------------ */

interface Snapshot {
  street: Street;
  pot: number;
  toCall: number;
  myStack: number;
  oppStack: number;
  myBet: number;
  oppBet: number;
  myPosition: 'SB' | 'BB';
}

interface ReplayStep {
  actionIndex: number;
  action: ActionLogEntry;
  snapshot: Snapshot;
  oppPriorActions: ActionRecord[];
}

function replayActions(
  hand: CompletedHand,
  ids: { my: string; opp: string },
): ReplayStep[] {
  const myPos = hand.myPosition;
  const oppPos = myPos === 'SB' ? 'BB' : 'SB';

  // Post blinds.
  const myBlind = myPos === 'SB' ? SMALL_BLIND : BIG_BLIND;
  const oppBlind = oppPos === 'SB' ? SMALL_BLIND : BIG_BLIND;
  const myStack0 = hand.initialStacks[0] - myBlind;
  const oppStack0 = hand.initialStacks[1] - oppBlind;

  let state: Snapshot = {
    street: 'preflop',
    pot: SMALL_BLIND + BIG_BLIND,
    toCall: myPos === 'SB' ? BIG_BLIND - SMALL_BLIND : 0,
    myStack: myStack0,
    oppStack: oppStack0,
    myBet: myBlind,
    oppBet: oppBlind,
    myPosition: myPos,
  };

  const oppPriorActions: ActionRecord[] = [];
  const steps: ReplayStep[] = [];

  let prevStreet: Street = 'preflop';
  for (let i = 0; i < hand.actionLog.length; i++) {
    const entry = hand.actionLog[i];
    if (entry.street !== prevStreet) {
      state = {
        ...state,
        street: entry.street,
        myBet: 0,
        oppBet: 0,
        toCall: 0,
      };
      prevStreet = entry.street;
    }

    // Snapshot BEFORE applying the action.
    steps.push({
      actionIndex: i,
      action: entry,
      snapshot: { ...state },
      oppPriorActions: oppPriorActions.slice(),
    });

    const isMine = entry.playerId === ids.my;
    applyActionToSnapshot(state, entry, isMine);

    if (!isMine) {
      oppPriorActions.push({
        playerId: entry.playerId,
        action: entry.action,
        amount: entry.amount,
        street: entry.street,
      });
    }
  }
  return steps;
}

function applyActionToSnapshot(
  state: Snapshot,
  entry: ActionLogEntry,
  isMine: boolean,
): void {
  const actorStack = isMine ? 'myStack' : 'oppStack';
  const actorBet = isMine ? 'myBet' : 'oppBet';

  if (entry.action === 'fold' || entry.action === 'check') {
    // No chip movement.
  } else if (entry.action === 'call') {
    state[actorStack] -= entry.amount;
    state[actorBet] += entry.amount;
    state.pot += entry.amount;
  } else if (entry.action === 'bet' || entry.action === 'raise') {
    // amount is the "raise-to" total for this street.
    const prior = state[actorBet];
    const delta = Math.max(0, entry.amount - prior);
    state[actorStack] -= delta;
    state[actorBet] = entry.amount;
    state.pot += delta;
  }
  // toCall is always stored FROM ME perspective — what *I* would need to call
  // if it were my turn. Snapshots are taken before each action; when my action
  // comes up, this reflects how much I must put in to continue.
  state.toCall = Math.max(0, state.oppBet - state.myBet);
}

/* ------------------------------------------------------------------ */
/*  Preflop situation derivation                                      */
/* ------------------------------------------------------------------ */

function derivePreflopSituation(
  oppPrior: ReadonlyArray<Pick<ActionRecord, 'action' | 'street'>>,
): import('./preflop-chart').PreflopSituation {
  const oppPreflop = oppPrior.filter((a) => a.street === 'preflop');
  const raises = oppPreflop.filter((a) => a.action === 'raise').length;
  const calls = oppPreflop.filter((a) => a.action === 'call').length;

  if (raises >= 2) return 'BB_VS_4BET'; // facing a 4bet
  if (raises === 1 && oppPreflop[0].action === 'raise') {
    // Opp opened; we're BB defending vs open OR SB facing a 3bet.
    // If my prior actions include a raise, I already opened → this is SB_VS_3BET.
    // We don't have my prior actions in this helper; inferred by caller instead.
    // Default to BB_VS_RAISE; caller can override. For MVP keep simple.
    return 'BB_VS_RAISE';
  }
  if (raises === 1) return 'SB_VS_3BET';
  if (calls >= 1) return 'BB_VS_LIMP';
  return 'SB_FIRST_ACTION';
}

/* ------------------------------------------------------------------ */
/*  Player ID resolution                                              */
/* ------------------------------------------------------------------ */

function determinePlayerIds(
  hand: CompletedHand,
): { my: string; opp: string } | null {
  const labels = new Map<string, string>();
  for (const a of hand.actionLog) labels.set(a.playerId, a.playerLabel);
  let my: string | null = null;
  let opp: string | null = null;
  for (const [id, label] of labels) {
    if (label === '나') my = id;
    else opp = id;
  }
  // Require at least one user action. Opponent may never have acted (e.g.,
  // I folded preflop immediately) — in that case opp gets a synthetic id
  // so replayActions can still run; no opponent history means top-100%
  // range inference.
  if (!my) return null;
  if (!opp) opp = '__no_opp_action__';
  return { my, opp };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function emptyAnalysis(summary: string): GtoAnalysis {
  return {
    overallScore: 0,
    streetScores: {},
    actionEvaluations: [],
    mistakes: [],
    strengths: [],
    summary,
  };
}

function pushStreet(
  acc: Partial<Record<Street, number[]>>,
  st: Street,
  score: number,
): void {
  (acc[st] ??= []).push(score);
}

const STREET_KO: Record<Street, string> = {
  preflop: '프리플랍',
  flop: '플랍',
  turn: '턴',
  river: '리버',
};

function streetLabel(st: Street): string {
  return STREET_KO[st];
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function buildSummary(
  overall: number,
  mistakes: Mistake[],
  strengths: string[],
): string {
  if (overall >= 85) {
    return strengths.length > 0
      ? '매우 잘 플레이한 핸드입니다. 권장 라인과 거의 일치합니다.'
      : '잘 플레이한 핸드입니다.';
  }
  if (overall >= 65) {
    if (mistakes.length > 0) {
      return `전반적으로 괜찮은 플레이. 다만 ${mistakes.length}개의 개선 포인트가 있습니다.`;
    }
    return '전반적으로 무난한 플레이입니다.';
  }
  if (overall >= 40) {
    return `몇 가지 실수가 있었습니다 (${mistakes.length}건). 각 액션의 reasoning을 확인하세요.`;
  }
  return `핸드에 큰 실수가 있었습니다 (${mistakes.length}건). 권장 라인과 많이 벗어났습니다.`;
}

