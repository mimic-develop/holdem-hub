import { motion } from 'framer-motion';
import type { PlayerAction } from '../../types/game';

interface ActionToastProps {
  action: PlayerAction;
  amount?: number;
  isAllIn?: boolean;
  /** 금액 표시 단위. 기본 'bb'. */
  unit?: 'bb' | 'chips';
}

const ACTION_META: Record<PlayerAction, { label: string; bg: string; ring: string }> = {
  fold:  { label: 'FOLD',  bg: 'linear-gradient(180deg, #b45454 0%, #6b1a1a 100%)', ring: 'rgba(107,26,26,0.45)' },
  check: { label: 'CHECK', bg: 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)', ring: 'rgba(100,116,139,0.45)' },
  call:  { label: 'CALL',  bg: 'linear-gradient(180deg, #4ade80 0%, #15803d 100%)', ring: 'rgba(34,197,94,0.45)' },
  bet:   { label: 'BET',   bg: 'linear-gradient(180deg, #fb923c 0%, #c2410c 100%)', ring: 'rgba(249,115,22,0.45)' },
  raise: { label: 'RAISE', bg: 'linear-gradient(180deg, #fb923c 0%, #c2410c 100%)', ring: 'rgba(249,115,22,0.45)' },
};

const CHIPS_PER_BB = 2;

function formatAmount(chips: number, unit: 'bb' | 'chips'): string {
  if (unit === 'chips') return String(chips);
  const bb = chips / CHIPS_PER_BB;
  return Number.isInteger(bb) ? `${bb}bb` : `${bb.toFixed(1)}bb`;
}

/**
 * 액션 토스트 — 플레이어 위에 잠깐 떠오르는 라벨.
 * "FOLD", "CHECK", "CALL 6bb", "RAISE 12bb", "ALL-IN" 등을 표시.
 * unit='chips' 설정 시 raw 칩 수량 표시.
 */
export function ActionToast({ action, amount, isAllIn, unit = 'bb' }: ActionToastProps) {
  const meta = ACTION_META[action];
  const display = isAllIn
    ? 'ALL-IN'
    : amount !== undefined && amount > 0 && (action === 'call' || action === 'bet' || action === 'raise')
      ? `${meta.label} ${formatAmount(amount, unit)}`
      : meta.label;

  return (
    <motion.div
      key={`${action}-${amount}`}
      initial={{ scale: 0.5, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="rounded-md px-3 py-1 text-xs font-black tracking-wider text-white"
      style={{
        background: meta.bg,
        boxShadow: `0 4px 14px ${meta.ring}, 0 0 0 1px rgba(255,255,255,0.15) inset`,
        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }}
    >
      {display}
    </motion.div>
  );
}
