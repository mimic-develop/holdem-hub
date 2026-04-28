import { motion } from 'framer-motion';

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

export function PotDisplay({ pot, street }: PotDisplayProps) {
  return (
    <motion.div
      key={`pot-${pot}`}
      initial={{ scale: 0.9, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-0.5"
    >
      <span className="text-xs uppercase tracking-wide text-white/60">
        POT · {STREET_KO[street] ?? street}
      </span>
      <span className="text-2xl font-bold text-primary drop-shadow-md">{pot}</span>
    </motion.div>
  );
}
