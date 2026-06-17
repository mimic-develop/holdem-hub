import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompletedHand } from '../../types/game';
import { useGameStore } from '../game-store';
import { useToastStore } from '../toast-store';
import * as historyMod from '../../storage/history';
import { listHands } from '../../storage/history';

// storage/history는 API 기반으로 전환됨 — 테스트에서 in-memory mock으로 대체.
vi.mock('../../storage/history');

// in-memory 스토어 (테스트간 resetDB()로 초기화)
let _hands: CompletedHand[] = [];

function wireHistoryMocks() {
  // saveHand: upsert by handId — 동일 ID 재저장 시 덮어씀 (insight 갱신 패턴 지원)
  vi.mocked(historyMod.saveHand).mockImplementation(async (hand) => {
    const idx = _hands.findIndex((h) => h.handId === hand.handId);
    if (idx >= 0) _hands[idx] = hand;
    else _hands.push(hand);
  });
  vi.mocked(historyMod.getHand).mockImplementation(async (id) =>
    _hands.find((h) => h.handId === id) ?? null,
  );
  vi.mocked(historyMod.listHands).mockImplementation(async (opts = {}) => {
    let result = [..._hands].sort((a, b) => b.playedAt - a.playedAt);
    if (opts.mode) result = result.filter((h) => h.mode === opts.mode);
    const offset = opts.offset ?? 0;
    const limit = opts.limit !== undefined ? opts.limit : result.length;
    return result.slice(offset, offset + limit);
  });
  vi.mocked(historyMod.getStats).mockResolvedValue({
    total: 0, wins: 0, losses: 0, splits: 0, netChips: 0, winRate: 0,
  });
}

function reset() {
  useGameStore.getState().resetGame();
}

function resetDB() {
  _hands = [];
  wireHistoryMocks();
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('game-store — core flow', () => {
  beforeEach(() => { reset(); wireHistoryMocks(); });

  it('startAiGame initializes state with meta intact', () => {
    useGameStore.getState().startAiGame('EASY');
    const s = useGameStore.getState();
    expect(s.gameState).not.toBeNull();
    expect(s.mode).toBe('AI');
    expect(s.handNumber).toBe(1);
    expect(s.gameState!.players).toHaveLength(2);
    expect(s.gameState!.pot).toBe(30); // SB(10) + BB(20) = 30
  });

  it('sequential applyMyAction calls do not throw (meta survives clones)', () => {
    // User (SB) will act, then bot will act (might take time), so we test the first action only
    // and verify the state is still valid for a subsequent call.
    useGameStore.getState().startAiGame('EASY');
    const s = useGameStore.getState();
    if (s.gameState!.toActId !== s.myPlayerId) {
      // If user is BB in the first hand, rotate by calling startNextHand twice (unlikely).
      useGameStore.getState().startNextHand();
    }
    expect(() => {
      useGameStore.getState().applyMyAction('fold');
    }).not.toThrow();
    const after = useGameStore.getState();
    expect(after.isHandOver).toBe(true); // SB folds → hand over
  });

  it('after fold, startNextHand rotates blinds and keeps meta alive', async () => {
    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');
    // hand 1 ended (SB folded) — now start hand 2
    useGameStore.getState().startNextHand();
    const s = useGameStore.getState();
    expect(s.handNumber).toBe(2);
    expect(s.gameState).not.toBeNull();
    // Position rotation: user was SB, now BB
    expect(s.sbPlayerId).toBe(s.opponentPlayerId);
    // Bot should be thinking (it's SB now, acts first preflop)
    // Wait a bit for the bot to act — but we don't want to wait 2s in tests.
    // Just verify the bot action was scheduled.
    expect(s.isWaitingForBot || s.isHandOver).toBe(true);
    await waitMs(5); // let microtasks settle
  });

  it('conserves chips across multiple hands', async () => {
    useGameStore.getState().startAiGame('EASY');
    for (let i = 0; i < 3; i++) {
      const s0 = useGameStore.getState();
      // User always folds if possible; otherwise simulate a forced end.
      if (!s0.isHandOver && s0.gameState?.toActId === s0.myPlayerId) {
        useGameStore.getState().applyMyAction('fold');
      }
      // Hand might still be in progress (bot's turn) — we can't easily wait in unit tests.
      // If it's the bot's turn we skip this hand and just check stacks.
      const sAfter = useGameStore.getState();
      if (sAfter.isHandOver) {
        useGameStore.getState().startNextHand();
      }
    }
    const final = useGameStore.getState();
    if (final.gameState) {
      const totalStacks = final.gameState.players.reduce((sum, p) => sum + p.stack, 0);
      // stacks + pot should be conserved
      // 25BB × 20 chips/BB × 2 players = 1000 chips total.
      expect(totalStacks + final.gameState.pot).toBe(1000);
    }
  });

  it('multiple sequential user actions across streets preserve meta', async () => {
    // Ensure user is SB first
    useGameStore.getState().startAiGame('EASY');
    let s = useGameStore.getState();
    // If user is not SB this round, we bail — the first hand should always be user=SB
    // by the startAiGame setup.
    expect(s.sbPlayerId).toBe(s.myPlayerId);
    expect(s.gameState!.toActId).toBe(s.myPlayerId);

    // User (SB) calls — limps preflop. Bot (BB) must then act. Wait a tick.
    useGameStore.getState().applyMyAction('call', 1);
    s = useGameStore.getState();
    // Either hand ended immediately (unlikely after limp) or bot is up.
    expect(s.gameState).not.toBeNull();
    expect(s.isHandOver).toBe(false);

    // The store should NOT have lost meta. We probe this by calling getLegalActionsForMe
    // with the bot's turn (returns null) — this does NOT trigger applyAction.
    // Instead, we force-flush the bot's timer by advancing fake timers? vitest doesn't do
    // that by default. As a practical check: wait for the bot to act.
    // The bot's thinking delay is 800-2500ms, capped by `Math.max(200, decision.thinkingTimeMs)`.
    // We wait up to 3s.
    for (let i = 0; i < 60; i++) {
      await waitMs(50);
      const cur = useGameStore.getState();
      if (cur.isHandOver) break;
      if (cur.gameState!.toActId === cur.myPlayerId) break;
    }
    const after = useGameStore.getState();
    // The bot should have acted — either hand ended OR it's our turn again.
    expect(after.gameState).not.toBeNull();
    // If the bot raised, it's our turn. If it checked, we advanced streets; it's bot's turn (BB acts first postflop = bot).
    // Whatever the state, we must be able to call another action on our turn WITHOUT throwing.
    if (!after.isHandOver && after.gameState!.toActId === after.myPlayerId) {
      expect(() => {
        useGameStore.getState().applyMyAction('fold');
      }).not.toThrow();
    }
  }, 10000);

  it('drives a full hand via the store without losing meta', async () => {
    // Force user=SB first by startAiGame. Then we limp; bot acts (check or raise).
    // We wait for bot, then we act again. This used to throw "meta missing from state"
    // because the store's shallow clone of GameState dropped the WeakMap meta entry.
    useGameStore.getState().startAiGame('EASY');
    const s0 = useGameStore.getState();
    expect(s0.gameState!.toActId).toBe(s0.myPlayerId);

    useGameStore.getState().applyMyAction('call', 1);

    // Wait for bot to act (up to 3s)
    for (let i = 0; i < 60; i++) {
      await waitMs(50);
      const cur = useGameStore.getState();
      if (cur.isHandOver) break;
      if (cur.gameState!.toActId === cur.myPlayerId) break;
    }
    const afterBot = useGameStore.getState();
    expect(afterBot.gameState).not.toBeNull();

    // If our turn, push another action. Should NOT throw (previously threw
    // "meta missing from state" when the store's shallow clone dropped the
    // engine's WeakMap meta entry).
    if (!afterBot.isHandOver && afterBot.gameState!.toActId === afterBot.myPlayerId) {
      const legal = useGameStore.getState().getLegalActionsForMe();
      expect(legal).not.toBeNull();
      expect(() => {
        // Pick whatever is legal — fold if facing a bet, otherwise check.
        if (legal!.canCall) {
          useGameStore.getState().applyMyAction('fold');
        } else {
          useGameStore.getState().applyMyAction('check');
        }
      }).not.toThrow();
    }

    // Stack conservation
    const final = useGameStore.getState();
    if (final.gameState) {
      const total = final.gameState.players.reduce((sum, p) => sum + p.stack, 0);
      // 25BB × 20 chips/BB × 2 players = 1000 chips total.
      expect(total + final.gameState.pot).toBe(1000);
    }
  }, 10000);

  it('resetGame clears all state', () => {
    useGameStore.getState().startAiGame('HARD');
    useGameStore.getState().resetGame();
    const s = useGameStore.getState();
    expect(s.gameState).toBeNull();
    expect(s.mode).toBeNull();
    expect(s.handHistory).toEqual([]);
    expect(s._bot).toBeNull();
  });
});

describe('game-store — auto-save integration with IndexedDB', () => {
  beforeEach(() => {
    reset();
    resetDB();
  });

  afterEach(() => {
    resetDB();
  });

  it('saves a completed hand to storage on fold', async () => {
    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');
    // saveHand is fire-and-forget; give it a tick to complete.
    await waitMs(20);
    const list = await listHands();
    expect(list).toHaveLength(1);
    const saved = list[0];
    expect(saved.mode).toBe('AI');
    expect(saved.aiDifficulty).toBe('EASY');
    expect(saved.myPosition).toBe('SB'); // user is SB in hand 1
    expect(saved.result).toBe('LOSS'); // SB folded to BB
    expect(saved.wentToShowdown).toBe(false);
    expect(saved.myWinLoss).toBeLessThan(0); // lost the SB (1 chip)
    expect(saved.myCards).toHaveLength(2);
    expect(saved.deckSnapshot).toHaveLength(52);
    expect(saved.actionLog).toHaveLength(1);
    expect(saved.actionLog[0].action).toBe('fold');
    expect(saved.actionLog[0].playerLabel).toBe('나');
  });

  it('persists multiple hands and preserves order (latest first)', async () => {
    useGameStore.getState().startAiGame('MEDIUM');
    // Hand 1: fold
    useGameStore.getState().applyMyAction('fold');
    await waitMs(20);
    // Hand 2: fold
    useGameStore.getState().startNextHand();
    // After startNextHand, if it's bot's turn (bot is now SB), wait for bot or fold when our turn.
    await waitMs(30);
    let s = useGameStore.getState();
    // If we're waiting for bot, wait up to 3s
    for (let i = 0; i < 60 && s.gameState && !s.isHandOver && s.gameState.toActId !== s.myPlayerId; i++) {
      await waitMs(50);
      s = useGameStore.getState();
    }
    if (!s.isHandOver && s.gameState && s.gameState.toActId === s.myPlayerId) {
      useGameStore.getState().applyMyAction('fold');
      await waitMs(20);
    }

    const list = await listHands();
    // Expect at least 1 hand saved (both if hand 2 also completed).
    expect(list.length).toBeGreaterThanOrEqual(1);
    // Latest first
    if (list.length >= 2) {
      expect(list[0].playedAt).toBeGreaterThanOrEqual(list[1].playedAt);
    }
  }, 10000);

  it('captures full deck snapshot (52 unique cards in deal-order)', async () => {
    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');
    await waitMs(20);
    const list = await listHands();
    expect(list).toHaveLength(1);
    const snap = list[0].deckSnapshot;
    expect(snap).toHaveLength(52);
    const keys = new Set(snap.map((c) => `${c.rank}${c.suit}`));
    expect(keys.size).toBe(52);
  });

  it('attaches postHandInsight to the saved hand asynchronously', async () => {
    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');

    // Wait for analyzeAndPersist to complete (eval + re-save). evaluateHand on
    // a 1-action fold is fast (no postflop equity) — should land within ~500ms.
    let saved = null;
    for (let i = 0; i < 30; i++) {
      await waitMs(50);
      const list = await listHands();
      saved = list[0] ?? null;
      if (saved?.postHandInsight) break;
    }
    expect(saved).not.toBeNull();
    expect(saved!.postHandInsight).toBeDefined();
    expect(typeof saved!.postHandInsight!.overallScore).toBe('number');
    expect(saved!.postHandInsight!.overallScore).toBeGreaterThanOrEqual(0);
    expect(saved!.postHandInsight!.overallScore).toBeLessThanOrEqual(100);
    // The in-memory copy in handHistory should also carry it.
    const inMem = useGameStore.getState().handHistory[0];
    expect(inMem.postHandInsight).toBeDefined();
    expect(inMem.postHandInsight!.overallScore).toBe(saved!.postHandInsight!.overallScore);
  }, 10000);

  it('FIRST_HAND milestone fires exactly once after a single hand completion', async () => {
    useToastStore.getState().reset();
    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');
    // Wait for analyzeAndPersist → detectMilestones → toast push.
    let toasts: ReturnType<typeof useToastStore.getState>['toasts'] = [];
    for (let i = 0; i < 30; i++) {
      await waitMs(50);
      toasts = useToastStore.getState().toasts;
      if (toasts.length > 0) break;
    }
    const firstHand = toasts.filter((t) => t.milestone.id === 'FIRST_HAND');
    expect(firstHand).toHaveLength(1);
    useToastStore.getState().reset();
  }, 10000);

  it('analyzeAndPersist survives resetGame mid-flight without overwriting state', async () => {
    // Regression: the helper re-reads handHistory after the async wait. If the
    // user reset the game in between, the in-memory map produces an empty array
    // — we must NOT clobber the (now-fresh) handHistory and must NOT crash.
    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');
    // Don't await — let analyzeAndPersist's setTimeout(0) chain start, then
    // immediately reset.
    useGameStore.getState().resetGame();

    // Give the deferred evaluateHand+saveHand time to complete.
    await waitMs(500);
    const after = useGameStore.getState();
    // After reset, handHistory must be empty (and stays empty even if a stale
    // analyzeAndPersist completes).
    expect(after.handHistory).toEqual([]);
    // IDB still got the persisted hand (with postHandInsight), since the helper
    // saves regardless of in-memory presence.
    const list = await listHands();
    expect(list.length).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('waits for the initial saveHand to land before getHand (no save↔get race)', async () => {
    // Regression: finalizeHand fires the initial saveHand (POST) without await,
    // then analyzeAndPersist does getHand (GET). These are independent HTTP
    // requests with no ordering guarantee — a slow POST overtaken by the GET
    // leaves the server with no record → 404 → getHand returns null → the
    // enriched (analyzed) hand is never re-persisted. The fix awaits the
    // initial save before getHand. Here we hold the FIRST save open and assert
    // getHand is never called while it is still pending.
    let firstSaveResolve: (() => void) | null = null;
    let firstSaveResolved = false;
    let getHandCalledBeforeFirstSaveResolved = false;
    let saveCallCount = 0;

    const persist = (hand: CompletedHand) => {
      const idx = _hands.findIndex((h) => h.handId === hand.handId);
      if (idx >= 0) _hands[idx] = hand;
      else _hands.push(hand);
    };

    vi.mocked(historyMod.saveHand).mockImplementation(async (hand) => {
      saveCallCount += 1;
      if (saveCallCount === 1) {
        // Initial save (no insight): park until the test releases it.
        await new Promise<void>((r) => {
          firstSaveResolve = () => {
            persist(hand);
            firstSaveResolved = true;
            r();
          };
        });
      } else {
        // Enriched re-save (with insight): land immediately.
        persist(hand);
      }
    });
    vi.mocked(historyMod.getHand).mockImplementation(async (id) => {
      if (!firstSaveResolved) getHandCalledBeforeFirstSaveResolved = true;
      return _hands.find((h) => h.handId === id) ?? null;
    });

    useGameStore.getState().startAiGame('EASY');
    useGameStore.getState().applyMyAction('fold');

    // Let analyzeAndPersist run through evaluateHand and reach `await savePromise`.
    await waitMs(300);
    // getHand must NOT have fired yet — the initial save is still pending.
    expect(getHandCalledBeforeFirstSaveResolved).toBe(false);

    // Release the initial save → the POST "lands" on the server.
    expect(firstSaveResolve).not.toBeNull();
    firstSaveResolve!();

    // Now getHand finds the hand and the enriched version is persisted.
    let saved: CompletedHand | null = null;
    for (let i = 0; i < 30; i++) {
      await waitMs(50);
      saved = (await listHands())[0] ?? null;
      if (saved?.postHandInsight) break;
    }
    expect(getHandCalledBeforeFirstSaveResolved).toBe(false);
    expect(saved).not.toBeNull();
    expect(saved!.postHandInsight).toBeDefined();
  }, 10000);
});
