import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { HandResolution } from '../../engine/game-engine';
import { HandRank } from '../../engine/hand-evaluator';
import type { CompletedHand, Street } from '../../types/game';
import { Link } from 'react-router-dom';

interface HandResultOverlayProps {
  resolution: HandResolution;
  myPlayerId: string;
  onNext: () => void;
  nextLabel?: string;
  /** Latest CompletedHand for this resolution (carries gtoAnalysis when ready). */
  completedHand?: CompletedHand;
}

const HAND_RANK_KO: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: '하이카드',
  [HandRank.PAIR]: '원 페어',
  [HandRank.TWO_PAIR]: '투 페어',
  [HandRank.THREE_OF_A_KIND]: '트리플',
  [HandRank.STRAIGHT]: '스트레이트',
  [HandRank.FLUSH]: '플러시',
  [HandRank.FULL_HOUSE]: '풀하우스',
  [HandRank.FOUR_OF_A_KIND]: '포카드',
  [HandRank.STRAIGHT_FLUSH]: '스트레이트 플러시',
  [HandRank.ROYAL_FLUSH]: '로열 플러시',
};

const STREET_KO: Record<Street, string> = {
  preflop: '프리플랍',
  flop: '플랍',
  turn: '턴',
  river: '리버',
};

export function HandResultOverlay({
  resolution,
  myPlayerId,
  onNext,
  nextLabel = '다음 핸드 →',
  completedHand,
}: HandResultOverlayProps) {
  const iWon = resolution.winners.includes(myPlayerId);
  const isSplit = resolution.winners.length > 1;
  const title = isSplit ? '🤝 무승부' : iWon ? '🎉 승리!' : '😔 패배';
  const myWinLoss = completedHand?.myWinLoss ?? 0;
  const subtitle =
    resolution.endedBy === 'fold'
      ? '상대가 폴드했습니다'
      : resolution.evaluations
        ? formatShowdown(resolution, myPlayerId)
        : '쇼다운';

  const analysis = completedHand?.gtoAnalysis;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border border-primary/30 bg-card px-6 py-5"
      >
        <div
          className={`text-2xl font-bold ${iWon ? 'text-primary' : isSplit ? 'text-foreground' : 'text-red-400'}`}
        >
          {title}
        </div>
        {completedHand && (
          <div
            className={clsx(
              'text-lg font-bold',
              myWinLoss > 0
                ? 'text-green-400'
                : myWinLoss < 0
                  ? 'text-red-400'
                  : 'text-foreground',
            )}
          >
            {formatChips(myWinLoss)} 칩
          </div>
        )}
        <div className="text-xs text-muted-foreground text-center whitespace-pre-line">
          {subtitle}
        </div>
        <div className="text-sm font-semibold text-white">
          팟 <span className="text-primary">{resolution.potAwarded}</span>
        </div>

        {/* GTO breakdown */}
        <ScorePanel analysis={analysis} />

        <div className="mt-2 flex w-full gap-2">
          {completedHand && (
            <Link
              to={`/analysis/${completedHand.handId}`}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-secondary active:scale-95"
            >
              자세히
            </Link>
          )}
          <button
            type="button"
            onClick={onNext}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-95"
          >
            {nextLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface ScorePanelProps {
  analysis: CompletedHand['gtoAnalysis'];
}

/** 5-star rendering of a 0-100 score. */
function Stars({ score }: { score: number }) {
  const filled = Math.round((score / 100) * 5);
  return (
    <span className="text-[11px] tracking-tight">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < filled ? 'text-primary' : 'text-foreground'}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function ScorePanel({ analysis }: ScorePanelProps) {
  if (!analysis) {
    return (
      <div className="mt-2 w-full rounded-md border border-border bg-background/60 px-3 py-3 text-center text-xs text-muted-foreground">
        <span className="inline-block animate-pulse">분석 중…</span>
      </div>
    );
  }

  const { overallScore, streetScores } = analysis;
  const overallColor = scoreColorClass(overallScore);

  const streetOrder: Street[] = ['preflop', 'flop', 'turn', 'river'];
  const presentStreets = streetOrder.filter((st) => streetScores[st] !== undefined);

  return (
    <div className="mt-2 w-full rounded-md border border-border bg-background/60 p-3 text-xs">
      <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        이 핸드 플레이 평가
      </div>
      <div className="mt-1 flex items-baseline justify-center gap-1">
        <span className={clsx('text-3xl font-bold', overallColor)}>
          {overallScore}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <div className="mx-auto mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={clsx('h-full transition-all', scoreBarClass(overallScore))}
          style={{ width: `${overallScore}%` }}
        />
      </div>
      {presentStreets.length > 0 && (
        <ul className="mt-3 space-y-1">
          {presentStreets.map((st) => {
            const score = streetScores[st]!;
            return (
              <li key={st} className="flex items-center justify-between gap-2">
                <span className="w-12 text-muted-foreground">{STREET_KO[st]}</span>
                <Stars score={score} />
                <span
                  className={clsx(
                    'w-10 text-right font-semibold',
                    scoreColorClass(score),
                  )}
                >
                  {score}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {analysis.summary && (
        <div className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-foreground">
          {analysis.summary}
        </div>
      )}
    </div>
  );
}

function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBarClass(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatChips(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function formatShowdown(resolution: HandResolution, myPlayerId: string): string {
  if (!resolution.evaluations) return '쇼다운';
  const mine = resolution.evaluations[myPlayerId];
  const oppId = Object.keys(resolution.evaluations).find((k) => k !== myPlayerId);
  const opp = oppId ? resolution.evaluations[oppId] : undefined;
  const lines: string[] = [];
  if (mine) lines.push(`내 핸드: ${HAND_RANK_KO[mine.rank] ?? mine.rank}`);
  if (opp) lines.push(`상대 핸드: ${HAND_RANK_KO[opp.rank] ?? opp.rank}`);
  return lines.join('\n');
}
