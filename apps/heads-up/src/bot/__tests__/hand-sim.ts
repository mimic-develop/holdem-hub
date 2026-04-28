import { Deck } from '../../engine/deck';
import { cardToString, stringToCard, type Card } from '../../engine/card';
import { compareHands, evaluate } from '../../engine/hand-evaluator';
import type { GameState, Player, Street } from '../../types/game';
import type { HeuristicBot } from '../heuristic-bot';

export interface SimArgs {
  sbBot: HeuristicBot;
  bbBot: HeuristicBot;
  sbCards: [string, string];
  bbCards: [string, string];
  stacks?: number;
  smallBlind?: number;
  deckSeed: number;
}

export interface SimResult {
  winner: 'SB' | 'BB' | 'split';
  pot: number;
  endedBy: 'fold' | 'showdown';
  endedStreet: Street;
  actions: number;
}

function buildRemainingDeck(
  deckSeed: number,
  reserved: Card[],
): Card[] {
  const d = new Deck(deckSeed);
  d.shuffle();
  const reservedSet = new Set(reserved.map(cardToString));
  const rest: Card[] = [];
  while (d.remaining() > 0) {
    const c = d.deal();
    if (!reservedSet.has(cardToString(c))) rest.push(c);
  }
  return rest;
}

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];
const STREET_BOARD_COUNT: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

export function simulateHand(args: SimArgs): SimResult {
  const stacks = args.stacks ?? 200;
  const sb = args.smallBlind ?? 1;
  const bb = sb * 2;

  const sbHole = args.sbCards.map(stringToCard) as [Card, Card];
  const bbHole = args.bbCards.map(stringToCard) as [Card, Card];

  const runout = buildRemainingDeck(args.deckSeed, [...sbHole, ...bbHole]);

  const sbPlayer: Player = {
    id: 'SB',
    stack: stacks - sb,
    holeCards: sbHole,
    position: 'SB',
    hasFolded: false,
    currentBet: sb,
  };
  const bbPlayer: Player = {
    id: 'BB',
    stack: stacks - bb,
    holeCards: bbHole,
    position: 'BB',
    hasFolded: false,
    currentBet: bb,
  };

  const bots = { SB: args.sbBot, BB: args.bbBot };
  let pot = sb + bb;
  const board: Card[] = [];
  let actionsTotal = 0;

  for (const street of STREETS) {
    // Deal missing board cards
    const need = STREET_BOARD_COUNT[street] - board.length;
    for (let i = 0; i < need; i++) board.push(runout.shift()!);

    // Reset street bets
    if (street !== 'preflop') {
      sbPlayer.currentBet = 0;
      bbPlayer.currentBet = 0;
    }
    let currentBet = street === 'preflop' ? bb : 0;
    const firstToAct: 'SB' | 'BB' = street === 'preflop' ? 'SB' : 'BB';
    let toAct: 'SB' | 'BB' = firstToAct;
    let actionsThisStreet = 0;
    const maxActionsPerStreet = 8;
    // Once both have acted after the last raise and bets match → street done.
    let actionsSinceLastRaise = 0;

    while (actionsThisStreet < maxActionsPerStreet) {
      const active = toAct === 'SB' ? sbPlayer : bbPlayer;
      const other = toAct === 'SB' ? bbPlayer : sbPlayer;
      if (active.hasFolded || active.stack === 0) break;

      const state: GameState = {
        players: [sbPlayer, bbPlayer],
        board,
        pot,
        street,
        currentBet,
        minRaise: bb,
        toActId: active.id,
        bigBlind: bb,
        smallBlind: sb,
        history: [],
      };
      const decision = bots[toAct].decide(state, active.id);
      actionsTotal++;
      actionsThisStreet++;
      actionsSinceLastRaise++;

      let action = decision.action;
      let amount = decision.amount;
      const toCall = Math.max(0, currentBet - active.currentBet);

      if (action === 'check' && toCall > 0) {
        action = 'fold';
        amount = 0;
      }

      if (action === 'fold') {
        active.hasFolded = true;
        pot += 0;
        return {
          winner: other.id as 'SB' | 'BB',
          pot,
          endedBy: 'fold',
          endedStreet: street,
          actions: actionsTotal,
        };
      }

      if (action === 'check') {
        // no chip movement
      } else if (action === 'call') {
        const pay = Math.min(active.stack, toCall);
        active.stack -= pay;
        active.currentBet += pay;
        pot += pay;
      } else if (action === 'bet' || action === 'raise') {
        const minTarget = Math.max(currentBet + bb, currentBet + 1);
        const target = Math.min(active.stack + active.currentBet, Math.max(amount, minTarget));
        const add = target - active.currentBet;
        active.stack -= add;
        active.currentBet = target;
        pot += add;
        currentBet = target;
        actionsSinceLastRaise = 0;
      }

      // Street done when both players have matched the current bet and last raiser has been responded to.
      const bothMatched =
        sbPlayer.hasFolded ||
        bbPlayer.hasFolded ||
        (sbPlayer.currentBet === currentBet && bbPlayer.currentBet === currentBet);
      if (actionsThisStreet >= 2 && bothMatched && actionsSinceLastRaise >= 1) {
        break;
      }

      toAct = toAct === 'SB' ? 'BB' : 'SB';
    }

    if (sbPlayer.hasFolded || bbPlayer.hasFolded) break;
  }

  // Showdown: ensure full board even if a player is all-in early
  while (board.length < 5 && runout.length > 0) {
    board.push(runout.shift()!);
  }

  const sbEval = evaluate([sbHole[0], sbHole[1], ...board]);
  const bbEval = evaluate([bbHole[0], bbHole[1], ...board]);
  const cmp = compareHands(sbEval, bbEval);
  const winner: 'SB' | 'BB' | 'split' = cmp > 0 ? 'SB' : cmp < 0 ? 'BB' : 'split';
  return {
    winner,
    pot,
    endedBy: 'showdown',
    endedStreet: 'river',
    actions: actionsTotal,
  };
}
