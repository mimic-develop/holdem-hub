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

const SIZES: Record<'sm' | 'md' | 'lg', {
  box: string; rank: string; suit: string; center: string;
  corner: string; cornerBR: string;
}> = {
  sm: {
    box: 'w-10 h-14',
    rank: 'text-[18px]',
    suit: 'text-[11px]',
    center: 'text-2xl',
    corner: 'top-1 left-1',
    cornerBR: 'bottom-1 right-1',
  },
  md: {
    box: 'w-14 h-20',
    rank: 'text-[22px]',
    suit: 'text-[13px]',
    center: 'text-[34px]',
    corner: 'top-1 left-1.5',
    cornerBR: 'bottom-1 right-1.5',
  },
  lg: {
    box: 'w-16 h-24',
    rank: 'text-[26px]',
    suit: 'text-[15px]',
    center: 'text-[42px]',
    corner: 'top-1.5 left-1.5',
    cornerBR: 'bottom-1.5 right-1.5',
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
        initial={animate ? { opacity: 0, scale: 0.4, y: -60, rotate: -25 } : false}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        exit={{ opacity: 0, y: -40, rotate: 30, transition: { duration: 0.25 } }}
        transition={{ delay: delay / 1000, type: 'spring', stiffness: 260, damping: 22 }}
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
  // MIMIC red (#ba0c19) vs slate-900 (#0f172a) — 흰 배경 대비 최대화
  const colorClass = isRed ? 'text-[#ba0c19]' : 'text-[#0f172a]';

  return (
    <motion.div
      key={`${rankChar}${suit}`}
      className={clsx(base, dims.box, colorClass, className)}
      style={{
        background:
          'linear-gradient(180deg, #ffffff 0%, #fafafa 65%, #f1f3f5 100%)',
        boxShadow:
          '0 3px 8px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.6) inset, 0 0 0 1px rgba(0,0,0,0.22)',
      }}
      initial={animate ? { rotateY: 90, opacity: 0, scale: 0.6, y: -40 } : false}
      animate={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, y: -30, scale: 0.85, transition: { duration: 0.22 } }}
      transition={{ delay: delay / 1000, type: 'spring', stiffness: 220, damping: 20 }}
    >
      {/* Top-left corner: rank only */}
      <div className={clsx('absolute leading-none flex flex-col items-center', dims.corner)}>
        <span className={clsx('font-black tracking-tighter', dims.rank)}>
          {rankChar}
        </span>
      </div>

      {/* Center: large suit symbol */}
      <span className={clsx('leading-none font-bold', dims.center)}>
        {suitChar}
      </span>

      {/* Bottom-right corner: rank only (180° rotated) */}
      <div className={clsx('absolute rotate-180 leading-none flex flex-col items-center', dims.cornerBR)}>
        <span className={clsx('font-black tracking-tighter', dims.rank)}>
          {rankChar}
        </span>
      </div>
    </motion.div>
  );
}
