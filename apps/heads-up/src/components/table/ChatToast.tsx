import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatEntry } from '../../store/game-store';

interface ChatToastProps {
  entries: ChatEntry[];
}

/**
 * Shows the most recent chat messages as transient bubbles near the bottom of
 * the screen. Auto-expires after 6 seconds based on the message timestamp.
 */
export function ChatToast({ entries }: ChatToastProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(
    () => entries.filter((e) => now - e.at < 6000).slice(-3),
    [entries, now],
  );

  return (
    <div className="pointer-events-none fixed bottom-28 left-0 right-0 z-20 flex flex-col items-center gap-1 px-4">
      <AnimatePresence initial={false}>
        {visible.map((e) => (
          <motion.div
            key={`${e.at}-${e.text}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-sm rounded-full bg-black/70 px-3 py-1 text-xs text-white shadow-lg"
          >
            <span className="mr-1 font-semibold text-primary">{e.from}</span>
            <span>{e.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
