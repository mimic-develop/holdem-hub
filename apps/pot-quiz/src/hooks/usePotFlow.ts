import { useCallback, useMemo, useReducer } from 'react';
import { deriveFlow, type FlowStep, type FlowSummary } from '../lib/derive-flow';
import type { Puzzle } from '../types/poker';

/**
 * 한 퍼즐에 대한 클릭 기반 워크플로우 상태 + 진행 reducer.
 *
 * 진행 모델:
 *  - `flow.steps` 시퀀스에 따라 `stepIndex`가 증가
 *  - 각 step은 해당 액션이 정답으로 수행됐을 때만 다음 step으로 진행 (오답은 제자리)
 *  - chipsAtSeat / chipsAtDeadMoney / formedPots / awardedPots를 즉시 갱신
 *
 * 액션:
 *  - clickSeat(id): 현재 step이 shortStack이면 검증 후 칩 취합. awarding이면 즉시 확정(단일승자)
 *    또는 토글(동률 후보 다수).
 *  - clickDeadMoney(): 현재 step이 deadMoney이면 데드머니를 메인팟에 합침.
 *  - confirmAwarding(): 현재 step이 awarding이고 동률 후보 선택 중일 때 확정.
 *
 * autoReturn step은 사용자 액션 없이 자동 진행되도록 호출처에서 `setTimeout` 등으로 advance.
 *
 * PR3 범위: shortStack / deadMoney / autoReturn 처리. awarding은 PR4에서 본격 구현.
 */

export interface PotFlowState {
  stepIndex: number;
  chipsAtSeat: Record<string, number>;
  chipsAtDeadMoney: number;
  formedPots: Record<number, number>;
  awardedPots: Record<number, { winners: string[]; amount: number }>;
  awardingSelection: string[];
  errorTick: number;
  errorReason: string | null;
  hadAnyError: boolean;
  /** 첫 오답이 발생한 단계 — finalizeResult에서 wrongStep 분기에 사용 */
  firstErrorKind: 'forming' | 'awarding' | null;
  /**
   * 사용자 액션으로 stepIndex가 증가한 시점의 카운터(monotonic).
   * autoReturn 자동 진행은 카운트 안 함. 게임 모드에서 sub-step 도파민 보너스 계산용.
   */
  lastSuccessAt: number;
  /** 마지막 성공한 step kind — bonus 표시 라벨 */
  lastSuccessKind: 'shortStack' | 'deadMoney' | 'awarding' | null;
  /**
   * 마지막으로 정답 처리된 step의 스냅샷 — narration 텍스트 생성용.
   * autoReturn 자동 진행도 narration이 의미 있으므로 포함.
   */
  lastSuccessStep: FlowStep | null;
}

type Action =
  | { type: 'CLICK_SEAT'; seatId: string; flow: FlowSummary }
  | { type: 'CLICK_DEAD_MONEY'; flow: FlowSummary }
  | { type: 'CONFIRM_AWARDING'; flow: FlowSummary }
  | { type: 'ADVANCE_AUTO_RETURN'; flow: FlowSummary }
  | { type: 'SUBMIT_DRAG_SHORTSTACK'; seatId: string; potDropId: string; amount: number; flow: FlowSummary }
  | { type: 'RESET'; init: PotFlowState };

function reducer(state: PotFlowState, action: Action): PotFlowState {
  switch (action.type) {
    case 'RESET':
      return action.init;

    case 'CLICK_SEAT': {
      const step = action.flow.steps[state.stepIndex];
      if (!step) return state;

      if (step.kind === 'shortStack') {
        if (!step.correctSeatIds.includes(action.seatId)) {
          return {
            ...state,
            errorTick: state.errorTick + 1,
            errorReason: '숏스택이 아닙니다 — 이 팟의 eligible 중 가장 적게 베팅한 좌석을 고르세요',
            hadAnyError: true,
            firstErrorKind: state.firstErrorKind ?? 'forming',
          };
        }
        // 정답: 모든 eligible 좌석에서 perSeatAmount만큼 차감 → formedPots[potIndex] 증가
        const newChips = { ...state.chipsAtSeat };
        for (const id of step.eligible) {
          newChips[id] = Math.max(0, (newChips[id] ?? 0) - step.perSeatAmount);
        }
        const collected = step.perSeatAmount * step.eligible.length;
        return {
          ...state,
          stepIndex: state.stepIndex + 1,
          chipsAtSeat: newChips,
          formedPots: {
            ...state.formedPots,
            [step.potIndex]: (state.formedPots[step.potIndex] ?? 0) + collected,
          },
          errorReason: null,
          lastSuccessAt: state.lastSuccessAt + 1,
          lastSuccessKind: 'shortStack',
          lastSuccessStep: step,
        };
      }

      if (step.kind === 'awarding') {
        // 자격(eligible) 좌석 사전 검증 — 자격 없는 좌석 클릭/토글 시도 시 즉시 오답
        if (!step.pot.eligible.includes(action.seatId)) {
          return {
            ...state,
            errorTick: state.errorTick + 1,
            errorReason: '이 좌석은 이 팟의 자격이 없습니다 (콜을 끝까지 못한 좌석)',
            hadAnyError: true,
            firstErrorKind: state.firstErrorKind ?? 'awarding',
          };
        }
        // 단일 승자면 즉시 확정 / 다중 후보면 토글
        if (step.correctWinners.length === 1) {
          if (step.correctWinners[0] !== action.seatId) {
            return {
              ...state,
              errorTick: state.errorTick + 1,
              errorReason: '이 좌석은 이 팟의 승자가 아닙니다 — 핸드 강도 + eligible을 다시 확인하세요',
              hadAnyError: true,
              firstErrorKind: state.firstErrorKind ?? 'awarding',
            };
          }
          return commitAwarding(state, step, [action.seatId]);
        }
        // 다중 — 토글
        const selected = state.awardingSelection.includes(action.seatId)
          ? state.awardingSelection.filter(id => id !== action.seatId)
          : [...state.awardingSelection, action.seatId];
        return { ...state, awardingSelection: selected, errorReason: null };
      }

      // shortStack / awarding 외의 step에서 좌석 클릭은 무시
      return state;
    }

    case 'CLICK_DEAD_MONEY': {
      const step = action.flow.steps[state.stepIndex];
      if (!step || step.kind !== 'deadMoney') {
        return {
          ...state,
          errorTick: state.errorTick + 1,
          errorReason: '지금은 데드머니를 합칠 차례가 아닙니다',
          hadAnyError: true,
          firstErrorKind: state.firstErrorKind ?? 'forming',
        };
      }
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        chipsAtDeadMoney: 0,
        formedPots: {
          ...state.formedPots,
          0: (state.formedPots[0] ?? 0) + step.amount,
        },
        errorReason: null,
        lastSuccessAt: state.lastSuccessAt + 1,
        lastSuccessKind: 'deadMoney',
        lastSuccessStep: step,
      };
    }

    case 'CONFIRM_AWARDING': {
      const step = action.flow.steps[state.stepIndex];
      if (!step || step.kind !== 'awarding') return state;
      const selectedSet = new Set(state.awardingSelection);
      const correctSet = new Set(step.correctWinners);
      const same = selectedSet.size === correctSet.size && [...selectedSet].every(id => correctSet.has(id));
      if (!same) {
        return {
          ...state,
          errorTick: state.errorTick + 1,
          errorReason: '공동 승자 모두를 정확히 선택해야 합니다',
          hadAnyError: true,
          firstErrorKind: state.firstErrorKind ?? 'awarding',
        };
      }
      return commitAwarding(state, step, [...selectedSet]);
    }

    case 'SUBMIT_DRAG_SHORTSTACK': {
      const step = action.flow.steps[state.stepIndex];
      if (!step || step.kind !== 'shortStack') return state;

      // 좌석 검증
      if (!step.correctSeatIds.includes(action.seatId)) {
        return {
          ...state,
          errorTick: state.errorTick + 1,
          errorReason: '숏스택이 아닙니다 — 이 팟의 eligible 중 가장 적게 베팅한 좌석을 고르세요',
          hadAnyError: true,
          firstErrorKind: state.firstErrorKind ?? 'forming',
        };
      }
      // 팟 검증
      const expectedPotDropId = `pot-${step.potIndex}`;
      if (action.potDropId !== expectedPotDropId) {
        return {
          ...state,
          errorTick: state.errorTick + 1,
          errorReason: `이 좌석의 칩은 ${step.pot.label}으로 가야 합니다`,
          hadAnyError: true,
          firstErrorKind: state.firstErrorKind ?? 'forming',
        };
      }
      // 액수 검증 — 정확히 perSeatAmount
      if (action.amount !== step.perSeatAmount) {
        return {
          ...state,
          errorTick: state.errorTick + 1,
          errorReason: `액수가 다릅니다 — ${step.pot.label} 기준 액수를 다시 확인하세요`,
          hadAnyError: true,
          firstErrorKind: state.firstErrorKind ?? 'forming',
        };
      }
      // 정답: 모든 eligible 좌석에서 perSeatAmount 차감 + 팟에 적립
      const newChips = { ...state.chipsAtSeat };
      for (const id of step.eligible) {
        newChips[id] = Math.max(0, (newChips[id] ?? 0) - step.perSeatAmount);
      }
      const collected = step.perSeatAmount * step.eligible.length;
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        chipsAtSeat: newChips,
        formedPots: {
          ...state.formedPots,
          [step.potIndex]: (state.formedPots[step.potIndex] ?? 0) + collected,
        },
        errorReason: null,
        lastSuccessAt: state.lastSuccessAt + 1,
        lastSuccessKind: 'shortStack',
        lastSuccessStep: step,
      };
    }

    case 'ADVANCE_AUTO_RETURN': {
      const step = action.flow.steps[state.stepIndex];
      if (!step || step.kind !== 'autoReturn') return state;
      // 잉여 분량은 처음부터 receiver 좌석의 invested에 포함돼 있고 forming 단계에서 떼이지
      // 않았으므로 chipsAtSeat는 그대로 둔다. (이전엔 amount를 더해 double-count 했음 — 버그)
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        // 사용자 액션 아니므로 lastSuccessAt 증가 안 함 (게임 모드 보너스 트리거 방지).
        // narration은 의미 있으므로 lastSuccessStep만 갱신.
        lastSuccessStep: step,
      };
    }
  }
}

function commitAwarding(state: PotFlowState, step: Extract<FlowStep, { kind: 'awarding' }>, winners: string[]): PotFlowState {
  const formed = state.formedPots[step.potIndex] ?? step.pot.amount;
  const per = Math.floor(formed / winners.length);
  const rem = formed - per * winners.length;
  const newChips = { ...state.chipsAtSeat };
  winners.forEach((id, i) => {
    newChips[id] = (newChips[id] ?? 0) + per + (i === 0 ? rem : 0);
  });
  return {
    ...state,
    stepIndex: state.stepIndex + 1,
    chipsAtSeat: newChips,
    awardingSelection: [],
    // 분배된 팟은 즉시 비워짐(0칩) — 시각적으로 "이 팟은 처리됨" 신호
    formedPots: {
      ...state.formedPots,
      [step.potIndex]: 0,
    },
    awardedPots: {
      ...state.awardedPots,
      [step.potIndex]: { winners, amount: formed },
    },
    errorReason: null,
    lastSuccessAt: state.lastSuccessAt + 1,
    lastSuccessKind: 'awarding',
    lastSuccessStep: step,
  };
}

function initialState(puzzle: Puzzle | undefined): PotFlowState {
  const chipsAtSeat: Record<string, number> = {};
  if (puzzle) {
    for (const p of puzzle.players) chipsAtSeat[p.id] = p.invested;
  }
  return {
    stepIndex: 0,
    chipsAtSeat,
    chipsAtDeadMoney: puzzle?.blindInfo?.deadMoney ?? 0,
    formedPots: {},
    awardedPots: {},
    awardingSelection: [],
    errorTick: 0,
    errorReason: null,
    hadAnyError: false,
    firstErrorKind: null,
    lastSuccessAt: 0,
    lastSuccessKind: null,
    lastSuccessStep: null,
  };
}

export interface UsePotFlowResult {
  flow: FlowSummary | null;
  state: PotFlowState;
  step: FlowStep | null;
  isComplete: boolean;
  isFormingComplete: boolean;
  clickSeat: (seatId: string) => void;
  clickDeadMoney: () => void;
  confirmAwarding: () => void;
  advanceAutoReturn: () => void;
  /** 좌석 → 팟 드래그 결과 제출 (forming.shortStack 전용) */
  submitDragShortStack: (seatId: string, potDropId: string, amount: number) => void;
  reset: () => void;
}

export function usePotFlow(puzzle: Puzzle | undefined): UsePotFlowResult {
  const flow = useMemo(() => (puzzle ? deriveFlow(puzzle) : null), [puzzle]);
  const init = useMemo(() => initialState(puzzle), [puzzle]);
  const [state, dispatch] = useReducer(reducer, init);

  // puzzle 바뀌면 초기화는 호출처에서 reset() 호출
  const clickSeat = useCallback((seatId: string) => {
    if (!flow) return;
    dispatch({ type: 'CLICK_SEAT', seatId, flow });
  }, [flow]);

  const clickDeadMoney = useCallback(() => {
    if (!flow) return;
    dispatch({ type: 'CLICK_DEAD_MONEY', flow });
  }, [flow]);

  const confirmAwarding = useCallback(() => {
    if (!flow) return;
    dispatch({ type: 'CONFIRM_AWARDING', flow });
  }, [flow]);

  const advanceAutoReturn = useCallback(() => {
    if (!flow) return;
    dispatch({ type: 'ADVANCE_AUTO_RETURN', flow });
  }, [flow]);

  const submitDragShortStack = useCallback((seatId: string, potDropId: string, amount: number) => {
    if (!flow) return;
    dispatch({ type: 'SUBMIT_DRAG_SHORTSTACK', seatId, potDropId, amount, flow });
  }, [flow]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', init });
  }, [init]);

  const step = flow?.steps[state.stepIndex] ?? null;
  const isComplete = !!flow && state.stepIndex >= flow.steps.length;
  const isFormingComplete = !!flow && !flow.steps
    .slice(state.stepIndex)
    .some(s => s.kind === 'shortStack' || s.kind === 'deadMoney' || s.kind === 'autoReturn');

  return {
    flow,
    state,
    step,
    isComplete,
    isFormingComplete,
    clickSeat,
    clickDeadMoney,
    confirmAwarding,
    advanceAutoReturn,
    submitDragShortStack,
    reset,
  };
}
