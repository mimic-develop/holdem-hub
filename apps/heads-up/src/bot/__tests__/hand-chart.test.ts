import { describe, expect, it } from 'vitest';
import { stringToCard } from '../../engine/card';
import {
  HU_BB_VS_OPEN_CHART,
  HU_SB_OPEN_CHART,
  combosForKey,
  getAllHandKeys,
  handKey,
} from '../hand-chart';

describe('handKey', () => {
  it('formats pairs', () => {
    expect(handKey(stringToCard('As'), stringToCard('Ah'))).toBe('AA');
    expect(handKey(stringToCard('2s'), stringToCard('2d'))).toBe('22');
  });

  it('formats suited hands with high rank first', () => {
    expect(handKey(stringToCard('Kh'), stringToCard('Ah'))).toBe('AKs');
    expect(handKey(stringToCard('2c'), stringToCard('7c'))).toBe('72s');
  });

  it('formats offsuit hands', () => {
    expect(handKey(stringToCard('As'), stringToCard('Kh'))).toBe('AKo');
    expect(handKey(stringToCard('2s'), stringToCard('Td'))).toBe('T2o');
  });
});

describe('chart structure', () => {
  it('has exactly 169 hand keys', () => {
    expect(getAllHandKeys().length).toBe(169);
    expect(Object.keys(HU_BB_VS_OPEN_CHART).length).toBe(169);
  });

  it('every entry sums to 1.0', () => {
    for (const [key, a] of Object.entries(HU_SB_OPEN_CHART)) {
      expect(a.raise + a.call + a.fold).toBeCloseTo(1, 6);
      expect(a.raise).toBeGreaterThanOrEqual(0);
      expect(a.call).toBeGreaterThanOrEqual(0);
      expect(a.fold).toBeGreaterThanOrEqual(0);
      void key;
    }
    for (const [, a] of Object.entries(HU_BB_VS_OPEN_CHART)) {
      expect(a.raise + a.call + a.fold).toBeCloseTo(1, 6);
    }
  });

  it('combosForKey is 6 for pairs, 4 for suited, 12 for offsuit', () => {
    expect(combosForKey('AA')).toBe(6);
    expect(combosForKey('AKs')).toBe(4);
    expect(combosForKey('AKo')).toBe(12);
  });
});

describe('SB open chart — premium hands always raise', () => {
  const premium = ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs'];
  for (const h of premium) {
    it(`${h} raises ≥ 0.95`, () => {
      expect(HU_SB_OPEN_CHART[h].raise).toBeGreaterThanOrEqual(0.95);
      expect(HU_SB_OPEN_CHART[h].fold).toBeLessThanOrEqual(0.05);
    });
  }
});

describe('BB vs open — premium hands never fold', () => {
  const premium = ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo'];
  for (const h of premium) {
    it(`${h} folds ≤ 0.05`, () => {
      const a = HU_BB_VS_OPEN_CHART[h];
      expect(a.fold).toBeLessThanOrEqual(0.05);
      expect(a.raise + a.call).toBeGreaterThanOrEqual(0.95);
    });
  }
});

describe('SB open is HU-wide (combo-weighted)', () => {
  it('total raise frequency is between 0.70 and 0.90', () => {
    let raiseWeighted = 0;
    let total = 0;
    for (const [key, action] of Object.entries(HU_SB_OPEN_CHART)) {
      const c = combosForKey(key);
      raiseWeighted += c * action.raise;
      total += c;
    }
    const freq = raiseWeighted / total;
    expect(total).toBe(1326); // 52 choose 2
    expect(freq).toBeGreaterThan(0.7);
    expect(freq).toBeLessThan(0.9);
  });
});

describe('SB open — trash hands fold majority', () => {
  const trash = ['72o', '82o', '83o', '32o', '42o'];
  for (const h of trash) {
    it(`${h} raises < 0.5`, () => {
      expect(HU_SB_OPEN_CHART[h].raise).toBeLessThan(0.5);
    });
  }
});
