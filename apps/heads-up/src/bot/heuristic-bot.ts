import type { Card } from '../engine/card';
import type { BotDecision, GameState, Player, PlayerAction } from '../types/game';
import type {
  AiLevel,
  AiLevelModifiers,
  AiPersonaId,
  AiPersonaProfile,
} from '../types/ai';
import { AI_PERSONAS } from './personas';
import { AI_LEVELS } from './levels';
import { calculateEquity } from './equity';
import {
  HU_BB_VS_OPEN_CHART,
  HU_SB_OPEN_CHART,
  type PreflopAction,
  handKey,
} from './hand-chart';
import { classifyHand, decidePostflop } from './postflop-rules';

/** @deprecated 마스터 스펙 v2 이후 `AiLevel`을 사용. 임시 별칭. */
export type Difficulty = AiLevel;

interface BotProfile {
  bluffRate: number;
  aggression: number;
  thinkingMinMs: number;
  thinkingMaxMs: number;
  equityIterations: number;
}

/**
 * Persona × Level → 단일 BotProfile로 환산.
 *
 * 마스터 스펙의 의도:
 *   - aggression ← persona.riskTolerance (위험 감수도)
 *   - bluffRate  ← persona.bluffBias × level별 base
 *   - 사고 시간 ← level.delayRangeMs
 *   - equityIterations ← level별 (HARD가 더 정밀)
 */
function deriveProfile(
  persona: AiPersonaProfile,
  level: AiLevelModifiers,
): BotProfile {
  const baseBluff = 0.15; // STANDARD × MEDIUM에서 약 15% 블러프 — 기존 MEDIUM 값과 동일
  // EASY일수록 결정이 들쑥날쑥하지만 평균 블러프율은 sizing accuracy로 약간 보정.
  const bluffRate = Math.min(0.6, baseBluff * persona.bluffBias);
  const aggression = persona.riskTolerance;
  // sizingAccuracy가 낮을수록 equity sample을 적게 — 결정이 noisier.
  const equityIterations = Math.round(300 + level.sizingAccuracy * 700);
  return {
    bluffRate,
    aggression,
    thinkingMinMs: level.delayRangeMs[0],
    thinkingMaxMs: level.delayRangeMs[1],
    equityIterations,
  };
}

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

/**
 * Persona의 vpip/pfr/threeBet bias를 preflop fold/call/raise 분포에 적용.
 * 핵심 아이디어: vpipBias로 fold를 줄이고, pfrBias로 call→raise 비율을 조정.
 */
function applyPersonaPreflop(
  base: PreflopAction,
  persona: AiPersonaProfile,
  facingRaise: boolean,
): PreflopAction {
  // 1. fold 비율을 vpipBias 만큼 축소(또는 확대).
  const foldFactor = clamp(1 / persona.vpipBias, 0.3, 2.5);
  let fold = clamp(base.fold * foldFactor, 0, 1);
  let remaining = 1 - fold;
  if (remaining < 0) remaining = 0;

  // 2. 남은 (call + raise) 부피 안에서 raise 비중을 pfrBias / threeBetBias로 보정.
  const raiseScale = facingRaise ? persona.threeBetBias : persona.pfrBias;
  const baseTotal = base.call + base.raise;
  const baseRaiseShare = baseTotal > 0 ? base.raise / baseTotal : 0;
  const newRaiseShare = clamp(baseRaiseShare * raiseScale, 0, 1);

  let raise = remaining * newRaiseShare;
  let call = remaining - raise;

  // 3. 정규화 (방어적).
  const total = fold + call + raise;
  if (total > 0 && Math.abs(total - 1) > 1e-6) {
    fold /= total;
    call /= total;
    raise /= total;
  }
  return { fold, call, raise };
}

/**
 * 결정 noise: level.decisionNoise 확률로 인접 액션으로 swap.
 *
 * 원칙: noise는 정밀도(precision)를 떨어뜨릴 뿐, **commitment 방향을 뒤집지 않는다**.
 *  - 플레이하기로 한 핸드를 noise로 폴드시키지 않음 (call → fold ✗)
 *  - 폴드하기로 한 핸드를 noise로 갑자기 raise시키지 않음
 *  - 대신: raise ↔ call (사이즈 강도), bet ↔ check (cbet 누락) 같은 인접 swap만 허용
 */
function applyLevelNoise(
  decision: { action: PlayerAction; amount: number },
  noise: number,
  canCheck: boolean,
  canCall: boolean,
  canRaise: boolean,
  rng: () => number,
): { action: PlayerAction; amount: number } {
  if (rng() >= noise) return decision;
  switch (decision.action) {
    case 'raise':
      // 과한 압박을 머뭇거려 콜/체크로 후퇴 (commitment은 유지).
      if (canCall) return { action: 'call', amount: 0 };
      if (canCheck) return { action: 'check', amount: 0 };
      return decision;
    case 'bet':
      // 자발적 베팅을 망설여 체크 (commitment은 유지 — 폴드 X).
      if (canCheck) return { action: 'check', amount: 0 };
      return decision;
    case 'call':
      // 콜은 commitment. noise로 폴드시키지 않음. 가끔 과잉 반응으로 raise.
      // raise 불가하면 그대로 call 유지.
      return decision;
    case 'check':
      // 체크할 자리에서 작은 베팅으로 휘청 (raise 가능 시).
      if (canRaise) return { action: 'bet', amount: decision.amount };
      return decision;
    case 'fold':
    default:
      // 폴드도 그대로 유지 — noise로 갑자기 콜하면 손실 폭주.
      return decision;
  }
}

type PreflopSample = 'raise' | 'call' | 'fold';

function samplePreflop(action: PreflopAction, rng: () => number): PreflopSample {
  const r = rng();
  if (r < action.raise) return 'raise';
  if (r < action.raise + action.call) return 'call';
  return 'fold';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

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

export class HeuristicBot {
  /** @deprecated `level` 사용 권장. */
  readonly difficulty: AiLevel;
  readonly personaId: AiPersonaId;
  readonly level: AiLevel;
  private readonly persona: AiPersonaProfile;
  private readonly mods: AiLevelModifiers;
  private readonly profile: BotProfile;
  private readonly rng: () => number;

  /**
   * 두 가지 호출 시그니처 지원:
   *
   * 1. `new HeuristicBot('MEDIUM')`              ← legacy: difficulty만 (= STANDARD persona)
   * 2. `new HeuristicBot('LAG', 'HARD')`          ← persona × level
   *
   * 첫 인자가 known persona id면 (persona, level) 모드, 아니면 (level) legacy 모드로 해석.
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
      // legacy: 첫 인자가 'EASY' | 'MEDIUM' | 'HARD'
      personaId = 'STANDARD';
      level = personaOrLevel as AiLevel;
      actualSeed = typeof levelOrSeed === 'number' ? levelOrSeed : seed;
    }

    this.personaId = personaId;
    this.level = level;
    this.difficulty = level;
    this.persona = AI_PERSONAS[personaId];
    this.mods = AI_LEVELS[level];
    this.profile = deriveProfile(this.persona, this.mods);
    this.rng = actualSeed !== undefined ? mulberry32(actualSeed) : defaultCryptoRng();
  }

  decide(state: GameState, botId: string): BotDecision {
    const me = getPlayer(state, botId);
    const hole = ensureHoleCards(me);
    const thinkingTimeMs = Math.round(
      this.profile.thinkingMinMs +
        this.rng() * (this.profile.thinkingMaxMs - this.profile.thinkingMinMs),
    );

    if (state.street === 'preflop') {
      return this.preflopDecide(state, me, hole, thinkingTimeMs);
    }
    return this.postflopDecide(state, me, hole, thinkingTimeMs);
  }

  private preflopDecide(
    state: GameState,
    me: Player,
    hole: [Card, Card],
    thinkingTimeMs: number,
  ): BotDecision {
    const key = handKey(hole[0], hole[1]);
    const toCall = Math.max(0, state.currentBet - me.currentBet);
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && me.stack > 0;

    const facingRaise = state.currentBet > state.bigBlind;
    const baseChart = facingRaise ? HU_BB_VS_OPEN_CHART : HU_SB_OPEN_CHART;
    const base = baseChart[key] ?? { raise: 0, call: 0, fold: 1 };
    const adjusted = applyPersonaPreflop(base, this.persona, facingRaise);
    const sample = samplePreflop(adjusted, this.rng);

    let raw: { action: PlayerAction; amount: number };
    if (sample === 'raise') {
      const openSize = state.bigBlind * (2.3 + this.rng() * 0.6) * this.profile.aggression;
      const threeBetSize =
        (state.pot + toCall) * (2.0 + this.rng() * 0.8) * this.profile.aggression;
      const raiseTo = Math.round(
        canCheck || state.currentBet <= state.bigBlind ? openSize : threeBetSize,
      );
      const clampedRaise = Math.min(
        me.stack + me.currentBet,
        Math.max(raiseTo, state.currentBet + state.minRaise),
      );
      raw = { action: 'raise', amount: clampedRaise };
    } else if (sample === 'call') {
      raw = canCheck
        ? { action: 'check', amount: 0 }
        : { action: 'call', amount: Math.min(me.stack, toCall) };
    } else {
      raw = canCheck ? { action: 'check', amount: 0 } : { action: 'fold', amount: 0 };
    }

    const noised = applyLevelNoise(
      raw,
      this.mods.decisionNoise,
      canCheck,
      canCall,
      true,
      this.rng,
    );
    return { action: noised.action, amount: noised.amount, thinkingTimeMs };
  }

  private postflopDecide(
    state: GameState,
    me: Player,
    hole: [Card, Card],
    thinkingTimeMs: number,
  ): BotDecision {
    const toCall = Math.max(0, state.currentBet - me.currentBet);
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && me.stack > 0;
    const equity = calculateEquity(hole, state.board, [], {
      iterations: this.profile.equityIterations,
      rng: this.rng,
    });
    const potOdds = toCall === 0 ? 0 : toCall / (state.pot + toCall);
    const strength = classifyHand(hole, state.board);

    // Persona-aware bluff rate: bluffBias가 낮은 NIT은 약하면 잘 안 들이대고,
    //                           bluffBias가 높은 MANIAC은 자주 시도.
    // showdownCuriosity가 높으면 콜 다운 — bluffRate를 낮춤(가짜 압박을 안 만들고 콜로 받음).
    const effectiveBluff = this.profile.bluffRate;

    const decision = decidePostflop(
      {
        equity,
        potOdds,
        potSize: state.pot,
        toCall,
        stackSize: me.stack,
        myCurrentBet: me.currentBet,
        bluffRate: effectiveBluff,
        // riskTolerance는 이미 deriveProfile의 aggression에 반영됨;
        // 추가로 cbet/barrel 가중을 street에 따라 곱해준다.
        aggression: this.profile.aggression * streetAggressionMultiplier(state.street, this.persona),
        strength,
      },
      this.rng,
    );

    const action: PlayerAction = decision.action;
    let amount = decision.amount;

    if (action === 'raise') {
      const minRaise = state.currentBet + state.minRaise;
      amount = Math.min(me.stack + me.currentBet, Math.max(amount, minRaise));
    } else if (action === 'bet') {
      amount = Math.min(me.stack, Math.max(1, amount));
    }

    // sizing accuracy: bet/raise 사이즈에 약간의 noise 추가 (낮을수록 더 들쑥날쑥).
    if ((action === 'bet' || action === 'raise') && this.mods.sizingAccuracy < 1) {
      const variance = (1 - this.mods.sizingAccuracy) * 0.3; // 최대 ±30%
      const factor = 1 + (this.rng() * 2 - 1) * variance;
      amount = Math.round(amount * factor);
      if (action === 'raise') {
        const minRaise = state.currentBet + state.minRaise;
        amount = Math.min(me.stack + me.currentBet, Math.max(amount, minRaise));
      } else {
        amount = Math.min(me.stack, Math.max(1, amount));
      }
    }

    const noised = applyLevelNoise(
      { action, amount },
      this.mods.decisionNoise,
      canCheck,
      canCall,
      true,
      this.rng,
    );
    return { action: noised.action, amount: noised.amount, thinkingTimeMs };
  }
}

/**
 * Postflop street별 aggression 보정.
 * cbetBias는 flop에, barrelBias는 turn/river에 적용.
 */
function streetAggressionMultiplier(
  street: GameState['street'],
  persona: AiPersonaProfile,
): number {
  switch (street) {
    case 'flop':
      return persona.cbetBias;
    case 'turn':
    case 'river':
      return persona.barrelBias;
    default:
      return 1;
  }
}

function isPersonaId(s: string): s is AiPersonaId {
  return s === 'STANDARD' || s === 'NIT' || s === 'LAG' || s === 'CALLING' || s === 'MANIAC';
}
