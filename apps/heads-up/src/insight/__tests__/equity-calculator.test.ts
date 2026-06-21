import { describe, expect, it } from 'vitest';
import { stringToCard } from '../../engine/card';
import {
  buildPercentileRange,
  equityVsPercentile,
  getRankedHandKeys,
  inferOpponentRange,
  potOddsRequired,
} from '../equity-calculator';

describe('equity-calculator — ranking', () => {
  it('produces all 169 canonical keys in descending strength', () => {
    const order = getRankedHandKeys();
    expect(order.length).toBe(169);
    expect(new Set(order).size).toBe(169);
    // AA should be at/near the top, 72o near the bottom.
    const aaIdx = order.indexOf('AA');
    const trashIdx = order.indexOf('72o');
    expect(aaIdx).toBeLessThan(trashIdx);
    expect(aaIdx).toBeLessThan(10);
    expect(trashIdx).toBeGreaterThan(100);
  });
});

describe('equity-calculator — inferOpponentRange', () => {
  it('no action → any hand', () => {
    const r = inferOpponentRange([]);
    expect(r.percentile).toBe(1);
  });

  it('single raise → top 15%', () => {
    const r = inferOpponentRange([{ action: 'raise', street: 'preflop' }]);
    expect(r.percentile).toBe(0.15);
  });

  it('two raises (4bet) → top 5%', () => {
    const r = inferOpponentRange([
      { action: 'raise', street: 'preflop' },
      { action: 'raise', street: 'preflop' },
    ]);
    expect(r.percentile).toBe(0.05);
  });

  it('only call → top 60%', () => {
    const r = inferOpponentRange([{ action: 'call', street: 'preflop' }]);
    expect(r.percentile).toBe(0.6);
  });

  it('postflop barrels narrow the range vs preflop-only (Bayesian update)', () => {
    const preflopOnly = inferOpponentRange([{ action: 'call', street: 'preflop' }]);
    const barreled = inferOpponentRange([
      { action: 'call', street: 'preflop' },
      { action: 'bet', street: 'flop' },
      { action: 'bet', street: 'turn' },
    ]);
    // Caller who fires flop + turn must be treated as a much stronger range.
    expect(barreled.percentile).toBeLessThan(preflopOnly.percentile);
    expect(barreled.percentile).toBeCloseTo(0.6 * 0.6 * 0.6, 5);
  });

  it('a passive postflop line (check/call) stays wider than a barreling line', () => {
    const passive = inferOpponentRange([
      { action: 'raise', street: 'preflop' },
      { action: 'check', street: 'flop' },
    ]);
    const aggressive = inferOpponentRange([
      { action: 'raise', street: 'preflop' },
      { action: 'bet', street: 'flop' },
    ]);
    expect(aggressive.percentile).toBeLessThan(passive.percentile);
    expect(passive.percentile).toBe(0.15); // check leaves the prior unchanged
  });
});

describe('equity-calculator — buildPercentileRange', () => {
  it('top 15% yields ~170-260 combos from full deck', () => {
    const range = buildPercentileRange(0.15, []);
    // Top 15% of 169 keys ≈ 25 canonical hands. Combo count ~150-260 depending
    // on pair/suited/offsuit mix.
    expect(range.length).toBeGreaterThan(100);
    expect(range.length).toBeLessThan(400);
  });

  it('top 5% yields premium-heavy range', () => {
    const range = buildPercentileRange(0.05, []);
    expect(range.length).toBeGreaterThan(30);
    expect(range.length).toBeLessThan(100);
  });

  it('excludes user cards', () => {
    const aceSpades = stringToCard('As');
    const aceHearts = stringToCard('Ah');
    const range = buildPercentileRange(1.0, [aceSpades, aceHearts]);
    // No combo in the range contains either excluded card.
    for (const [c1, c2] of range) {
      expect(`${c1.rank}${c1.suit}`).not.toBe('14s');
      expect(`${c1.rank}${c1.suit}`).not.toBe('14h');
      expect(`${c2.rank}${c2.suit}`).not.toBe('14s');
      expect(`${c2.rank}${c2.suit}`).not.toBe('14h');
    }
  });
});

describe('equity-calculator — equityVsPercentile', () => {
  it('AA vs top 5% range has meaningful equity (50-80%)', () => {
    const eq = equityVsPercentile(
      [stringToCard('As'), stringToCard('Ah')],
      [],
      0.05,
      { iterations: 1000 },
    );
    // AA vs KK/QQ/AK is 70-85%; vs a tighter range tends lower.
    expect(eq).toBeGreaterThan(0.5);
    expect(eq).toBeLessThan(0.95);
  });

  it('72o vs top 15% range has low equity (<30%)', () => {
    const eq = equityVsPercentile(
      [stringToCard('7s'), stringToCard('2h')],
      [],
      0.15,
      { iterations: 1000 },
    );
    expect(eq).toBeLessThan(0.35);
  });

  it('AA vs top 5% >= AA vs any hand (tighter range = lower equity)', () => {
    const myHand: [ReturnType<typeof stringToCard>, ReturnType<typeof stringToCard>] = [
      stringToCard('As'),
      stringToCard('Ah'),
    ];
    const tight = equityVsPercentile(myHand, [], 0.05, { iterations: 2000 });
    const loose = equityVsPercentile(myHand, [], 1.0, { iterations: 2000 });
    // AA crushes random > AA vs top 5% (because top 5% has KK/QQ which fare better).
    expect(loose).toBeGreaterThan(tight);
  });
});

describe('equity-calculator — potOddsRequired', () => {
  it('returns 0 when nothing to call', () => {
    expect(potOddsRequired(100, 0)).toBe(0);
  });
  it('pot 30, call 10 → 10/40 = 0.25', () => {
    expect(potOddsRequired(30, 10)).toBeCloseTo(0.25, 6);
  });
  it('pot 20, call 20 → 20/40 = 0.5', () => {
    expect(potOddsRequired(20, 20)).toBeCloseTo(0.5, 6);
  });
});
