import { describe, it, expect } from 'vitest';
import { Deck } from '../deck';
import { cardToString } from '../card';

describe('Deck', () => {
  it('starts with 52 unique cards', () => {
    const d = new Deck();
    expect(d.remaining()).toBe(52);
    const seen = new Set<string>();
    for (const c of d.snapshot()) seen.add(cardToString(c));
    expect(seen.size).toBe(52);
  });

  it('deal() removes one card and decreases remaining', () => {
    const d = new Deck(1);
    d.shuffle();
    const before = d.remaining();
    const c = d.deal();
    expect(c).toBeDefined();
    expect(d.remaining()).toBe(before - 1);
  });

  it('deal() never repeats cards through the whole deck', () => {
    const d = new Deck(7);
    d.shuffle();
    const seen = new Set<string>();
    while (d.remaining() > 0) {
      const c = d.deal();
      const str = cardToString(c);
      expect(seen.has(str)).toBe(false);
      seen.add(str);
    }
    expect(seen.size).toBe(52);
  });

  it('deal() throws when empty', () => {
    const d = new Deck(2);
    while (d.remaining() > 0) d.deal();
    expect(() => d.deal()).toThrow();
  });

  it('same seed produces identical shuffle (determinism)', () => {
    const a = new Deck(12345);
    const b = new Deck(12345);
    a.shuffle();
    b.shuffle();
    expect(a.snapshot().map(cardToString)).toEqual(b.snapshot().map(cardToString));
  });

  it('different seeds produce different shuffles', () => {
    const a = new Deck(1);
    const b = new Deck(2);
    a.shuffle();
    b.shuffle();
    expect(a.snapshot().map(cardToString)).not.toEqual(b.snapshot().map(cardToString));
  });

  it('snapshot returns an independent copy', () => {
    const d = new Deck(3);
    const snap = d.snapshot();
    snap.pop();
    expect(d.remaining()).toBe(52);
  });

  it('shuffle without seed still produces a valid 52-card permutation', () => {
    const d = new Deck();
    d.shuffle();
    const seen = new Set<string>();
    for (const c of d.snapshot()) seen.add(cardToString(c));
    expect(seen.size).toBe(52);
  });
});
