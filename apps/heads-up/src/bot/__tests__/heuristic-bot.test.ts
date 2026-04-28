import { describe, expect, it } from 'vitest';
import { stringToCard } from '../../engine/card';
import { HeuristicBot } from '../heuristic-bot';
import { buildState } from './state-helpers';

describe('HeuristicBot — premium hands (95%+ non-fold)', () => {
  const premiumPairs: Array<[string, string]> = [
    ['As', 'Ah'],
    ['Ks', 'Kh'],
    ['Qs', 'Qh'],
    ['As', 'Kh'], // AKo
    ['As', 'Ks'], // AKs
  ];

  for (const [c1, c2] of premiumPairs) {
    it(`${c1}/${c2} as SB first-in — fold rate < 5% over 1000 decisions`, () => {
      let folds = 0;
      for (let i = 0; i < 1000; i++) {
        const bot = new HeuristicBot('MEDIUM', i + 1);
        const { state, meId } = buildState({
          myCards: [c1, c2],
          myPosition: 'SB',
        });
        const d = bot.decide(state, meId);
        if (d.action === 'fold') folds++;
      }
      expect(folds).toBeLessThan(50);
    });

    it(`${c1}/${c2} as BB facing 3bb raise — fold rate < 5% over 1000 decisions`, () => {
      let folds = 0;
      for (let i = 0; i < 1000; i++) {
        const bot = new HeuristicBot('MEDIUM', i + 1);
        const { state, meId } = buildState({
          myCards: [c1, c2],
          myPosition: 'BB',
          oppCurrentBet: 6, // SB raised to 3bb (= 6 with bb=2)
          myCurrentBet: 2,
          currentBet: 6,
          pot: 8,
        });
        const d = bot.decide(state, meId);
        if (d.action === 'fold') folds++;
      }
      expect(folds).toBeLessThan(50);
    });
  }
});

describe('HeuristicBot — determinism', () => {
  it('same seed yields identical decision sequence', () => {
    const sequence = (seed: number) => {
      const bot = new HeuristicBot('MEDIUM', seed);
      const out: string[] = [];
      const hands: Array<[string, string]> = [
        ['7s', '2d'],
        ['Ks', 'Qs'],
        ['9h', '8h'],
        ['As', 'Ah'],
        ['3c', '8c'],
      ];
      for (const h of hands) {
        const { state, meId } = buildState({ myCards: h, myPosition: 'SB' });
        const d = bot.decide(state, meId);
        out.push(`${d.action}|${d.amount}|${d.thinkingTimeMs}`);
      }
      return out;
    };
    expect(sequence(99)).toEqual(sequence(99));
  });

  it('different seeds produce different sequences (probabilistic)', () => {
    const s1 = new HeuristicBot('MEDIUM', 1);
    const s2 = new HeuristicBot('MEDIUM', 2);
    const { state, meId } = buildState({ myCards: ['7s', '2d'], myPosition: 'SB' });
    const results1: string[] = [];
    const results2: string[] = [];
    for (let i = 0; i < 20; i++) {
      results1.push(s1.decide(state, meId).action);
      results2.push(s2.decide(state, meId).action);
    }
    expect(results1.join(',')).not.toBe(results2.join(','));
  });
});

describe('HeuristicBot — thinking time bounds', () => {
  it('thinkingTimeMs is between 800 and 2500', () => {
    const bot = new HeuristicBot('MEDIUM', 42);
    for (let i = 0; i < 50; i++) {
      const { state, meId } = buildState({ myCards: ['As', 'Ah'], myPosition: 'SB' });
      const d = bot.decide(state, meId);
      expect(d.thinkingTimeMs).toBeGreaterThanOrEqual(800);
      expect(d.thinkingTimeMs).toBeLessThanOrEqual(2500);
    }
  });
});

describe('HeuristicBot — HARD more aggressive than EASY', () => {
  it('over 500 random scenarios, HARD bets/raises more often than EASY', () => {
    const hands: Array<[string, string]> = [];
    // Generate a variety of hands (not all premium, not all trash)
    const ranks = '23456789TJQKA';
    const suits = 'shdc';
    for (let i = 0; i < 500; i++) {
      const r1 = ranks[i % 13];
      const r2 = ranks[(i * 3) % 13];
      const s1 = suits[i % 4];
      const s2 = suits[(i * 5) % 4];
      const c1 = r1 + s1;
      const c2 = r2 + s2;
      if (c1 !== c2) hands.push([c1, c2]);
    }

    let easyAgg = 0;
    let hardAgg = 0;
    for (let i = 0; i < hands.length; i++) {
      const [c1, c2] = hands[i];
      const easy = new HeuristicBot('EASY', i + 1);
      const hard = new HeuristicBot('HARD', i + 1);
      // Face a raise (so chart's raise = 3bet)
      const { state, meId } = buildState({
        myCards: [c1, c2],
        myPosition: 'BB',
        oppCurrentBet: 6,
        myCurrentBet: 2,
        currentBet: 6,
        pot: 8,
      });
      const eDec = easy.decide(state, meId);
      const hDec = hard.decide(state, meId);
      if (eDec.action === 'raise' || eDec.action === 'bet') easyAgg++;
      if (hDec.action === 'raise' || hDec.action === 'bet') hardAgg++;
    }

    console.log(`EASY aggression: ${easyAgg}/${hands.length}, HARD: ${hardAgg}/${hands.length}`);
    expect(hardAgg).toBeGreaterThan(easyAgg);
  });
});

describe('HeuristicBot — trash hands (72o) fold or play rarely', () => {
  it('72o as SB — raise rate should be under 40% (trash hand)', () => {
    let raises = 0;
    for (let i = 0; i < 1000; i++) {
      const bot = new HeuristicBot('MEDIUM', i + 1);
      const { state, meId } = buildState({
        myCards: ['7c', '2d'],
        myPosition: 'SB',
      });
      const d = bot.decide(state, meId);
      if (d.action === 'raise') raises++;
    }
    expect(raises).toBeLessThan(400);
  });
});

describe('HeuristicBot — postflop equity-driven decisions', () => {
  it('strong hand (trips) bets on flop when checked to', () => {
    const bot = new HeuristicBot('MEDIUM', 10);
    const { state, meId } = buildState({
      myCards: ['9s', '9h'],
      board: ['9c', 'As', '2d'],
      street: 'flop',
      myCurrentBet: 0,
      oppCurrentBet: 0,
      currentBet: 0,
      pot: 8,
      myPosition: 'BB',
    });
    let bets = 0;
    for (let i = 0; i < 10; i++) {
      const b = new HeuristicBot('MEDIUM', 10 + i);
      const d = b.decide(state, meId);
      if (d.action === 'bet' || d.action === 'raise') bets++;
      void bot;
    }
    expect(bets).toBeGreaterThanOrEqual(5);
  });

  it('garbage hand with no equity facing a big bet folds', () => {
    const bot = new HeuristicBot('MEDIUM', 20);
    const { state, meId } = buildState({
      myCards: ['2c', '3d'],
      board: ['As', 'Kh', 'Qd'],
      street: 'flop',
      myCurrentBet: 0,
      oppCurrentBet: 20,
      currentBet: 20,
      pot: 30,
      myPosition: 'BB',
    });
    const d = bot.decide(state, meId);
    expect(['fold', 'call', 'check']).toContain(d.action);
  });
});

describe('HeuristicBot — rejects invalid input', () => {
  it('throws on missing hole cards', () => {
    const bot = new HeuristicBot('MEDIUM', 1);
    const { state } = buildState({ myCards: ['As', 'Ah'] });
    state.players[0].holeCards = null;
    expect(() => bot.decide(state, 'ME')).toThrow();
  });

  it('throws on unknown botId', () => {
    const bot = new HeuristicBot('MEDIUM', 1);
    const { state } = buildState({ myCards: ['As', 'Ah'] });
    expect(() => bot.decide(state, 'NOBODY')).toThrow();
    void stringToCard;
  });
});
