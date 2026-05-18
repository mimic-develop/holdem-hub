import { describe, expect, it } from 'vitest';
import type { CompletedHand } from '../../types/game';
import { groupHandsBySession } from '../group-hands';

function makeHand(overrides: Partial<CompletedHand>): CompletedHand {
  return {
    handId: 'h_' + Math.random().toString(36).slice(2),
    playedAt: 0,
    handNumber: 1,
    mode: 'AI',
    aiDifficulty: 'MEDIUM',
    opponentName: 'BOT',
    myPosition: 'BTN' as CompletedHand['myPosition'],
    initialStacks: [1000, 1000],
    finalStacks: [1000, 1000],
    result: 'WIN',
    myWinLoss: 0,
    board: [],
    myCards: [
      { rank: 14, suit: 's' as CompletedHand['myCards'][0]['suit'] },
      { rank: 13, suit: 'h' as CompletedHand['myCards'][0]['suit'] },
    ],
    wentToShowdown: false,
    actionLog: [],
    deckSnapshot: [],
    ...overrides,
  };
}

describe('groupHandsBySession', () => {
  it('returns empty array for empty input', () => {
    expect(groupHandsBySession([])).toEqual([]);
  });

  it('groups by explicit sessionId', () => {
    const hands = [
      makeHand({ sessionId: 'A', handId: 'a1', playedAt: 100, handNumber: 1, myWinLoss: 50, result: 'WIN' }),
      makeHand({ sessionId: 'A', handId: 'a2', playedAt: 200, handNumber: 2, myWinLoss: -30, result: 'LOSS' }),
      makeHand({ sessionId: 'B', handId: 'b1', playedAt: 300, handNumber: 1, myWinLoss: 20, result: 'WIN' }),
    ];
    const groups = groupHandsBySession(hands);
    expect(groups).toHaveLength(2);
    // latest endedAt first
    expect(groups[0].sessionId).toBe('B');
    expect(groups[1].sessionId).toBe('A');
    expect(groups[1].hands).toHaveLength(2);
    expect(groups[1].netChips).toBe(20);
    expect(groups[1].wins).toBe(1);
    expect(groups[1].losses).toBe(1);
    expect(groups[1].inferred).toBe(false);
  });

  it('keeps hands within a group sorted by handNumber asc', () => {
    const hands = [
      makeHand({ sessionId: 'A', handId: 'a3', playedAt: 300, handNumber: 3 }),
      makeHand({ sessionId: 'A', handId: 'a1', playedAt: 100, handNumber: 1 }),
      makeHand({ sessionId: 'A', handId: 'a2', playedAt: 200, handNumber: 2 }),
    ];
    const groups = groupHandsBySession(hands);
    expect(groups).toHaveLength(1);
    expect(groups[0].hands.map((h) => h.handNumber)).toEqual([1, 2, 3]);
  });

  it('starts a new legacy group when handNumber resets to 1', () => {
    const t0 = 1_700_000_000_000;
    const hands = [
      makeHand({ handId: 'l1', playedAt: t0 + 0, handNumber: 1 }),
      makeHand({ handId: 'l2', playedAt: t0 + 1000, handNumber: 2 }),
      // Same mode, same difficulty, but handNumber resets — new game.
      makeHand({ handId: 'l3', playedAt: t0 + 2000, handNumber: 1 }),
      makeHand({ handId: 'l4', playedAt: t0 + 3000, handNumber: 2 }),
    ];
    const groups = groupHandsBySession(hands);
    expect(groups).toHaveLength(2);
    expect(groups[0].inferred).toBe(true);
    expect(groups[0].hands).toHaveLength(2);
    expect(groups[1].hands).toHaveLength(2);
  });

  it('starts a new legacy group when time gap exceeds 30 minutes', () => {
    const t0 = 1_700_000_000_000;
    const gap = 31 * 60 * 1000;
    const hands = [
      makeHand({ handId: 'l1', playedAt: t0 + 0, handNumber: 1 }),
      makeHand({ handId: 'l2', playedAt: t0 + 1000, handNumber: 2 }),
      // 31 min later, handNumber=3 — wide gap forces new group despite no reset.
      makeHand({ handId: 'l3', playedAt: t0 + gap, handNumber: 3 }),
    ];
    const groups = groupHandsBySession(hands);
    expect(groups).toHaveLength(2);
    // newest group first
    expect(groups[0].hands).toHaveLength(1);
    expect(groups[0].hands[0].handId).toBe('l3');
  });

  it('does not merge legacy hands of different modes', () => {
    const t0 = 1_700_000_000_000;
    const hands = [
      makeHand({ handId: 'a1', mode: 'AI', playedAt: t0, handNumber: 1 }),
      makeHand({ handId: 'r1', mode: 'REMOTE', playedAt: t0 + 1000, handNumber: 2 }),
    ];
    const groups = groupHandsBySession(hands);
    expect(groups).toHaveLength(2);
  });

  it('mixes legacy and explicit sessionId without collision', () => {
    const hands = [
      makeHand({ sessionId: 'A', handId: 'a1', playedAt: 100, handNumber: 1 }),
      makeHand({ handId: 'l1', playedAt: 200, handNumber: 1 }),
      makeHand({ sessionId: 'A', handId: 'a2', playedAt: 300, handNumber: 2 }),
    ];
    const groups = groupHandsBySession(hands);
    expect(groups).toHaveLength(2);
    const aGroup = groups.find((g) => g.sessionId === 'A');
    expect(aGroup?.hands).toHaveLength(2);
    expect(aGroup?.inferred).toBe(false);
  });
});
