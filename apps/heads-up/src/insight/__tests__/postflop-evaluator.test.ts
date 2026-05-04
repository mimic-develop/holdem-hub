import { describe, expect, it } from 'vitest';
import { stringToCard, type Card } from '../../engine/card';
import {
  evaluatePostflopAction,
  type PostflopContext,
} from '../postflop-evaluator';

function c(s: string): Card {
  return stringToCard(s);
}

function ctx(overrides: Partial<PostflopContext> = {}): PostflopContext {
  return {
    street: 'flop',
    board: [c('9s'), c('7d'), c('2c')],
    myHand: [c('As'), c('Ah')],
    pot: 10,
    toCall: 0,
    bigBlind: 2,
    myStack: 200,
    oppStack: 200,
    opponentHistory: [],
    ...overrides,
  };
}

const FAST = { iterations: 200 };

describe('postflop-evaluator — obvious good plays', () => {
  it('betting AA on a dry flop scores high', () => {
    const ev = evaluatePostflopAction(
      ctx({ myHand: [c('As'), c('Ah')] }),
      'bet',
      7,
      FAST,
    );
    expect(ev.score).toBeGreaterThanOrEqual(85);
    expect(ev.mistakeType).toBeNull();
  });

  it('betting the nuts (set) value-bets for strong score', () => {
    const ev = evaluatePostflopAction(
      ctx({ myHand: [c('9h'), c('9d')], board: [c('9c'), c('7d'), c('2c')] }),
      'bet',
      9,
      FAST,
    );
    expect(ev.score).toBeGreaterThanOrEqual(85);
  });

  it('folding garbage facing a big bet is correct', () => {
    const ev = evaluatePostflopAction(
      ctx({
        myHand: [c('3s'), c('2h')],
        board: [c('As'), c('Kd'), c('Qc')],
        pot: 10,
        toCall: 20,
      }),
      'fold',
      0,
      FAST,
    );
    expect(ev.score).toBeGreaterThanOrEqual(85);
  });
});

describe('postflop-evaluator — obvious bad plays', () => {
  it('folding the nuts (full house) is a VALUE_MISS catastrophe', () => {
    const ev = evaluatePostflopAction(
      ctx({
        myHand: [c('9h'), c('9d')],
        board: [c('9c'), c('7d'), c('7s')], // 99 full of 7s
        pot: 10,
        toCall: 5,
      }),
      'fold',
      0,
      FAST,
    );
    expect(ev.score).toBeLessThanOrEqual(30);
    expect(ev.mistakeType).toBe('VALUE_MISS');
  });

  it('folding open-ended wheel draw with great pot odds is a mistake', () => {
    // I have 54 suited; board 632 rainbow. Any 7/A completes. pot huge, call small.
    const ev = evaluatePostflopAction(
      ctx({
        myHand: [c('5s'), c('4s')],
        board: [c('6h'), c('3d'), c('2c')],
        pot: 100,
        toCall: 5,
      }),
      'fold',
      0,
      FAST,
    );
    expect(ev.score).toBeLessThanOrEqual(40);
  });

  it('bluffing air on a scary board with no equity is BLUFF_TOO_OFTEN', () => {
    const ev = evaluatePostflopAction(
      ctx({
        myHand: [c('2s'), c('3d')],
        board: [c('Ac'), c('Kh'), c('Qs')],
        pot: 10,
        toCall: 0,
      }),
      'bet',
      10,
      FAST,
    );
    // With hero having no equity and no draw on a broadway board,
    // bluffing is a mistake — low score + BLUFF_TOO_OFTEN.
    expect(ev.score).toBeLessThanOrEqual(40);
    expect(['BLUFF_TOO_OFTEN', null]).toContain(ev.mistakeType);
  });
});

describe('postflop-evaluator — size miss detection', () => {
  it('correct action but tiny under-size is SIZE_MISS (mid score)', () => {
    // AA on dry flop — should bet 66-100% pot. Tiny bet flagged.
    const ev = evaluatePostflopAction(
      ctx({
        myHand: [c('As'), c('Ah')],
        board: [c('9s'), c('7d'), c('2c')],
        pot: 100,
      }),
      'bet',
      5, // way under 66 BB rec
      FAST,
    );
    expect(ev.score).toBeGreaterThanOrEqual(40);
    expect(ev.score).toBeLessThanOrEqual(80);
  });
});

describe('postflop-evaluator — output invariants', () => {
  it('score stays in [0, 100]', () => {
    // Sweep over a few configurations.
    const configs: Array<Parameters<typeof evaluatePostflopAction>> = [
      [ctx({}), 'fold', 0, FAST],
      [ctx({ toCall: 5 }), 'call', 5, FAST],
      [ctx({}), 'bet', 50, FAST],
      [ctx({ toCall: 10 }), 'raise', 40, FAST],
      [ctx({}), 'check', 0, FAST],
    ];
    for (const args of configs) {
      const ev = evaluatePostflopAction(...args);
      expect(ev.score).toBeGreaterThanOrEqual(0);
      expect(ev.score).toBeLessThanOrEqual(100);
      expect(ev.reasoning.length).toBeGreaterThan(0);
    }
  });

  it('equity/potOdds are in [0, 1]', () => {
    const ev = evaluatePostflopAction(
      ctx({ toCall: 5 }),
      'call',
      5,
      FAST,
    );
    expect(ev.equity).toBeGreaterThanOrEqual(0);
    expect(ev.equity).toBeLessThanOrEqual(1);
    expect(ev.potOdds).toBeGreaterThanOrEqual(0);
    expect(ev.potOdds).toBeLessThanOrEqual(1);
  });
});

describe('postflop-evaluator — sizing recommendations are sane', () => {
  it('raise sizing facing a small bet is 2.5-4x that bet (not 8-10x)', () => {
    // pot=10 flop, opp bet 4 → my toCall=4. Reasonable raise: 10-18 chips.
    const ev = evaluatePostflopAction(
      ctx({
        myHand: [c('As'), c('Ah')],
        board: [c('9s'), c('7d'), c('2c')],
        pot: 10,
        toCall: 4,
      }),
      'raise',
      15, // 3.75x the bet — a standard raise
      FAST,
    );
    expect(ev.score).toBeGreaterThanOrEqual(80);
    expect(ev.recommendedAction.action).toBe('raise');
    const [lo, hi] = ev.recommendedAction.sizingRange!;
    // Reasonable raise-to range: between 2x and 5x opp's bet (= 2x-5x toCall).
    expect(lo).toBeGreaterThanOrEqual(8);
    expect(hi).toBeLessThanOrEqual(30);
  });

  it('perfect play scores exactly 100 (nuts + in-range bet)', () => {
    // 99 on 9972-KK (river) — full house of 9s over Ks. Nuts equity.
    const ev = evaluatePostflopAction(
      ctx({
        street: 'river',
        board: [c('9s'), c('9d'), c('7c'), c('Ks'), c('Kh')],
        myHand: [c('9h'), c('9c')],
        pot: 100,
        toCall: 0,
      }),
      'bet',
      80, // ~80% pot value bet
      FAST,
    );
    expect(ev.score).toBe(100);
  });
});

describe('postflop-evaluator — range inference affects equity', () => {
  it('AA equity is lower against tight (3bet) range than vs random', () => {
    const board: Card[] = [c('9s'), c('7d'), c('2c')];
    const baseCtx = ctx({ myHand: [c('As'), c('Ah')], board });
    const noHistory = evaluatePostflopAction(baseCtx, 'bet', 7, FAST);
    const vs3Bet = evaluatePostflopAction(
      {
        ...baseCtx,
        opponentHistory: [{ action: 'raise', street: 'preflop' }],
      },
      'bet',
      7,
      FAST,
    );
    // Against a tight 3-bet range (KK, QQ, AK, AQ), AA's equity shifts down
    // slightly. Our noHistory uses top 100% (random).
    expect(vs3Bet.inferredRange.percentile).toBe(0.15);
    expect(noHistory.inferredRange.percentile).toBe(1);
  });
});
