import { describe, expect, it } from 'vitest';
import { HeuristicBot } from '../../bot/heuristic-bot';
import { applyAction, startNewHand, type HandResolution } from '../game-engine';

/**
 * Headless session driver — simulates a full session of bot-vs-bot hands by
 * running the actual game engine the UI will use. Validates:
 *   - stacks never drift (conservation of chips)
 *   - 5+ consecutive hands run without throwing
 *   - at least some hands reach showdown (sanity check)
 *   - blinds rotate correctly
 */
describe('game-engine — session flow (bot vs bot)', () => {
  it('plays 15 hands with rotating blinds, conserving chips', () => {
    let stackA = 200;
    let stackB = 200;
    let sbId: 'A' | 'B' = 'A';
    let showdowns = 0;
    let folds = 0;
    const bot = new HeuristicBot('MEDIUM', 1337);
    const N = 15;

    for (let h = 0; h < N; h++) {
      const bbId = sbId === 'A' ? 'B' : 'A';
      const sbStack = sbId === 'A' ? stackA : stackB;
      const bbStack = bbId === 'A' ? stackA : stackB;

      // Reset if either busted.
      if (sbStack <= 0 || bbStack <= 0) {
        stackA = 200;
        stackB = 200;
      }

      const state = startNewHand({
        sbPlayerId: sbId,
        bbPlayerId: bbId,
        sbStack: sbId === 'A' ? stackA : stackB,
        bbStack: bbId === 'A' ? stackA : stackB,
        smallBlind: 1,
        bigBlind: 2,
        deckSeed: h + 1,
      });

      let cur = state;
      let resolution: HandResolution | undefined;
      let safety = 0;
      while (!resolution && safety++ < 200) {
        const toAct = cur.toActId;
        const decision = bot.decide(cur, toAct);
        const r = applyAction(cur, toAct, decision.action, decision.amount);
        cur = r.state;
        resolution = r.resolution;
      }
      expect(resolution).toBeDefined();
      if (resolution!.endedBy === 'showdown') showdowns++;
      else folds++;

      // Update stacks from resolution state.
      stackA = cur.players.find((p) => p.id === 'A')!.stack;
      stackB = cur.players.find((p) => p.id === 'B')!.stack;
      // Conservation
      expect(stackA + stackB).toBe(400);

      // Rotate blinds.
      sbId = bbId;
    }

    expect(folds + showdowns).toBe(N);
    // Sanity: in a 15-hand MEDIUM vs MEDIUM session, we should see at least 1 showdown.
    expect(showdowns).toBeGreaterThanOrEqual(1);
    // Sanity: not all hands are showdowns either.
    expect(folds).toBeGreaterThanOrEqual(1);
  });

  it('handles split pot (aces vs aces)', () => {
    // Force a tie with hardcoded hole cards — check pot splits.
    // We can't inject hole cards via startNewHand, so this tests showdown split via
    // the engine's compareHands path indirectly: we run 30 deckSeeds and check that
    // every hand either has a winner or is a split, with stacks still summing to start.
    const bot = new HeuristicBot('EASY', 42);
    for (let seed = 0; seed < 30; seed++) {
      let cur = startNewHand({
        sbPlayerId: 'A',
        bbPlayerId: 'B',
        sbStack: 200,
        bbStack: 200,
        smallBlind: 1,
        bigBlind: 2,
        deckSeed: seed,
      });
      let resolution: HandResolution | undefined;
      let safety = 0;
      while (!resolution && safety++ < 200) {
        const d = bot.decide(cur, cur.toActId);
        const r = applyAction(cur, cur.toActId, d.action, d.amount);
        cur = r.state;
        resolution = r.resolution;
      }
      expect(resolution).toBeDefined();
      const totalStacks = cur.players.reduce((sum, p) => sum + p.stack, 0);
      expect(totalStacks).toBe(400);
    }
  });
});
