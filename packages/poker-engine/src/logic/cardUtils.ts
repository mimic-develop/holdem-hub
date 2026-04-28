import type { Card, Rank, Suit } from './types.js';

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const RANK_LABELS: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', 'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
};

export function parseCard(raw: string): Card {
  const rank = raw[0].toUpperCase() as Rank;
  const suit = raw[1].toLowerCase() as Suit;
  return { rank, suit };
}

export function parseCards(raws: string[]): Card[] {
  return raws.map(parseCard);
}

export function getRankValue(rank: string): number {
  return RANK_VALUES[rank.toUpperCase()] ?? 0;
}

export function getRankLabel(rank: string): string {
  return RANK_LABELS[rank.toUpperCase()] ?? rank;
}

export function getSuitSymbol(suit: string): string {
  return SUIT_SYMBOLS[suit.toLowerCase()] ?? suit;
}

export function isRedSuit(suit: string): boolean {
  return suit.toLowerCase() === 'h' || suit.toLowerCase() === 'd';
}

/** Generate all C(n, k) combinations from an array */
export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}
