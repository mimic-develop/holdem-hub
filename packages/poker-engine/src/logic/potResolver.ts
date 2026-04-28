import type { Pot, PotResult, HandEvaluation } from './types.js';
import { compareHands } from './handEvaluator.js';

export interface PlayerHandMap {
  [playerId: string]: HandEvaluation;
}

export interface ResolutionResult {
  potResults: PotResult[];
  playerPayouts: Record<string, number>;
}

/**
 * Resolve each pot to find winners and distribute chips.
 * Only eligible players compete for each pot.
 * Handles ties (chop) with remainder going to first player by position.
 */
export function resolvePots(pots: Pot[], handMap: PlayerHandMap): ResolutionResult {
  const playerPayouts: Record<string, number> = {};
  const potResults: PotResult[] = [];

  for (const pot of pots) {
    // Only consider players who have evaluated hands (eligible players)
    const competitors = pot.eligible.filter(id => id in handMap);

    if (competitors.length === 0) {
      potResults.push({ pot, winners: [], perWinner: 0 });
      continue;
    }

    // Find best hand among eligible players
    let bestEval = handMap[competitors[0]];
    let winners = [competitors[0]];

    for (let i = 1; i < competitors.length; i++) {
      const cmp = compareHands(handMap[competitors[i]], bestEval);
      if (cmp > 0) {
        // New best
        bestEval = handMap[competitors[i]];
        winners = [competitors[i]];
      } else if (cmp === 0) {
        // Tie
        winners.push(competitors[i]);
      }
    }

    // Split pot among winners
    const perWinner = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - perWinner * winners.length;

    for (let i = 0; i < winners.length; i++) {
      const payout = perWinner + (i === 0 ? remainder : 0);
      playerPayouts[winners[i]] = (playerPayouts[winners[i]] ?? 0) + payout;
    }

    potResults.push({ pot, winners, perWinner });
  }

  return { potResults, playerPayouts };
}
