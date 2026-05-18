/**
 * HeuristicBot — 페르소나 × 난이도 기반 의사결정.
 *
 * 새 파이프라인 (heads_up_ai_persona_logic_design.md):
 *   1. evaluateDecisionFeatures(state) → features
 *   2. getBaseActionScores(features) → baseScores
 *   3. applyPersonaModifiers(baseScores, features, persona) → personaScores
 *   4. applyDifficultyModifiers(personaScores, features, level) → finalScores
 *   5. chooseAction(finalScores, features, temperature) → action
 *   6. 사이즈 계산 (sizeRatio × pot 등)
 *
 * 외부 인터페이스(HeuristicBot 생성자, decide 메서드)는 그대로 유지.
 * preflop도 동일 파이프라인을 거쳐 일관성 확보.
 */

import type { Card } from '../engine/card';
import type { BotDecision, GameState, Player, PlayerAction } from '../types/game';
import type { AiLevel, AiLevelModifiers, AiPersonaId } from '../types/ai';
import { AI_LEVELS } from './levels';
import {
  HU_BB_VS_OPEN_CHART,
  HU_SB_OPEN_CHART,
  handKey,
} from './hand-chart';
import { evaluateDecisionFeatures } from './features';
import { EquityCache } from './equity-cache';
import { getBaseActionScores, getBasePreflopScores } from './base-scores';
import { applyPersonaModifiers } from './persona-modifiers';
import { applyDifficultyModifiers, temperatureFor } from './difficulty-modifiers';
import { chooseAction } from './action-chooser';
import type { DecisionFeatures } from './decision-types';
import { decide25bbPreflop } from './preflop-25bb/engine';
import { resolveSpecPersona } from './preflop-25bb/personaResolver';
import { initialStateFor, type PersonaState } from './preflop-25bb/personaState';
import { applyEvents } from './preflop-25bb/bayesianPersonaUpdater';
import type { PersonaStateEvent } from './preflop-25bb/personaStateEvents';

/** @deprecated 마스터 스펙 v2 이후 `AiLevel`을 사용. 임시 별칭. */
export type Difficulty = AiLevel;

/* ────────────────────────────────────────────────────────
 * RNG helpers
 * ──────────────────────────────────────────────────────── */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function defaultCryptoRng(): () => number {
  const buf = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  };
}

/* ────────────────────────────────────────────────────────
 * State helpers
 * ──────────────────────────────────────────────────────── */
function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`player ${id} not found in state`);
  return p;
}

function ensureHoleCards(p: Player): [Card, Card] {
  if (!p.holeCards || p.holeCards.length !== 2) {
    throw new Error(`player ${p.id} missing hole cards`);
  }
  return [p.holeCards[0], p.holeCards[1]];
}

function iterationsFor(level: AiLevel): number {
  // 설계도 §1.1 — 무거운 몬테카를로 회피. 캐시와 결합해 부담 최소화.
  switch (level) {
    case 'EASY': return 200;
    case 'MEDIUM': return 400;
    case 'HARD': return 600;
  }
}

function isPersonaId(s: string): s is AiPersonaId {
  return s === 'STANDARD' || s === 'NIT' || s === 'LAG' || s === 'CALLING' || s === 'MANIAC';
}

/* ────────────────────────────────────────────────────────
 * Sizing — chooseAction이 반환한 sizeRatio를 실제 칩 amount로 변환
 * ──────────────────────────────────────────────────────── */
function computeAmount(
  playerAction: PlayerAction,
  sizeRatio: number,
  state: GameState,
  me: Player,
  rng: () => number,
  sizingAccuracy: number,
): number {
  const toCall = Math.max(0, state.currentBet - me.currentBet);
  const effectiveStack = me.stack;
  const stackPlusCommitted = me.stack + me.currentBet;
  const minRaise = state.currentBet + state.minRaise;

  if (playerAction === 'fold' || playerAction === 'check') return 0;
  if (playerAction === 'call') return Math.min(effectiveStack, toCall);

  // bet / raise
  if (sizeRatio >= 999) {
    // all-in
    return playerAction === 'raise' ? stackPlusCommitted : effectiveStack;
  }

  // sizing accuracy: 의도된 사이즈에 ±jitter 추가 (낮을수록 부정확)
  const jitter = (1 - sizingAccuracy) * 0.3; // 최대 ±30%
  const jitterFactor = 1 + (rng() * 2 - 1) * jitter;

  if (playerAction === 'bet') {
    // bet은 toCall=0 가정 — pot 비율
    const raw = state.pot * sizeRatio * jitterFactor;
    const sized = Math.round(raw);
    return Math.min(effectiveStack, Math.max(1, sized));
  }

  // raise — pot + toCall 기준 raise sizing
  const raw = (state.pot + toCall) * sizeRatio * jitterFactor;
  const raiseTo = Math.round(raw);
  // 최소 raise 보장
  const clamped = Math.max(raiseTo, minRaise);
  return Math.min(stackPlusCommitted, clamped);
}

/* ────────────────────────────────────────────────────────
 * HeuristicBot
 * ──────────────────────────────────────────────────────── */
export class HeuristicBot {
  /** @deprecated `level` 사용 권장. */
  readonly difficulty: AiLevel;
  readonly personaId: AiPersonaId;
  readonly level: AiLevel;
  private readonly mods: AiLevelModifiers;
  private readonly rng: () => number;
  private readonly iterations: number;
  private readonly thinkingMinMs: number;
  private readonly thinkingMaxMs: number;
  private readonly temperature: number;
  private readonly equityCache = new EquityCache();

  /** Bayesian-inspired persona state — mutates during match via `recordEvents`. */
  private personaState: PersonaState;

  /**
   * 두 가지 호출 시그니처 지원:
   *  1. `new HeuristicBot('MEDIUM')`        — legacy: difficulty만 (STANDARD persona)
   *  2. `new HeuristicBot('LAG', 'HARD')`   — persona × level
   */
  constructor(personaOrLevel: AiPersonaId | AiLevel, levelOrSeed?: AiLevel | number, seed?: number) {
    let personaId: AiPersonaId;
    let level: AiLevel;
    let actualSeed: number | undefined;

    if (isPersonaId(personaOrLevel)) {
      personaId = personaOrLevel;
      level = (typeof levelOrSeed === 'string' ? levelOrSeed : 'MEDIUM') as AiLevel;
      actualSeed = typeof levelOrSeed === 'number' ? levelOrSeed : seed;
    } else {
      personaId = 'STANDARD';
      level = personaOrLevel as AiLevel;
      actualSeed = typeof levelOrSeed === 'number' ? levelOrSeed : seed;
    }

    this.personaId = personaId;
    this.level = level;
    this.difficulty = level;
    this.mods = AI_LEVELS[level];
    this.rng = actualSeed !== undefined ? mulberry32(actualSeed) : defaultCryptoRng();
    this.iterations = iterationsFor(level);
    this.thinkingMinMs = this.mods.delayRangeMs[0];
    this.thinkingMaxMs = this.mods.delayRangeMs[1];
    this.temperature = temperatureFor(level);
    this.personaState = initialStateFor(resolveSpecPersona(this.personaId));
  }

  /** Feed match events into the persona-state vector. Callers (game-store
   *  finalizeHand etc.) emit events; this method mutates internal state. */
  recordEvents(events: PersonaStateEvent[]): void {
    const specPersona = resolveSpecPersona(this.personaId);
    this.personaState = applyEvents(this.personaState, events, specPersona);
  }

  /** Read-only snapshot for tests / telemetry. */
  getPersonaState(): PersonaState {
    return { ...this.personaState };
  }

  decide(state: GameState, botId: string): BotDecision {
    const me = getPlayer(state, botId);
    const hole = ensureHoleCards(me);

    const rawThinkingMs = Math.round(
      this.thinkingMinMs + this.rng() * (this.thinkingMaxMs - this.thinkingMinMs),
    );

    // ── 25bb HU preflop persona engine (beta) ─────────────────────────
    // 사양 12개 노드 중 매칭되면 새 엔진의 액션을 그대로 사용. 매칭 실패
    // (4bet 이후, 25bb 미세 이탈 등)는 legacy 파이프라인으로 fallback.
    const preflop25 = decide25bbPreflop(state, botId, this.personaId, this.rng, this.personaState);
    if (preflop25) {
      const isFast = preflop25.action === 'fold' || preflop25.action === 'check';
      const thinkingTimeMs = isFast
        ? Math.max(250, Math.round(rawThinkingMs * 0.45))
        : rawThinkingMs;
      return { action: preflop25.action, amount: preflop25.amount, thinkingTimeMs };
    }

    // 1. Features 추출
    const features = evaluateDecisionFeatures({
      state,
      me,
      hole,
      iterations: this.iterations,
      rng: this.rng,
      equityCache: this.equityCache,
    });

    // 2. Base scores
    const baseScores = state.street === 'preflop'
      ? this.preflopBaseScores(hole, state, features)
      : getBaseActionScores(features);

    // 3. Persona modifiers
    const personaScores = applyPersonaModifiers(baseScores, features, this.personaId);

    // 4. Difficulty modifiers
    const finalScores = applyDifficultyModifiers(personaScores, features, this.level, this.rng);

    // 5. Choose action
    const chosen = chooseAction(finalScores, features, this.temperature, this.rng);

    // 6. Compute amount
    const amount = computeAmount(
      chosen.playerAction,
      chosen.sizeRatio,
      state,
      me,
      this.rng,
      this.mods.sizingAccuracy,
    );

    // 빠른 결정(fold / check)에는 thinking time 단축 — NIT 페르소나처럼 매 핸드
    // 폴드/체크만 반복하는 케이스에서 사용자가 스택 누적으로 stuck 처럼 느끼는 것을 회피.
    const isFastAction = chosen.playerAction === 'fold' || chosen.playerAction === 'check';
    const thinkingTimeMs = isFastAction
      ? Math.max(250, Math.round(rawThinkingMs * 0.45))
      : rawThinkingMs;

    return { action: chosen.playerAction, amount, thinkingTimeMs };
  }

  /**
   * Preflop base scores — hand-chart의 raise/call/fold 분포를 흡수.
   * 그 위에 persona/difficulty modifier가 일관 적용됨.
   */
  private preflopBaseScores(
    hole: [Card, Card],
    state: GameState,
    features: DecisionFeatures,
  ) {
    const key = handKey(hole[0], hole[1]);
    const facingRaise = state.currentBet > state.bigBlind;
    const chart = facingRaise ? HU_BB_VS_OPEN_CHART : HU_SB_OPEN_CHART;
    const base = chart[key] ?? { raise: 0, call: 0, fold: 1 };
    return getBasePreflopScores(base, features);
  }
}
