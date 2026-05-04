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
 * Manages an 8-second decision countdown with 2×10-second timebank support.
 *
 * Resets to base when `isActive` transitions false → true.
 * When time reaches 0:
 *   - If timebank available: fires `onUsedTimebank`, extends to +10s.
 *   - Otherwise: fires `onExpire`.
 *
 * Uses a local variable for the running value to avoid stale-closure issues
 * with `setInterval`; React state is updated each tick only for rendering.
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

  useEffect(() => {
    if (!isActive) {
      // Reset when turn ends.
      setRemaining(DECISION_BASE_SECONDS);
      setMaxTime(DECISION_BASE_SECONDS);
      return;
    }

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

    return () => clearInterval(interval);
    // Only restart when the active state changes. Callbacks are kept current via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return { remaining, maxTime };
}
