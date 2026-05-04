import { AnimatePresence, motion } from 'framer-motion';

interface TurnBannerProps {
  show: boolean;
}

/**
 * "내 차례입니다" 플로팅 배너. 부모(`TablePage`)에서 isMyTurn 상승 엣지에 1.5s 노출.
 * pointer-events-none 으로 클릭 통과.
 */
export function TurnBanner({ show }: TurnBannerProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(252,211,77,0.6), 0 6px 18px rgba(0,0,0,0.45)',
                '0 0 0 12px rgba(252,211,77,0), 0 6px 18px rgba(0,0,0,0.45)',
              ],
            }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
            className="rounded-full px-4 py-1.5 text-sm font-bold text-black"
            style={{
              background: 'linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%)',
              border: '1px solid rgba(255,255,255,0.35)',
            }}
          >
            🎯 내 차례입니다
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
