import { AnimatePresence, motion } from 'framer-motion';
import type { FlowStep } from '../lib/derive-flow';
import type { Puzzle } from '../types/poker';

interface NarrationToastProps {
  /** 마지막 정답 step. 변경 시 새 narration 1회 재생. */
  step: FlowStep | null;
  /** step 변화를 감지하는 카운터(monotonic). 같은 step 종류가 연달아도 재트리거. */
  tick: number;
  puzzle: Puzzle;
}

/**
 * 정답 직후 1.5초간 화면 중앙에 "방금 일어난 일"을 명시적 텍스트로 표시.
 * - forming(shortStack): "메인팟: A·B·C 각자 100칩씩 → 3 × 100 = 300칩"
 * - deadMoney: "데드머니 50칩 → 메인팟에 합쳤습니다"
 * - awarding: "메인팟 → A (300칩) 획득"
 * - autoReturn: "잉여 200칩 → C에게 반환"
 *
 * 학습 모드/게임 모드 공통. 시각만으로 부족한 절차의 "왜"를 텍스트로 강화.
 */
export default function NarrationToast({ step, tick, puzzle }: NarrationToastProps) {
  if (!step) return null;
  const { headline, formula } = buildNarration(step, puzzle);
  if (!headline) return null;

  return (
    <div className="relative h-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={tick}
          initial={{ opacity: 0, y: -8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute left-1/2 -translate-x-1/2 -top-1 z-20 pointer-events-none"
          data-testid="narration-toast"
        >
          <div className="px-3 py-2 rounded-xl bg-zinc-950/95 border border-emerald-400/50 shadow-lg shadow-emerald-500/20 backdrop-blur-md whitespace-nowrap">
            <p className="text-[11px] font-bold text-emerald-200 leading-none mb-0.5">{headline}</p>
            {formula && (
              <p className="text-[10px] font-mono text-emerald-100/90 leading-none">{formula}</p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function buildNarration(step: FlowStep, puzzle: Puzzle): { headline: string; formula?: string } {
  const nameOf = (id: string) => puzzle.players.find(p => p.id === id)?.name ?? id;

  if (step.kind === 'shortStack') {
    const names = step.eligible.map(nameOf).join('·');
    const total = step.perSeatAmount * step.eligible.length;
    return {
      headline: `${step.pot.label}: ${names} 각자 ${step.perSeatAmount.toLocaleString()}칩씩`,
      formula: `${step.eligible.length} × ${step.perSeatAmount.toLocaleString()} = ${total.toLocaleString()}칩`,
    };
  }

  if (step.kind === 'deadMoney') {
    return {
      headline: `데드머니 ${step.amount.toLocaleString()}칩 → 메인팟 합산`,
    };
  }

  if (step.kind === 'awarding') {
    const winners = step.correctWinners.map(nameOf).join('·');
    const tag = step.correctWinners.length > 1 ? ' 공동 분배' : '';
    return {
      headline: `${step.pot.label} → ${winners}${tag}`,
    };
  }

  if (step.kind === 'autoReturn') {
    return {
      headline: `잉여 ${step.pot.amount.toLocaleString()}칩 → ${nameOf(step.receiverId)} 좌석에 그대로 남김`,
    };
  }

  return { headline: '' };
}
