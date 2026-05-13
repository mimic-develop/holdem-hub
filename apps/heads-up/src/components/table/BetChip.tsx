import { motion } from 'framer-motion';
import { useChipDisplay } from '../../hooks/useChipDisplay';

interface BetChipProps {
  amount: number;
  /** Optional explicit color. By default, color tier is derived from `amount`. */
  color?: 'white' | 'red' | 'green' | 'blue' | 'black';
}

interface ChipPalette {
  face: string;     // top disc gradient
  rim: string;      // disc rim color
  edge: string;     // edge dash color
  shadow: string;   // outer drop-shadow tint
}

const PALETTE: Record<NonNullable<BetChipProps['color']>, ChipPalette> = {
  white: {
    face: 'radial-gradient(circle at 35% 30%, #f8fafc 0%, #cbd5e1 60%, #94a3b8 100%)',
    rim: '#475569',
    edge: '#e2e8f0',
    shadow: 'rgba(0,0,0,0.45)',
  },
  red: {
    face: 'radial-gradient(circle at 35% 30%, #ef4444 0%, #b91c1c 60%, #7f1d1d 100%)',
    rim: '#7f1d1d',
    edge: '#fff',
    shadow: 'rgba(127,29,29,0.5)',
  },
  green: {
    face: 'radial-gradient(circle at 35% 30%, #22c55e 0%, #15803d 60%, #14532d 100%)',
    rim: '#14532d',
    edge: '#fff',
    shadow: 'rgba(20,83,45,0.5)',
  },
  blue: {
    face: 'radial-gradient(circle at 35% 30%, #3b82f6 0%, #1d4ed8 60%, #172554 100%)',
    rim: '#1e3a8a',
    edge: '#fff',
    shadow: 'rgba(30,58,138,0.55)',
  },
  black: {
    face: 'radial-gradient(circle at 35% 30%, #4b5563 0%, #1f2937 60%, #030712 100%)',
    rim: '#030712',
    edge: '#facc15', // gold dashes for high denomination
    shadow: 'rgba(0,0,0,0.6)',
  },
};

/** 1 BB = 20 chips in heads-up (SB=10, BB=20). */
const CHIPS_PER_BB = 20;

/**
 * Map bet size (in chips) to a poker-style color tier.
 * Thresholds are in BB units (chips / CHIPS_PER_BB).
 */
function tierForAmount(chips: number): NonNullable<BetChipProps['color']> {
  const bb = chips / CHIPS_PER_BB;
  if (bb < 3) return 'white';
  if (bb < 12) return 'red';
  if (bb < 25) return 'green';
  if (bb < 50) return 'blue';
  return 'black';
}

/**
 * 3장이 쌓인 포커칩 스택 + 우측 금액 라벨.
 *
 * - 가장자리 흰 dash 4개로 "포커칩"임을 즉시 식별 가능
 * - 금액 티어에 따라 색상이 달라져(white→red→green→blue→black) 베팅 크기를 한눈에 파악
 * - 라벨이 칩 옆에 붙어 있어 "이 금액이 누구의 베팅인지" 모호하지 않음
 */
export function BetChip({ amount, color }: BetChipProps) {
  const { fmt, toggle } = useChipDisplay();
  if (amount <= 0) return null;
  const tier = color ?? tierForAmount(amount);
  const p = PALETTE[tier];

  return (
    <motion.div
      key={`bet-${amount}`}
      initial={{ scale: 0.4, opacity: 0, y: 6 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="inline-flex items-center gap-1.5 cursor-pointer"
      onClick={toggle}
    >
      {/* Stacked chips: render 3 discs with vertical offset to imply a stack. */}
      <div className="relative" style={{ width: 28, height: 18 }}>
        {/* Bottom chip — offset down */}
        <ChipDisc style={{ left: 0, top: 8 }} face={p.face} rim={p.rim} shadow={p.shadow} />
        {/* Middle chip */}
        <ChipDisc style={{ left: 0, top: 4 }} face={p.face} rim={p.rim} shadow={p.shadow} />
        {/* Top chip — with edge dashes */}
        <ChipDisc
          style={{ left: 0, top: 0 }}
          face={p.face}
          rim={p.rim}
          shadow={p.shadow}
          edge={p.edge}
          showDashes
        />
      </div>

      {/* Amount label — sits right of the stack */}
      <span
        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
        style={{
          background: 'rgba(0,0,0,0.78)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {fmt(amount)}
      </span>
    </motion.div>
  );
}

interface ChipDiscProps {
  style: React.CSSProperties;
  face: string;
  rim: string;
  shadow: string;
  edge?: string;
  showDashes?: boolean;
}

/** Single chip disc — circular face with rim ring and (optionally) 4 edge dashes. */
function ChipDisc({ style, face, rim, shadow, edge, showDashes }: ChipDiscProps) {
  return (
    <div
      className="absolute h-[18px] w-[28px] rounded-full"
      style={{
        ...style,
        background: face,
        boxShadow: `0 0 0 1.5px ${rim}, 0 1px 2px ${shadow}`,
      }}
    >
      {showDashes && edge && (
        <>
          {/* Four edge dashes at 12/3/6/9 o'clock — characteristic poker-chip mark */}
          <span
            aria-hidden
            className="absolute left-1/2 top-0 h-[3px] w-[5px] -translate-x-1/2 rounded-sm"
            style={{ background: edge, opacity: 0.9 }}
          />
          <span
            aria-hidden
            className="absolute right-0 top-1/2 h-[5px] w-[3px] -translate-y-1/2 rounded-sm"
            style={{ background: edge, opacity: 0.9 }}
          />
          <span
            aria-hidden
            className="absolute left-1/2 bottom-0 h-[3px] w-[5px] -translate-x-1/2 rounded-sm"
            style={{ background: edge, opacity: 0.9 }}
          />
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-[5px] w-[3px] -translate-y-1/2 rounded-sm"
            style={{ background: edge, opacity: 0.9 }}
          />
          {/* Inner specular highlight */}
          <span
            aria-hidden
            className="absolute inset-[3px] rounded-full"
            style={{
              background:
                'radial-gradient(ellipse 70% 40% at 50% 30%, rgba(255,255,255,0.35) 0%, transparent 70%)',
            }}
          />
        </>
      )}
    </div>
  );
}
