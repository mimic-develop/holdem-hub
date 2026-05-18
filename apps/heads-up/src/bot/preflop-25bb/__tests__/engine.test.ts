import { describe, expect, it } from 'vitest';
import { buildState } from '../../__tests__/state-helpers';
import { decide25bbPreflop } from '../engine';

/**
 * Engine-level tests. We don't probe baseline distribution exactly (that's
 * covered in frequencyMath unit tests). These tests verify:
 *   1. preflop/25bb gates: non-preflop & non-25bb stacks return null.
 *   2. Hand-class correction keeps premium hands from folding.
 *   3. Trash hands fold most of the time at SB_FIRST_IN.
 *   4. SB_FIRST_IN node samples spread across limp / raise_2 / fold.
 */

function build25bbState(opts: { myCards: [string, string]; myPosition?: 'SB' | 'BB' }) {
  return buildState({
    myCards: opts.myCards,
    myPosition: opts.myPosition ?? 'SB',
    bigBlind: 20,
    smallBlind: 10,
    myStack: 490, // 500 - 10 (sb posted)
    oppStack: 480, // 500 - 20 (bb posted)
  });
}

function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('decide25bbPreflop — gates', () => {
  it('returns null when not preflop', () => {
    const { state, meId } = buildState({
      myCards: ['As', 'Kh'],
      street: 'flop',
      bigBlind: 20,
      smallBlind: 10,
      myStack: 480,
      oppStack: 480,
    });
    expect(decide25bbPreflop(state, meId, 'STANDARD', Math.random)).toBeNull();
  });

  it('returns null when effective stack is ~100bb (not 25bb)', () => {
    const { state, meId } = buildState({
      myCards: ['As', 'Kh'],
      bigBlind: 2,
      smallBlind: 1,
      myStack: 199, // 200 - 1
      oppStack: 198,
    });
    expect(decide25bbPreflop(state, meId, 'STANDARD', Math.random)).toBeNull();
  });
});

describe('decide25bbPreflop — hand-class correction', () => {
  it('premium AA never folds at SB_FIRST_IN_25BB', () => {
    let folds = 0;
    const iters = 500;
    for (let i = 0; i < iters; i++) {
      const { state, meId } = build25bbState({ myCards: ['As', 'Ah'] });
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (out?.action === 'fold') folds++;
    }
    expect(folds).toBe(0);
  });

  it('trash 72o folds more than baseline', () => {
    let folds = 0;
    const iters = 2000;
    for (let i = 0; i < iters; i++) {
      const { state, meId } = build25bbState({ myCards: ['7s', '2h'] });
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (out?.action === 'fold') folds++;
    }
    // baseline fold ~5.7%; trash boost ×1.3 → normalized ~7.3%. With 2000 samples
    // variance keeps this safely above 5.8%.
    expect(folds / iters).toBeGreaterThan(0.058);
  });
});

describe('decide25bbPreflop — SB_FIRST_IN_25BB samples', () => {
  it('produces a mix of limp / raise / fold across 1000 samples', () => {
    const counts: Record<string, number> = {};
    const iters = 1000;
    for (let i = 0; i < iters; i++) {
      const { state, meId } = build25bbState({ myCards: ['Td', '9d'] });
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (!out) continue;
      const key = `${out.action}:${out.amount}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // T9s is 'playable'; modifier rule boosts limp slightly. We expect at
    // least all three families (limp = call, raise, fold) to appear.
    const totalCalls = Object.keys(counts).filter((k) => k.startsWith('call:')).length;
    const totalRaises = Object.keys(counts).filter((k) => k.startsWith('raise:')).length;
    const totalFolds = Object.keys(counts).filter((k) => k.startsWith('fold:')).length;
    expect(totalCalls).toBeGreaterThan(0);
    expect(totalRaises).toBeGreaterThan(0);
    expect(totalFolds).toBeGreaterThan(0);
  });

  it('balanced_pro deterministic sample with low roll picks first non-zero action', () => {
    const { state, meId } = build25bbState({ myCards: ['Td', '9d'] });
    // Force a low rng — first cumulative window. baseline iter order: all_in_25(0) → raise_2 →
    // limp → fold. all_in_25 is 0 so first hit is raise_2.
    const out = decide25bbPreflop(state, meId, 'STANDARD', seqRng([0.0]));
    expect(out).not.toBeNull();
    expect(out?.action).toBe('raise');
  });
});
