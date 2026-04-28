import { describe, expect, it } from 'vitest';
import { stringToCard, type Card } from '../../engine/card';
import { calculateEquity, type HandCombo } from '../equity';

function combo(a: string, b: string): HandCombo {
  return [stringToCard(a), stringToCard(b)];
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

describe('calculateEquity — known matchups', () => {
  it('AA vs 72o preflop ≈ 0.87 (within ±0.05)', () => {
    const me = combo('As', 'Ah');
    const opp: HandCombo[] = [[stringToCard('7c'), stringToCard('2d')]];
    const eq = calculateEquity(me, [], opp, { iterations: 5000, rng: mulberry32(1) });
    expect(eq).toBeGreaterThan(0.82);
    expect(eq).toBeLessThan(0.92);
  });

  it('AA vs KK preflop ≈ 0.82 (within ±0.05)', () => {
    const me = combo('As', 'Ah');
    const opp: HandCombo[] = [[stringToCard('Ks'), stringToCard('Kh')]];
    const eq = calculateEquity(me, [], opp, { iterations: 5000, rng: mulberry32(2) });
    expect(eq).toBeGreaterThan(0.77);
    expect(eq).toBeLessThan(0.87);
  });

  it('AKs vs QQ preflop ≈ 0.46 (coin flip, slight QQ edge)', () => {
    const me = combo('As', 'Ks');
    const opp: HandCombo[] = [[stringToCard('Qh'), stringToCard('Qd')]];
    const eq = calculateEquity(me, [], opp, { iterations: 5000, rng: mulberry32(3) });
    expect(eq).toBeGreaterThan(0.4);
    expect(eq).toBeLessThan(0.52);
  });

  it('flopped set beats top pair — 999 vs AKo on A-9-2 rainbow', () => {
    const me = combo('9h', '9d');
    const board: Card[] = [stringToCard('As'), stringToCard('9c'), stringToCard('2h')];
    const opp: HandCombo[] = [[stringToCard('Ad'), stringToCard('Kh')]];
    const eq = calculateEquity(me, board, opp, { iterations: 5000, rng: mulberry32(4) });
    expect(eq).toBeGreaterThan(0.9);
  });

  it('drawing hand has expected equity — 65s vs AA on 7-8-K two-tone', () => {
    const me = combo('6s', '5s');
    const board: Card[] = [stringToCard('7h'), stringToCard('8h'), stringToCard('Ks')];
    const opp: HandCombo[] = [[stringToCard('Ac'), stringToCard('Ad')]];
    const eq = calculateEquity(me, board, opp, { iterations: 5000, rng: mulberry32(5) });
    expect(eq).toBeGreaterThan(0.3);
    expect(eq).toBeLessThan(0.55);
  });

  it('uses random opponent when range is empty', () => {
    const me = combo('As', 'Ah');
    const eq = calculateEquity(me, [], [], { iterations: 3000, rng: mulberry32(6) });
    expect(eq).toBeGreaterThan(0.8);
    expect(eq).toBeLessThan(0.9);
  });
});

describe('calculateEquity — determinism', () => {
  it('same seed yields identical result', () => {
    const me = combo('As', 'Kh');
    const opp: HandCombo[] = [[stringToCard('Qd'), stringToCard('Qc')]];
    const a = calculateEquity(me, [], opp, { iterations: 500, rng: mulberry32(42) });
    const b = calculateEquity(me, [], opp, { iterations: 500, rng: mulberry32(42) });
    expect(a).toBe(b);
  });
});

describe('calculateEquity — performance', () => {
  it('1000 iterations complete in < 100ms', () => {
    const me = combo('As', 'Kh');
    const board: Card[] = [stringToCard('Qh'), stringToCard('7c'), stringToCard('2d')];
    const start = performance.now();
    calculateEquity(me, board, [], { iterations: 1000, rng: mulberry32(7) });
    const elapsed = performance.now() - start;
    console.log(`equity 1000 iters: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(100);
  });
});
