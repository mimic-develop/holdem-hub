import { ALL_RANKS, ALL_SUITS, type Card, type Suit } from '../engine/card';
import { compareHands, evaluate } from '../engine/hand-evaluator';

export type HandCombo = [Card, Card];
export type OpponentRange = HandCombo[];

const SUIT_INDEX: Record<Suit, number> = { s: 0, h: 1, d: 2, c: 3 };

function cardId(c: Card): number {
  return SUIT_INDEX[c.suit] * 13 + (c.rank - 2);
}

const DECK_BY_ID: Card[] = (() => {
  const deck: Card[] = new Array(52);
  for (const s of ALL_SUITS) {
    for (const r of ALL_RANKS) {
      deck[SUIT_INDEX[s] * 13 + (r - 2)] = { suit: s, rank: r };
    }
  }
  return deck;
})();

function defaultCryptoRng(): () => number {
  const buf = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  };
}

export interface EquityOptions {
  iterations?: number;
  rng?: () => number;
}

export function calculateEquity(
  myHand: HandCombo,
  board: Card[],
  opponentRange: OpponentRange,
  options: EquityOptions = {},
): number {
  const iterations = options.iterations ?? 1000;
  const rng = options.rng ?? defaultCryptoRng();

  const used = new Uint8Array(52);
  const myIds = [cardId(myHand[0]), cardId(myHand[1])];
  used[myIds[0]] = 1;
  used[myIds[1]] = 1;
  for (const c of board) used[cardId(c)] = 1;

  const avail = new Uint32Array(52);
  let availCount = 0;
  for (let i = 0; i < 52; i++) {
    if (!used[i]) avail[availCount++] = i;
  }

  const validRange: Array<[number, number]> = [];
  for (const [c1, c2] of opponentRange) {
    const id1 = cardId(c1);
    const id2 = cardId(c2);
    if (id1 !== id2 && !used[id1] && !used[id2]) {
      validRange.push([id1, id2]);
    }
  }
  const useRange = validRange.length > 0;

  const boardNeeded = 5 - board.length;
  const scratch = new Uint32Array(52);

  const myFull: Card[] = new Array(7);
  const oppFull: Card[] = new Array(7);
  myFull[0] = myHand[0];
  myFull[1] = myHand[1];
  for (let i = 0; i < board.length; i++) {
    myFull[2 + i] = board[i];
    oppFull[2 + i] = board[i];
  }

  let wins = 0;
  let ties = 0;
  let sims = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let oppId1: number;
    let oppId2: number;
    let pool: Uint32Array;
    let poolCount: number;
    let boardStart: number;

    if (useRange) {
      const combo = validRange[(rng() * validRange.length) | 0];
      oppId1 = combo[0];
      oppId2 = combo[1];
      poolCount = 0;
      for (let i = 0; i < availCount; i++) {
        const id = avail[i];
        if (id !== oppId1 && id !== oppId2) scratch[poolCount++] = id;
      }
      pool = scratch;
      boardStart = 0;
    } else {
      const i1 = (rng() * availCount) | 0;
      const t1 = avail[0];
      avail[0] = avail[i1];
      avail[i1] = t1;
      oppId1 = avail[0];

      const i2 = 1 + ((rng() * (availCount - 1)) | 0);
      const t2 = avail[1];
      avail[1] = avail[i2];
      avail[i2] = t2;
      oppId2 = avail[1];

      pool = avail;
      poolCount = availCount;
      boardStart = 2;
    }

    for (let j = 0; j < boardNeeded; j++) {
      const pos = boardStart + j;
      const remaining = poolCount - pos;
      const idx = pos + ((rng() * remaining) | 0);
      const t = pool[pos];
      pool[pos] = pool[idx];
      pool[idx] = t;
    }

    oppFull[0] = DECK_BY_ID[oppId1];
    oppFull[1] = DECK_BY_ID[oppId2];
    for (let j = 0; j < boardNeeded; j++) {
      const c = DECK_BY_ID[pool[boardStart + j]];
      myFull[2 + board.length + j] = c;
      oppFull[2 + board.length + j] = c;
    }

    const my = evaluate(myFull);
    const opp = evaluate(oppFull);
    const cmp = compareHands(my, opp);
    if (cmp > 0) wins++;
    else if (cmp === 0) ties++;
    sims++;
  }

  if (sims === 0) return 0.5;
  return (wins + ties * 0.5) / sims;
}
