import type { Pot } from './types.js';

export interface PlayerContribution {
  id: string;
  invested: number;
}

/**
 * Build main pot and side pots from player contributions.
 *
 * Algorithm:
 * 1. Sort players by invested amount ascending.
 * 2. At each "level", the contribution to this level = (current level - prev level).
 * 3. That level's pot = contribution * (number of players still contributing).
 * 4. Players who have used up their stack become ineligible for higher pots.
 */
export function buildPots(players: PlayerContribution[], deadMoney = 0): Pot[] {
  if (players.length === 0) return [];

  const sorted = [...players].sort((a, b) => a.invested - b.invested);

  const pots: Pot[] = [];
  let prevLevel = 0;
  let potIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    const currentLevel = sorted[i].invested;
    if (currentLevel <= prevLevel) continue;

    const contribution = currentLevel - prevLevel;
    const eligible = sorted.slice(i).map(p => p.id);
    const contributingPlayers = sorted.filter(p => p.invested > prevLevel);
    const potAmount = contribution * contributingPlayers.length;

    const isMain = potIndex === 0;
    pots.push({
      type: isMain ? 'main' : 'side',
      label: isMain ? '메인팟' : `사이드팟 ${potIndex}`,
      amount: potAmount,
      eligible: eligible,
    });

    prevLevel = currentLevel;
    potIndex++;
  }

  // Dead money (folded SB/BB blinds) goes into the main pot — all players eligible
  if (deadMoney > 0 && pots.length > 0) {
    pots[0] = { ...pots[0], amount: pots[0].amount + deadMoney };
  }

  return pots;
}

/** Sum all pot amounts */
export function totalPot(pots: Pot[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
