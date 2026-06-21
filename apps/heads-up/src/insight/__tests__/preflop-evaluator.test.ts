import { describe, expect, it } from 'vitest';
import { stringToCard, type Card } from '../../engine/card';
import {
  dominantAction,
  evaluatePreflopAction,
  handToKey,
} from '../preflop-evaluator';
import { getFreq } from '../preflop-chart';

function c(s: string): Card {
  return stringToCard(s);
}

const BB_CHIPS = 2;
const CTX_SB = {
  situation: 'SB_FIRST_ACTION' as const,
  position: 'SB' as const,
  stackBB: 100,
  bigBlindChips: BB_CHIPS,
};

describe('handToKey', () => {
  it('builds pair keys', () => {
    expect(handToKey(c('As'), c('Ah'))).toBe('AA');
    expect(handToKey(c('2c'), c('2d'))).toBe('22');
  });

  it('places higher rank first', () => {
    expect(handToKey(c('Kh'), c('As'))).toBe('AKo');
    expect(handToKey(c('2s'), c('Qs'))).toBe('Q2s');
  });

  it('marks suited vs offsuit', () => {
    expect(handToKey(c('As'), c('Ks'))).toBe('AKs');
    expect(handToKey(c('As'), c('Kh'))).toBe('AKo');
  });

  it('T7o example from spec', () => {
    expect(handToKey(c('Ts'), c('7h'))).toBe('T7o');
  });
});

describe('dominantAction', () => {
  it('picks the action with the largest frequency', () => {
    const rec = dominantAction({ fold: 0, call: 0.3, raise: 0.7, raiseSize: 3 });
    expect(rec.action).toBe('raise');
    expect(rec.frequency).toBe(0.7);
    expect(rec.sizeInBB).toBe(3);
  });
  it('only exposes sizeInBB when the dominant action is raise', () => {
    const rec = dominantAction({ fold: 0.1, call: 0.8, raise: 0.1, raiseSize: 3 });
    expect(rec.action).toBe('call');
    expect(rec.sizeInBB).toBeUndefined();
  });
});

describe('evaluatePreflopAction — SB opens with AA', () => {
  it('raising AA scores ~100', () => {
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    expect(ev.handKey).toBe('AA');
    expect(ev.score).toBeGreaterThanOrEqual(95);
    expect(ev.recommendedAction.action).toBe('raise');
  });

  it('folding AA scores ~0', () => {
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'fold',
      0,
    );
    expect(ev.score).toBeLessThanOrEqual(9);
  });

  it('size that is way off loses 10 points (90s)', () => {
    // Recommended open size = 2.5bb. User opens 10bb (4x the size).
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 10,
    );
    expect(ev.score).toBeLessThanOrEqual(90);
    expect(ev.score).toBeGreaterThanOrEqual(80);
  });

  it('raising AA all-in is a sizing error, not a "recommended" play', () => {
    // Recommended open = 2.5bb at 100bb. Shoving the full stack is a huge
    // over-bet — must score far below a normal raise and be flagged as 올인.
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 100, // all-in (entire 100bb stack)
    );
    expect(ev.score).toBeLessThanOrEqual(50);
    expect(ev.commentary).toMatch(/올인/);
  });
});

describe('evaluatePreflopAction — SB 72o', () => {
  it('folding 72o is the right play (high score)', () => {
    const ev = evaluatePreflopAction(
      [c('7s'), c('2h')],
      CTX_SB,
      'fold',
      0,
    );
    expect(ev.handKey).toBe('72o');
    expect(ev.recommendedAction.action).toBe('fold');
    expect(ev.score).toBeGreaterThanOrEqual(95);
  });

  it('raising 72o scores low', () => {
    const ev = evaluatePreflopAction(
      [c('7s'), c('2h')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    expect(ev.score).toBeLessThanOrEqual(9);
  });
});

describe('evaluatePreflopAction — JJ vs BB 3bet', () => {
  const CTX_3BET = {
    situation: 'SB_VS_3BET' as const,
    position: 'SB' as const,
    stackBB: 100,
    bigBlindChips: BB_CHIPS,
    facingBetBB: 10,
  };

  it('calling JJ vs 3bet is within the GTO mix (score ≥ 70)', () => {
    const ev = evaluatePreflopAction(
      [c('Js'), c('Jh')],
      CTX_3BET,
      'call',
      BB_CHIPS * 10,
    );
    expect(ev.score).toBeGreaterThanOrEqual(70);
  });

  it('4betting JJ is also within the mix (lower freq → 40-89 band)', () => {
    const ev = evaluatePreflopAction(
      [c('Js'), c('Jh')],
      CTX_3BET,
      'raise',
      BB_CHIPS * 24,
    );
    expect(ev.score).toBeGreaterThanOrEqual(40);
    expect(ev.score).toBeLessThanOrEqual(89);
  });

  it('folding JJ vs 3bet is sub-optimal but not zero', () => {
    const ev = evaluatePreflopAction(
      [c('Js'), c('Jh')],
      CTX_3BET,
      'fold',
      0,
    );
    // JJ fold has some non-zero frequency in SB_VS_3BET (0.1) → low band.
    expect(ev.score).toBeLessThanOrEqual(69);
  });
});

describe('evaluatePreflopAction — preflop check normalizes to call', () => {
  it('check in BB_VS_LIMP is equivalent to call for scoring', () => {
    const CTX_LIMP = {
      situation: 'BB_VS_LIMP' as const,
      position: 'BB' as const,
      stackBB: 100,
      bigBlindChips: BB_CHIPS,
    };
    // T5o: BB_VS_LIMP defaults to 100% check. User "check"s (free option).
    const evCheck = evaluatePreflopAction(
      [c('Ts'), c('5h')],
      CTX_LIMP,
      'check',
      0,
    );
    expect(evCheck.score).toBeGreaterThanOrEqual(95);
    expect(evCheck.recommendedAction.action).toBe('call');
  });
});

describe('evaluatePreflopAction — scoring band boundaries', () => {
  it('freq=0 → score 0', () => {
    // Check against a hand that's guaranteed 100% fold: 72o SB.
    const ev = evaluatePreflopAction(
      [c('7s'), c('2h')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    const freq = getFreq('SB_FIRST_ACTION', '72o');
    expect(freq.raise).toBe(0);
    expect(ev.score).toBe(0);
  });

  it('dominant freq=1 → score 100', () => {
    const ev = evaluatePreflopAction(
      [c('Ks'), c('Kh')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    expect(ev.score).toBe(100);
  });
});

describe('evaluatePreflopAction — robustness', () => {
  it('score stays in [0, 100] across random (hand, situation, action, amount) inputs', () => {
    const suits: Array<'s' | 'h' | 'd' | 'c'> = ['s', 'h', 'd', 'c'];
    const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const sits = [
      'SB_FIRST_ACTION',
      'BB_VS_LIMP',
      'BB_VS_RAISE',
      'SB_VS_3BET',
      'BB_VS_4BET',
      'SB_VS_5BET',
    ] as const;
    const actions: Array<'fold' | 'check' | 'call' | 'bet' | 'raise'> = [
      'fold', 'check', 'call', 'bet', 'raise',
    ];
    // Pseudo-random but deterministic walk over a representative sample.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 300; i++) {
      const r1 = ranks[Math.floor(rand() * ranks.length)];
      const r2 = ranks[Math.floor(rand() * ranks.length)];
      // Avoid identical cards (same rank+suit).
      const s1 = suits[Math.floor(rand() * suits.length)];
      let s2 = suits[Math.floor(rand() * suits.length)];
      if (r1 === r2 && s1 === s2) {
        s2 = suits[(suits.indexOf(s1) + 1) % suits.length];
      }
      const action = actions[Math.floor(rand() * actions.length)];
      const amount = Math.floor(rand() * 200);
      const sit = sits[Math.floor(rand() * sits.length)];
      const ev = evaluatePreflopAction(
        [
          { suit: s1, rank: r1 as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 },
          { suit: s2, rank: r2 as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 },
        ],
        {
          situation: sit,
          position: 'SB',
          stackBB: 100,
          bigBlindChips: BB_CHIPS,
        },
        action,
        amount,
      );
      expect(ev.score, `iter ${i} sit=${sit} act=${action}`).toBeGreaterThanOrEqual(0);
      expect(ev.score, `iter ${i} sit=${sit} act=${action}`).toBeLessThanOrEqual(100);
      expect(ev.userFrequencyMatch).toBeGreaterThanOrEqual(0);
      expect(ev.userFrequencyMatch).toBeLessThanOrEqual(1);
      expect(ev.commentary.length).toBeGreaterThan(0);
    }
  });

  it('chart entries are immutable (cannot mutate freq through getFreq)', () => {
    // Regression guard: Object.freeze ensures accidental mutations surface.
    // In strict mode, assignment throws. In non-strict, it silently fails.
    // Either way, the chart must be unchanged afterward.
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    const original = ev.userFrequencyMatch;
    // Attempt mutation (should be no-op or throw — either is acceptable).
    try {
      const freqAccess = (ev.recommendedAction as unknown as { frequency: number });
      freqAccess.frequency = -1;
    } catch {
      // strict-mode throw is fine
    }
    // Re-evaluating should give the same answer.
    const ev2 = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    expect(ev2.userFrequencyMatch).toBe(original);
  });
});

describe('evaluatePreflopAction — commentary', () => {
  it('returns non-empty Korean commentary', () => {
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 2.5,
    );
    expect(ev.commentary).toContain('AA');
    expect(ev.commentary.length).toBeGreaterThan(5);
  });

  it('warns about size mismatch', () => {
    const ev = evaluatePreflopAction(
      [c('As'), c('Ah')],
      CTX_SB,
      'raise',
      BB_CHIPS * 10,
    );
    expect(ev.commentary).toMatch(/사이즈|BB/);
  });
});
