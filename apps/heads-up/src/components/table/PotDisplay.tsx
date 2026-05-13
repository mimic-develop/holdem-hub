import { motion } from 'framer-motion';
import { useChipDisplay } from '../../hooks/useChipDisplay';

interface PotDisplayProps {
  pot: number;
  street: string;
}

const STREET_KO: Record<string, string> = {
  preflop: '프리플랍',
  flop: '플랍',
  turn: '턴',
  river: '리버',
};

/**
 * GTO Wizard 스타일 팟 표시: 작은 다크 pill, 중앙 배치.
 * 클릭 시 BB ↔ chips 단위 전환.
 */
export function PotDisplay({ pot, street }: PotDisplayProps) {
  const { fmt, toggle } = useChipDisplay();

  if (pot === 0) {
    return (
      <span
        className="text-[10px] uppercase tracking-widest text-white/30 cursor-pointer"
        onClick={toggle}
      >
        {STREET_KO[street] ?? street}
      </span>
    );
  }

  return (
    <motion.div
      key={`pot-${pot}`}
      initial={{ scale: 0.92, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      className="rounded-full px-3 py-1 cursor-pointer"
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.4)',
      }}
      onClick={toggle}
    >
      <span className="text-xs text-white/80">
        Pot: <span className="font-bold text-white">{fmt(pot)}</span>
      </span>
    </motion.div>
  );
}
