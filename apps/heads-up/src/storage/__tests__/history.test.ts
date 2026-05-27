/**
 * history.ts는 API 기반으로 전환됨.
 * apiFetch를 in-memory mock으로 대체해 CRUD 계약을 검증.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HandRank } from '../../engine/hand-evaluator';
import type { CompletedHand } from '../../types/game';
import {
  getHand,
  getStats,
  listHands,
  saveHand,
} from '../history';

// ── in-memory API stub ───────────────────────────────────────────────────────
let _hands: CompletedHand[] = [];

vi.mock('@hh/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hh/shared')>();
  return {
    ...actual,
    apiFetch: vi.fn(async (path: string, options?: { method?: string; body?: string }) => {
      const method = (options?.method ?? 'GET').toUpperCase();

      // POST /play-lab/heads-up/hands
      if (method === 'POST' && path === '/play-lab/heads-up/hands') {
        const hand: CompletedHand = JSON.parse(options?.body ?? '{}');
        _hands.push(hand);
        return { handId: hand.handId };
      }

      // GET /play-lab/heads-up/hands/:id
      if (method === 'GET' && /^\/play-lab\/heads-up\/hands\/[^/]+$/.test(path)) {
        const id = path.split('/').at(-1)!;
        const found = _hands.find((h) => h.handId === id);
        if (!found) throw Object.assign(new Error('Not Found'), { status: 404 });
        return found;
      }

      // GET /play-lab/heads-up/hands (list)
      if (method === 'GET' && path.startsWith('/play-lab/heads-up/hands')) {
        const qs = path.includes('?') ? new URLSearchParams(path.split('?')[1]) : new URLSearchParams();
        let result = [..._hands].sort((a, b) => b.playedAt - a.playedAt);
        const mode = qs.get('mode');
        if (mode) result = result.filter((h) => h.mode === mode);
        const offset = Number(qs.get('offset') ?? 0);
        const limit = Number(qs.get('limit') ?? result.length);
        return { hands: result.slice(offset, offset + limit), total: _hands.length };
      }

      // GET /play-lab/heads-up/stats
      if (method === 'GET' && path === '/play-lab/heads-up/stats') {
        const total = _hands.length;
        const wins = _hands.filter((h) => h.result === 'WIN').length;
        const losses = _hands.filter((h) => h.result === 'LOSS').length;
        const splits = _hands.filter((h) => h.result === 'SPLIT').length;
        const netChips = _hands.reduce((s, h) => s + h.myWinLoss, 0);
        return {
          total, wins, losses, splits, netChips,
          winRate: total > 0 ? wins / total : 0,
        };
      }

      throw new Error(`Unhandled mock: ${method} ${path}`);
    }),
  };
});
// ────────────────────────────────────────────────────────────────────────────

function makeHand(overrides: Partial<CompletedHand> = {}): CompletedHand {
  const base: CompletedHand = {
    handId: `h-${Math.random().toString(36).slice(2, 10)}`,
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
    myCards: [
      { suit: 's', rank: 14 },
      { suit: 'h', rank: 14 },
    ],
    wentToShowdown: false,
    actionLog: [],
    deckSnapshot: [],
  };
  return { ...base, ...overrides };
}

describe('storage/history — basic CRUD', () => {
  beforeEach(() => {
    _hands = [];
  });

  it('saves and retrieves a single hand by id', async () => {
    const h = makeHand({ handId: 'test-1' });
    await saveHand(h);
    const got = await getHand('test-1');
    expect(got).not.toBeNull();
    expect(got!.handId).toBe('test-1');
    expect(got!.myCards[0].rank).toBe(14);
    expect(got!.result).toBe('WIN');
  });

  it('returns null for missing hand', async () => {
    const got = await getHand('does-not-exist');
    expect(got).toBeNull();
  });

  it('listHands returns most-recent first', async () => {
    const now = Date.now();
    await saveHand(makeHand({ handId: 'a', playedAt: now - 3000, handNumber: 1 }));
    await saveHand(makeHand({ handId: 'b', playedAt: now - 1000, handNumber: 3 }));
    await saveHand(makeHand({ handId: 'c', playedAt: now - 2000, handNumber: 2 }));
    const list = await listHands();
    expect(list.map((h) => h.handId)).toEqual(['b', 'c', 'a']);
  });

  it('listHands paginates via offset + limit', async () => {
    const now = Date.now();
    for (let i = 0; i < 25; i++) {
      await saveHand(makeHand({ handId: `h-${i}`, playedAt: now - i * 1000 }));
    }
    const page1 = await listHands({ limit: 10, offset: 0 });
    const page2 = await listHands({ limit: 10, offset: 10 });
    const page3 = await listHands({ limit: 10, offset: 20 });
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(5);
    // No overlap
    const allIds = [...page1, ...page2, ...page3].map((h) => h.handId);
    expect(new Set(allIds).size).toBe(25);
  });

  it('listHands filters by mode', async () => {
    await saveHand(makeHand({ handId: 'ai-1', mode: 'AI', playedAt: Date.now() - 2000 }));
    await saveHand(makeHand({ handId: 'remote-1', mode: 'REMOTE', playedAt: Date.now() - 1000 }));
    await saveHand(makeHand({ handId: 'ai-2', mode: 'AI', playedAt: Date.now() }));
    const aiOnly = await listHands({ mode: 'AI' });
    expect(aiOnly.map((h) => h.handId)).toEqual(['ai-2', 'ai-1']);
    const remoteOnly = await listHands({ mode: 'REMOTE' });
    expect(remoteOnly.map((h) => h.handId)).toEqual(['remote-1']);
  });
});

describe('storage/history — stats', () => {
  beforeEach(() => {
    _hands = [];
  });

  it('empty store returns zero stats', async () => {
    const s = await getStats();
    expect(s).toEqual({
      total: 0,
      wins: 0,
      losses: 0,
      splits: 0,
      netChips: 0,
      winRate: 0,
    });
  });

  it('computes wins/losses/splits/netChips across hands', async () => {
    await saveHand(makeHand({ handId: '1', result: 'WIN', myWinLoss: 10 }));
    await saveHand(makeHand({ handId: '2', result: 'WIN', myWinLoss: 5 }));
    await saveHand(makeHand({ handId: '3', result: 'LOSS', myWinLoss: -8 }));
    await saveHand(makeHand({ handId: '4', result: 'SPLIT', myWinLoss: 0 }));
    const s = await getStats();
    expect(s.total).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.splits).toBe(1);
    expect(s.netChips).toBe(7);
    expect(s.winRate).toBeCloseTo(0.5, 5);
  });

  it('handles 50+ hands efficiently', async () => {
    const start = performance.now();
    for (let i = 0; i < 60; i++) {
      await saveHand(
        makeHand({
          handId: `perf-${i}`,
          result: i % 3 === 0 ? 'WIN' : i % 3 === 1 ? 'LOSS' : 'SPLIT',
          myWinLoss: i % 3 === 0 ? 5 : i % 3 === 1 ? -3 : 0,
        }),
      );
    }
    const s = await getStats();
    const elapsed = performance.now() - start;
    expect(s.total).toBe(60);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('storage/history — round-trip with full CompletedHand', () => {
  beforeEach(() => {
    _hands = [];
  });

  it('preserves nested objects (board, cards, actionLog, winningHand)', async () => {
    const hand = makeHand({
      handId: 'rich',
      wentToShowdown: true,
      board: [
        { suit: 'c', rank: 9 },
        { suit: 'd', rank: 9 },
        { suit: 'h', rank: 2 },
        { suit: 's', rank: 7 },
        { suit: 'c', rank: 3 },
      ],
      opponentCards: [
        { suit: 'c', rank: 13 },
        { suit: 'd', rank: 13 },
      ],
      winningHand: {
        rank: HandRank.THREE_OF_A_KIND,
        score: 123456,
        kickers: [{ suit: 's', rank: 14 }],
      },
      actionLog: [
        {
          street: 'preflop',
          playerId: 'me',
          playerLabel: '나',
          action: 'call',
          amount: 1,
          potAfter: 4,
        },
        {
          street: 'preflop',
          playerId: 'bot',
          playerLabel: 'AI 봇 (MEDIUM)',
          action: 'check',
          amount: 0,
          potAfter: 4,
        },
      ],
    });
    await saveHand(hand);
    const got = await getHand('rich');
    expect(got).not.toBeNull();
    expect(got!.board).toHaveLength(5);
    expect(got!.board[0]).toEqual({ suit: 'c', rank: 9 });
    expect(got!.opponentCards![0].rank).toBe(13);
    expect(got!.winningHand?.rank).toBe(HandRank.THREE_OF_A_KIND);
    expect(got!.actionLog).toHaveLength(2);
    expect(got!.actionLog[0].playerLabel).toBe('나');
  });
});
