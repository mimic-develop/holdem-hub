import { describe, expect, it } from 'vitest';
import { stringToCard, type Card } from '../../engine/card';
import type { CompletedHand } from '../../types/game';
import { evaluateHand } from '../hand-evaluator-main';

function c(s: string): Card {
  return stringToCard(s);
}

function makeHand(overrides: Partial<CompletedHand> = {}): CompletedHand {
  const base: CompletedHand = {
    handId: 'test-hand',
    playedAt: Date.now(),
    handNumber: 1,
    mode: 'AI',
    aiDifficulty: 'MEDIUM',
    opponentName: 'AI 봇 (MEDIUM)',
    myPosition: 'SB',
    initialStacks: [200, 200],
    finalStacks: [205, 195],
    result: 'WIN',
    myWinLoss: 5,
    board: [],
    myCards: [c('As'), c('Ah')],
    wentToShowdown: false,
    actionLog: [],
    deckSnapshot: [],
  };
  return { ...base, ...overrides };
}

const FAST = { iterations: 150 };

describe('evaluateHand — empty / degenerate hands', () => {
  it('returns empty analysis when there are no user actions', () => {
    const hand = makeHand({ actionLog: [] });
    const g = evaluateHand(hand, FAST);
    expect(g.overallScore).toBe(0);
    expect(g.actionEvaluations).toEqual([]);
    expect(g.summary).toMatch(/내 액션/);
  });
});

describe('evaluateHand — obvious good play (AA raise preflop, bot folds)', () => {
  it('scores 90+ for a premium preflop raise', () => {
    const hand = makeHand({
      myPosition: 'SB',
      myCards: [c('As'), c('Ah')],
      actionLog: [
        {
          street: 'preflop',
          playerId: 'me',
          playerLabel: '나',
          action: 'raise',
          amount: 5,
          potAfter: 8,
        },
        {
          street: 'preflop',
          playerId: 'bot',
          playerLabel: 'AI 봇',
          action: 'fold',
          amount: 0,
          potAfter: 8,
        },
      ],
    });
    const g = evaluateHand(hand, FAST);
    expect(g.overallScore).toBeGreaterThanOrEqual(90);
    expect(g.streetScores.preflop).toBeGreaterThanOrEqual(90);
    expect(g.mistakes.length).toBe(0);
  });
});

describe('evaluateHand — obvious bad play (fold AA to small bet)', () => {
  it('scores low for folding AA to a min-bet on an undercard board', () => {
    const hand = makeHand({
      myPosition: 'BB',
      myCards: [c('As'), c('Ah')],
      board: [c('7s'), c('4d'), c('2c')],
      wentToShowdown: false,
      initialStacks: [200, 200],
      finalStacks: [196, 204],
      myWinLoss: -4,
      result: 'LOSS',
      actionLog: [
        {
          street: 'preflop',
          playerId: 'bot',
          playerLabel: 'AI 봇',
          action: 'call',
          amount: 1,
          potAfter: 4,
        },
        {
          street: 'preflop',
          playerId: 'me',
          playerLabel: '나',
          action: 'check',
          amount: 0,
          potAfter: 4,
        },
        {
          street: 'flop',
          playerId: 'me',
          playerLabel: '나',
          action: 'check',
          amount: 0,
          potAfter: 4,
        },
        {
          street: 'flop',
          playerId: 'bot',
          playerLabel: 'AI 봇',
          action: 'bet',
          amount: 2,
          potAfter: 6,
        },
        {
          street: 'flop',
          playerId: 'me',
          playerLabel: '나',
          action: 'fold',
          amount: 0,
          potAfter: 6,
        },
      ],
    });
    const g = evaluateHand(hand, FAST);
    // The flop fold of AA (overpair) to a half-pot bet is terrible.
    // Expect some mistake flagged and low overall.
    expect(g.mistakes.length).toBeGreaterThanOrEqual(1);
    expect(g.overallScore).toBeLessThan(75);
  });
});

describe('evaluateHand — performance', () => {
  it('evaluates a full 4-street hand in under 2 seconds', () => {
    const hand = makeHand({
      myPosition: 'SB',
      myCards: [c('Ks'), c('Qs')],
      board: [c('Kd'), c('8c'), c('2h'), c('5s'), c('9d')],
      wentToShowdown: true,
      actionLog: [
        { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'raise', amount: 5, potAfter: 7 },
        { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'call', amount: 3, potAfter: 10 },
        { street: 'flop', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 10 },
        { street: 'flop', playerId: 'me', playerLabel: '나', action: 'bet', amount: 7, potAfter: 17 },
        { street: 'flop', playerId: 'bot', playerLabel: 'B', action: 'call', amount: 7, potAfter: 24 },
        { street: 'turn', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 24 },
        { street: 'turn', playerId: 'me', playerLabel: '나', action: 'bet', amount: 16, potAfter: 40 },
        { street: 'turn', playerId: 'bot', playerLabel: 'B', action: 'call', amount: 16, potAfter: 56 },
        { street: 'river', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 56 },
        { street: 'river', playerId: 'me', playerLabel: '나', action: 'check', amount: 0, potAfter: 56 },
      ],
    });
    const start = performance.now();
    const g = evaluateHand(hand, FAST);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(g.actionEvaluations.length).toBeGreaterThan(0);
    expect(g.overallScore).toBeGreaterThanOrEqual(0);
    expect(g.overallScore).toBeLessThanOrEqual(100);
    expect(Object.keys(g.streetScores).length).toBeGreaterThan(0);
  }, 5000);
});

describe('evaluateHand — equity field propagation (STEP 9)', () => {
  it('postflop ActionEvaluation carries equity in [0,1]', () => {
    const hand = makeHand({
      myPosition: 'SB',
      myCards: [c('As'), c('Ah')],
      board: [c('9s'), c('7d'), c('2c')],
      actionLog: [
        { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'call', amount: 1, potAfter: 4 },
        { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 4 },
        { street: 'flop', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 4 },
        { street: 'flop', playerId: 'me', playerLabel: '나', action: 'bet', amount: 3, potAfter: 7 },
      ],
    });
    const g = evaluateHand(hand, FAST);
    const flopEval = g.actionEvaluations.find((e) => e.street === 'flop');
    expect(flopEval).toBeDefined();
    expect(typeof flopEval!.equity).toBe('number');
    expect(flopEval!.equity!).toBeGreaterThan(0.5);
    expect(flopEval!.equity!).toBeLessThanOrEqual(1);
  });

  it('preflop ActionEvaluation has undefined equity (chart-based, not equity-based)', () => {
    const hand = makeHand({
      myPosition: 'SB',
      myCards: [c('As'), c('Ah')],
      actionLog: [
        { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'raise', amount: 5, potAfter: 7 },
        { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'fold', amount: 0, potAfter: 7 },
      ],
    });
    const g = evaluateHand(hand, FAST);
    const preflopEval = g.actionEvaluations.find((e) => e.street === 'preflop');
    expect(preflopEval).toBeDefined();
    expect(preflopEval!.equity).toBeUndefined();
  });
});

describe('evaluateHand — toCall reconstruction across streets', () => {
  it('correctly identifies facing-a-bet on flop (toCall > 0 in snapshot)', () => {
    // Me=SB. Limp preflop, opp checks. Flop: opp bets 3. I call.
    // My flop action should be evaluated as "facing a bet" (toCall=3),
    // not as "can check free" (the replay bug would mis-set toCall=0).
    const hand = makeHand({
      myPosition: 'SB',
      myCards: [c('As'), c('Ah')],
      board: [c('9s'), c('7d'), c('2c')],
      actionLog: [
        { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'call', amount: 1, potAfter: 4 },
        { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 4 },
        { street: 'flop', playerId: 'bot', playerLabel: 'B', action: 'bet', amount: 3, potAfter: 7 },
        // My call of 3 facing opp's bet on the flop.
        { street: 'flop', playerId: 'me', playerLabel: '나', action: 'call', amount: 3, potAfter: 10 },
      ],
    });
    const g = evaluateHand(hand, FAST);
    const flopEval = g.actionEvaluations.find((e) => e.street === 'flop');
    expect(flopEval).toBeDefined();
    // AA overpair on 972 dry board facing a mini-bet. Recommendation is raise
    // (value), user called — "slow-play" substitute alt in the 50-70 band.
    // Key regression check: score must NOT land in the 40-ish "passive with
    // marginal equity" band that the toCall=0 bug produced.
    expect(flopEval!.score).toBeGreaterThanOrEqual(55);
    // Guard: recommendation should NOT be "check" — the situation isn't free.
    expect(flopEval!.recommended).not.toMatch(/^체크/);
  });
});

describe('evaluateHand — no donk-bet recommendation (OOP preflop caller)', () => {
  it('recommends check (not a donk bet) for the OOP caller on the flop', () => {
    // Me=BB. SB opens, I call → opponent is the preflop aggressor and I'm OOP.
    // On the flop I act first with a free check. Even with strong top-pair
    // equity, the standard line is to check to the aggressor — the engine must
    // NOT recommend leading out (a donk bet).
    const hand = makeHand({
      myPosition: 'BB',
      myCards: [c('Ah'), c('9h')],
      board: [c('As'), c('7d'), c('2c')],
      actionLog: [
        { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'raise', amount: 5, potAfter: 8 },
        { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'call', amount: 4, potAfter: 12 },
        { street: 'flop', playerId: 'me', playerLabel: '나', action: 'check', amount: 0, potAfter: 12 },
        { street: 'flop', playerId: 'bot', playerLabel: 'B', action: 'check', amount: 0, potAfter: 12 },
      ],
    });
    const g = evaluateHand(hand, FAST);
    const flopEval = g.actionEvaluations.find((e) => e.street === 'flop');
    expect(flopEval).toBeDefined();
    expect(flopEval!.recommended).toMatch(/^체크/);
    // And checking it (the standard line) should score well, not be flagged.
    expect(flopEval!.score).toBeGreaterThanOrEqual(70);
  });
});

describe('evaluateHand — regression sample (10 varied hands)', () => {
  const cases: Array<{
    name: string;
    hand: CompletedHand;
    expectScoreMin?: number;
    expectScoreMax?: number;
  }> = [
    {
      name: 'premium preflop raise, insta-win',
      hand: makeHand({
        myCards: [c('Ks'), c('Kh')],
        actionLog: [
          { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'raise', amount: 5, potAfter: 8 },
          { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'fold', amount: 0, potAfter: 8 },
        ],
      }),
      expectScoreMin: 85,
    },
    {
      name: 'SB 72o fold preflop (correct)',
      hand: makeHand({
        myCards: [c('7s'), c('2h')],
        actionLog: [
          { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'fold', amount: 0, potAfter: 3 },
        ],
      }),
      expectScoreMin: 85,
    },
    {
      name: 'AA SB fold preflop (disaster)',
      hand: makeHand({
        myCards: [c('As'), c('Ah')],
        actionLog: [
          { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'fold', amount: 0, potAfter: 3 },
        ],
      }),
      expectScoreMax: 20,
    },
    {
      name: 'KK with reasonable 3bet call',
      hand: makeHand({
        myCards: [c('Ks'), c('Kh')],
        actionLog: [
          { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'raise', amount: 5, potAfter: 7 },
          { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'raise', amount: 16, potAfter: 21 },
          { street: 'preflop', playerId: 'me', playerLabel: '나', action: 'raise', amount: 40, potAfter: 56 },
          { street: 'preflop', playerId: 'bot', playerLabel: 'B', action: 'fold', amount: 0, potAfter: 56 },
        ],
      }),
      expectScoreMin: 60,
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const g = evaluateHand(tc.hand, FAST);
      expect(g.overallScore).toBeGreaterThanOrEqual(0);
      expect(g.overallScore).toBeLessThanOrEqual(100);
      if (tc.expectScoreMin !== undefined) {
        expect(
          g.overallScore,
          `${tc.name}: expected >= ${tc.expectScoreMin}, got ${g.overallScore}`,
        ).toBeGreaterThanOrEqual(tc.expectScoreMin);
      }
      if (tc.expectScoreMax !== undefined) {
        expect(
          g.overallScore,
          `${tc.name}: expected <= ${tc.expectScoreMax}, got ${g.overallScore}`,
        ).toBeLessThanOrEqual(tc.expectScoreMax);
      }
    });
  }
});
