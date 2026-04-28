import type { Card } from '../engine/card';
import type { BotDecision, GameState, Player, PlayerAction } from '../types/game';
import { calculateEquity } from './equity';
import {
  HU_BB_VS_OPEN_CHART,
  HU_SB_OPEN_CHART,
  type PreflopAction,
  handKey,
} from './hand-chart';
import { classifyHand, decidePostflop } from './postflop-rules';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface BotProfile {
  bluffRate: number;
  aggression: number;
  thinkingMinMs: number;
  thinkingMaxMs: number;
  equityIterations: number;
}

const PROFILES: Record<Difficulty, BotProfile> = {
  EASY: {
    bluffRate: 0.05,
    aggression: 0.75,
    thinkingMinMs: 800,
    thinkingMaxMs: 2500,
    equityIterations: 300,
  },
  MEDIUM: {
    bluffRate: 0.15,
    aggression: 1.0,
    thinkingMinMs: 800,
    thinkingMaxMs: 2500,
    equityIterations: 500,
  },
  HARD: {
    bluffRate: 0.25,
    aggression: 1.25,
    thinkingMinMs: 800,
    thinkingMaxMs: 2500,
    equityIterations: 800,
  },
};

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

function adjustForDifficulty(base: PreflopAction, d: Difficulty): PreflopAction {
  if (d === 'EASY') {
    const foldShift = base.fold * 0.6;
    const raiseShift = base.raise * 0.2;
    return {
      raise: base.raise - raiseShift,
      call: base.call + foldShift + raiseShift,
      fold: base.fold - foldShift,
    };
  }
  if (d === 'HARD') {
    const callShift = base.call * 0.4;
    const marginalFoldShift = base.raise > 0 && base.raise < 1 ? base.fold * 0.3 : 0;
    return {
      raise: base.raise + callShift + marginalFoldShift,
      call: base.call - callShift,
      fold: base.fold - marginalFoldShift,
    };
  }
  return base;
}

type PreflopSample = 'raise' | 'call' | 'fold';

function samplePreflop(action: PreflopAction, rng: () => number): PreflopSample {
  const r = rng();
  if (r < action.raise) return 'raise';
  if (r < action.raise + action.call) return 'call';
  return 'fold';
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
  readonly difficulty: Difficulty;
  private readonly profile: BotProfile;
  private readonly rng: () => number;

  constructor(difficulty: Difficulty, seed?: number) {
    this.difficulty = difficulty;
    this.profile = PROFILES[difficulty];
    this.rng = seed !== undefined ? mulberry32(seed) : defaultCryptoRng();
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

    // If there's a raise above the big blind, we're facing a raise regardless of position
    // (applies to BB defending vs SB open AND SB facing BB's 3bet).
    // Otherwise it's first-in / limp scenario → use open chart.
    const facingRaise = state.currentBet > state.bigBlind;
    const baseChart = facingRaise ? HU_BB_VS_OPEN_CHART : HU_SB_OPEN_CHART;
    const base = baseChart[key] ?? { raise: 0, call: 0, fold: 1 };
    const adjusted = adjustForDifficulty(base, this.difficulty);
    const sample = samplePreflop(adjusted, this.rng);

    if (sample === 'raise') {
      const openSize = state.bigBlind * (2.3 + this.rng() * 0.6) * this.profile.aggression;
      const threeBetSize =
        (state.pot + toCall) * (2.0 + this.rng() * 0.8) * this.profile.aggression;
      const raiseTo = Math.round(
        canCheck || state.currentBet <= state.bigBlind ? openSize : threeBetSize,
      );
      const clampedRaise = Math.min(me.stack + me.currentBet, Math.max(raiseTo, state.currentBet + state.minRaise));
      return { action: 'raise', amount: clampedRaise, thinkingTimeMs };
    }
    if (sample === 'call') {
      if (canCheck) return { action: 'check', amount: 0, thinkingTimeMs };
      return { action: 'call', amount: Math.min(me.stack, toCall), thinkingTimeMs };
    }
    if (canCheck) return { action: 'check', amount: 0, thinkingTimeMs };
    return { action: 'fold', amount: 0, thinkingTimeMs };
  }

  private postflopDecide(
    state: GameState,
    me: Player,
    hole: [Card, Card],
    thinkingTimeMs: number,
  ): BotDecision {
    const toCall = Math.max(0, state.currentBet - me.currentBet);
    const equity = calculateEquity(hole, state.board, [], {
      iterations: this.profile.equityIterations,
      rng: this.rng,
    });
    const potOdds = toCall === 0 ? 0 : toCall / (state.pot + toCall);
    const strength = classifyHand(hole, state.board);

    const decision = decidePostflop(
      {
        equity,
        potOdds,
        potSize: state.pot,
        toCall,
        stackSize: me.stack,
        myCurrentBet: me.currentBet,
        bluffRate: this.profile.bluffRate,
        aggression: this.profile.aggression,
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

    return { action, amount, thinkingTimeMs };
  }
}
