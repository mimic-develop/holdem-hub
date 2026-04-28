import { stringToCard, type Card } from '../../engine/card';
import type { GameState, Player, Position, Street } from '../../types/game';

export interface BuildStateOpts {
  myCards: [string, string] | [Card, Card];
  oppCards?: [string, string] | [Card, Card];
  board?: string[] | Card[];
  street?: Street;
  pot?: number;
  currentBet?: number;
  myCurrentBet?: number;
  oppCurrentBet?: number;
  myStack?: number;
  oppStack?: number;
  myPosition?: Position;
  bigBlind?: number;
  smallBlind?: number;
  toActId?: string;
}

function toCard(c: string | Card): Card {
  return typeof c === 'string' ? stringToCard(c) : c;
}

function toCards(arr: (string | Card)[] | undefined): Card[] {
  if (!arr) return [];
  return arr.map(toCard);
}

export function buildState(opts: BuildStateOpts): { state: GameState; meId: string } {
  const myPosition = opts.myPosition ?? 'SB';
  const oppPosition: Position = myPosition === 'SB' ? 'BB' : 'SB';
  const bb = opts.bigBlind ?? 2;
  const sb = opts.smallBlind ?? 1;
  const street = opts.street ?? 'preflop';

  const me: Player = {
    id: 'ME',
    stack: opts.myStack ?? 200,
    holeCards: [toCard(opts.myCards[0]), toCard(opts.myCards[1])],
    position: myPosition,
    hasFolded: false,
    currentBet: opts.myCurrentBet ?? (street === 'preflop' ? (myPosition === 'SB' ? sb : bb) : 0),
  };
  const opp: Player = {
    id: 'OPP',
    stack: opts.oppStack ?? 200,
    holeCards: opts.oppCards ? [toCard(opts.oppCards[0]), toCard(opts.oppCards[1])] : null,
    position: oppPosition,
    hasFolded: false,
    currentBet:
      opts.oppCurrentBet ?? (street === 'preflop' ? (oppPosition === 'SB' ? sb : bb) : 0),
  };

  const pot = opts.pot ?? me.currentBet + opp.currentBet;
  const currentBet =
    opts.currentBet ?? Math.max(me.currentBet, opp.currentBet);

  return {
    meId: 'ME',
    state: {
      players: [me, opp],
      board: toCards(opts.board),
      pot,
      street,
      currentBet,
      minRaise: bb,
      toActId: opts.toActId ?? 'ME',
      bigBlind: bb,
      smallBlind: sb,
      history: [],
    },
  };
}
