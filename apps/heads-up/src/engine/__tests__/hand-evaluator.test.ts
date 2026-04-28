import { describe, it, expect } from 'vitest';
import { stringToCard, type Card } from '../card';
import { compareHands, evaluate, HandRank } from '../hand-evaluator';

function hand(...codes: string[]): Card[] {
  return codes.map(stringToCard);
}

describe('evaluate — per-rank classification', () => {
  it('HIGH_CARD #1', () => {
    const h = evaluate(hand('As', 'Kd', '9h', '7c', '5s', '3d', '2h'));
    expect(h.rank).toBe(HandRank.HIGH_CARD);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 13, 9, 7, 5]);
  });

  it('HIGH_CARD #2', () => {
    const h = evaluate(hand('Kc', 'Jh', '8d', '6s', '4c', '3h', '2d'));
    expect(h.rank).toBe(HandRank.HIGH_CARD);
    expect(h.kickers.map((c) => c.rank)).toEqual([13, 11, 8, 6, 4]);
  });

  it('PAIR #1', () => {
    const h = evaluate(hand('9s', '9d', 'Ah', 'Kc', 'Qs', '5h', '3d'));
    expect(h.rank).toBe(HandRank.PAIR);
    expect(h.kickers.map((c) => c.rank)).toEqual([9, 9, 14, 13, 12]);
  });

  it('PAIR #2 (low pair with high kickers)', () => {
    const h = evaluate(hand('2s', '2d', 'Ah', 'Kc', 'Qs', 'Jh', '9d'));
    expect(h.rank).toBe(HandRank.PAIR);
    expect(h.kickers.map((c) => c.rank)).toEqual([2, 2, 14, 13, 12]);
  });

  it('TWO_PAIR #1', () => {
    const h = evaluate(hand('Ah', 'Ad', 'Ks', 'Kd', '9h', '5c', '2s'));
    expect(h.rank).toBe(HandRank.TWO_PAIR);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 14, 13, 13, 9]);
  });

  it('TWO_PAIR #2 — picks top 2 from 3 pairs', () => {
    const h = evaluate(hand('Ah', 'Ad', 'Ks', 'Kd', 'Qh', 'Qc', '2s'));
    expect(h.rank).toBe(HandRank.TWO_PAIR);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 14, 13, 13, 12]);
  });

  it('THREE_OF_A_KIND #1', () => {
    const h = evaluate(hand('9h', '9d', '9c', 'Ah', 'Ks', '5d', '2c'));
    expect(h.rank).toBe(HandRank.THREE_OF_A_KIND);
    expect(h.kickers.map((c) => c.rank)).toEqual([9, 9, 9, 14, 13]);
  });

  it('THREE_OF_A_KIND #2', () => {
    const h = evaluate(hand('7h', '7d', '7s', 'Jh', 'Tc', '4d', '2c'));
    expect(h.rank).toBe(HandRank.THREE_OF_A_KIND);
    expect(h.kickers.map((c) => c.rank)).toEqual([7, 7, 7, 11, 10]);
  });

  it('STRAIGHT #1 — 6-high', () => {
    const h = evaluate(hand('6h', '5d', '4c', '3s', '2h', 'Ah', 'Kc'));
    expect(h.rank).toBe(HandRank.STRAIGHT);
    expect(h.kickers.map((c) => c.rank)).toEqual([6, 5, 4, 3, 2]);
  });

  it('STRAIGHT #2 — wheel A-2-3-4-5', () => {
    const h = evaluate(hand('As', '2d', '3c', '4h', '5s', 'Kd', 'Qc'));
    expect(h.rank).toBe(HandRank.STRAIGHT);
    expect(h.kickers.map((c) => c.rank)).toEqual([5, 4, 3, 2, 14]);
  });

  it('STRAIGHT #3 — Broadway (A-K-Q-J-T, mixed suits)', () => {
    const h = evaluate(hand('As', 'Kh', 'Qd', 'Jc', 'Ts', '5d', '2c'));
    expect(h.rank).toBe(HandRank.STRAIGHT);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 13, 12, 11, 10]);
  });

  it('FLUSH #1 — picks top 5 of flush suit', () => {
    const h = evaluate(hand('Ah', 'Kh', 'Qh', 'Jh', '9h', '5h', '2c'));
    expect(h.rank).toBe(HandRank.FLUSH);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 13, 12, 11, 9]);
    expect(h.kickers.every((c) => c.suit === 'h')).toBe(true);
  });

  it('FLUSH #2 — flush beats separate straight', () => {
    const h = evaluate(hand('2h', '3h', '4h', '5h', '7h', 'Ac', 'Kc'));
    expect(h.rank).toBe(HandRank.FLUSH);
    expect(h.kickers.every((c) => c.suit === 'h')).toBe(true);
  });

  it('FULL_HOUSE #1', () => {
    const h = evaluate(hand('9s', '9d', '9h', 'Ks', 'Kh', 'Qc', '2d'));
    expect(h.rank).toBe(HandRank.FULL_HOUSE);
    expect(h.kickers.map((c) => c.rank)).toEqual([9, 9, 9, 13, 13]);
  });

  it('FULL_HOUSE #2 — two trips → trips + pair (lower trip becomes pair)', () => {
    const h = evaluate(hand('As', 'Ad', 'Ah', 'Ks', 'Kh', 'Kc', '2d'));
    expect(h.rank).toBe(HandRank.FULL_HOUSE);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 14, 14, 13, 13]);
  });

  it('FULL_HOUSE #3 — trips + 2 pairs → uses higher pair', () => {
    const h = evaluate(hand('7s', '7d', '7h', 'Ks', 'Kh', 'Qc', 'Qd'));
    expect(h.rank).toBe(HandRank.FULL_HOUSE);
    expect(h.kickers.map((c) => c.rank)).toEqual([7, 7, 7, 13, 13]);
  });

  it('FOUR_OF_A_KIND #1', () => {
    const h = evaluate(hand('7s', '7d', '7h', '7c', 'Ks', 'Qh', '2d'));
    expect(h.rank).toBe(HandRank.FOUR_OF_A_KIND);
    expect(h.kickers.map((c) => c.rank)).toEqual([7, 7, 7, 7, 13]);
  });

  it('FOUR_OF_A_KIND #2', () => {
    const h = evaluate(hand('As', 'Ad', 'Ah', 'Ac', '2s', '3h', '4d'));
    expect(h.rank).toBe(HandRank.FOUR_OF_A_KIND);
    expect(h.kickers.map((c) => c.rank)).toEqual([14, 14, 14, 14, 4]);
  });

  it('STRAIGHT_FLUSH #1 — 9-high', () => {
    const h = evaluate(hand('9h', '8h', '7h', '6h', '5h', 'Ac', 'Kd'));
    expect(h.rank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(h.kickers.map((c) => c.rank)).toEqual([9, 8, 7, 6, 5]);
    expect(h.kickers.every((c) => c.suit === 'h')).toBe(true);
  });

  it('STRAIGHT_FLUSH #2 — wheel of same suit (5-high SF, not royal)', () => {
    const h = evaluate(hand('Ac', '2c', '3c', '4c', '5c', 'Kh', 'Qs'));
    expect(h.rank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(h.kickers.map((c) => c.rank)).toEqual([5, 4, 3, 2, 14]);
  });

  it('ROYAL_FLUSH #1', () => {
    const h = evaluate(hand('Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d'));
    expect(h.rank).toBe(HandRank.ROYAL_FLUSH);
  });

  it('ROYAL_FLUSH #2 — ignores non-suit broadway cards', () => {
    const h = evaluate(hand('As', 'Ks', 'Qs', 'Js', 'Ts', 'Ah', 'Kh'));
    expect(h.rank).toBe(HandRank.ROYAL_FLUSH);
    expect(h.kickers.every((c) => c.suit === 's')).toBe(true);
  });
});

describe('compareHands — kicker tiebreakers', () => {
  it('higher pair beats lower pair', () => {
    const a = evaluate(hand('Ah', 'Ad', '9s', '7c', '5d', '3h', '2c'));
    const b = evaluate(hand('Kh', 'Kd', 'Qs', 'Jc', '8d', '5h', '2c'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('same pair — higher kicker wins', () => {
    const a = evaluate(hand('9s', '9d', 'Ah', 'Kc', 'Js', '3h', '2d'));
    const b = evaluate(hand('9c', '9h', 'Ad', 'Kh', 'Tc', '3s', '2h'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('same two pair — higher single kicker wins', () => {
    const a = evaluate(hand('Ah', 'Ad', 'Ks', 'Kh', 'Qc', '2s', '3d'));
    const b = evaluate(hand('As', 'Ac', 'Kd', 'Kc', 'Jh', '2d', '3h'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('wheel straight loses to 6-high straight', () => {
    const wheel = evaluate(hand('As', '2d', '3c', '4h', '5s', 'Kd', 'Qc'));
    const six = evaluate(hand('6h', '5d', '4c', '3s', '2h', 'Kd', 'Qc'));
    expect(compareHands(wheel, six)).toBeLessThan(0);
  });

  it('royal flush beats king-high straight flush', () => {
    const royal = evaluate(hand('Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d'));
    const sf = evaluate(hand('Kh', 'Qh', 'Jh', 'Th', '9h', '2c', '3d'));
    expect(royal.rank).toBe(HandRank.ROYAL_FLUSH);
    expect(sf.rank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(compareHands(royal, sf)).toBeGreaterThan(0);
  });

  it('flush tiebreak by highest card in flush', () => {
    const a = evaluate(hand('Ah', '9h', '7h', '5h', '3h', '2c', 'Kd'));
    const b = evaluate(hand('Kh', 'Qh', 'Jh', '9h', '2h', '3c', '4d'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it('higher full house wins (trips rank dominates)', () => {
    const a = evaluate(hand('9s', '9d', '9h', '2s', '2h', '7c', '3d'));
    const b = evaluate(hand('8s', '8d', '8h', 'As', 'Ah', '7c', '3d'));
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });
});

describe('best 5 from 7 — selection correctness', () => {
  it('trips + pair → full house (not just trips)', () => {
    const h = evaluate(hand('9s', '9d', '9h', 'Ks', 'Kh', 'Qc', '2d'));
    expect(h.rank).toBe(HandRank.FULL_HOUSE);
  });

  it('4 of same suit + straight (non-flush) → straight, not flush', () => {
    const h = evaluate(hand('7h', '8h', '9h', 'Th', 'Jc', '2s', '3d'));
    expect(h.rank).toBe(HandRank.STRAIGHT);
  });

  it('6 of same suit → picks top 5 of suit for flush', () => {
    const h = evaluate(hand('2h', '4h', '6h', '8h', 'Th', 'Qh', 'Ks'));
    expect(h.rank).toBe(HandRank.FLUSH);
    expect(h.kickers.map((c) => c.rank)).toEqual([12, 10, 8, 6, 4]);
  });

  it('7 cards with both a straight and a flush (different suits) → flush wins', () => {
    const h = evaluate(hand('2h', '3h', '5h', '7h', '9h', '4c', '6s'));
    expect(h.rank).toBe(HandRank.FLUSH);
  });

  it('quads + pair → quads, not full house', () => {
    const h = evaluate(hand('As', 'Ad', 'Ah', 'Ac', 'Ks', 'Kh', '2d'));
    expect(h.rank).toBe(HandRank.FOUR_OF_A_KIND);
  });
});

describe('ties', () => {
  it('two identical 7-card high-card hands → tied score', () => {
    const a = evaluate(hand('As', 'Kd', '9h', '7c', '5s', '3d', '2h'));
    const b = evaluate(hand('Ac', 'Kh', '9d', '7s', '5c', '3h', '2d'));
    expect(compareHands(a, b)).toBe(0);
  });

  it('two straights sharing same top rank → tied', () => {
    const a = evaluate(hand('9s', '8d', '7c', '6h', '5s', '2d', '3c'));
    const b = evaluate(hand('9c', '8h', '7d', '6s', '5c', '2h', '4s'));
    expect(compareHands(a, b)).toBe(0);
  });

  it('two full houses with same trips+pair → tied', () => {
    const a = evaluate(hand('9s', '9d', '9h', 'Ks', 'Kh', '2c', '3d'));
    const b = evaluate(hand('9c', '9h', '9d', 'Kd', 'Kc', '2s', '4h'));
    expect(compareHands(a, b)).toBe(0);
  });
});
