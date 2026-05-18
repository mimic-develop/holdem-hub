import { buildPots, type Pot } from '@hh/poker-engine';
import { bbaAdjusted, computeAnswer } from './game-logic';
import type { Puzzle } from '../types/poker';

/**
 * 한 문제를 클릭 기반 워크플로우로 풀기 위한 정답 가이드.
 *
 * `buildPots()`(정답 팟 산출)과 `resolvePots()`(승자 결정) 결과를 가지고,
 * 사용자가 차례로 수행해야 할 액션 시퀀스를 만든다:
 *
 *   shortStack(메인팟) → deadMoney(있으면) → shortStack(사이드팟 1) → ...
 *   → autoReturn(잉여 1-eligible 팟)
 *   → awarding(메인팟) → awarding(사이드팟 1) → ...
 *
 * 각 스텝의 `correctSeatIds` / `correctWinners` 는 사용자가 클릭해야 할 좌석.
 */
export type FlowStep =
  | {
      kind: 'shortStack';
      potIndex: number;
      pot: Pot;
      correctSeatIds: string[];
      perSeatAmount: number;
      eligible: string[];
    }
  | {
      kind: 'deadMoney';
      amount: number;
    }
  | {
      kind: 'awarding';
      potIndex: number;
      pot: Pot;
      correctWinners: string[];
    }
  | {
      kind: 'autoReturn';
      potIndex: number;
      pot: Pot;
      receiverId: string;
    };

export interface FlowSummary {
  steps: FlowStep[];
  pots: Pot[];
  deadMoney: number;
}

/**
 * 한 팟에 대해, 그 팟 레벨의 숏스택 좌석들(동률 허용)을 찾는다.
 *
 * `buildPots()` 의 알고리즘: 정렬된 sorted 배열에서 i 인덱스부터 시작하는 슬라이스를
 * `eligible`로 둠. 즉 `eligible[0]` 는 invested 최소값을 가진 좌석. invested 동률은 모두 포함.
 */
function shortStackSeats(pot: Pot, investedById: Record<string, number>): string[] {
  if (pot.eligible.length === 0) return [];
  const minInvested = Math.min(...pot.eligible.map(id => investedById[id] ?? Infinity));
  return pot.eligible.filter(id => investedById[id] === minInvested);
}

export function deriveFlow(puzzle: Puzzle): FlowSummary {
  const { contributions, deadMoney } = bbaAdjusted(puzzle);
  const pots = buildPots(contributions, deadMoney);
  const answer = computeAnswer(puzzle);

  const investedById: Record<string, number> = {};
  for (const p of puzzle.players) investedById[p.id] = p.invested;

  const steps: FlowStep[] = [];
  const autoReturnSteps: FlowStep[] = [];
  const awardingSteps: FlowStep[] = [];

  pots.forEach((pot, potIndex) => {
    if (pot.eligible.length < 2) {
      autoReturnSteps.push({
        kind: 'autoReturn',
        potIndex,
        pot,
        receiverId: pot.eligible[0],
      });
      return;
    }

    const dm = potIndex === 0 ? deadMoney : 0;
    const baseAmount = pot.amount - dm;
    const perSeatAmount = baseAmount / pot.eligible.length;

    steps.push({
      kind: 'shortStack',
      potIndex,
      pot,
      correctSeatIds: shortStackSeats(pot, investedById),
      perSeatAmount,
      eligible: pot.eligible,
    });

    if (potIndex === 0 && deadMoney > 0) {
      steps.push({ kind: 'deadMoney', amount: deadMoney });
    }

    const winners = answer.potResults[potIndex]?.winners ?? [];
    awardingSteps.push({
      kind: 'awarding',
      potIndex,
      pot,
      correctWinners: winners,
    });
  });

  return {
    steps: [...steps, ...autoReturnSteps, ...awardingSteps],
    pots,
    deadMoney,
  };
}
