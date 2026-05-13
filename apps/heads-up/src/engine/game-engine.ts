import type { Card } from './card';
import { Deck } from './deck';
import { compareHands, evaluate, type HandValue } from './hand-evaluator';
import type {
  ActionRecord,
  GameState,
  Player,
  PlayerAction,
  Position,
  Street,
} from '../types/game';

export interface NewHandOptions {
  sbPlayerId: string;
  bbPlayerId: string;
  sbStack: number;
  bbStack: number;
  smallBlind: number;
  bigBlind: number;
  deckSeed?: number;
}

export interface LegalActions {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  /** Minimum total bet size (all-in) allowed when opening/raising. */
  minBetTotal: number;
  /** Minimum raise-to amount for a raise action. */
  minRaiseTotal: number;
  /** Maximum total bet size (i.e. all-in). */
  maxBetTotal: number;
}

export interface HandResolution {
  state: GameState;
  winners: string[];
  /** Board cards at time of resolution (runout completed on fold-and-showdown path). */
  revealedBoard: Card[];
  endedBy: 'fold' | 'showdown';
  endedStreet: Street;
  potAwarded: number;
  /** Present only on showdown. */
  evaluations?: Record<string, HandValue>;
}

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];
const STREET_BOARD_COUNT: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

interface InternalMeta {
  /** Original hole cards (never hidden from the engine). */
  sbHole: [Card, Card];
  bbHole: [Card, Card];
  /** Remaining runout cards in deal-order. */
  runout: Card[];
  /** Full 52-card deck in deal-order captured before any deal. */
  initialDeck: Card[];
  /** Optional seed the deck was shuffled with. */
  deckSeed?: number;
  /** The player who raised last on the current street, or null if no raise yet. */
  lastAggressorId: string | null;
  /** Number of actions taken on the current street (for check-check resolution). */
  actionsThisStreet: number;
  /** Last raise increment (for legal minRaise calculation). */
  lastRaiseSize: number;
}

/**
 * Internal meta per-hand. Stored on the GameState via a side channel because
 * GameState is the "public" snapshot used by UI & bots.
 */
const META = new WeakMap<GameState, InternalMeta>();

export function getMeta(state: GameState): InternalMeta | undefined {
  return META.get(state);
}

function setMeta(state: GameState, meta: InternalMeta): void {
  META.set(state, meta);
}

/**
 * Produces a shallow clone of the state (new object, new arrays for players/board/history)
 * while preserving the engine's hidden meta association. Used by consumers (e.g. Zustand)
 * that need a new object reference to trigger re-renders but still want the next
 * `applyAction` call to succeed.
 */
export function cloneState(state: GameState): GameState {
  const cloned: GameState = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      holeCards: p.holeCards ? p.holeCards.slice() : null,
    })),
    board: state.board.slice(),
    history: state.history.slice(),
  };
  const meta = META.get(state);
  if (meta) META.set(cloned, meta);
  return cloned;
}

function nextToAct(state: GameState, currentId: string): string {
  const other = state.players.find((p) => p.id !== currentId);
  if (!other) throw new Error('opponent not found');
  return other.id;
}

function makePlayer(id: string, position: Position, stack: number, posted: number): Player {
  // Cap blind posting at the player's actual stack — never allow negative stacks.
  // A short-stacked player posts all-in for their remaining chips.
  const actual = Math.min(posted, stack);
  return {
    id,
    stack: stack - actual,
    holeCards: null,
    position,
    hasFolded: false,
    currentBet: actual,
  };
}

/**
 * If the initial hand state is already "resolved" — i.e., one or both players
 * went all-in posting the blind and no further action is possible — run the
 * board out and return a HandResolution immediately.
 * Returns null if the hand needs normal action.
 */
export function resolveImmediate(state: GameState): HandResolution | null {
  const meta = META.get(state);
  if (!meta) return null;
  if (!isStreetClosed(state, meta)) return null;
  return resolveShowdown(state, meta);
}

export function startNewHand(opts: NewHandOptions): GameState {
  const deck = new Deck(opts.deckSeed);
  deck.shuffle();

  // Snapshot the full deck in deal-order BEFORE any deal, so we can persist the
  // full shuffle for post-hoc verification. Deck.deal() pops from the tail, so
  // reversing the snapshot puts the first-dealt card at index 0.
  const initialDeck = deck.snapshot().slice().reverse();

  // Cap blind posting at each player's actual stack (handles short-stack edge case).
  const sbPosted = Math.min(opts.smallBlind, opts.sbStack);
  const bbPosted = Math.min(opts.bigBlind, opts.bbStack);

  const sb = makePlayer(opts.sbPlayerId, 'SB', opts.sbStack, sbPosted);
  const bb = makePlayer(opts.bbPlayerId, 'BB', opts.bbStack, bbPosted);

  const sbHole: [Card, Card] = [deck.deal(), deck.deal()];
  const bbHole: [Card, Card] = [deck.deal(), deck.deal()];
  sb.holeCards = sbHole;
  bb.holeCards = bbHole;

  // Pre-stage all remaining runout cards so the deal order is deterministic
  // even if players go all-in mid-street.
  const runout: Card[] = [];
  while (deck.remaining() > 0) runout.push(deck.deal());

  const state: GameState = {
    players: [sb, bb],
    board: [],
    // Pot = actual chips posted (not nominal blind amounts).
    pot: sbPosted + bbPosted,
    street: 'preflop',
    // currentBet = the highest actual commitment (BB's posted amount if full, else SB's).
    currentBet: Math.max(sbPosted, bbPosted),
    minRaise: opts.bigBlind,
    toActId: sb.id, // SB acts first preflop in heads-up
    bigBlind: opts.bigBlind,
    smallBlind: opts.smallBlind,
    history: [],
  };

  setMeta(state, {
    sbHole,
    bbHole,
    runout,
    initialDeck,
    deckSeed: opts.deckSeed,
    lastAggressorId: bb.id, // BB is the "last aggressor" preflop (posted BB)
    actionsThisStreet: 0,
    lastRaiseSize: opts.bigBlind,
  });

  return state;
}

export function getLegalActions(state: GameState, playerId: string): LegalActions {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) throw new Error(`player ${playerId} not in state`);
  const opp = state.players.find((p) => p.id !== playerId);
  if (!opp) throw new Error(`opponent of ${playerId} not in state`);
  const toCall = Math.max(0, state.currentBet - me.currentBet);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && me.stack > 0;
  const callAmount = Math.min(me.stack, toCall);

  // In HU, once the opponent is all-in, no further raising is possible —
  // they have no chips to match. The only remaining actions are call & fold.
  const oppAllIn = opp.stack === 0 && !opp.hasFolded;

  const maxBetTotal = me.stack + me.currentBet;
  // Opening a bet (no current bet) — min = 1 BB.
  const canBet = state.currentBet === 0 && me.stack > 0 && !oppAllIn;
  const minBetTotal = Math.min(maxBetTotal, state.bigBlind);

  // Raising — min raise-to = currentBet + minRaise (engine tracks last raise increment).
  const canRaise =
    state.currentBet > 0 && me.stack + me.currentBet > state.currentBet && !oppAllIn;
  const minRaiseTotal = Math.min(maxBetTotal, state.currentBet + state.minRaise);

  return {
    canCheck,
    canCall,
    callAmount,
    canBet,
    canRaise,
    minBetTotal,
    minRaiseTotal,
    maxBetTotal,
  };
}

export interface ApplyActionResult {
  /** The new/mutated state (same object reference — engine mutates in place). */
  state: GameState;
  /** Resolution if the hand ended on this action. */
  resolution?: HandResolution;
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
  amount: number,
): ApplyActionResult {
  if (state.toActId !== playerId) {
    throw new Error(`not ${playerId}'s turn (toAct=${state.toActId})`);
  }
  const meta = META.get(state);
  if (!meta) throw new Error('meta missing from state');

  const me = state.players.find((p) => p.id === playerId)!;
  const other = state.players.find((p) => p.id !== playerId)!;
  const toCall = Math.max(0, state.currentBet - me.currentBet);

  const legal = getLegalActions(state, playerId);
  // Normalize action against legality.
  let effective: PlayerAction = action;
  let effectiveAmount = amount;

  // If caller said 'check' but there's a bet to call, coerce to fold (old behavior).
  if (effective === 'check' && !legal.canCheck) {
    effective = 'fold';
    effectiveAmount = 0;
  }
  // Defensive: if caller said 'fold' but the action is free (canCheck), assume they
  // meant 'check' — folding for free is never a legitimate intent and would silently
  // gift the hand to the opponent.
  if (effective === 'fold' && legal.canCheck) {
    effective = 'check';
    effectiveAmount = 0;
  }
  // If caller said 'bet' but there's already a bet, reinterpret as 'raise' so the
  // min-raise logic applies correctly.
  if (effective === 'bet' && state.currentBet > 0) {
    effective = 'raise';
  }
  // And vice versa: 'raise' with no existing bet is really a 'bet'.
  if (effective === 'raise' && state.currentBet === 0) {
    effective = 'bet';
  }
  // If the opponent is already all-in, no raise/bet is legal — coerce to call
  // (or check if no chips are owed). Prevents chips going into an uncallable pot
  // and prevents getting stuck when opponent can't respond.
  const oppAllIn = other.stack === 0 && !other.hasFolded;
  if (oppAllIn && (effective === 'bet' || effective === 'raise')) {
    if (legal.canCall) {
      effective = 'call';
      effectiveAmount = legal.callAmount;
    } else {
      effective = 'check';
      effectiveAmount = 0;
    }
  }

  const record: ActionRecord = {
    playerId,
    action: effective,
    amount: 0,
    street: state.street,
  };

  if (effective === 'fold') {
    me.hasFolded = true;
    record.amount = 0;
    state.history.push(record);
    const resolution = resolveByFold(state, other.id);
    return { state, resolution };
  }

  if (effective === 'check') {
    record.amount = 0;
    state.history.push(record);
    meta.actionsThisStreet++;
  } else if (effective === 'call') {
    const pay = Math.min(me.stack, toCall);
    me.stack -= pay;
    me.currentBet += pay;
    state.pot += pay;
    record.amount = pay;
    state.history.push(record);
    meta.actionsThisStreet++;
  } else if (effective === 'bet' || effective === 'raise') {
    // Normalize target "raise-to" total.
    let target = Math.round(effectiveAmount);
    const maxTotal = me.stack + me.currentBet;
    if (target > maxTotal) target = maxTotal;
    // Enforce min sizing unless this is an all-in for less.
    const minTotal = effective === 'bet' ? legal.minBetTotal : legal.minRaiseTotal;
    const isAllIn = target === maxTotal;
    if (!isAllIn && target < minTotal) target = minTotal;

    const increment = target - state.currentBet;
    const add = target - me.currentBet;
    me.stack -= add;
    me.currentBet = target;
    state.pot += add;
    record.amount = target;
    state.history.push(record);

    // Update currentBet / minRaise.
    const raiseSize = Math.max(increment, 0);
    // A "real" raise (>= previous min raise) resets the minRaise to this size;
    // an all-in under the min raise does NOT reset minRaise (standard rule).
    if (raiseSize >= state.minRaise) {
      state.minRaise = raiseSize;
      meta.lastRaiseSize = raiseSize;
    }
    state.currentBet = target;
    meta.lastAggressorId = playerId;
    meta.actionsThisStreet++;
  }

  // Determine if street is complete.
  const bothAllInOrClosed = isStreetClosed(state, meta);
  if (bothAllInOrClosed) {
    return advanceStreetOrShowdown(state, meta);
  }

  // Pass action to opponent.
  state.toActId = nextToAct(state, playerId);
  return { state };
}

/**
 * A street is complete when both players have had a chance to act
 * AFTER the last aggressive action, and bets are matched (or someone is all-in).
 */
function isStreetClosed(state: GameState, meta: InternalMeta): boolean {
  const [a, b] = state.players;
  if (a.hasFolded || b.hasFolded) return true;

  const betsMatch = a.currentBet === b.currentBet;

  // Both all-in — no further action is possible regardless of whether bets match.
  // Any excess commitment from the deeper stack will be refunded at showdown.
  if (a.stack === 0 && b.stack === 0) return true;

  // One all-in: street closes as soon as the non-all-in player has committed
  // at least as much as the all-in player (i.e. matched their all-in). Any
  // further excess from the non-all-in player is uncallable and will be refunded.
  if (a.stack === 0 && b.currentBet >= a.currentBet) return true;
  if (b.stack === 0 && a.currentBet >= b.currentBet) return true;

  if (!betsMatch) return false;

  // Preflop special: BB has an option to raise even after SB calls.
  // So the street closes only after BB has acted voluntarily post-limp.
  // We detect this by requiring at least 2 actions on preflop before closing.
  if (state.street === 'preflop') {
    return meta.actionsThisStreet >= 2;
  }

  // Postflop: closes on check-check or bet-call.
  return meta.actionsThisStreet >= 2;
}

function advanceStreetOrShowdown(
  state: GameState,
  meta: InternalMeta,
): ApplyActionResult {
  // If someone is all-in and bets match, run out remaining board and go to showdown.
  const someoneAllIn = state.players.some((p) => p.stack === 0);

  if (state.street === 'river' || someoneAllIn) {
    return { state, resolution: resolveShowdown(state, meta) };
  }

  // Advance to next street.
  const idx = STREETS.indexOf(state.street);
  const nextStreet = STREETS[idx + 1];
  const need = STREET_BOARD_COUNT[nextStreet] - state.board.length;
  for (let i = 0; i < need; i++) {
    state.board.push(meta.runout.shift()!);
  }
  state.street = nextStreet;
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  for (const p of state.players) p.currentBet = 0;
  meta.actionsThisStreet = 0;
  meta.lastAggressorId = null;
  meta.lastRaiseSize = state.bigBlind;
  // BB (out of position preflop = first to act postflop) acts first on every postflop street in HU.
  const bb = state.players.find((p) => p.position === 'BB')!;
  state.toActId = bb.id;
  return { state };
}

function resolveByFold(state: GameState, winnerId: string): HandResolution {
  const winner = state.players.find((p) => p.id === winnerId)!;
  winner.stack += state.pot;
  const potAwarded = state.pot;
  state.pot = 0;
  return {
    state,
    winners: [winnerId],
    revealedBoard: state.board.slice(),
    endedBy: 'fold',
    endedStreet: state.street,
    potAwarded,
  };
}

function resolveShowdown(state: GameState, meta: InternalMeta): HandResolution {
  // Run any remaining board if all-in before river.
  while (state.board.length < 5 && meta.runout.length > 0) {
    state.board.push(meta.runout.shift()!);
  }

  // Refund any uncalled excess commitment. Happens when one player went all-in
  // for less than the other had already committed — the deeper player's excess
  // never got matched and must be returned to their stack before settling the pot.
  // In heads-up this is equivalent to capping both committed amounts at the
  // smaller of the two.
  const [a, b] = state.players;
  if (a.currentBet > b.currentBet) {
    const excess = a.currentBet - b.currentBet;
    a.stack += excess;
    state.pot -= excess;
    a.currentBet = b.currentBet;
  } else if (b.currentBet > a.currentBet) {
    const excess = b.currentBet - a.currentBet;
    b.stack += excess;
    state.pot -= excess;
    b.currentBet = a.currentBet;
  }

  const evaluations: Record<string, HandValue> = {};
  for (const p of state.players) {
    if (!p.holeCards || p.holeCards.length !== 2) {
      throw new Error(`player ${p.id} missing hole cards at showdown`);
    }
    evaluations[p.id] = evaluate([p.holeCards[0], p.holeCards[1], ...state.board]);
  }
  let winners: string[];
  if (a.hasFolded) winners = [b.id];
  else if (b.hasFolded) winners = [a.id];
  else {
    const cmp = compareHands(evaluations[a.id], evaluations[b.id]);
    if (cmp > 0) winners = [a.id];
    else if (cmp < 0) winners = [b.id];
    else winners = [a.id, b.id];
  }

  const potAwarded = state.pot;
  if (winners.length === 1) {
    state.players.find((p) => p.id === winners[0])!.stack += potAwarded;
  } else {
    const split = Math.floor(potAwarded / 2);
    const remainder = potAwarded - split * 2;
    state.players[0].stack += split;
    state.players[1].stack += split;
    // Odd chip goes to BB by convention (better position loses the chip — tradition varies; keep simple).
    if (remainder > 0) {
      state.players.find((p) => p.position === 'BB')!.stack += remainder;
    }
  }
  state.pot = 0;
  state.street = 'river';

  return {
    state,
    winners,
    revealedBoard: state.board.slice(),
    endedBy: 'showdown',
    endedStreet: 'river',
    potAwarded,
    evaluations,
  };
}
