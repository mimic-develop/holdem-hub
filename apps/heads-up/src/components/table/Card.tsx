import { motion } from 'framer-motion';
import { cardToString, type Card as CardType } from '../../engine/card';
import clsx from 'clsx';

interface CardProps {
  card?: CardType | null;
  /** When true, render face-down. */
  faceDown?: boolean;
  /** Size preset. */
  size?: 'sm' | 'md' | 'lg';
  /** Delay for flip-in animation (ms). */
  delay?: number;
  /** When true, animate entrance. */
  animate?: boolean;
  className?: string;
}

const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-9 h-12 text-sm',
  md: 'w-12 h-16 text-lg',
  lg: 'w-14 h-20 text-2xl',
};

const SUIT_SYMBOL: Record<string, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export function Card({
  card,
  faceDown = false,
  size = 'md',
  delay = 0,
  animate = true,
  className,
}: CardProps) {
  const base =
    'relative inline-flex items-center justify-center rounded-md shadow-md border font-semibold select-none overflow-hidden';
  if (!card || faceDown) {
    return (
      <motion.div
        key="back"
        className={clsx(
          base,
          SIZES[size],
          'bg-card-back border-blue-900',
          className,
        )}
        initial={animate ? { opacity: 0, y: -10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay / 1000, duration: 0.2 }}
      >
        <div className="absolute inset-1 rounded-sm border border-blue-400/30" />
        <div className="h-2 w-2 rounded-full bg-blue-300/50" />
      </motion.div>
    );
  }

  const suit = card.suit;
  const isRed = suit === 'h' || suit === 'd';
  const rankChar = cardToString(card)[0];
  const suitChar = SUIT_SYMBOL[suit];

  return (
    <motion.div
      key={`${rankChar}${suit}`}
      className={clsx(
        base,
        SIZES[size],
        'bg-white border-neutral-300 text-neutral-900',
        isRed && 'text-red-600',
        className,
      )}
      initial={animate ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay: delay / 1000, duration: 0.3 }}
    >
      <div className="absolute top-0.5 left-1 text-xs font-bold leading-none">
        {rankChar}
      </div>
      <div className="absolute top-3 left-1 text-[10px] leading-none">
        {suitChar}
      </div>
      <div className="flex flex-col items-center">
        <span className="leading-none">{rankChar}</span>
        <span className="text-xs leading-none">{suitChar}</span>
      </div>
    </motion.div>
  );
}
