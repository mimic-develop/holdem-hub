import { buildPots, evaluateHand, resolvePots, type PotResult } from '@hh/poker-engine';
import type { Puzzle } from '../types/poker';

export interface AnswerData {
  potResults: PotResult[];
  playerPayouts: Record<string, number>;
  correctRanks: Record<string, number>;
  handMap: Record<string, { descriptionKo: string; rankValue: number; tiebreakers: number[] }>;
}

export function bbaAdjusted(puzzle: Puzzle) {
  const contributions = puzzle.players.map(p => ({ id: p.id, invested: p.invested }));
  const deadMoney = puzzle.blindInfo?.deadMoney ?? 0;
  return { contributions, deadMoney };
}

export function computeAnswer(puzzle: Puzzle): AnswerData {
  const rawHandMap: Record<string, ReturnType<typeof evaluateHand>> = {};
  for (const p of puzzle.players) rawHandMap[p.id] = evaluateHand(p.cards, puzzle.board);

  const { contributions, deadMoney } = bbaAdjusted(puzzle);
  const pots = buildPots(contributions, deadMoney);
  const { potResults } = resolvePots(pots, rawHandMap);

  const playerPayouts: Record<string, number> = {};
  for (const pr of potResults) {
    if (pr.pot.eligible.length < 2) continue;
    const total = pr.pot.amount;
    const n = pr.winners.length;
    const per = Math.floor(total / n);
    const rem = total - per * n;
    for (let i = 0; i < n; i++) {
      const amt = per + (i === 0 ? rem : 0);
      playerPayouts[pr.winners[i]] = (playerPayouts[pr.winners[i]] ?? 0) + amt;
    }
  }

  const sortedIds = [...puzzle.players.map(p => p.id)].sort((a, b) => {
    const ha = rawHandMap[a], hb = rawHandMap[b];
    if (hb.rankValue !== ha.rankValue) return hb.rankValue - ha.rankValue;
    for (let i = 0; i < Math.max(ha.tiebreakers.length, hb.tiebreakers.length); i++) {
      const d = (hb.tiebreakers[i] ?? 0) - (ha.tiebreakers[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });

  const correctRanks: Record<string, number> = {};
  let rank = 1;
  for (let i = 0; i < sortedIds.length; i++) {
    if (i === 0) {
      correctRanks[sortedIds[i]] = 1;
    } else {
      const prev = rawHandMap[sortedIds[i - 1]], curr = rawHandMap[sortedIds[i]];
      const tied = prev.rankValue === curr.rankValue && prev.tiebreakers.every((t, j) => t === curr.tiebreakers[j]);
      if (!tied) rank = i + 1;
      correctRanks[sortedIds[i]] = rank;
    }
  }

  const handMap: Record<string, { descriptionKo: string; rankValue: number; tiebreakers: number[] }> = {};
  for (const [id, ev] of Object.entries(rawHandMap)) {
    handMap[id] = { descriptionKo: ev.descriptionKo, rankValue: ev.rankValue, tiebreakers: ev.tiebreakers };
  }

  return { potResults, playerPayouts, correctRanks, handMap };
}

export function normalizeRanks(rankMap: Record<string, number>): Record<string, number> {
  const unique = Array.from(new Set(Object.values(rankMap))).sort((a, b) => a - b);
  const mapping: Record<number, number> = {};
  unique.forEach((v, i) => { mapping[v] = i + 1; });
  const result: Record<string, number> = {};
  for (const [id, r] of Object.entries(rankMap)) result[id] = mapping[r];
  return result;
}

export function rankingsMatch(user: Record<string, number>, correct: Record<string, number>) {
  const nu = normalizeRanks(user), nc = normalizeRanks(correct);
  return Object.keys(nc).every(id => nu[id] === nc[id]);
}

export interface LastResult {
  correct: boolean;
  rankingCorrect: boolean;
  payoutScore: number;
  points: number;
  answer: AnswerData;
  userPayouts: Record<string, number>;
  userRankings: Record<string, number>;
  userPotInputs?: Record<string, number>;
  elapsed: number;
  passed: boolean;
  /**
   * 오답이 발생한 단계.
   *  - 'ranking': 1단계 핸드 순위
   *  - 'forming': 2단계 팟 형성 (이전 'pot')
   *  - 'awarding': 3단계 승자 결정 (이전 'payout')
   */
  wrongStep?: 'ranking' | 'forming' | 'awarding';
  brokenStreak?: number;
  timeScore?: number;
}

/**
 * 게임 phase.
 *  - 'pot' 안에서 forming + awarding 두 sub-step 시퀀스가 진행됨 (PR3/PR4)
 *  - 'payout' phase 는 제거됨 — 모든 분배 로직이 'pot' phase 안에서 좌석 클릭으로 처리
 */
export type Phase = 'ranking' | 'pot' | 'result' | 'wrong';
