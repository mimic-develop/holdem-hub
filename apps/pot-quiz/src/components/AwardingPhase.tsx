import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import PracticeGuide from './PracticeGuide';
import { rankColor, rankLabel } from '../lib/ranking';
import type { FlowStep } from '../lib/derive-flow';
import type { Puzzle } from '../types/poker';

interface AwardingPhaseProps {
  puzzle: Puzzle;
  lockedRankings: Record<string, number>;
  step: FlowStep | null;
  /** 동률 후보 sub-step 임시 선택 (좌석 ID들) */
  awardingSelection: string[];
  /** 다중 후보 확정 버튼 핸들러 */
  onConfirm: () => void;
  /** 오답 토스트 트리거 */
  errorTick: number;
  errorReason: string | null;
  /** 학습 모드면 'why' 가이드 + 힌트 버튼 노출 */
  isPractice?: boolean;
  hintActive?: boolean;
  onToggleHint?: () => void;
  /** 사용자가 활성 팟을 클릭해 선택했는지 — 아직 안 했으면 "팟 먼저 클릭" 가이드 */
  potSelected?: boolean;
}

/**
 * awarding(=옛 payout) phase 안내 패널.
 *
 * 좌석 클릭은 PokerTable로 받으므로, 이 컴포넌트는 가이드 + 토스트 + (다중 후보 시) "확정" 버튼만.
 */
export default function AwardingPhase({
  puzzle,
  lockedRankings,
  step,
  awardingSelection,
  onConfirm,
  errorTick,
  errorReason,
  isPractice = false,
  hintActive = false,
  onToggleHint,
  potSelected = false,
}: AwardingPhaseProps) {
  const isAwarding = step?.kind === 'awarding';
  const isMultiCandidate = isAwarding && step.correctWinners.length > 1;
  const guideText = !step
    ? '모든 팟 분배 완료'
    : step.kind === 'awarding'
      ? !potSelected
        ? `먼저 ${step.pot.label}을 클릭해 분배할 팟을 선택하세요`
        : isMultiCandidate
          ? `${step.pot.label}의 승자(공동)들을 모두 선택 후 확정`
          : `${step.pot.label}의 승자 좌석을 선택하세요`
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
      <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide shrink-0">순위 ✓ 팟 ✓</span>
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

      <div className="relative bg-card/70 border border-border rounded-xl px-3 py-3 mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          3단계 · 승자 결정
        </p>
        <p className="text-sm text-foreground font-medium">{guideText}</p>

        {/* 자격(eligible) 좌석 명시 — selectedPot 활성 시 누가 후보인지 즉시 인지 */}
        {isAwarding && potSelected && step.pot.eligible.length > 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
            <span className="font-semibold text-foreground/80">자격:</span>{' '}
            {step.pot.eligible.map(id => {
              const p = puzzle.players.find(pl => pl.id === id);
              return p?.name ?? id;
            }).join(' · ')}
          </p>
        )}

        {/* 동률 후보일 때 선택된 좌석 미리보기 */}
        {isMultiCandidate && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>선택됨:</span>
            {awardingSelection.length === 0
              ? <span className="italic">없음</span>
              : awardingSelection.map(id => {
                const p = puzzle.players.find(pl => pl.id === id);
                return <span key={id} className="text-green-400 font-semibold">{p?.name ?? id}</span>;
              })}
          </div>
        )}

        <AnimatePresence>
          {errorReason && (
            <motion.div
              key={errorTick}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-3 px-2 py-1 rounded bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-semibold"
              data-testid="awarding-error-toast"
            >
              {errorReason}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isMultiCandidate && (
        <button
          onClick={onConfirm}
          data-testid="btn-confirm-awarding"
          disabled={awardingSelection.length === 0}
          className="w-full py-3 rounded-xl font-bold text-base bg-green-600 hover:bg-green-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95"
        >
          <CheckCircle className="w-4 h-4" />
          승자 확정 ({awardingSelection.length}명)
        </button>
      )}
    </>
  );
}
