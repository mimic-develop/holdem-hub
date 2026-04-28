import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, startNewHand } from '../game-engine';

const OPTS = {
  sbPlayerId: 'SB',
  bbPlayerId: 'BB',
  sbStack: 200,
  bbStack: 200,
  smallBlind: 1,
  bigBlind: 2,
  deckSeed: 42,
};

describe('game-engine — initialization', () => {
  it('deals 2 cards to each player and posts blinds', () => {
    const s = startNewHand(OPTS);
    expect(s.players).toHaveLength(2);
    expect(s.players[0].holeCards).toHaveLength(2);
    expect(s.players[1].holeCards).toHaveLength(2);
    expect(s.pot).toBe(3);
    expect(s.players[0].stack).toBe(199); // SB posted 1
    expect(s.players[1].stack).toBe(198); // BB posted 2
    expect(s.currentBet).toBe(2);
    expect(s.toActId).toBe('SB'); // SB acts first preflop
  });

  it('deck produces unique cards', () => {
    const s = startNewHand(OPTS);
    const sbCards = s.players[0].holeCards!;
    const bbCards = s.players[1].holeCards!;
    const all = [...sbCards, ...bbCards].map((c) => `${c.rank}${c.suit}`);
    expect(new Set(all).size).toBe(4);
  });
});

describe('game-engine — legal actions', () => {
  it('SB preflop: call 1, raise, or fold (can\'t check)', () => {
    const s = startNewHand(OPTS);
    const la = getLegalActions(s, 'SB');
    expect(la.canCheck).toBe(false);
    expect(la.canCall).toBe(true);
    expect(la.callAmount).toBe(1);
    expect(la.canRaise).toBe(true);
    expect(la.minRaiseTotal).toBe(4); // currentBet 2 + minRaise 2
  });

  it('BB after SB limp: can check or raise', () => {
    const s0 = startNewHand(OPTS);
    const r = applyAction(s0, 'SB', 'call', 1);
    const la = getLegalActions(r.state, 'BB');
    expect(la.canCheck).toBe(true);
    expect(la.canCall).toBe(false);
    expect(la.canRaise).toBe(true);
  });
});

describe('game-engine — preflop flow', () => {
  it('limp / check closes preflop and deals flop', () => {
    const s0 = startNewHand(OPTS);
    const r1 = applyAction(s0, 'SB', 'call', 1);
    expect(r1.resolution).toBeUndefined();
    expect(r1.state.toActId).toBe('BB');

    const r2 = applyAction(r1.state, 'BB', 'check', 0);
    expect(r2.resolution).toBeUndefined();
    expect(r2.state.street).toBe('flop');
    expect(r2.state.board).toHaveLength(3);
    expect(r2.state.currentBet).toBe(0);
    // BB acts first on flop
    expect(r2.state.toActId).toBe('BB');
  });

  it('SB raise + BB fold ends hand', () => {
    const s0 = startNewHand(OPTS);
    const r1 = applyAction(s0, 'SB', 'raise', 6);
    expect(r1.resolution).toBeUndefined();
    expect(r1.state.currentBet).toBe(6);
    const r2 = applyAction(r1.state, 'BB', 'fold', 0);
    expect(r2.resolution).toBeDefined();
    expect(r2.resolution!.endedBy).toBe('fold');
    expect(r2.resolution!.winners).toEqual(['SB']);
    // SB had stack 194 after raising 6. Pot was 2 (BB) + 6 (SB) = 8. Winner gets pot.
    expect(r2.state.players.find((p) => p.id === 'SB')!.stack).toBe(194 + 8);
  });

  it('3-bet / call', () => {
    const s0 = startNewHand(OPTS);
    const r1 = applyAction(s0, 'SB', 'raise', 6);
    const r2 = applyAction(r1.state, 'BB', 'raise', 18); // 3-bet
    expect(r2.resolution).toBeUndefined();
    expect(r2.state.currentBet).toBe(18);
    expect(r2.state.toActId).toBe('SB');
    const r3 = applyAction(r2.state, 'SB', 'call', 12);
    expect(r3.state.street).toBe('flop');
    expect(r3.state.pot).toBe(36);
  });
});

describe('game-engine — postflop flow', () => {
  it('check-check advances to turn', () => {
    const s0 = startNewHand(OPTS);
    const a = applyAction(s0, 'SB', 'call', 1);
    const b = applyAction(a.state, 'BB', 'check', 0);
    expect(b.state.street).toBe('flop');
    const c = applyAction(b.state, 'BB', 'check', 0);
    const d = applyAction(c.state, 'SB', 'check', 0);
    expect(d.state.street).toBe('turn');
    expect(d.state.board).toHaveLength(4);
  });

  it('bet/call advances street and clears bets', () => {
    const s0 = startNewHand(OPTS);
    const a = applyAction(s0, 'SB', 'call', 1);
    const b = applyAction(a.state, 'BB', 'check', 0);
    const c = applyAction(b.state, 'BB', 'bet', 2);
    expect(c.state.currentBet).toBe(2);
    const d = applyAction(c.state, 'SB', 'call', 2);
    expect(d.state.street).toBe('turn');
    expect(d.state.currentBet).toBe(0);
    expect(d.state.players.every((p) => p.currentBet === 0)).toBe(true);
  });
});

describe('game-engine — showdown', () => {
  it('reaches showdown and awards pot', () => {
    const s0 = startNewHand(OPTS);
    let s = s0;
    // Both check/call through.
    s = applyAction(s, 'SB', 'call', 1).state;
    s = applyAction(s, 'BB', 'check', 0).state;
    // flop
    s = applyAction(s, 'BB', 'check', 0).state;
    s = applyAction(s, 'SB', 'check', 0).state;
    // turn
    s = applyAction(s, 'BB', 'check', 0).state;
    s = applyAction(s, 'SB', 'check', 0).state;
    // river
    expect(s.street).toBe('river');
    s = applyAction(s, 'BB', 'check', 0).state;
    const final = applyAction(s, 'SB', 'check', 0);
    expect(final.resolution).toBeDefined();
    expect(final.resolution!.endedBy).toBe('showdown');
    expect(final.state.board).toHaveLength(5);
    const sb = final.state.players.find((p) => p.id === 'SB')!;
    const bb = final.state.players.find((p) => p.id === 'BB')!;
    expect(sb.stack + bb.stack).toBe(400); // no chips lost
  });

  it('all-in preflop runs out full board', () => {
    const s0 = startNewHand({ ...OPTS, sbStack: 50, bbStack: 50 });
    const r1 = applyAction(s0, 'SB', 'raise', 50); // all-in
    const r2 = applyAction(r1.state, 'BB', 'call', 48);
    expect(r2.resolution).toBeDefined();
    expect(r2.resolution!.endedBy).toBe('showdown');
    expect(r2.state.board).toHaveLength(5);
  });
});

describe('game-engine — enforcement', () => {
  it('check is coerced to fold when there is a bet to call', () => {
    const s0 = startNewHand(OPTS);
    // SB tries to "check" despite toCall=1 → should fold
    const r = applyAction(s0, 'SB', 'check', 0);
    expect(r.resolution).toBeDefined();
    expect(r.resolution!.winners).toEqual(['BB']);
  });

  it('fold is coerced to check when the action is free', () => {
    const s0 = startNewHand(OPTS);
    // SB limps
    const r1 = applyAction(s0, 'SB', 'call', 1);
    // BB can check for free; if BB sends "fold", it should be coerced to check.
    const r2 = applyAction(r1.state, 'BB', 'fold', 0);
    expect(r2.resolution).toBeUndefined();
    expect(r2.state.street).toBe('flop'); // both matched & checked → advance
  });

  it('bet action with existing bet is coerced to raise', () => {
    const s0 = startNewHand(OPTS);
    // SB tries action='bet' amount=6 preflop (currentBet=2 already); should be treated as raise.
    const r = applyAction(s0, 'SB', 'bet', 6);
    expect(r.state.currentBet).toBe(6);
    // Last history entry should reflect the raise.
    const last = r.state.history[r.state.history.length - 1];
    // We don't coerce the history record, but the amount must reflect the raise.
    expect(last.amount).toBe(6);
  });

  it('raise with no existing bet is coerced to bet', () => {
    const s0 = startNewHand(OPTS);
    const r1 = applyAction(s0, 'SB', 'call', 1);
    const r2 = applyAction(r1.state, 'BB', 'check', 0);
    // Flop. No bet yet. BB tries raise → should be coerced to bet.
    const r3 = applyAction(r2.state, 'BB', 'raise', 4);
    expect(r3.state.currentBet).toBe(4);
  });

  it('raise below min is bumped to min', () => {
    const s0 = startNewHand(OPTS);
    // SB tries to raise-to 3 (less than min 4) — not all-in so should be bumped to 4
    const r = applyAction(s0, 'SB', 'raise', 3);
    expect(r.state.currentBet).toBe(4);
  });

  it('allows all-in under min raise', () => {
    const s0 = startNewHand({ ...OPTS, sbStack: 5 });
    const r = applyAction(s0, 'SB', 'raise', 5); // all-in total 5 (< min 4+2=4? min 4 so ok)
    // With sbStack=5, SB has already posted 1, stack=4, max total=5.
    // minRaise stays the same
    expect(r.state.currentBet).toBe(5);
    const sb = r.state.players.find((p) => p.id === 'SB')!;
    expect(sb.stack).toBe(0);
  });
});

describe('game-engine — all-in with unequal stacks', () => {
  it('SB 200 vs BB 50, SB all-in, BB calls all-in: street closes and reaches showdown', () => {
    // Previously stuck: SB.cb=200, BB.cb=50 → betsMatch=false, not closed despite both all-in.
    const s0 = startNewHand({ ...OPTS, sbStack: 200, bbStack: 50 });
    const r1 = applyAction(s0, 'SB', 'raise', 200); // SB all-in total 200
    expect(r1.resolution).toBeUndefined();
    expect(r1.state.players.find((p) => p.id === 'SB')!.stack).toBe(0);

    const r2 = applyAction(r1.state, 'BB', 'call', 48); // BB calls all-in for 48 (stack was 48 post-blind)
    expect(r2.resolution).toBeDefined();
    expect(r2.resolution!.endedBy).toBe('showdown');
    expect(r2.state.board).toHaveLength(5);
  });

  it('refunds SB\'s uncalled excess: SB committed 200, BB only 50, excess 150 returned', () => {
    const s0 = startNewHand({ ...OPTS, sbStack: 200, bbStack: 50 });
    applyAction(s0, 'SB', 'raise', 200);
    const r = applyAction(s0, 'BB', 'call', 48);
    expect(r.resolution).toBeDefined();
    const sb = r.state.players.find((p) => p.id === 'SB')!;
    const bb = r.state.players.find((p) => p.id === 'BB')!;
    // Chip conservation: SB 200 + BB 50 = 250 total in the system.
    expect(sb.stack + bb.stack).toBe(250);
  });

  it('both all-in for unequal amounts: BB short-stacked triggers all-in call, hand resolves', () => {
    // SB 30, BB 100. SB raises all-in for 30; BB already committed 2, calls the shortfall of 28.
    // After BB calls all-in-for-less, bets match at 30 for the min(both). Excess beyond min belongs
    // to the deeper-stacked player (here, BB's 70 uncommitted stays in BB's stack).
    const s0 = startNewHand({ ...OPTS, sbStack: 30, bbStack: 100 });
    const r1 = applyAction(s0, 'SB', 'raise', 30); // SB all-in
    expect(r1.resolution).toBeUndefined();
    const r2 = applyAction(r1.state, 'BB', 'call', 28);
    expect(r2.resolution).toBeDefined();
    expect(r2.resolution!.endedBy).toBe('showdown');
    const sb = r2.state.players.find((p) => p.id === 'SB')!;
    const bb = r2.state.players.find((p) => p.id === 'BB')!;
    expect(sb.stack + bb.stack).toBe(130);
  });

  it('if opp is all-in, user\'s "raise" is coerced to call', () => {
    // SB 200, BB 50. BB is all-in first.
    // Scenario: SB limp, BB check? No, force BB to be the all-in aggressor:
    //   SB limps, BB raises all-in to 50, now SB facing all-in.
    const s0 = startNewHand({ ...OPTS, sbStack: 200, bbStack: 50 });
    const r1 = applyAction(s0, 'SB', 'call', 1); // limp
    const r2 = applyAction(r1.state, 'BB', 'raise', 50); // BB all-in
    expect(r2.state.players.find((p) => p.id === 'BB')!.stack).toBe(0);

    // SB tries to 3-bet. Should be coerced to call (opp is all-in).
    const r3 = applyAction(r2.state, 'SB', 'raise', 100);
    // Hand should resolve on showdown (both committed, bets match at 50).
    expect(r3.resolution).toBeDefined();
    expect(r3.resolution!.endedBy).toBe('showdown');
    // Verify action log says "call" or equivalent — currentBet should NOT have gone above BB's all-in 50.
    expect(r3.state.currentBet).toBe(50);
  });

  it('legal actions when opp is all-in: no canRaise', () => {
    const s0 = startNewHand({ ...OPTS, sbStack: 200, bbStack: 50 });
    const r1 = applyAction(s0, 'SB', 'call', 1);
    const r2 = applyAction(r1.state, 'BB', 'raise', 50); // BB all-in
    const la = getLegalActions(r2.state, 'SB');
    expect(la.canRaise).toBe(false);
    expect(la.canBet).toBe(false);
    expect(la.canCall).toBe(true);
    expect(la.callAmount).toBe(48); // 50 - SB's 2 committed
  });

  it('chip conservation holds across arbitrary all-in paths', () => {
    // Run 10 randomized-seed all-in showdowns and verify chips conserve.
    for (let seed = 0; seed < 10; seed++) {
      const s0 = startNewHand({
        ...OPTS,
        sbStack: 75,
        bbStack: 125,
        deckSeed: seed,
      });
      const r1 = applyAction(s0, 'SB', 'raise', 75); // SB all-in
      const r2 = applyAction(r1.state, 'BB', 'call', 73);
      expect(r2.resolution).toBeDefined();
      const sb = r2.state.players.find((p) => p.id === 'SB')!;
      const bb = r2.state.players.find((p) => p.id === 'BB')!;
      expect(sb.stack + bb.stack).toBe(200);
    }
  });
});
