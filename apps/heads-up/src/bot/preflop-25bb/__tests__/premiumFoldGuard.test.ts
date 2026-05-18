import { describe, expect, it } from 'vitest';
import { stringToCard } from '../../../engine/card';
import type { GameState, Player } from '../../../types/game';
import { decide25bbPreflop } from '../engine';
import { applyHandClassCorrection, applyPersonaModifier, normalizeFrequencies } from '../frequencyMath';
import type { ActionFrequencies } from '../types';

/**
 * Hard-zero fold guarantee for premium hands.
 *
 * Spec 요구사항:
 *  (1) AA/KK/QQ/AKs at SB_FIRST_IN_25BB     → 10k fold count = 0
 *  (2) AA/KK     at BB_VS_SB_OPEN_2BB_25BB → 10k fold count = 0
 *  (3) AA        at SB_VS_BB_JAM_AFTER_OPEN_2BB → fold count = 0 (call ≈ 100%)
 *  (4) premium fold stays 0 across persona × normalize pipeline (unit-level)
 */

const BB = 20;
const SB = 10;
const STACK_BB = 25;

function mkPlayer(opts: {
  id: string;
  position: 'SB' | 'BB';
  cards?: [string, string];
  stack: number;
  currentBet: number;
}): Player {
  return {
    id: opts.id,
    stack: opts.stack,
    holeCards: opts.cards ? [stringToCard(opts.cards[0]), stringToCard(opts.cards[1])] : null,
    position: opts.position,
    hasFolded: false,
    currentBet: opts.currentBet,
  };
}

/** SB acts first; history is empty. SB is the bot here. */
function makeSbFirstIn(myCards: [string, string]): { state: GameState; meId: string } {
  const me = mkPlayer({ id: 'ME', position: 'SB', cards: myCards, stack: STACK_BB * BB - SB, currentBet: SB });
  const opp = mkPlayer({ id: 'OPP', position: 'BB', stack: STACK_BB * BB - BB, currentBet: BB });
  return {
    meId: 'ME',
    state: {
      players: [me, opp],
      board: [],
      pot: SB + BB,
      street: 'preflop',
      currentBet: BB,
      minRaise: BB,
      toActId: 'ME',
      bigBlind: BB,
      smallBlind: SB,
      history: [],
    },
  };
}

/** SB has raised to 2bb (40 chips). BB(bot) is to act. */
function makeBbVsSbOpen(myCards: [string, string]): { state: GameState; meId: string } {
  const sbStartingCommit = SB;
  const sbRaiseTo = 2 * BB; // 40
  const me = mkPlayer({ id: 'ME', position: 'BB', cards: myCards, stack: STACK_BB * BB - BB, currentBet: BB });
  const opp = mkPlayer({ id: 'OPP', position: 'SB', stack: STACK_BB * BB - sbRaiseTo, currentBet: sbRaiseTo });
  return {
    meId: 'ME',
    state: {
      players: [opp, me],
      board: [],
      pot: sbRaiseTo + BB,
      street: 'preflop',
      currentBet: sbRaiseTo,
      minRaise: BB,
      toActId: 'ME',
      bigBlind: BB,
      smallBlind: SB,
      history: [
        { playerId: 'OPP', action: 'raise', amount: sbRaiseTo, street: 'preflop' },
      ],
    },
  };
  // Reference sbStartingCommit so the variable read is non-shadowed even if a
  // future test refactor reuses it.
  void sbStartingCommit;
}

/** SB(bot) raised to 2bb, BB jammed 25bb. SB now to act. */
function makeSbVsJamAfterOpen(myCards: [string, string]): { state: GameState; meId: string } {
  const sbRaiseTo = 2 * BB; // 40
  const bbJamTo = STACK_BB * BB; // 500
  const me = mkPlayer({ id: 'ME', position: 'SB', cards: myCards, stack: STACK_BB * BB - sbRaiseTo, currentBet: sbRaiseTo });
  const opp = mkPlayer({ id: 'OPP', position: 'BB', stack: 0, currentBet: bbJamTo });
  return {
    meId: 'ME',
    state: {
      players: [me, opp],
      board: [],
      pot: sbRaiseTo + bbJamTo,
      street: 'preflop',
      currentBet: bbJamTo,
      minRaise: BB,
      toActId: 'ME',
      bigBlind: BB,
      smallBlind: SB,
      history: [
        { playerId: 'ME', action: 'raise', amount: sbRaiseTo, street: 'preflop' },
        { playerId: 'OPP', action: 'raise', amount: bbJamTo, street: 'preflop' },
      ],
    },
  };
}

function countFolds(maker: (cards: [string, string]) => { state: GameState; meId: string },
                   cards: [string, string], iters: number): number {
  let folds = 0;
  for (let i = 0; i < iters; i++) {
    const { state, meId } = maker(cards);
    const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
    if (out?.action === 'fold') folds++;
  }
  return folds;
}

describe('Premium hands — hard-zero fold guarantee', () => {
  const ITERS = 10_000;

  it('(1) AA never folds at SB_FIRST_IN_25BB over 10k samples', () => {
    expect(countFolds(makeSbFirstIn, ['As', 'Ah'], ITERS)).toBe(0);
  });
  it('(1) KK never folds at SB_FIRST_IN_25BB over 10k samples', () => {
    expect(countFolds(makeSbFirstIn, ['Ks', 'Kh'], ITERS)).toBe(0);
  });
  it('(1) QQ never folds at SB_FIRST_IN_25BB over 10k samples', () => {
    expect(countFolds(makeSbFirstIn, ['Qs', 'Qh'], ITERS)).toBe(0);
  });
  it('(1) AKs never folds at SB_FIRST_IN_25BB over 10k samples', () => {
    expect(countFolds(makeSbFirstIn, ['As', 'Ks'], ITERS)).toBe(0);
  });

  it('(2) AA never folds at BB_VS_SB_OPEN_2BB_25BB over 10k samples', () => {
    expect(countFolds(makeBbVsSbOpen, ['As', 'Ah'], ITERS)).toBe(0);
  });
  it('(2) KK never folds at BB_VS_SB_OPEN_2BB_25BB over 10k samples', () => {
    expect(countFolds(makeBbVsSbOpen, ['Ks', 'Kh'], ITERS)).toBe(0);
  });

  it('(3) AA never folds at SB_VS_BB_JAM_AFTER_OPEN_2BB; result is always call', () => {
    let folds = 0;
    let calls = 0;
    const iters = ITERS;
    for (let i = 0; i < iters; i++) {
      const { state, meId } = makeSbVsJamAfterOpen(['As', 'Ah']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (out?.action === 'fold') folds++;
      if (out?.action === 'call') calls++;
    }
    expect(folds).toBe(0);
    // Node baseline only has call+fold; with fold zeroed, call must absorb 100%
    expect(calls).toBe(iters);
  });

  it('(4) premium fold stays 0 through persona × normalize pipeline (unit)', () => {
    // Worst case: a persona that boosts fold heavily — TIGHT-style.
    const base: ActionFrequencies = { fold: 30, call: 20, raise_2: 25, all_in_25: 25 };
    const heavyFoldMod = { fold: 5.0, call: 0.2, raise_2: 0.2, all_in_25: 0.2 };
    const afterPersona = applyPersonaModifier(base, heavyFoldMod);
    const afterClass = applyHandClassCorrection(afterPersona, 'premium');
    const normalized = normalizeFrequencies(afterClass);
    expect(normalized.fold).toBe(0);
    // remaining mass must sum to 100
    const sum = Object.values(normalized).reduce((s, v) => s + (v ?? 0), 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('(4b) premium fold stays 0 even if every persona modifier multiplies fold massively', () => {
    const base: ActionFrequencies = { fold: 80, raise_2: 20 };
    const afterPersona = applyPersonaModifier(base, { fold: 10.0 });
    const afterClass = applyHandClassCorrection(afterPersona, 'premium');
    const normalized = normalizeFrequencies(afterClass);
    expect(normalized.fold).toBe(0);
    expect(normalized.raise_2).toBeCloseTo(100, 6);
  });

  it('(5) AA never folds at SB_FIRST_IN_25BB even with maximally hostile persona state', () => {
    // Externally seed a maximally-stressed state into the engine via the
    // public `personaState` param to verify hand-class hard zero survives
    // through the state-modifier stage.
    const extremeState = {
      aggression: 0, callDown: 0, riskTolerance: 0,
      trapTendency: 0, tiltLevel: 1, confidence: 0,
    };
    let folds = 0;
    const iters = 10_000;
    for (let i = 0; i < iters; i++) {
      const { state, meId } = makeSbFirstIn(['As', 'Ah']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random, extremeState);
      if (out?.action === 'fold') folds++;
    }
    expect(folds).toBe(0);
  });

  it('(5b) KK never folds at BB_VS_SB_OPEN with tilted+callDown state pushing fold up', () => {
    const extremeState = {
      aggression: 0, callDown: 0, riskTolerance: 0,
      trapTendency: 0, tiltLevel: 1, confidence: 0,
    };
    let folds = 0;
    const iters = 10_000;
    for (let i = 0; i < iters; i++) {
      const { state, meId } = makeBbVsSbOpen(['Ks', 'Kh']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random, extremeState);
      if (out?.action === 'fold') folds++;
    }
    expect(folds).toBe(0);
  });
});
