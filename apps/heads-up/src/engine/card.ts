export type Suit = 's' | 'h' | 'd' | 'c';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
}

const RANK_TO_CHAR: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const CHAR_TO_RANK: Record<string, Rank> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const VALID_SUITS: ReadonlySet<string> = new Set(['s', 'h', 'd', 'c']);

export function cardToString(card: Card): string {
  return RANK_TO_CHAR[card.rank] + card.suit;
}

export function stringToCard(str: string): Card {
  if (str.length !== 2) {
    throw new Error(`Invalid card string: "${str}"`);
  }
  const rankChar = str[0].toUpperCase();
  const suitChar = str[1].toLowerCase();
  const rank = CHAR_TO_RANK[rankChar];
  if (rank === undefined) {
    throw new Error(`Invalid rank character: "${str[0]}" in "${str}"`);
  }
  if (!VALID_SUITS.has(suitChar)) {
    throw new Error(`Invalid suit character: "${str[1]}" in "${str}"`);
  }
  return { suit: suitChar as Suit, rank };
}

export function compareCards(a: Card, b: Card): number {
  return a.rank - b.rank;
}

export const ALL_SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];
export const ALL_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
