import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { HandResolution } from '../../engine/game-engine';
import { HandRank } from '../../engine/hand-evaluator';
import type { CompletedHand } from '../../types/game';
import { Card } from './Card';

interface HandResultOverlayProps {
  resolution: HandResolution;
  myPlayerId: string;
  onNext: () => void;
  nextLabel?: string;
  /** Latest CompletedHand for this resolution. */
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

export function HandResultOverlay({
  resolution,
  myPlayerId,
  onNext,
  nextLabel = '다음 핸드 →',
  completedHand,
}: HandResultOverlayProps) {
  const iWon = resolution.winners.includes(myPlayerId);
  const isSplit = resolution.winners.length > 1;
  const isShowdown = resolution.endedBy === 'showdown';

  const title = isSplit ? '🤝 무승부' : iWon ? '🎉 승리!' : '😔 패배';
  const myWinLoss = completedHand?.myWinLoss ?? 0;

  // Hand rank subtitle (showdown only)
  const handRankSubtitle =
    isShowdown && resolution.evaluations
      ? buildHandRankText(resolution, myPlayerId)
      : null;

  const titleColor = isSplit
    ? 'text-foreground'
    : iWon
      ? 'text-amber-400'
      : 'text-rose-400';

  const chipColor = clsx(
    'text-2xl font-black tabular-nums',
    myWinLoss > 0 ? 'text-green-400' : myWinLoss < 0 ? 'text-rose-400' : 'text-foreground',
  );

  const myCards = completedHand?.myCards;
  const oppCards = isShowdown ? completedHand?.opponentCards : undefined;
  const board = completedHand?.board ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.88, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/10 bg-card px-5 py-5 shadow-2xl"
      >
        {/* 제목 + 칩 델타 */}
        <div className={clsx('text-xl font-bold', titleColor)}>{title}</div>
        <div className={chipColor}>
          {myWinLoss > 0 ? '+' : ''}{myWinLoss} 칩
        </div>

        {/* ── 카드 시각화 ── */}
        {isShowdown && myCards && (
          <div className="w-full space-y-2">
            {/* 양쪽 홀카드 — me vs opp */}
            <div className="flex items-center justify-center gap-3">
              {/* 내 카드 */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">나</span>
                <div className="flex gap-1">
                  {myCards.map((c, i) => (
                    <Card key={`my-${i}`} card={c} size="sm" animate delay={i * 60} />
                  ))}
                </div>
              </div>

              <span className="text-xs font-bold text-white/30">vs</span>

              {/* 상대 카드 */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">상대</span>
                <div className="flex gap-1">
                  {oppCards
                    ? oppCards.map((c, i) => (
                        <Card key={`opp-${i}`} card={c} size="sm" animate delay={80 + i * 60} />
                      ))
                    : /* 폴더 카드는 숨겨진 채로 (뒷면 2장) */
                      [0, 1].map((i) => (
                        <Card key={`opp-back-${i}`} card={null} faceDown size="sm" animate={false} />
                      ))}
                </div>
              </div>
            </div>

            {/* 보드 카드 */}
            {board.length > 0 && (
              <div className="flex justify-center gap-1 pt-1">
                {board.map((c, i) => (
                  <Card key={`board-${i}`} card={c} size="sm" animate delay={160 + i * 40} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 폴드: 내 카드만 + 안내 텍스트 */}
        {!isShowdown && myCards && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {myCards.map((c, i) => (
                <Card key={`my-${i}`} card={c} size="sm" animate delay={i * 60} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">상대가 폴드했습니다</span>
          </div>
        )}

        {/* 쇼다운 손패 이름 */}
        {handRankSubtitle && (
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {handRankSubtitle}
          </p>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onNext}
          autoFocus
          className="mt-2 w-full rounded-lg px-4 py-3 text-base font-bold text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%)',
            boxShadow:
              '0 6px 18px rgba(252,211,77,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          {nextLabel}
        </button>
      </motion.div>
    </motion.div>
  );
}

function buildHandRankText(resolution: HandResolution, myPlayerId: string): string {
  if (!resolution.evaluations) return '';
  const mine = resolution.evaluations[myPlayerId];
  const oppId = Object.keys(resolution.evaluations).find((k) => k !== myPlayerId);
  const opp = oppId ? resolution.evaluations[oppId] : undefined;
  const lines: string[] = [];
  if (mine) lines.push(`내 핸드: ${HAND_RANK_KO[mine.rank] ?? mine.rank}`);
  if (opp) lines.push(`상대 핸드: ${HAND_RANK_KO[opp.rank] ?? opp.rank}`);
  return lines.join('  /  ');
}
