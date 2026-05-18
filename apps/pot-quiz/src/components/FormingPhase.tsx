import { AnimatePresence, motion } from 'framer-motion';
import PracticeGuide from './PracticeGuide';
import { rankColor, rankLabel } from '../lib/ranking';
import type { FlowStep } from '../lib/derive-flow';
import type { Puzzle } from '../types/poker';

interface FormingPhaseProps {
  puzzle: Puzzle;
  lockedRankings: Record<string, number>;
  step: FlowStep | null;
  /** 오답 시 토스트 트리거 — 변경 시 ephemeral 표시 */
  errorTick: number;
  errorReason: string | null;
  /** 학습 모드면 'why' 가이드 + 힌트 버튼 노출 */
  isPractice?: boolean;
  hintActive?: boolean;
  onToggleHint?: () => void;
}

/**
 * forming(=옛 pot) phase 의 안내 패널.
 *
 * 사용자 입력은 PokerTable 좌석/데드머니 클릭으로 받으므로, 이 컴포넌트는
 * "다음 액션은 무엇" 안내 + 오답 토스트 + 순위 요약만 표시.
 */
export default function FormingPhase({
  puzzle,
  lockedRankings,
  step,
  errorTick,
  errorReason,
  isPractice = false,
  hintActive = false,
  onToggleHint,
}: FormingPhaseProps) {
  const guideText = !step
    ? '팟 형성 완료 — 승자 결정으로 진행합니다'
    : step.kind === 'shortStack'
      ? `${step.pot.label}의 기준 숏스택 좌석을 선택하세요`
      : step.kind === 'deadMoney'
        ? '데드머니 더미를 클릭해 메인팟에 합치세요'
        : step.kind === 'autoReturn'
          ? `잉여 칩을 ${puzzle.players.find(p => p.id === step.receiverId)?.name ?? step.receiverId} 에게 반환합니다`
          : '';

  return (
    <>
      {isPractice && (
        <PracticeGuide
          step={step}
          puzzle={puzzle}
          hintActive={hintActive}
          onToggleHint={onToggleHint ?? (() => {})}
        />
      )}

      {/* Locked ranking bar */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide shrink-0">순위 ✓</span>
        <div className="flex gap-1 flex-wrap">
          {[...puzzle.players]
            .sort((a, b) => (lockedRankings[a.id] ?? 99) - (lockedRankings[b.id] ?? 99))
            .map(p => (
              <span key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${rankColor(lockedRankings[p.id] ?? 0)}`}>
                {rankLabel(lockedRankings[p.id] ?? 0)} {p.name}
              </span>
            ))}
        </div>
      </div>

      {/* Guide panel */}
      <div className="relative bg-card/70 border border-border rounded-xl px-3 py-3 mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          2단계 · 팟 형성
        </p>
        <p className="text-sm text-foreground font-medium">{guideText}</p>

        {/* Error toast */}
        <AnimatePresence>
          {errorReason && (
            <motion.div
              key={errorTick}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-3 px-2 py-1 rounded bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-semibold"
              data-testid="forming-error-toast"
            >
              {errorReason}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
