import { CheckCircle } from 'lucide-react';
import RankingDisplay from './RankingDisplay';
import type { Puzzle } from '../types/poker';

interface RankingPhaseProps {
  puzzle: Puzzle;
  rankAssignments: Record<string, number>;
  onReset: () => void;
  onSubmit: () => void;
}

export default function RankingPhase({ puzzle, rankAssignments, onReset, onSubmit }: RankingPhaseProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-wide leading-tight"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            1단계 · 핸드 순위
          </p>
          <p
            className="text-[10px] leading-tight"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            탭: 순위 지정 · 재탭: 동점
          </p>
        </div>
        <button
          onClick={onReset}
          data-testid="btn-reset-ranks"
          disabled={Object.keys(rankAssignments).length === 0}
          className="text-[10px] px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:border-input disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          초기화
        </button>
      </div>
      <RankingDisplay players={puzzle.players} rankings={rankAssignments} />

      <button
        onClick={onSubmit}
        data-testid="btn-submit-ranking"
        className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary text-primary-foreground transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
      >
        <CheckCircle className="w-4 h-4" />
        순위 확인
      </button>
    </>
  );
}
