import { describe, it, expect } from 'vitest';
import { Deck } from '../deck';
import type { Card } from '../card';
import { evaluate } from '../hand-evaluator';

function generateHands(count: number): Card[][] {
  const hands: Card[][] = [];
  for (let i = 0; i < count; i++) {
    const d = new Deck(i + 1);
    d.shuffle();
    const h: Card[] = [];
    for (let j = 0; j < 7; j++) h.push(d.deal());
    hands.push(h);
  }
  return hands;
}

describe('performance', () => {
  it('evaluate() averages < 0.5ms per call over 5000 random hands', () => {
    const hands = generateHands(5000);

    for (let i = 0; i < 500; i++) evaluate(hands[i % hands.length]);

    const start = performance.now();
    for (const h of hands) evaluate(h);
    const elapsed = performance.now() - start;
    const perCall = elapsed / hands.length;

    console.log(
      `evaluate: ${perCall.toFixed(4)}ms/call ` +
        `(${hands.length} hands in ${elapsed.toFixed(1)}ms)`,
    );
    expect(perCall).toBeLessThan(0.5);
  });
});
