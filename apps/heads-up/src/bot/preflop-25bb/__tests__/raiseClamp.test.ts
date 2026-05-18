import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, Player } from '../../../types/game';
import { convertSpecAction } from '../actionConverter';

/**
 * Verifies console.warn is emitted whenever a spec raise size would be
 * clamped by `engine.applyAction` to a legal range.
 */

const BB = 20;
const SB = 10;

function mkPlayer(opts: {
  id: string;
  position: 'SB' | 'BB';
  stack: number;
  currentBet: number;
}): Player {
  return {
    id: opts.id,
    stack: opts.stack,
    holeCards: null,
    position: opts.position,
    hasFolded: false,
    currentBet: opts.currentBet,
  };
}

/** State: SB raise to 2bb, BB just 3bet to 5bb. SB to act. raise_2 (40) is below
 *  the new min raise (~10bb total = 200 chips). */
function makeSbVs3betFiveState(): { state: GameState; botId: string } {
  const SB_RAISE_TO = 40; // 2bb
  const BB_3BET_TO = 100; // 5bb
  const sb = mkPlayer({ id: 'SB', position: 'SB', stack: 25 * BB - SB_RAISE_TO, currentBet: SB_RAISE_TO });
  const bb = mkPlayer({ id: 'BB', position: 'BB', stack: 25 * BB - BB_3BET_TO, currentBet: BB_3BET_TO });
  return {
    botId: 'SB',
    state: {
      players: [sb, bb],
      board: [],
      pot: SB_RAISE_TO + BB_3BET_TO,
      street: 'preflop',
      currentBet: BB_3BET_TO,
      minRaise: BB_3BET_TO - SB_RAISE_TO, // 60
      toActId: 'SB',
      bigBlind: BB,
      smallBlind: SB,
      history: [
        { playerId: 'SB', action: 'raise', amount: SB_RAISE_TO, street: 'preflop' },
        { playerId: 'BB', action: 'raise', amount: BB_3BET_TO, street: 'preflop' },
      ],
    },
  };
}

describe('actionConverter — raise clamp warning', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when raise_2 falls below min raise after 3bet', () => {
    const { state, botId } = makeSbVs3betFiveState();
    const result = convertSpecAction('raise_2', state, botId);
    expect(result).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/raise_2 clamp/);
  });

  it('does not warn when raise_8 (160) is within legal range after 3bet', () => {
    const { state, botId } = makeSbVs3betFiveState();
    // min raise total ≥ ~160 (BB_3BET_TO + minRaise = 100+60=160); raise_8=160
    // sits exactly at boundary so no clamp.
    convertSpecAction('raise_8', state, botId);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
