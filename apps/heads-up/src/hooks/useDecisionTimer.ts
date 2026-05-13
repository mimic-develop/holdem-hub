import { useEffect, useRef, useState } from 'react';

/** Base decision time in seconds. 마스터 스펙 v2 §4.4. */
export const DECISION_BASE_SECONDS = 16;
/** Timebank bonus added when base time expires and a timebank is available. */
export const TIMEBANK_BONUS_SECONDS = 20;

interface UseDecisionTimerOptions {
  /** True while it is the human player's turn to act. */
  isActive: boolean;
  /** Remaining timebank charges (from game-store). */
  timebanksLeft: number;
  /** Called when time runs out and no timebank is available → auto-action. */
  onExpire: () => void;
  /** Called when a timebank charge is consumed. Caller should decrement store. */
  onUsedTimebank: () => void;
}

interface DecisionTimerState {
  /** Remaining seconds (may exceed DECISION_BASE_SECONDS during timebank). */
  remaining: number;
  /** Current phase maximum (8 or 10 during timebank). */
  maxTime: number;
}

/**
 * Manages a 16-second decision countdown with 2×20-second timebank support.
 *
 * Resets to base when `isActive` transitions false → true.
 * When time reaches 0:
 *   - If timebank available: fires `onUsedTimebank`, extends to +20s.
 *   - Otherwise: fires `onExpire`.
 *
 * Uses a local variable for the running value to avoid stale-closure issues
 * with `setInterval`; React state is updated each tick only for rendering.
 *
 * 탭 비활성화(백그라운드) 대응:
 *   브라우저가 백그라운드 탭의 setInterval을 1초 단위로 스로틀하면 타이머가
 *   느리게 흐르다 expired=true가 된 채 멈출 수 있다.
 *   visibilitychange 핸들러가 탭 복귀 시 타이머를 재시작한다.
 */
export function useDecisionTimer({
  isActive,
  timebanksLeft,
  onExpire,
  onUsedTimebank,
}: UseDecisionTimerOptions): DecisionTimerState {
  const [remaining, setRemaining] = useState<number>(DECISION_BASE_SECONDS);
  const [maxTime, setMaxTime] = useState<number>(DECISION_BASE_SECONDS);

  // Keep callbacks fresh without restarting the interval.
  const onExpireRef = useRef(onExpire);
  const onUsedTimebankRef = useRef(onUsedTimebank);
  const timebanksLeftRef = useRef(timebanksLeft);
  onExpireRef.current = onExpire;
  onUsedTimebankRef.current = onUsedTimebank;
  timebanksLeftRef.current = timebanksLeft;

  // 내부 인터벌을 외부에서 재시작할 수 있도록 epoch를 카운터로 관리.
  // isActive가 true인 채로 탭이 복귀하면 epoch를 올려 effect를 재실행시킨다.
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setRemaining(DECISION_BASE_SECONDS);
      setMaxTime(DECISION_BASE_SECONDS);
      return;
    }

    // 탭 복귀 감지 — 백그라운드에서 타이머가 throttle/suspend되어
    // expired=true로 죽었을 때 epoch를 올려 타이머를 재시작한다.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setEpoch((e) => e + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // Start fresh countdown.
    setRemaining(DECISION_BASE_SECONDS);
    setMaxTime(DECISION_BASE_SECONDS);

    let current = DECISION_BASE_SECONDS;
    let timebankUsedThisTurn = false;
    let expired = false;

    const interval = setInterval(() => {
      current = Math.round((current - 0.1) * 10) / 10;

      if (current <= 0 && !expired) {
        if (!timebankUsedThisTurn && timebanksLeftRef.current > 0) {
          // Activate timebank: extend by TIMEBANK_BONUS_SECONDS.
          timebankUsedThisTurn = true;
          current = TIMEBANK_BONUS_SECONDS;
          setMaxTime(TIMEBANK_BONUS_SECONDS);
          onUsedTimebankRef.current();
        } else {
          // Time completely out → auto-action.
          expired = true;
          current = 0;
          clearInterval(interval);
          onExpireRef.current();
        }
      }

      setRemaining(current);
    }, 100);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, epoch]);

  return { remaining, maxTime };
}
