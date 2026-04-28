import { describe, it, expect } from 'vitest';
import {
  ALL_RANKS,
  ALL_SUITS,
  cardToString,
  compareCards,
  stringToCard,
  type Card,
} from '../card';

describe('cardToString / stringToCard', () => {
  it('round-trips all 52 cards', () => {
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        const card: Card = { suit, rank };
        const str = cardToString(card);
        expect(stringToCard(str)).toEqual(card);
      }
    }
  });

  it('formats face cards with T/J/Q/K/A', () => {
    expect(cardToString({ suit: 's', rank: 10 })).toBe('Ts');
    expect(cardToString({ suit: 'h', rank: 11 })).toBe('Jh');
    expect(cardToString({ suit: 'd', rank: 12 })).toBe('Qd');
    expect(cardToString({ suit: 'c', rank: 13 })).toBe('Kc');
    expect(cardToString({ suit: 's', rank: 14 })).toBe('As');
  });

  it('parses case-insensitively', () => {
    expect(stringToCard('as')).toEqual({ suit: 's', rank: 14 });
    expect(stringToCard('AS')).toEqual({ suit: 's', rank: 14 });
    expect(stringToCard('tH')).toEqual({ suit: 'h', rank: 10 });
  });

  it('rejects invalid strings', () => {
    expect(() => stringToCard('')).toThrow();
    expect(() => stringToCard('A')).toThrow();
    expect(() => stringToCard('Ass')).toThrow();
    expect(() => stringToCard('1s')).toThrow();
    expect(() => stringToCard('Ax')).toThrow();
    expect(() => stringToCard('Zh')).toThrow();
  });
});

describe('compareCards', () => {
  it('returns negative when a < b, positive when a > b, zero when equal', () => {
    expect(compareCards({ suit: 's', rank: 2 }, { suit: 'h', rank: 5 })).toBeLessThan(0);
    expect(compareCards({ suit: 's', rank: 14 }, { suit: 'h', rank: 13 })).toBeGreaterThan(0);
    expect(compareCards({ suit: 's', rank: 9 }, { suit: 'h', rank: 9 })).toBe(0);
  });
});
