import { describe, expect, it } from 'vitest';
import {
  allHandKeys,
  getFreq,
  HU_100BB_CHARTS,
  parseHandKey,
} from '../preflop-chart';

describe('preflop-chart — hand-key enumeration', () => {
  it('yields exactly 169 unique canonical keys', () => {
    const keys = Array.from(allHandKeys());
    expect(keys.length).toBe(169);
    expect(new Set(keys).size).toBe(169);
  });

  it('contains 13 pairs, 78 suited, 78 offsuit', () => {
    const keys = Array.from(allHandKeys());
    const pairs = keys.filter((k) => k.length === 2);
    const suited = keys.filter((k) => k.length === 3 && k.endsWith('s'));
    const offsuit = keys.filter((k) => k.length === 3 && k.endsWith('o'));
    expect(pairs.length).toBe(13);
    expect(suited.length).toBe(78);
    expect(offsuit.length).toBe(78);
  });

  it('always places the higher rank first', () => {
    for (const k of allHandKeys()) {
      const { hi, lo } = parseHandKey(k);
      expect(hi).toBeGreaterThanOrEqual(lo);
    }
  });
});

describe('preflop-chart — SB_FIRST_ACTION coverage (169 hands)', () => {
  const chart = HU_100BB_CHARTS.SB_FIRST_ACTION;

  it('has an entry for every one of the 169 hands', () => {
    for (const k of allHandKeys()) {
      expect(chart[k], `missing entry: ${k}`).toBeDefined();
    }
    expect(Object.keys(chart).length).toBe(169);
  });

  it('each entry sums to ~1.0 across {fold, call, raise}', () => {
    for (const k of allHandKeys()) {
      const f = chart[k];
      const sum = f.fold + f.call + f.raise;
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('every raise entry has a raiseSize set', () => {
    for (const k of allHandKeys()) {
      const f = chart[k];
      if (f.raise > 0) {
        expect(f.raiseSize, `missing raiseSize for ${k}`).toBeDefined();
        expect(f.raiseSize!).toBeGreaterThan(1);
      }
    }
  });

  it('premium hands always raise', () => {
    for (const k of ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs']) {
      expect(chart[k].raise, `${k}`).toBeCloseTo(1, 5);
    }
  });

  it('weakest offsuit hands always fold', () => {
    for (const k of ['72o', '83o', '82o', '62o', '52o', '42o', '32o']) {
      expect(chart[k].fold, `${k}`).toBeCloseTo(1, 5);
      expect(chart[k].raise, `${k}`).toBe(0);
    }
  });

  it('overall open rate is in a reasonable HU range (50-90%)', () => {
    // Weight each hand by its combo count: 6 pairs, 4 suited, 12 offsuit.
    let openCombos = 0;
    let totalCombos = 0;
    for (const k of allHandKeys()) {
      const f = chart[k];
      const combos = k.length === 2 ? 6 : k.endsWith('s') ? 4 : 12;
      openCombos += f.raise * combos;
      totalCombos += combos;
    }
    expect(totalCombos).toBe(1326);
    const openRate = openCombos / totalCombos;
    expect(openRate).toBeGreaterThan(0.5);
    expect(openRate).toBeLessThan(0.9);
  });
});

describe('preflop-chart — BB_VS_RAISE sanity', () => {
  it('premium hands 3bet at meaningful frequency', () => {
    const f = getFreq('BB_VS_RAISE', 'AA');
    expect(f.raise).toBeGreaterThan(0.5);
    const kk = getFreq('BB_VS_RAISE', 'KK');
    expect(kk.raise).toBeGreaterThan(0.5);
  });

  it('JJ vs open is a mix (call/3bet both present)', () => {
    const f = getFreq('BB_VS_RAISE', 'JJ');
    expect(f.call).toBeGreaterThan(0.1);
    expect(f.raise).toBeGreaterThan(0.1);
  });

  it('trash hands always fold facing an open', () => {
    expect(getFreq('BB_VS_RAISE', '72o').fold).toBeCloseTo(1, 5);
  });
});

describe('preflop-chart — SB_VS_3BET sanity', () => {
  it('JJ facing a 3bet is a mix (call / 4bet / fold)', () => {
    const f = getFreq('SB_VS_3BET', 'JJ');
    // JJ should appear in multiple action buckets.
    const nonZero = [f.fold, f.call, f.raise].filter((x) => x > 0).length;
    expect(nonZero).toBeGreaterThanOrEqual(2);
    expect(f.call).toBeGreaterThan(0);
  });

  it('AA facing a 3bet almost always 4bets', () => {
    expect(getFreq('SB_VS_3BET', 'AA').raise).toBeGreaterThan(0.5);
  });

  it('weak hands facing a 3bet fold', () => {
    expect(getFreq('SB_VS_3BET', '72o').fold).toBeCloseTo(1, 5);
  });
});

describe('preflop-chart — BB_VS_LIMP sanity', () => {
  it('BB never folds facing a limp (free option)', () => {
    // Sample a variety of hands; none should have fold > 0.
    const samples = ['AA', 'T5o', '32o', '72o', 'K5s'];
    for (const k of samples) {
      expect(getFreq('BB_VS_LIMP', k).fold).toBe(0);
    }
  });

  it('premium hands iso-raise often', () => {
    expect(getFreq('BB_VS_LIMP', 'AA').raise).toBeGreaterThan(0.7);
    expect(getFreq('BB_VS_LIMP', 'KK').raise).toBeGreaterThan(0.7);
  });
});

describe('preflop-chart — SB_VS_5BET sanity', () => {
  it('snap-calls with KK+', () => {
    expect(getFreq('SB_VS_5BET', 'AA').call).toBeCloseTo(1, 5);
    expect(getFreq('SB_VS_5BET', 'KK').call).toBeCloseTo(1, 5);
  });

  it('folds trash facing all-in', () => {
    expect(getFreq('SB_VS_5BET', '72o').fold).toBeCloseTo(1, 5);
  });

  it('no raise action (all-in already — only call or fold)', () => {
    for (const k of ['AA', 'KK', 'QQ', 'AKs', 'JJ', '72o']) {
      expect(getFreq('SB_VS_5BET', k).raise).toBe(0);
    }
  });
});

/**
 * Cross-chart invariants — every entry in every situation must be well-formed.
 * Catches drift if someone edits a single branch and forgets to balance it,
 * or leaks a raiseSize onto a pure fold/call entry.
 */
describe('preflop-chart — cross-chart invariants', () => {
  const SITUATIONS = [
    'SB_FIRST_ACTION',
    'BB_VS_LIMP',
    'BB_VS_RAISE',
    'SB_VS_3BET',
    'BB_VS_4BET',
    'SB_VS_5BET',
  ] as const;

  it('every situation × every hand: frequencies sum to 1', () => {
    for (const sit of SITUATIONS) {
      const chart = HU_100BB_CHARTS[sit];
      for (const k of allHandKeys()) {
        const f = chart[k];
        expect(f, `${sit}/${k}`).toBeDefined();
        const sum = f.fold + f.call + f.raise;
        expect(sum, `${sit}/${k} sum`).toBeCloseTo(1, 5);
      }
    }
  });

  it('every situation: raise > 0 entries have raiseSize, raise = 0 entries do not', () => {
    for (const sit of SITUATIONS) {
      const chart = HU_100BB_CHARTS[sit];
      for (const k of allHandKeys()) {
        const f = chart[k];
        if (f.raise > 0) {
          expect(f.raiseSize, `${sit}/${k} missing raiseSize`).toBeDefined();
          expect(f.raiseSize!).toBeGreaterThan(1);
        } else {
          // Leaking raiseSize onto fold/call-only entries is harmless to scoring
          // but indicates a data-entry inconsistency.
          expect(f.raiseSize, `${sit}/${k} leaked raiseSize`).toBeUndefined();
        }
      }
    }
  });

  it('every situation: all freq components are in [0, 1]', () => {
    for (const sit of SITUATIONS) {
      const chart = HU_100BB_CHARTS[sit];
      for (const k of allHandKeys()) {
        const f = chart[k];
        for (const v of [f.fold, f.call, f.raise]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
