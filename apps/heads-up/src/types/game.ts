import type { Card } from '../engine/card';
import type { HandValue } from '../engine/hand-evaluator';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type Position = 'SB' | 'BB';

export type PlayerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export type GameMode = 'AI' | 'REMOTE';

export type HandResult = 'WIN' | 'LOSS' | 'SPLIT';

export interface Player {
  id: string;
  stack: number;
  holeCards: Card[] | null;
  position: Position;
  hasFolded: boolean;
  currentBet: number;
}

export interface ActionRecord {
  playerId: string;
  action: PlayerAction;
  amount: number;
  street: Street;
}

export interface GameState {
  players: Player[];
  board: Card[];
  pot: number;
  street: Street;
  currentBet: number;
  minRaise: number;
  toActId: string;
  bigBlind: number;
  smallBlind: number;
  history: ActionRecord[];
}

export interface BotDecision {
  action: PlayerAction;
  amount: number;
  thinkingTimeMs: number;
}

/** Enriched per-action entry saved with a completed hand for display & analysis. */
export interface ActionLogEntry {
  street: Street;
  playerId: string;
  playerLabel: string;
  action: PlayerAction;
  amount: number;
  /** Pot size after this action was applied. */
  potAfter: number;
}

export type MistakeType =
  | 'VALUE_MISS'
  | 'BLUFF_TOO_OFTEN'
  | 'SIZE_MISS'
  | 'RANGE_MISREAD';

/** Per-action verdict produced by the hand evaluator. */
export interface ActionEvaluation {
  /** Index into CompletedHand.actionLog. */
  actionIndex: number;
  street: Street;
  action: PlayerAction;
  amount: number;
  score: number;
  /** Human-readable recommendation (e.g. "70% pot 베팅 권장"). */
  recommended: string;
  reasoning: string;
  /** Estimated equity vs. opponent's inferred range (postflop only).
   *  Range [0, 1]. Undefined for preflop actions. */
  equity?: number;
}

export interface Mistake {
  actionIndex: number;
  street: Street;
  type: MistakeType;
  description: string;
}

/** End-to-end GTO-ish analysis of a completed hand. */
export interface GtoAnalysis {
  overallScore: number;
  streetScores: Partial<Record<Street, number>>;
  actionEvaluations: ActionEvaluation[];
  mistakes: Mistake[];
  strengths: string[];
  summary: string;
}

/**
 * The canonical "played hand" record stored in IndexedDB.
 *
 * Lives at the app level — captures everything needed to display in the history
 * list, re-render the analysis page, and (later) run GTO scoring after the fact.
 */
export interface CompletedHand {
  handId: string;
  playedAt: number;
  /** 1-indexed within the session that produced it — useful for sort tie-breaking. */
  handNumber: number;
  mode: GameMode;
  aiDifficulty?: string;
  opponentName: string;
  myPosition: Position;
  /** [me, opponent] at the start of the hand (post-blind is NOT subtracted here). */
  initialStacks: [number, number];
  finalStacks: [number, number];
  result: HandResult;
  /** Net chips (finalMyStack - initialMyStack). Negative = loss. */
  myWinLoss: number;
  board: Card[];
  myCards: [Card, Card];
  /** Only present when the hand ended at showdown. */
  opponentCards?: [Card, Card];
  wentToShowdown: boolean;
  /** Winner's evaluated hand (5-card best). Present only on showdown. */
  winningHand?: HandValue;
  actionLog: ActionLogEntry[];
  /** Full 52-card deck in deal-order — enables post-hoc verification. */
  deckSnapshot: Card[];
  /** Present when a deterministic seed was used (primarily tests & REMOTE mode). */
  seed?: number;
  gtoAnalysis?: GtoAnalysis;
}
