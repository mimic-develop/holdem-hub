import type { Card, Rank } from '../../engine/card';
import type { HandClass } from './types';

/**
 * Classify a starting hand into one of four tiers used by the lightweight
 * hand-class correction layer. NOT meant to be combo-precise GTO ranges —
 * just enough to prevent the AI from folding AA or jamming 72o.
 */

const RANK_CHAR: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

/** Returns "AKs" / "AKo" / "AA" style key. Higher rank first. */
export function handKey(a: Card, b: Card): string {
  const [hi, lo] = a.rank >= b.rank ? [a, b] : [b, a];
  const hiC = RANK_CHAR[hi.rank];
  const loC = RANK_CHAR[lo.rank];
  if (hi.rank === lo.rank) return `${hiC}${loC}`;
  const suited = hi.suit === lo.suit ? 's' : 'o';
  return `${hiC}${loC}${suited}`;
}

const PREMIUM = new Set([
  'AA', 'KK', 'QQ', 'JJ', 'TT',
  'AKs', 'AKo', 'AQs',
]);

const STRONG = new Set([
  '99', '88', '77',
  'AQo', 'AJs', 'ATs',
  'KQs', 'KJs', 'QJs',
]);

/** Trash = lowest disconnected offsuit junk. Mirrors spec heuristic. */
const TRASH = new Set([
  '72o', '82o', '83o', '32o', '42o', '52o', '62o',
  '73o', '74o', '84o', '93o', '94o', '95o',
  '43o', '53o', '54o', '63o', '64o',
]);

export function classifyHand(a: Card, b: Card): HandClass {
  const k = handKey(a, b);
  if (PREMIUM.has(k)) return 'premium';
  if (STRONG.has(k)) return 'strong';
  if (TRASH.has(k)) return 'trash';
  return 'playable';
}
