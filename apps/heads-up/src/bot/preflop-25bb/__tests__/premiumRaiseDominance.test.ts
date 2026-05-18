import { describe, expect, it } from 'vitest';
import { stringToCard } from '../../../engine/card';
import type { GameState, Player } from '../../../types/game';
import { decide25bbPreflop } from '../engine';

/**
 * Premium hands must be raise-dominant at SB_FIRST_IN — limp share must stay
 * well below the aggregate baseline (52.1%). Spec target: premium AA/KK
 * should raise far more often than limp.
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

function makeSbFirstIn(myCards: [string, string]): { state: GameState; meId: string } {
  const me = mkPlayer({ id: 'ME', position: 'SB', cards: myCards, stack: STACK_BB * BB - SB, currentBet: SB });
  const opp = mkPlayer({ id: 'OPP', position: 'BB', stack: STACK_BB * BB - BB, currentBet: BB });
  return {
    meId: 'ME',
    state: {
      players: [me, opp],
      board: [],
      pot: SB + BB,
      street: 'preflop',
      currentBet: BB,
      minRaise: BB,
      toActId: 'ME',
      bigBlind: BB,
      smallBlind: SB,
      history: [],
    },
  };
}

describe('Premium raise-dominance — SB_FIRST_IN_25BB', () => {
  const ITERS = 10_000;

  function distribute(cards: [string, string]) {
    let limps = 0;
    let raises = 0;
    let other = 0;
    for (let i = 0; i < ITERS; i++) {
      const { state, meId } = makeSbFirstIn(cards);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (!out) { other++; continue; }
      // limp manifests as 'call' (SB completes BB amount).
      if (out.action === 'call') limps++;
      else if (out.action === 'raise' || out.action === 'bet') raises++;
      else other++;
    }
    return { limps, raises, other };
  }

  it('AA: raise share > 70%, limp share < 25%', () => {
    const { limps, raises } = distribute(['As', 'Ah']);
    expect(raises / ITERS).toBeGreaterThan(0.70);
    expect(limps / ITERS).toBeLessThan(0.25);
  });

  it('KK: raise share > 70%, limp share < 25%', () => {
    const { limps, raises } = distribute(['Ks', 'Kh']);
    expect(raises / ITERS).toBeGreaterThan(0.70);
    expect(limps / ITERS).toBeLessThan(0.25);
  });

  it('AQs: raise share strictly higher than limp share', () => {
    const { limps, raises } = distribute(['As', 'Qs']);
    expect(raises).toBeGreaterThan(limps);
  });

  it('AKo: never folds and is raise-leaning vs limp', () => {
    let folds = 0;
    let raises = 0;
    let limps = 0;
    for (let i = 0; i < ITERS; i++) {
      const { state, meId } = makeSbFirstIn(['As', 'Kh']);
      const out = decide25bbPreflop(state, meId, 'STANDARD', Math.random);
      if (out?.action === 'fold') folds++;
      else if (out?.action === 'raise' || out?.action === 'bet') raises++;
      else if (out?.action === 'call') limps++;
    }
    expect(folds).toBe(0);
    expect(raises).toBeGreaterThan(limps);
  });
});
