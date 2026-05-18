import { Lightbulb } from 'lucide-react';
import type { FlowStep } from '../lib/derive-flow';
import type { Puzzle } from '../types/poker';

interface PracticeGuideProps {
  step: FlowStep | null;
  puzzle: Puzzle;
  /** 힌트(정답 좌석 강조) 활성 상태 */
  hintActive: boolean;
  /** 힌트 토글 핸들러 */
  onToggleHint: () => void;
}

/**
 * 학습 모드 전용 'why' 카드 + 힌트 버튼.
 *
 * 현재 sub-step 종류에 따라 절차적 의미(=왜 이 좌석/더미를 클릭해야 하는지)를 설명하고,
 * 힌트 버튼으로 정답 좌석을 시각적 강조해서 학습자가 자기 추리 → 정답 확인 흐름을 반복할 수 있게 한다.
 */
export default function PracticeGuide({ step, puzzle, hintActive, onToggleHint }: PracticeGuideProps) {
  if (!step) return null;

  const { title, body } = describeStep(step, puzzle);
  const showHint = step.kind === 'shortStack' || step.kind === 'awarding' || step.kind === 'deadMoney';

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-0.5">
            📘 왜 이렇게 하나
          </p>
          <p className="text-[12px] font-semibold text-foreground leading-snug mb-0.5">{title}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>
        </div>
        {showHint && (
          <button
            type="button"
            onClick={onToggleHint}
            data-testid="btn-toggle-hint"
            className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold transition-all flex items-center gap-1 ${
              hintActive
                ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-300'
                : 'bg-card border border-border text-muted-foreground hover:border-input hover:text-foreground'
            }`}
          >
            <Lightbulb className="w-3 h-3" />
            힌트
          </button>
        )}
      </div>
    </div>
  );
}

function describeStep(step: FlowStep, puzzle: Puzzle): { title: string; body: string } {
  if (step.kind === 'shortStack') {
    const isMain = step.potIndex === 0;
    if (isMain) {
      return {
        title: '메인팟의 기준 = 가장 짧은 스택',
        body: '모든 살아남은 좌석이 동등하게 기여한 금액으로 메인팟이 만들어집니다.\n각 좌석이 낼 수 있는 최대 = 가장 적게 베팅한 사람의 invested. 그래서 그 좌석을 기준으로 모든 eligible 좌석에서 같은 액수씩 떼어옵니다.',
      };
    }
    return {
      title: `사이드팟 ${step.potIndex}의 기준 = 남은 좌석 중 가장 짧은 스택`,
      body: '이전 팟에서 칩을 다 낸 좌석은 제외됩니다. 남은 좌석들끼리 다시 동등하게 기여한 금액으로 사이드팟을 형성하므로, 현재 남은 좌석 중 가장 짧은 스택이 기준이 됩니다.',
    };
  }

  if (step.kind === 'deadMoney') {
    return {
      title: '데드머니는 메인팟에 합칩니다',
      body: '폴드된 좌석의 블라인드/앤티(또는 그 외 dead chip)는 누구의 invested에도 속하지 않지만, 메인팟의 자격은 살아남은 모든 좌석이므로 메인팟에 합쳐 분배 대상이 됩니다.',
    };
  }

  if (step.kind === 'autoReturn') {
    const receiver = puzzle.players.find(p => p.id === step.receiverId)?.name ?? step.receiverId;
    return {
      title: `잉여 칩 ${step.pot.amount.toLocaleString()}칩 → ${receiver} 반환`,
      body:
        `${receiver}가 다른 좌석들보다 더 많이 베팅했지만, ` +
        `다른 살아있는 좌석이 그 분량만큼 콜을 못 했습니다 (이미 올인 또는 폴드).\n` +
        `포커 룰상 분배 대상은 자격 좌석이 2명 이상인 팟뿐이므로, ` +
        `이 ${step.pot.amount.toLocaleString()}칩은 ${receiver}에게 그대로 돌려줍니다.`,
    };
  }

  if (step.kind === 'awarding') {
    const isMain = step.potIndex === 0;
    return {
      title: isMain ? '메인팟 승자: 자격 좌석 중 핸드 1등' : `사이드팟 ${step.potIndex} 승자: 그 팟의 자격 좌석 중 핸드 1등`,
      body: '팟마다 자격(eligible) 좌석이 다릅니다. 사이드팟은 칩을 끝까지 낸 좌석들끼리만 비교하므로, 메인팟 승자와 다를 수 있습니다.\n핸드 강도 동률이면 공동 분배.',
    };
  }

  return { title: '', body: '' };
}
