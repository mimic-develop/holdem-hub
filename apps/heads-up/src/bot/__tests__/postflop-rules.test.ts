import { describe, expect, it } from 'vitest';
import { stringToCard, type Card } from '../../engine/card';
import { HandRank } from '../../engine/hand-evaluator';
import { classifyHand, potOddsFromBet } from '../postflop-rules';

function c(s: string): Card {
  return stringToCard(s);
}
function board(...ss: string[]): Card[] {
  return ss.map(c);
}

describe('classifyHand — made hand detection', () => {
  it('HIGH_CARD on flop with nothing', () => {
    const s = classifyHand([c('Ks'), c('5h')], board('Jc', '7d', '2s'));
    expect(s.madeHand).toBe(HandRank.HIGH_CARD);
    expect(s.isPair).toBe(false);
  });

  it('top pair with ace on A72', () => {
    const s = classifyHand([c('As'), c('Kh')], board('Ac', '7d', '2s'));
    expect(s.madeHand).toBe(HandRank.PAIR);
    expect(s.isTopPair).toBe(true);
    expect(s.isPocketPair).toBe(false);
    expect(s.isOverpair).toBe(false);
  });

  it('overpair with KK on Q72', () => {
    const s = classifyHand([c('Ks'), c('Kh')], board('Qc', '7d', '2s'));
    expect(s.isOverpair).toBe(true);
    expect(s.isTopPair).toBe(false);
    expect(s.madeHand).toBe(HandRank.PAIR);
  });

  it('set with 99 on 972', () => {
    const s = classifyHand([c('9s'), c('9h')], board('9c', '7d', '2s'));
    expect(s.isSet).toBe(true);
    expect(s.madeHand).toBe(HandRank.THREE_OF_A_KIND);
  });

  it('two pair using both hole cards', () => {
    const s = classifyHand([c('As'), c('Kh')], board('Ac', 'Kd', '2s'));
    expect(s.isTwoPair).toBe(true);
    expect(s.madeHand).toBe(HandRank.TWO_PAIR);
  });

  it('full house (set + board pair)', () => {
    const s = classifyHand([c('9s'), c('9h')], board('9c', 'Kd', 'Ks'));
    expect(s.isFullHouse).toBe(true);
    expect(s.madeHand).toBe(HandRank.FULL_HOUSE);
  });

  it('flush on four-to-flush board', () => {
    const s = classifyHand([c('As'), c('2s')], board('Ks', '7s', '5s'));
    expect(s.isFlush).toBe(true);
    expect(s.madeHand).toBe(HandRank.FLUSH);
    expect(s.isFlushDraw).toBe(false);
  });

  it('straight on 6-high board', () => {
    const s = classifyHand([c('5s'), c('4h')], board('6c', '3d', '2s'));
    expect(s.isStraight).toBe(true);
    expect(s.madeHand).toBe(HandRank.STRAIGHT);
  });

  it('wheel straight A-2-3-4-5', () => {
    const s = classifyHand([c('As'), c('2h')], board('3c', '4d', '5s'));
    expect(s.isStraight).toBe(true);
  });
});

describe('classifyHand — draws', () => {
  it('flush draw with 4 cards of same suit', () => {
    const s = classifyHand([c('As'), c('Ks')], board('7s', '2s', '9h'));
    expect(s.isFlushDraw).toBe(true);
    expect(s.hasDraw).toBe(true);
    expect(s.isFlush).toBe(false);
  });

  it('not a flush draw with only 3 of a suit', () => {
    const s = classifyHand([c('As'), c('Kd')], board('7s', '2s', '9h'));
    expect(s.isFlushDraw).toBe(false);
  });

  it('OESD with 6-7-8-9', () => {
    const s = classifyHand([c('6s'), c('7h')], board('8c', '9d', '2s'));
    expect(s.isOESD).toBe(true);
    expect(s.isGutshot).toBe(false);
  });

  it('gutshot with 5-6-8-9 (needs 7)', () => {
    const s = classifyHand([c('5s'), c('6h')], board('8c', '9d', '2s'));
    expect(s.isGutshot).toBe(true);
    expect(s.isOESD).toBe(false);
  });

  it('no straight draw — disconnected cards', () => {
    const s = classifyHand([c('2s'), c('Kh')], board('7c', '9d', 'Qs'));
    expect(s.isOESD).toBe(false);
    expect(s.isGutshot).toBe(false);
  });

  it('broadway gutshot JQKA needs T (one-ender, treated as gutshot)', () => {
    const s = classifyHand([c('Jh'), c('Qd')], board('Ks', 'Ac', '2h'));
    expect(s.isOESD).toBe(false);
    expect(s.isGutshot).toBe(true);
  });

  it('combo draw: flush draw + OESD', () => {
    const s = classifyHand([c('7s'), c('8s')], board('9s', 'Ts', '2h'));
    expect(s.isFlushDraw).toBe(true);
    expect(s.isOESD).toBe(true);
    expect(s.hasDraw).toBe(true);
  });

  it('made straight is not classified as draw', () => {
    const s = classifyHand([c('5s'), c('6h')], board('7c', '8d', '9s'));
    expect(s.isStraight).toBe(true);
    expect(s.isOESD).toBe(false);
    expect(s.isGutshot).toBe(false);
  });
});

describe('classifyHand — river (5 board cards)', () => {
  it('straight flush', () => {
    const s = classifyHand([c('9s'), c('Ts')], board('8s', '7s', '6s', '2h', 'Kd'));
    expect(s.isStraight).toBe(true);
    expect(s.isFlush).toBe(true);
    // Straight flush ≥ FLUSH enum; classifier reports the stronger piece via madeHand
    expect(s.madeHand).toBeGreaterThanOrEqual(HandRank.FLUSH);
  });

  it('draws are false on river (nothing to improve to)', () => {
    // 4 spades + board river — already made flush
    const s = classifyHand([c('As'), c('2s')], board('7s', '9s', 'Ks', 'Jd', '5h'));
    expect(s.isFlush).toBe(true);
    expect(s.isFlushDraw).toBe(false);
  });
});

describe('potOddsFromBet', () => {
  it('returns 0 when nothing to call', () => {
    expect(potOddsFromBet(100, 0)).toBe(0);
  });
  it('pot 30, toCall 10 → 10/40 = 0.25', () => {
    expect(potOddsFromBet(30, 10)).toBeCloseTo(0.25, 6);
  });
  it('pot 20, toCall 20 → 20/40 = 0.5', () => {
    expect(potOddsFromBet(20, 20)).toBeCloseTo(0.5, 6);
  });
});
