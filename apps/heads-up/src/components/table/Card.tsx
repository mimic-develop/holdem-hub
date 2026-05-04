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

/**
 * GTO Wizard / Poker Now 스타일 카드:
 * - 면(face): 흰 배경 + 미세 그라디언트, 좌상/우하 corner index, 중앙 큰 무늬
 * - 뒷면(back): 네이비 + 다이아몬드 패턴 + 골드 보더 액센트
 */

const SIZES: Record<'sm' | 'md' | 'lg', { box: string; rank: string; suit: string; center: string; corner: string }> = {
  sm: {
    box: 'w-10 h-14',
    rank: 'text-base',
    suit: 'text-[10px]',
    center: 'text-xl',
    corner: 'top-1 left-1',
  },
  md: {
    box: 'w-14 h-20',
    rank: 'text-xl',
    suit: 'text-xs',
    center: 'text-3xl',
    corner: 'top-1 left-1.5',
  },
  lg: {
    box: 'w-16 h-24',
    rank: 'text-2xl',
    suit: 'text-sm',
    center: 'text-4xl',
    corner: 'top-1.5 left-1.5',
  },
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
  const dims = SIZES[size];
  const base =
    'relative inline-flex items-center justify-center rounded-[7px] select-none overflow-hidden';

  if (!card || faceDown) {
    return (
      <motion.div
        key="back"
        className={clsx(base, dims.box, className)}
        style={{
          background:
            'linear-gradient(145deg, #1e3a8a 0%, #1a3372 50%, #11244e 100%)',
          boxShadow:
            '0 2px 6px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.12) inset, 0 0 0 1px rgba(0,0,0,0.4)',
        }}
        initial={animate ? { opacity: 0, y: -10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay / 1000, duration: 0.2 }}
      >
        {/* Gold-edge inner border */}
        <div
          aria-hidden
          className="absolute inset-[3px] rounded-[5px]"
          style={{
            border: '1px solid rgba(212,175,55,0.35)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        />
        {/* Diamond crosshatch pattern */}
        <div
          aria-hidden
          className="absolute inset-[5px] rounded-[4px] opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 6px)',
          }}
        />
        {/* Center mark */}
        <div
          aria-hidden
          className="relative z-10 flex h-3 w-3 items-center justify-center rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.7) 0%, rgba(212,175,55,0.2) 70%, transparent 100%)',
          }}
        />
      </motion.div>
    );
  }

  const suit = card.suit;
  const isRed = suit === 'h' || suit === 'd';
  const rankChar = cardToString(card)[0];
  const suitChar = SUIT_SYMBOL[suit];
  const colorClass = isRed ? 'text-red-600' : 'text-neutral-900';

  return (
    <motion.div
      key={`${rankChar}${suit}`}
      className={clsx(base, dims.box, colorClass, className)}
      style={{
        background:
          'linear-gradient(180deg, #ffffff 0%, #fafafa 65%, #f1f3f5 100%)',
        boxShadow:
          '0 2px 6px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.6) inset, 0 0 0 1px rgba(0,0,0,0.18)',
      }}
      initial={animate ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay: delay / 1000, duration: 0.3 }}
    >
      {/* Top-left corner: rank + suit stacked */}
      <div className={clsx('absolute leading-none flex flex-col items-center', dims.corner)}>
        <span className={clsx('font-black tracking-tighter', dims.rank)}>
          {rankChar}
        </span>
        <span className={clsx('leading-none -mt-0.5', dims.suit)}>{suitChar}</span>
      </div>

      {/* Center: large suit symbol */}
      <span className={clsx('leading-none font-bold opacity-95', dims.center)}>
        {suitChar}
      </span>
    </motion.div>
  );
}
