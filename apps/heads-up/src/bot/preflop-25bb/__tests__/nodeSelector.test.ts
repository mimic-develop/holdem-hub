import { describe, expect, it } from 'vitest';
import { getPreflopNodeId } from '../nodeSelector';

describe('getPreflopNodeId — 12 named nodes', () => {
  const cases: Array<{ pos: 'SB' | 'BB'; tokens: string[]; expected: string }> = [
    { pos: 'SB', tokens: [], expected: 'SB_FIRST_IN_25BB' },
    { pos: 'BB', tokens: ['SB_LIMP'], expected: 'BB_VS_SB_LIMP_25BB' },
    { pos: 'BB', tokens: ['SB_RAISE_2'], expected: 'BB_VS_SB_OPEN_2BB_25BB' },
    { pos: 'SB', tokens: ['SB_RAISE_2', 'BB_ALL_IN_25'], expected: 'SB_VS_BB_JAM_AFTER_OPEN_2BB' },
    { pos: 'SB', tokens: ['SB_RAISE_2', 'BB_RAISE_5'], expected: 'SB_VS_BB_3BET_5_AFTER_OPEN_2BB' },
    { pos: 'SB', tokens: ['SB_RAISE_2', 'BB_RAISE_7'], expected: 'SB_VS_BB_3BET_7_AFTER_OPEN_2BB' },
    { pos: 'SB', tokens: ['SB_RAISE_2', 'BB_RAISE_8'], expected: 'SB_VS_BB_3BET_8_AFTER_OPEN_2BB' },
    { pos: 'SB', tokens: ['SB_LIMP', 'BB_RAISE_3'], expected: 'SB_VS_BB_ISO_3_AFTER_LIMP' },
    { pos: 'SB', tokens: ['SB_LIMP', 'BB_RAISE_7_5'], expected: 'SB_VS_BB_ISO_7_5_AFTER_LIMP' },
    { pos: 'SB', tokens: ['SB_LIMP', 'BB_ALL_IN_25'], expected: 'SB_VS_BB_JAM_AFTER_LIMP' },
    { pos: 'BB', tokens: ['SB_LIMP', 'BB_RAISE_3', 'SB_ALL_IN_25'], expected: 'BB_VS_SB_LIMP_JAM_AFTER_ISO_3' },
    { pos: 'BB', tokens: ['SB_LIMP', 'BB_RAISE_7', 'SB_ALL_IN_25'], expected: 'BB_VS_SB_LIMP_JAM_AFTER_ISO_7' },
  ];

  for (const c of cases) {
    it(`${c.pos} after [${c.tokens.join(', ')}] → ${c.expected}`, () => {
      expect(getPreflopNodeId(c.pos, c.tokens)).toBe(c.expected);
    });
  }

  it('returns null for unrecognised 4bet sequence', () => {
    expect(getPreflopNodeId('BB', ['SB_RAISE_2', 'BB_RAISE_5', 'SB_RAISE_12'])).toBeNull();
  });

  it('returns null when SB acted but history is empty/positionToAct mismatch', () => {
    expect(getPreflopNodeId('BB', [])).toBeNull();
    expect(getPreflopNodeId('SB', ['SB_LIMP'])).toBeNull();
  });
});
