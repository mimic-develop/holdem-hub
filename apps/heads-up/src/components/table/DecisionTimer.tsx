import { AnimatePresence, motion } from 'framer-motion';
import { DECISION_BASE_SECONDS, TIMEBANK_BONUS_SECONDS } from '../../hooks/useDecisionTimer';

interface DecisionTimerProps {
  /** Remaining seconds in the current countdown phase. */
  remaining: number;
  /** Maximum seconds for the current phase (8 normally, 10 during timebank). */
  maxTime: number;
  /** Remaining timebank charges (0–2). */
  timebanksLeft: number;
  /** Whether to show the timer (only when it's the human player's turn). */
  show: boolean;
}

const RADIUS = 17;
const STROKE_WIDTH = 3;
const SVG_SIZE = (RADIUS + STROKE_WIDTH) * 2 + 2; // a little padding
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Danger threshold — last N seconds show red + pulse. */
const DANGER_SECONDS = 3;

/**
 * Circular SVG countdown timer displayed during the human player's decision window.
 *
 * Design:
 * - Thin ring that drains clockwise as time passes.
 * - Inner number shows remaining whole seconds.
 * - Last 3 seconds: ring + text pulse to red.
 * - Timebank dots shown below (filled = available, hollow = used).
 */
export function DecisionTimer({ remaining, maxTime, timebanksLeft, show }: DecisionTimerProps) {
  const fraction = Math.max(0, Math.min(1, remaining / maxTime));
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  const isTimebankActive = maxTime === TIMEBANK_BONUS_SECONDS;
  const isDanger = remaining <= DANGER_SECONDS && remaining > 0;

  const ringColor = isDanger ? '#f87171' : isTimebankActive ? '#f59e0b' : '#d4af37';
  const textColor = isDanger ? '#f87171' : isTimebankActive ? '#fbbf24' : '#e5e5e5';
  const trackColor = 'rgba(255,255,255,0.08)';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none absolute bottom-2 right-3 z-30 flex flex-col items-center gap-1"
        >
          {/* Circular ring */}
          <motion.div
            animate={isDanger ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={isDanger ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut' } : {}}
          >
            <svg
              width={SVG_SIZE}
              height={SVG_SIZE}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              style={{ display: 'block' }}
              aria-hidden
            >
              {/* Background track */}
              <circle
                cx={SVG_SIZE / 2}
                cy={SVG_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={trackColor}
                strokeWidth={STROKE_WIDTH}
              />
              {/* Progress arc — rotated so it starts at 12 o'clock */}
              <circle
                cx={SVG_SIZE / 2}
                cy={SVG_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={ringColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${SVG_SIZE / 2} ${SVG_SIZE / 2})`}
                style={{ transition: 'stroke-dashoffset 0.12s linear, stroke 0.3s' }}
              />
              {/* Remaining seconds label */}
              <text
                x="50%"
                y="50%"
                dominantBaseline="central"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={textColor}
                style={{ transition: 'fill 0.3s', fontFamily: 'inherit' }}
              >
                {Math.ceil(remaining)}
              </text>
            </svg>
          </motion.div>

          {/* Timebank dots — only show if timebanks are part of the setup */}
          {(timebanksLeft > 0 || maxTime === TIMEBANK_BONUS_SECONDS) && (
            <div className="flex gap-1" aria-label={`타임뱅크 ${timebanksLeft}회 남음`}>
              {Array.from({ length: 2 }).map((_, i) => {
                // i=0 is first timebank, i=1 is second.
                // If currently using timebank (maxTime === TIMEBANK_BONUS_SECONDS), the
                // first exhausted slot is "active" (pulsing amber).
                const totalUsed = 2 - timebanksLeft;
                const isConsumed = i < totalUsed;
                const isCurrentlyActive = isConsumed && i === totalUsed - 1 && isTimebankActive;
                return (
                  <motion.div
                    key={i}
                    animate={isCurrentlyActive ? { opacity: [1, 0.4, 1] } : {}}
                    transition={isCurrentlyActive ? { repeat: Infinity, duration: 0.9 } : {}}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: isConsumed
                        ? isCurrentlyActive
                          ? '#f59e0b'
                          : 'rgba(255,255,255,0.15)'
                        : '#d4af37',
                    }}
                  />
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Re-export constants for convenience.
export { DECISION_BASE_SECONDS, TIMEBANK_BONUS_SECONDS };
