import type { Card, HandEvaluation, HandRank } from './types.js';
import { parseCards, getRankValue, combinations } from './cardUtils.js';

const HAND_RANK_VALUES: Record<HandRank, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
};

const HAND_NAMES_KO: Record<HandRank, string> = {
  HIGH_CARD: '하이카드',
  ONE_PAIR: '원페어',
  TWO_PAIR: '투페어',
  THREE_OF_A_KIND: '트리플',
  STRAIGHT: '스트레이트',
  FLUSH: '플러시',
  FULL_HOUSE: '풀하우스',
  FOUR_OF_A_KIND: '포카드',
  STRAIGHT_FLUSH: '스트레이트 플러시',
};

/** Evaluate exactly 5 cards and return hand info */
function evaluateFive(cards: Card[]): { rank: HandRank; tiebreakers: number[] } {
  const sorted = [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
  const ranks = sorted.map(c => getRankValue(c.rank));
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including A-2-3-4-5 wheel)
  let isStraight = false;
  let straightHighCard = ranks[0];
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHighCard = ranks[0];
  }
  // Wheel: A-2-3-4-5
  const isWheel = ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2;
  if (isWheel) {
    isStraight = true;
    straightHighCard = 5;
  }

  if (isFlush && isStraight) {
    return { rank: 'STRAIGHT_FLUSH', tiebreakers: [straightHighCard] };
  }

  // Count ranks
  const rankCounts: Record<number, number> = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] ?? 0) + 1;
  const counts = Object.entries(rankCounts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (counts[0].count === 4) {
    return { rank: 'FOUR_OF_A_KIND', tiebreakers: [counts[0].rank, counts[1].rank] };
  }
  if (counts[0].count === 3 && counts[1].count === 2) {
    return { rank: 'FULL_HOUSE', tiebreakers: [counts[0].rank, counts[1].rank] };
  }
  if (isFlush) {
    return { rank: 'FLUSH', tiebreakers: ranks };
  }
  if (isStraight) {
    return { rank: 'STRAIGHT', tiebreakers: [straightHighCard] };
  }
  if (counts[0].count === 3) {
    const kickers = counts.slice(1).map(c => c.rank);
    return { rank: 'THREE_OF_A_KIND', tiebreakers: [counts[0].rank, ...kickers] };
  }
  if (counts[0].count === 2 && counts[1].count === 2) {
    const kicker = counts[2].rank;
    return { rank: 'TWO_PAIR', tiebreakers: [counts[0].rank, counts[1].rank, kicker] };
  }
  if (counts[0].count === 2) {
    const kickers = counts.slice(1).map(c => c.rank);
    return { rank: 'ONE_PAIR', tiebreakers: [counts[0].rank, ...kickers] };
  }
  return { rank: 'HIGH_CARD', tiebreakers: ranks };
}

/** Compare two tiebreaker arrays: returns >0 if a > b, <0 if a < b, 0 if equal */
function compareTiebreakers(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Get the best 5-card hand from 7 cards */
export function evaluateHand(holeCards: string[], board: string[]): HandEvaluation {
  const all7 = parseCards([...holeCards, ...board]);
  const fiveCombos = combinations(all7, 5);

  let bestRank: HandRank = 'HIGH_CARD';
  let bestTiebreakers: number[] = [0, 0, 0, 0, 0];
  let bestFive: Card[] = fiveCombos[0];

  for (const five of fiveCombos) {
    const result = evaluateFive(five);
    const rankVal = HAND_RANK_VALUES[result.rank];
    const bestVal = HAND_RANK_VALUES[bestRank];

    if (rankVal > bestVal || (rankVal === bestVal && compareTiebreakers(result.tiebreakers, bestTiebreakers) > 0)) {
      bestRank = result.rank;
      bestTiebreakers = result.tiebreakers;
      bestFive = five;
    }
  }

  const nameKo = HAND_NAMES_KO[bestRank];
  return {
    rank: bestRank,
    rankValue: HAND_RANK_VALUES[bestRank],
    tiebreakers: bestTiebreakers,
    bestFive,
    description: bestRank,
    descriptionKo: nameKo,
  };
}

/** Compare two HandEvaluations: >0 if a beats b, <0 if b beats a, 0 if tie */
export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  return compareTiebreakers(a.tiebreakers, b.tiebreakers);
}
