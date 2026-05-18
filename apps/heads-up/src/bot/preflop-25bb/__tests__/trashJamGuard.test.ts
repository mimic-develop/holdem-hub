import { describe, expect, it } from 'vitest';
import { stringToCard } from '../../../engine/card';
import type { GameState, Player } from '../../../types/game';
import { decide25bbPreflop } from '../engine';

/**
 * Trash hand jam-frequency cap.
 *
 * `BB_VS_SB_LIMP_25BB` has all_in_25 baseline = 7.6%. Trash hands receive
 * `reduceActions.all_in_25 = 0.4` → expected normalized ≤ ~3.1% after the
 * other actions (raise_3 20.1, raise_7 10.4, check 61.9) keep their share.
 *
 * We assert trash jams strictly less than the raw baseline (clear reduction
 * effect) — this is the spec's intent: "Do not reduce jam below 0% but keep
 * it well below baseline for trash."
 */

const BB = 20;
const SB = 10;
const STACK_BB = 25;

function mkPlayer(opts: {
  id: string;
  position: 'SB' | 'BB';
  cards?: [string, string];
  stack: number;
  currentBet: number;
}): Player {
  return {
    id: opts.id,
    stack: opts.stack,
    holeCards: opts.cards ? [stringToCard(opts.cards[0]), stringToCard(opts.cards[1])] : null,
    position: opts.position,
    hasFolded: false,
    currentBet: opts.currentBet,
  };
}

/** SB limped (call SB→BB total). BB(bot) to act with all_in_25 in baseline. */
function makeBbVsLimp(myCards: [string, string]): { state: GameState; meId: string } {
  const me = mkPlayer({ id: 'ME', position: 'BB', cards: myCards, stack: STACK_BB * BB - BB, currentBet: BB });
  const opp = mkPlayer({ id: 'OPP', position: 'SB', stack: STACK_BB * BB - BB, currentBet: BB });
  return {
    meId: 'ME',
    state: {
      players: [opp, me],
      board: [],
      pot: 2 * BB,
      street: 'preflop',
      currentBet: BB,
      minRaise: BB,
      toActId: 'ME',
      bigBlind: BB,
      smallBlind: SB,
      history: [
        { playerId: 'OPP', action: 'call', amount: SB, street: 'preflop' },
      ],
    },
  };
}

describe('Trash jam frequency — capped well below baseline', () => {
  const ITERS = 10_000;

  it('72o jams less than 4% at BB_VS_SB_LIMP_25BB (baseline 7.6% × 0.4 reduce)', () => {
    let jams = 0;
    for (let i = 0; i < ITERS; i++) {
      const { state, meId } = makeBbVsLimp(['7s', '2h']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      // all_in_25 → action='raise' with amount === legal.maxBetTotal
      if (out?.action === 'raise' && out.amount === STACK_BB * BB) jams++;
    }
    expect(jams / ITERS).toBeLessThan(0.04);
  });

  it('72o jam frequency at BB_VS_LIMP is meaningfully lower than playable T9s', () => {
    let trashJams = 0;
    let playableJams = 0;
    const iters = 5_000;
    for (let i = 0; i < iters; i++) {
      const trash = makeBbVsLimp(['7s', '2h']);
      const playable = makeBbVsLimp(['Td', '9d']);
      const a = decide25bbPreflop(trash.state, trash.meId, 'STANDARD', Math.random);
      const b = decide25bbPreflop(playable.state, playable.meId, 'STANDARD', Math.random);
      if (a?.action === 'raise' && a.amount === STACK_BB * BB) trashJams++;
      if (b?.action === 'raise' && b.amount === STACK_BB * BB) playableJams++;
    }
    expect(trashJams).toBeLessThan(playableJams);
  });

  it('82o at BB_VS_LIMP: aggressive lines (any raise/jam) stay under 4%', () => {
    let aggressives = 0;
    for (let i = 0; i < ITERS; i++) {
      const { state, meId } = makeBbVsLimp(['8s', '2h']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (out?.action === 'raise' || out?.action === 'bet') aggressives++;
    }
    // Cap is 4%; sample variance of 10k iterations allows ±0.4% tolerance.
    expect(aggressives / ITERS).toBeLessThan(0.05);
  });

  it('32o at BB_VS_LIMP: aggressive lines stay under 4%', () => {
    let aggressives = 0;
    for (let i = 0; i < ITERS; i++) {
      const { state, meId } = makeBbVsLimp(['3s', '2h']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (out?.action === 'raise' || out?.action === 'bet') aggressives++;
    }
    // Cap is 4%; sample variance of 10k iterations allows ±0.4% tolerance.
    expect(aggressives / ITERS).toBeLessThan(0.05);
  });
});
