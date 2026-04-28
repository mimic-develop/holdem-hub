import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ConnectionStatus } from '../../rtc/peer-connection';

interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
  opponentLeft: boolean;
  onReturnHome: () => void;
}

const AUTO_RETURN_MS = 30_000;

export function ConnectionStatusBanner({
  status,
  opponentLeft,
  onReturnHome,
}: ConnectionStatusBannerProps) {
  // When disconnected, start a countdown and auto-return to lobby after 30s.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'DISCONNECTED' && !opponentLeft) {
      setSecondsLeft(Math.ceil(AUTO_RETURN_MS / 1000));
      const interval = setInterval(() => {
        setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
      }, 1000);
      const timeout = setTimeout(() => {
        onReturnHome();
      }, AUTO_RETURN_MS);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        setSecondsLeft(null);
      };
    }
    setSecondsLeft(null);
    return undefined;
  }, [status, opponentLeft, onReturnHome]);

  const visible = status !== 'CONNECTED' || opponentLeft;
  const message = opponentLeft
    ? '상대방이 방을 나갔습니다.'
    : status === 'CONNECTING'
      ? '연결하는 중…'
      : secondsLeft !== null
        ? `상대와 연결이 끊어졌습니다. 재연결 시도 중… (${secondsLeft}초 후 자동 종료)`
        : '연결이 끊어졌습니다.';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="sticky top-0 z-30 bg-red-900/80 px-4 py-2 text-center text-sm text-white backdrop-blur"
        >
          <div className="flex items-center justify-center gap-2">
            <span>{message}</span>
            {opponentLeft && (
              <button
                type="button"
                onClick={onReturnHome}
                className="rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
              >
                로비로
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
