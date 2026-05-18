import { describe, expect, it } from 'vitest';
import {
  applyHandClassCorrection,
  applyPersonaModifier,
  normalizeFrequencies,
  sampleWeightedAction,
} from '../frequencyMath';
import type { ActionFrequencies } from '../types';

describe('applyPersonaModifier', () => {
  it('preserves zero-baseline actions (does not invent new actions)', () => {
    const base: ActionFrequencies = { raise_2: 0, fold: 50, call: 50 };
    const out = applyPersonaModifier(base, { raise_2: 1.5 });
    expect(out.raise_2).toBe(0);
  });

  it('applies global multipliers', () => {
    const base: ActionFrequencies = { fold: 20, call: 60, raise_2: 20 };
    const out = applyPersonaModifier(base, { fold: 0.5, raise_2: 1.5 });
    expect(out.fold).toBe(10);
    expect(out.call).toBe(60);
    expect(out.raise_2).toBe(30);
  });

  it('stacks node-specific multipliers on top of global', () => {
    const base: ActionFrequencies = { limp: 50, raise_2: 50 };
    const out = applyPersonaModifier(base, { limp: 1.2 }, { limp: 1.25 });
    expect(out.limp).toBeCloseTo(50 * 1.2 * 1.25, 6);
  });
});

describe('normalizeFrequencies', () => {
  it('scales to sum 100', () => {
    const out = normalizeFrequencies({ fold: 20, call: 30, raise_2: 50 });
    const sum = Object.values(out).reduce((s, v) => s + (v ?? 0), 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('returns unchanged when total <= 0', () => {
    const out = normalizeFrequencies({ fold: 0, call: 0 });
    expect(out).toEqual({ fold: 0, call: 0 });
  });
});

describe('applyHandClassCorrection', () => {
  it('forbids fold for premium hands', () => {
    const base: ActionFrequencies = { fold: 30, call: 30, raise_2: 40 };
    const out = applyHandClassCorrection(base, 'premium');
    expect(out.fold).toBe(0);
  });

  it('reduces all_in_25 for trash hands', () => {
    const base: ActionFrequencies = { fold: 60, all_in_25: 10, call: 30 };
    const out = applyHandClassCorrection(base, 'trash');
    // Trash receives all_in_25 ×0.15 reduce, then the absolute aggression cap
    // may further scale it down. After 0.15 reduce: 1.5. Total = 60*1.4 + 1.5 + 30 = 115.5
    // Aggressive mass = 1.5 → 1.3% of total, well under the 4% cap → cap inactive.
    expect(out.all_in_25).toBeCloseTo(10 * 0.15, 6);
    expect(out.fold).toBeCloseTo(60 * 1.4, 6);
  });

  it('zero-baseline stays zero even when class boosts that action', () => {
    const base: ActionFrequencies = { raise_2: 0, fold: 50, call: 50 };
    const out = applyHandClassCorrection(base, 'premium');
    expect(out.raise_2).toBe(0);
  });
});

describe('sampleWeightedAction', () => {
  function seededRng(seq: number[]): () => number {
    let i = 0;
    return () => seq[i++ % seq.length];
  }

  it('picks first action when roll falls in its window', () => {
    const out = sampleWeightedAction({ fold: 50, call: 50 }, seededRng([0.1]));
    expect(out).toBe('fold');
  });

  it('picks second action when roll past first window', () => {
    const out = sampleWeightedAction({ fold: 50, call: 50 }, seededRng([0.6]));
    expect(out).toBe('call');
  });

  it('1000-iteration sample matches expected distribution within ±3%', () => {
    let counts = { fold: 0, call: 0 };
    const total = 5000;
    for (let i = 0; i < total; i++) {
      const r = sampleWeightedAction({ fold: 20, call: 80 }, Math.random);
      counts[r === 'fold' ? 'fold' : 'call']++;
    }
    expect(counts.fold / total).toBeGreaterThan(0.17);
    expect(counts.fold / total).toBeLessThan(0.23);
  });
});
