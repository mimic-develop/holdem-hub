import { motion, AnimatePresence } from 'framer-motion';
import type { Pot } from '@hh/poker-engine';
import ChipStack from './ChipStack';

interface PotAreaProps {
  /** buildPots() 결과 — 정답 가이드. amount 비교용으로 사용. */
  pots: Pot[];
  /** 사용자가 형성한 팟 액수 (potIndex → 누적) */
  formedAmounts: Record<number, number>;
  /** 활성 팟 인덱스 (현재 forming 중인 팟). 없으면 -1. */
  activePotIndex: number;
  /** 사용자가 클릭으로 선택한 팟 인덱스 (좌석 선택 후 팟 골라 확정 직전 상태). 없으면 null. */
  selectedPotIndex?: number | null;
  /** 좌석 선택 후 팟 클릭 핸들러 — 정의되면 모든 팟이 클릭 가능, hover에 강조 */
  onPotClick?: (potDropId: string) => void;
}

export default function PotArea({ pots, formedAmounts, activePotIndex, selectedPotIndex = null, onPotClick }: PotAreaProps) {
  if (pots.length === 0) return null;

  return (
    <div className="flex w-full items-stretch justify-center gap-2 px-2">
      <AnimatePresence>
        {pots.map((pot, i) => {
          const amount = formedAmounts[i] ?? 0;
          const isActive = i === activePotIndex;
          const isSelected = i === selectedPotIndex;
          const isContested = pot.eligible.length >= 2;
          if (!isContested && amount === 0) return null;

          const dropId = `pot-${i}`;
          const isTargetable = !!onPotClick;
          return (
            <motion.div
              key={`pot-${i}`}
              data-flying-id={dropId}
              data-testid={`pot-target-${i}`}
              data-selected={isSelected || undefined}
              onClick={isTargetable ? () => onPotClick(dropId) : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={[
                'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 border-2 transition-colors',
                isTargetable && !isSelected ? 'cursor-pointer hover:border-yellow-400 hover:bg-yellow-400/10' : '',
                isSelected
                  ? 'border-yellow-300 bg-yellow-400/20'
                  : isActive
                    ? 'border-primary/60 bg-primary/10'
                    : amount > 0
                      ? 'border-border bg-card/60'
                      : 'border-border/40 bg-card/30',
              ].join(' ')}
              style={{
                boxShadow: isSelected
                  ? '0 0 0 3px rgba(253,224,71,0.55), 0 0 18px rgba(253,224,71,0.55)'
                  : isTargetable
                    ? '0 0 0 2px rgba(251,191,36,0.25), 0 0 14px rgba(251,191,36,0.3)'
                    : isActive ? '0 0 0 2px rgba(37,99,235,0.18)' : undefined,
              }}
            >
              <span
                className={[
                  'text-[9px] font-bold uppercase tracking-wider leading-none',
                  pot.type === 'main' ? 'text-primary' : 'text-purple-300',
                ].join(' ')}
              >
                {pot.label}
              </span>
              <ChipStack
                amount={amount}
                tone="pot"
                size="md"
                active={isActive && amount > 0}
                layoutId={`pot-chip-${i}`}
                showZero
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
