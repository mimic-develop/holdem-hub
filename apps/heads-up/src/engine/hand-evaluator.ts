import type { Card, Suit } from './card';

export enum HandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export interface HandValue {
  rank: HandRank;
  score: number;
  kickers: Card[];
}

const SUIT_INDEX: Record<Suit, number> = { s: 0, h: 1, d: 2, c: 3 };
const SUIT_BY_INDEX: readonly Suit[] = ['s', 'h', 'd', 'c'];

function packScore(rank: HandRank, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0): number {
  return (rank << 20) | (r1 << 16) | (r2 << 12) | (r3 << 8) | (r4 << 4) | r5;
}

function topBit(bits: number): number {
  if (bits === 0) return -1;
  return 31 - Math.clz32(bits);
}

function topN(bits: number, n: number): number[] {
  const out: number[] = [];
  let b = bits;
  for (let i = 0; i < n && b !== 0; i++) {
    const t = 31 - Math.clz32(b);
    out.push(t);
    b &= ~(1 << t);
  }
  return out;
}

function straightTop(rankBits: number): number {
  let bits = rankBits;
  if ((bits & (1 << 14)) !== 0) bits |= 1 << 1;
  for (let top = 14; top >= 5; top--) {
    const mask = 0x1f << (top - 4);
    if ((bits & mask) === mask) return top;
  }
  return 0;
}

function pickByRanks(cards: Card[], ranksNeeded: number[]): Card[] {
  const used = new Array<boolean>(cards.length).fill(false);
  const out: Card[] = [];
  for (const rank of ranksNeeded) {
    for (let i = 0; i < cards.length; i++) {
      if (!used[i] && cards[i].rank === rank) {
        out.push(cards[i]);
        used[i] = true;
        break;
      }
    }
  }
  return out;
}

function pickFlushByRanks(cards: Card[], suit: Suit, ranksNeeded: number[]): Card[] {
  const out: Card[] = [];
  for (const rank of ranksNeeded) {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (c.suit === suit && c.rank === rank) {
        out.push(c);
        break;
      }
    }
  }
  return out;
}

function straightRanks(top: number): number[] {
  if (top === 5) return [5, 4, 3, 2, 14];
  return [top, top - 1, top - 2, top - 3, top - 4];
}

export function evaluate(sevenCards: Card[]): HandValue {
  if (sevenCards.length !== 7) {
    throw new Error(`evaluate expects 7 cards, got ${sevenCards.length}`);
  }

  let rankBits = 0;
  const rankCounts = new Uint8Array(15);
  const suitRankBits = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];

  for (let i = 0; i < 7; i++) {
    const c = sevenCards[i];
    const r = c.rank;
    const s = SUIT_INDEX[c.suit];
    rankBits |= 1 << r;
    rankCounts[r]++;
    suitRankBits[s] |= 1 << r;
    suitCounts[s]++;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      flushSuit = s;
      break;
    }
  }

  if (flushSuit !== -1) {
    const sfTop = straightTop(suitRankBits[flushSuit]);
    if (sfTop > 0) {
      const suit = SUIT_BY_INDEX[flushSuit];
      const sfRanks = straightRanks(sfTop);
      const kickers = pickFlushByRanks(sevenCards, suit, sfRanks);
      if (sfTop === 14) {
        return {
          rank: HandRank.ROYAL_FLUSH,
          score: packScore(HandRank.ROYAL_FLUSH, 14),
          kickers,
        };
      }
      return {
        rank: HandRank.STRAIGHT_FLUSH,
        score: packScore(HandRank.STRAIGHT_FLUSH, sfTop),
        kickers,
      };
    }
  }

  let quadRank = 0;
  const tripsRanks: number[] = [];
  const pairRanks: number[] = [];
  for (let r = 14; r >= 2; r--) {
    const c = rankCounts[r];
    if (c === 4) quadRank = r;
    else if (c === 3) tripsRanks.push(r);
    else if (c === 2) pairRanks.push(r);
  }

  if (quadRank > 0) {
    const kickerBits = rankBits & ~(1 << quadRank);
    const kicker = topBit(kickerBits);
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      score: packScore(HandRank.FOUR_OF_A_KIND, quadRank, kicker),
      kickers: pickByRanks(sevenCards, [quadRank, quadRank, quadRank, quadRank, kicker]),
    };
  }

  if (tripsRanks.length > 0 && (tripsRanks.length > 1 || pairRanks.length > 0)) {
    const tripRank = tripsRanks[0];
    const pairRank = tripsRanks.length > 1 ? tripsRanks[1] : pairRanks[0];
    return {
      rank: HandRank.FULL_HOUSE,
      score: packScore(HandRank.FULL_HOUSE, tripRank, pairRank),
      kickers: pickByRanks(sevenCards, [tripRank, tripRank, tripRank, pairRank, pairRank]),
    };
  }

  if (flushSuit !== -1) {
    const top5 = topN(suitRankBits[flushSuit], 5);
    return {
      rank: HandRank.FLUSH,
      score: packScore(HandRank.FLUSH, top5[0], top5[1], top5[2], top5[3], top5[4]),
      kickers: pickFlushByRanks(sevenCards, SUIT_BY_INDEX[flushSuit], top5),
    };
  }

  const stTop = straightTop(rankBits);
  if (stTop > 0) {
    return {
      rank: HandRank.STRAIGHT,
      score: packScore(HandRank.STRAIGHT, stTop),
      kickers: pickByRanks(sevenCards, straightRanks(stTop)),
    };
  }

  if (tripsRanks.length === 1) {
    const tr = tripsRanks[0];
    const kickerBits = rankBits & ~(1 << tr);
    const topK = topN(kickerBits, 2);
    return {
      rank: HandRank.THREE_OF_A_KIND,
      score: packScore(HandRank.THREE_OF_A_KIND, tr, topK[0], topK[1]),
      kickers: pickByRanks(sevenCards, [tr, tr, tr, topK[0], topK[1]]),
    };
  }

  if (pairRanks.length >= 2) {
    const hi = pairRanks[0];
    const lo = pairRanks[1];
    const kickerBits = rankBits & ~((1 << hi) | (1 << lo));
    const kicker = topBit(kickerBits);
    return {
      rank: HandRank.TWO_PAIR,
      score: packScore(HandRank.TWO_PAIR, hi, lo, kicker),
      kickers: pickByRanks(sevenCards, [hi, hi, lo, lo, kicker]),
    };
  }

  if (pairRanks.length === 1) {
    const p = pairRanks[0];
    const kickerBits = rankBits & ~(1 << p);
    const topK = topN(kickerBits, 3);
    return {
      rank: HandRank.PAIR,
      score: packScore(HandRank.PAIR, p, topK[0], topK[1], topK[2]),
      kickers: pickByRanks(sevenCards, [p, p, topK[0], topK[1], topK[2]]),
    };
  }

  const top5 = topN(rankBits, 5);
  return {
    rank: HandRank.HIGH_CARD,
    score: packScore(HandRank.HIGH_CARD, top5[0], top5[1], top5[2], top5[3], top5[4]),
    kickers: pickByRanks(sevenCards, top5),
  };
}

export function compareHands(a: HandValue, b: HandValue): number {
  return a.score - b.score;
}
