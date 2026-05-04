import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType } from '../../engine/card';
import { Card } from './Card';

interface HoleCardsProps {
  cards: CardType[] | null;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Base delay added to each card (ms). Used to stagger dealing across players. */
  baseDelay?: number;
  /** When true, cards animate out (fold). */
  folded?: boolean;
}

/**
 * 두 홀카드를 약간 겹쳐 fan(부채꼴) 형태로 표시.
 * baseDelay로 플레이어별 딜링 순서 stagger 가능.
 * folded=true 시 AnimatePresence가 exit 애니메이션 발동 (카드가 위로 날아가며 사라짐).
 */
export function HoleCards({
  cards,
  faceDown = false,
  size = 'md',
  baseDelay = 0,
  folded = false,
}: HoleCardsProps) {
  const c1 = cards?.[0] ?? null;
  const c2 = cards?.[1] ?? null;

  return (
    <AnimatePresence>
      {!folded && (
        <motion.div
          key="hand"
          className="relative inline-flex items-end"
          exit={{ opacity: 0, y: -20, rotate: 8, transition: { duration: 0.35 } }}
        >
          <div
            className="relative origin-bottom-right"
            style={{ transform: 'rotate(-6deg)', marginRight: '-6px', zIndex: 1 }}
          >
            <Card card={c1} faceDown={faceDown} size={size} delay={baseDelay} />
          </div>
          <div
            className="relative origin-bottom-left"
            style={{ transform: 'rotate(6deg)', marginLeft: '-6px', zIndex: 2 }}
          >
            <Card card={c2} faceDown={faceDown} size={size} delay={baseDelay + 200} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
