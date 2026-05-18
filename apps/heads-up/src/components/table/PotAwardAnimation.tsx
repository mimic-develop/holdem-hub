import { useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const BIG_BLIND = 20;

interface PotAwardAnimationProps {
  /** Did I (the human player) win? */
  iWon: boolean;
  /** True if split pot (both players win). */
  isSplit: boolean;
  /** Net chip change for me (positive = won, negative = lost). */
  myWinLoss: number;
  /** Called when the animation finishes (~1.9s). */
  onComplete: () => void;
}

/**
 * 팟 수여 애니메이션.
 * PokerTable의 relative 컨테이너 안에 absolute overlay로 렌더됨.
 * 전체 화면을 덮지 않으므로 플레이어/보드 카드가 그대로 보인다.
 *
 * - 골드 코인 스택이 팟 중앙에서 수상자 방향으로 날아감
 * - 승패 결과 pill이 테이블 중앙에 잠깐 등장 후 페이드
 * - 1.2초 후 onComplete 자동 호출 (→ startNextHand)
 *   매 핸드 NIT 폴드/체크가 누적되는 경우 4초 → 2.5초로 단축되어 진행감 회복.
 */
export function PotAwardAnimation({
  iWon,
  isSplit,
  myWinLoss,
  onComplete,
}: PotAwardAnimationProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, 1200);
    return () => clearTimeout(t);
  }, [onComplete]);

  const bbAbs = Math.abs(myWinLoss) / BIG_BLIND;
  const bbDisplay =
    Number.isInteger(bbAbs) ? `${bbAbs}bb` : `${bbAbs.toFixed(1)}bb`;

  const resultLabel = isSplit
    ? '🤝 반반'
    : iWon
      ? `+${bbDisplay}`
      : `-${bbDisplay}`;

  // Coins fly toward my side (positive Y = down = toward me) or opponent's side
  const flyY = iWon ? '55%' : isSplit ? '0%' : '-55%';
  const COINS = [0, 1, 2, 3, 4, 5] as const;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      {/* Flying coin stack */}
      <div className="relative flex items-center justify-center">
        {COINS.map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ top: `${-i * 2}px` }}
            initial={{ y: 0, x: 0, scale: 1, opacity: 0.95 }}
            animate={{
              y: flyY,
              x: `${(i % 2 === 0 ? 1 : -1) * i * 2}px`,
              scale: 0.35,
              opacity: 0,
            }}
            transition={{
              duration: 0.75,
              delay: 0.25 + i * 0.045,
              ease: [0.4, 0, 1, 1],
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-amber-200 text-[10px] font-black text-amber-900"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #fde68a, #f59e0b)',
                boxShadow: '0 2px 6px rgba(245,158,11,0.6), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              ₩
            </div>
          </motion.div>
        ))}

        {/* Result pill — appears first, fades after coins fly */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 0 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: -6 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className={clsx(
            'relative z-10 select-none rounded-full px-4 py-1.5 text-sm font-black tracking-tight shadow-lg',
            isSplit
              ? 'bg-white/20 text-white'
              : iWon
                ? 'text-black'
                : 'bg-rose-700/85 text-white',
          )}
          style={
            iWon
              ? {
                  background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
                  boxShadow: '0 4px 16px rgba(252,211,77,0.5)',
                }
              : undefined
          }
        >
          {resultLabel}
        </motion.div>
      </div>
    </div>
  );
}
