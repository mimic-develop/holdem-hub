import { describe, expect, it } from 'vitest';
import type { CompletedHand, PostHandInsight } from '../../types/game';
import { aggregateFromHands, detectMilestones } from '../stats';

const NOW = new Date('2026-04-26T12:00:00Z').getTime();
const DAY = 86_400_000;

function makeAnalysis(overrides: Partial<PostHandInsight> = {}): PostHandInsight {
  return {
    overallScore: 75,
    streetScores: { preflop: 80, flop: 70 },
    actionEvaluations: [
      {
        actionIndex: 0,
        street: 'preflop',
        action: 'raise',
        amount: 6,
        score: 85,
        recommended: 'raise (freq 90%)',
        reasoning: '강한 핸드',
      },
    ],
    mistakes: [],
    strengths: [],
    summary: '괜찮은 플레이',
    ...overrides,
  };
}

function makeHand(overrides: Partial<CompletedHand> = {}): CompletedHand {
  const base: CompletedHand = {
    handId: `h-${Math.random().toString(36).slice(2, 10)}`,
    playedAt: NOW,
    handNumber: 1,
    mode: 'AI',
    aiDifficulty: 'MEDIUM',
    opponentName: 'AI 봇',
    myPosition: 'SB',
    initialStacks: [200, 200],
    finalStacks: [205, 195],
    result: 'WIN',
    myWinLoss: 5,
    board: [],
    myCards: [
      { suit: 's', rank: 14 },
      { suit: 'h', rank: 14 },
    ],
    wentToShowdown: false,
    actionLog: [
      {
        street: 'preflop',
        playerId: 'me',
        playerLabel: '나',
        action: 'raise',
        amount: 6,
        potAfter: 8,
      },
    ],
    deckSnapshot: [],
    postHandInsight: makeAnalysis(),
  };
  return { ...base, ...overrides };
}

describe('storage/stats — aggregateFromHands', () => {
  it('empty input returns zero-everything', () => {
    const stats = aggregateFromHands([], 'today', NOW);
    expect(stats.totalHands).toBe(0);
    expect(stats.evaluatedHands).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.avgGtoScore).toBe(0);
    expect(stats.avgScoreDelta).toBeNull();
    expect(stats.scoreTrend).toEqual([]);
    expect(stats.topMistakes).toEqual([]);
    expect(stats.spotPerformance).toEqual([]);
    expect(stats.winStreak).toBe(0);
  });

  it('today range only includes hands from today', () => {
    const hands = [
      makeHand({ handId: 'today1', playedAt: NOW }),
      makeHand({ handId: 'yest1', playedAt: NOW - DAY }),
      makeHand({ handId: 'today2', playedAt: NOW - 60_000 }),
    ];
    const s = aggregateFromHands(hands, 'today', NOW);
    expect(s.totalHands).toBe(2);
  });

  it('week range = today + last 6 days', () => {
    const hands = [
      makeHand({ handId: '0', playedAt: NOW }),
      makeHand({ handId: '5', playedAt: NOW - 5 * DAY }),
      makeHand({ handId: '8', playedAt: NOW - 8 * DAY }), // outside
    ];
    const s = aggregateFromHands(hands, 'week', NOW);
    expect(s.totalHands).toBe(2);
  });

  it('avgScoreDelta compares vs previous comparable window', () => {
    const hands = [
      // Today
      makeHand({
        handId: 'today',
        playedAt: NOW,
        postHandInsight: makeAnalysis({ overallScore: 80 }),
      }),
      // Yesterday (previous 'today')
      makeHand({
        handId: 'yest',
        playedAt: NOW - DAY,
        postHandInsight: makeAnalysis({ overallScore: 60 }),
      }),
    ];
    const s = aggregateFromHands(hands, 'today', NOW);
    expect(s.avgGtoScore).toBe(80);
    expect(s.avgScoreDelta).toBe(20);
  });

  it('streetAvgScores averages per street across hands', () => {
    const hands = [
      makeHand({
        handId: 'a',
        postHandInsight: makeAnalysis({
          streetScores: { preflop: 80, flop: 60 },
        }),
      }),
      makeHand({
        handId: 'b',
        postHandInsight: makeAnalysis({
          streetScores: { preflop: 100, turn: 50 },
        }),
      }),
    ];
    const s = aggregateFromHands(hands, 'today', NOW);
    expect(s.streetAvgScores.preflop).toBe(90);
    expect(s.streetAvgScores.flop).toBe(60);
    expect(s.streetAvgScores.turn).toBe(50);
    expect(s.streetAvgScores.river).toBeUndefined();
  });

  it('topMistakes counts and sorts by frequency desc', () => {
    const hands = [
      makeHand({
        handId: 'a',
        postHandInsight: makeAnalysis({
          mistakes: [
            { actionIndex: 0, street: 'flop', type: 'VALUE_MISS', description: '' },
          ],
          actionEvaluations: [
            {
              actionIndex: 0,
              street: 'flop',
              action: 'check',
              amount: 0,
              score: 20,
              recommended: 'bet',
              reasoning: '',
            },
          ],
        }),
      }),
      makeHand({
        handId: 'b',
        postHandInsight: makeAnalysis({
          mistakes: [
            { actionIndex: 0, street: 'turn', type: 'BLUFF_TOO_OFTEN', description: '' },
            { actionIndex: 1, street: 'river', type: 'BLUFF_TOO_OFTEN', description: '' },
          ],
          actionEvaluations: [
            {
              actionIndex: 0,
              street: 'turn',
              action: 'bet',
              amount: 10,
              score: 12,
              recommended: 'check',
              reasoning: '',
            },
            {
              actionIndex: 1,
              street: 'river',
              action: 'bet',
              amount: 30,
              score: 12,
              recommended: 'check',
              reasoning: '',
            },
          ],
        }),
      }),
    ];
    const s = aggregateFromHands(hands, 'today', NOW);
    expect(s.topMistakes).toHaveLength(2);
    expect(s.topMistakes[0].type).toBe('BLUFF_TOO_OFTEN');
    expect(s.topMistakes[0].count).toBe(2);
    expect(s.topMistakes[0].avgScoreImpact).toBeCloseTo(88, 0); // 100 - 12
    expect(s.topMistakes[1].type).toBe('VALUE_MISS');
  });

  it('spotPerformance buckets preflop SB hands as SB_OPEN when no opp action', () => {
    const hand = makeHand({
      handId: 'sb-open',
      myPosition: 'SB',
      actionLog: [
        {
          street: 'preflop',
          playerId: 'me',
          playerLabel: '나',
          action: 'raise',
          amount: 6,
          potAfter: 8,
        },
      ],
      postHandInsight: makeAnalysis({
        actionEvaluations: [
          {
            actionIndex: 0,
            street: 'preflop',
            action: 'raise',
            amount: 6,
            score: 95,
            recommended: 'raise',
            reasoning: '',
          },
        ],
      }),
    });
    const s = aggregateFromHands([hand], 'today', NOW);
    const sb = s.spotPerformance.find((p) => p.spotKey === 'SB_OPEN');
    expect(sb).toBeDefined();
    expect(sb!.handsCount).toBe(1);
    expect(sb!.avgScore).toBe(95);
    expect(sb!.perfectCount).toBe(1);
  });

  it('spotPerformance classifies SB facing 3bet correctly', () => {
    const hand = makeHand({
      handId: 'sb-3bet',
      myPosition: 'SB',
      actionLog: [
        {
          street: 'preflop',
          playerId: 'me',
          playerLabel: '나',
          action: 'raise',
          amount: 6,
          potAfter: 8,
        },
        {
          street: 'preflop',
          playerId: 'opp',
          playerLabel: 'AI 봇',
          action: 'raise',
          amount: 18,
          potAfter: 24,
        },
        {
          street: 'preflop',
          playerId: 'me',
          playerLabel: '나',
          action: 'fold',
          amount: 0,
          potAfter: 24,
        },
      ],
      postHandInsight: makeAnalysis({
        actionEvaluations: [
          {
            actionIndex: 0,
            street: 'preflop',
            action: 'raise',
            amount: 6,
            score: 95,
            recommended: '',
            reasoning: '',
          },
          {
            actionIndex: 2,
            street: 'preflop',
            action: 'fold',
            amount: 0,
            score: 70,
            recommended: '',
            reasoning: '',
          },
        ],
      }),
    });
    const s = aggregateFromHands([hand], 'today', NOW);
    const open = s.spotPerformance.find((p) => p.spotKey === 'SB_OPEN');
    const vs3 = s.spotPerformance.find((p) => p.spotKey === 'SB_VS_3BET');
    expect(open?.handsCount).toBe(1);
    expect(vs3?.handsCount).toBe(1);
    expect(vs3?.avgScore).toBe(70);
  });

  it('scoreTrend buckets by day, sorted ascending', () => {
    const hands = [
      makeHand({
        handId: 'd2',
        playedAt: NOW - 2 * DAY,
        postHandInsight: makeAnalysis({ overallScore: 60 }),
      }),
      makeHand({
        handId: 'd0',
        playedAt: NOW,
        postHandInsight: makeAnalysis({ overallScore: 90 }),
      }),
      makeHand({
        handId: 'd0b',
        playedAt: NOW - 3600_000, // also today
        postHandInsight: makeAnalysis({ overallScore: 70 }),
      }),
    ];
    const s = aggregateFromHands(hands, 'week', NOW);
    expect(s.scoreTrend).toHaveLength(2);
    expect(s.scoreTrend[0].bucket).toBeLessThan(s.scoreTrend[1].bucket);
    // Day 0 (today) has two hands → average of 90 + 70 = 80
    expect(s.scoreTrend[1].avgScore).toBe(80);
    expect(s.scoreTrend[1].handsCount).toBe(2);
  });

  it('winStreak counts consecutive WINs from newest hand backwards', () => {
    // listHands returns newest-first, so we mirror that here.
    const hands = [
      makeHand({ handId: 'newest', result: 'WIN' }),
      makeHand({ handId: 'n-1', result: 'WIN' }),
      makeHand({ handId: 'n-2', result: 'WIN' }),
      makeHand({ handId: 'n-3', result: 'LOSS' }),
      makeHand({ handId: 'n-4', result: 'WIN' }),
    ];
    const s = aggregateFromHands(hands, 'all', NOW);
    expect(s.winStreak).toBe(3);
  });

  it('hands without postHandInsight still count for total/winrate but not avgScore', () => {
    const hands = [
      makeHand({ handId: 'a', result: 'WIN', postHandInsight: makeAnalysis({ overallScore: 80 }) }),
      makeHand({ handId: 'b', result: 'LOSS', postHandInsight: undefined }),
    ];
    const s = aggregateFromHands(hands, 'today', NOW);
    expect(s.totalHands).toBe(2);
    expect(s.evaluatedHands).toBe(1);
    expect(s.avgGtoScore).toBe(80);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
  });
});

describe('storage/stats — detectMilestones', () => {
  it('FIRST_HAND fires on the first ever hand', () => {
    const latest = makeHand();
    const ms = detectMilestones([], [latest], latest);
    expect(ms.find((m) => m.id === 'FIRST_HAND')).toBeDefined();
  });

  it('FIRST_HIGH_SCORE fires once when crossing 80', () => {
    const before = [
      makeHand({ handId: 'b', postHandInsight: makeAnalysis({ overallScore: 70 }) }),
    ];
    const latest = makeHand({
      handId: 'l',
      postHandInsight: makeAnalysis({ overallScore: 85 }),
    });
    const ms = detectMilestones(before, [...before, latest], latest);
    expect(ms.find((m) => m.id === 'FIRST_HIGH_SCORE')).toBeDefined();
  });

  it('FIRST_HIGH_SCORE does NOT re-fire if a previous hand was already 80+', () => {
    const before = [
      makeHand({ handId: 'b', postHandInsight: makeAnalysis({ overallScore: 88 }) }),
    ];
    const latest = makeHand({
      handId: 'l',
      postHandInsight: makeAnalysis({ overallScore: 92 }),
    });
    const ms = detectMilestones(before, [...before, latest], latest);
    expect(ms.find((m) => m.id === 'FIRST_HIGH_SCORE')).toBeUndefined();
  });

  it('PERFECT_HAND fires on >= 95', () => {
    const latest = makeHand({
      postHandInsight: makeAnalysis({ overallScore: 96 }),
    });
    const ms = detectMilestones([], [latest], latest);
    expect(ms.find((m) => m.id === 'PERFECT_HAND')).toBeDefined();
  });

  it('HUNDRED_HANDS fires when crossing 100', () => {
    const before = Array.from({ length: 99 }, (_, i) =>
      makeHand({ handId: `b-${i}` }),
    );
    const latest = makeHand({ handId: 'l' });
    const ms = detectMilestones(before, [...before, latest], latest);
    expect(ms.find((m) => m.id === 'HUNDRED_HANDS')).toBeDefined();
  });

  it('WIN_STREAK_3 fires when streak grows from 2 to 3', () => {
    const before = [
      makeHand({ handId: 'a', result: 'LOSS' }),
      makeHand({ handId: 'b', result: 'WIN' }),
      makeHand({ handId: 'c', result: 'WIN' }),
    ];
    const latest = makeHand({ handId: 'd', result: 'WIN' });
    const ms = detectMilestones(before, [...before, latest], latest);
    expect(ms.find((m) => m.id === 'WIN_STREAK_3')).toBeDefined();
  });

  it('WIN_STREAK_3 does NOT fire if streak stayed at 1', () => {
    const before = [
      makeHand({ handId: 'a', result: 'WIN' }),
    ];
    const latest = makeHand({ handId: 'b', result: 'LOSS' });
    const ms = detectMilestones(before, [...before, latest], latest);
    expect(ms.find((m) => m.id === 'WIN_STREAK_3')).toBeUndefined();
  });

  it('PREFLOP_MASTER requires >= 20 evaluated hands and crossing 90 avg', () => {
    // 20 hands with preflop=92 → average crosses from 0 to 92.
    const before: CompletedHand[] = [];
    const after = Array.from({ length: 20 }, (_, i) =>
      makeHand({
        handId: `h-${i}`,
        postHandInsight: makeAnalysis({ streetScores: { preflop: 92 } }),
      }),
    );
    const ms = detectMilestones(before, after, after[after.length - 1]);
    expect(ms.find((m) => m.id === 'PREFLOP_MASTER')).toBeDefined();
  });
});
