import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { AiPersonaId } from '../../types/ai';
import type { CompletedHand } from '../../types/game';
import type { Card } from '../../engine/card';
import { AI_PERSONAS } from '../../bot/personas';

interface MatchEndOverlayProps {
  /** Net BB diff for the human player. Negative = lost. */
  netBB: number;
  /** Total hands in this match (e.g. 12). */
  totalHands: number;
  /** Persona of the AI opponent (REMOTE 모드는 null). */
  personaId: AiPersonaId | null;
  /** All completed hands in this match — used for hand-by-hand summary. */
  handHistory: CompletedHand[];
  /** Trigger startRematch() — same persona×level. */
  onRematch: () => void;
  /** "다른 상대 찾기" — 홈으로 돌아가서 새 persona/level 선택. */
  onFindNew: () => void;
}

/**
 * 매치 종료 오버레이.
 *
 * 마스터 스펙 v2 §21: "결과 화면의 핵심 CTA는 항상 분석보다 리매치다."
 * Layer 1: 총 결과 + 감정 카피 + Primary CTA(리매치)
 * 핸드 내역: persona copy 아래 스크롤 가능한 핸드별 요약 리스트
 */
export function MatchEndOverlay({
  netBB,
  totalHands,
  personaId,
  handHistory,
  onRematch,
  onFindNew,
}: MatchEndOverlayProps) {
  const won = netBB > 0;
  const tied = netBB === 0;
  const title = tied ? '🤝 무승부' : won ? '🏆 매치 승리' : '💀 매치 패배';
  const personaName = personaId ? AI_PERSONAS[personaId].displayName : '상대';

  const copy = personaId
    ? buildPersonaCopy(personaName, won, tied, netBB, totalHands)
    : tied
      ? '치열한 승부였습니다.'
      : won
        ? '주도권을 잡고 마무리했습니다.'
        : '이번 매치는 흐름이 따라주지 않았습니다.';

  const colorClass = tied
    ? 'text-neutral-100'
    : won
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-6"
      >
        <div className={clsx('text-2xl font-bold', colorClass)}>{title}</div>

        {/* Net BB — 가장 큰 시각 요소 */}
        <div className="flex items-baseline gap-1">
          <span className={clsx('text-5xl font-black tracking-tight', colorClass)}>
            {netBB > 0 ? '+' : ''}
            {netBB}
          </span>
          <span className="text-sm text-neutral-400">BB</span>
        </div>

        {/* Match meta */}
        <div className="text-center text-xs text-neutral-500">
          상대: <span className="font-semibold text-neutral-100">{personaName}</span>
          <span className="mx-1.5">·</span>
          <span>{totalHands}핸드 매치</span>
        </div>

        {/* 감정 카피 */}
        <p className="text-center text-sm leading-relaxed text-neutral-200">{copy}</p>

        {/* ── 핸드별 요약 리스트 ── */}
        {handHistory.length > 0 && (
          <div className="w-full">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              핸드 내역
            </div>
            <div
              className="max-h-52 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/60"
              style={{ scrollbarWidth: 'thin' }}
            >
              {handHistory.map((hand) => (
                <HandSummaryRow key={hand.handId} hand={hand} />
              ))}
            </div>
          </div>
        )}

        {/* Primary CTA — 리매치 */}
        <button
          type="button"
          onClick={onRematch}
          autoFocus
          className="mt-1 w-full rounded-lg px-4 py-3 text-base font-bold text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%)',
            boxShadow:
              '0 6px 18px rgba(252,211,77,0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          🔁 리매치
        </button>

        {/* Secondary CTA */}
        <button
          type="button"
          onClick={onFindNew}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700 active:scale-95"
        >
          다른 상대 찾기
        </button>

        {/* Tertiary */}
        <Link
          to="/history"
          className="text-xs text-neutral-400 underline-offset-2 hover:text-neutral-100 hover:underline"
        >
          전적 보기 →
        </Link>
      </motion.div>
    </motion.div>
  );
}

// ─── 핸드 요약 행 ─────────────────────────────────────────────────────────────

const RANK_CHAR: Record<number, string> = {
  2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9',
  10:'T', 11:'J', 12:'Q', 13:'K', 14:'A',
};
const SUIT_CHAR: Record<string, string> = { s:'♠', h:'♥', d:'♦', c:'♣' };
const SUIT_RED: Record<string, boolean> = { h: true, d: true };

function cardToText(c: Card): { rank: string; suit: string; red: boolean } {
  return {
    rank: RANK_CHAR[c.rank] ?? '?',
    suit: SUIT_CHAR[c.suit] ?? c.suit,
    red: SUIT_RED[c.suit] ?? false,
  };
}

function CardText({ card }: { card: Card }) {
  const { rank, suit, red } = cardToText(card);
  return (
    <span className={clsx('font-bold tabular-nums', red ? 'text-red-400' : 'text-white/90')}>
      {rank}<span className={red ? 'text-red-400' : 'text-white/60'}>{suit}</span>
    </span>
  );
}

/** 헤즈업 빅블라인드(칩). myWinLoss는 칩 단위라 bb 환산에 사용. */
const HAND_BIG_BLIND = 20;

function HandSummaryRow({ hand }: { hand: CompletedHand }) {
  // myWinLoss는 칩 단위 → 실제 BB(20칩)로 환산. (과거엔 /2로 나눠 10배로 표시되던 버그)
  const bbRaw = hand.myWinLoss / HAND_BIG_BLIND;
  const bbDelta = Number.isInteger(bbRaw) ? bbRaw : Math.round(bbRaw * 10) / 10;
  const score = hand.postHandInsight?.overallScore;

  return (
    <div className="flex items-center gap-2 border-b border-neutral-800/70 px-2.5 py-1.5 last:border-0 text-xs">
      {/* 핸드 번호 */}
      <span className="w-6 shrink-0 text-[10px] text-neutral-500">
        H{hand.handNumber}
      </span>

      {/* 내 카드 */}
      <div className="flex shrink-0 gap-0.5">
        {hand.myCards.map((c, i) => (
          <CardText key={i} card={c} />
        ))}
      </div>

      {/* vs 상대 */}
      <span className="text-white/20">vs</span>
      {hand.wentToShowdown && hand.opponentCards ? (
        <div className="flex shrink-0 gap-0.5">
          {hand.opponentCards.map((c, i) => (
            <CardText key={i} card={c} />
          ))}
        </div>
      ) : (
        <span className="text-white/30">폴드</span>
      )}

      {/* spacer */}
      <div className="flex-1" />

      {/* 인사이트 점수 */}
      <span className="w-7 text-right text-[10px] text-neutral-500">
        {score !== undefined ? score : '—'}
      </span>

      {/* BB 델타 — 부호·색으로 승패까지 표현 (별도 W/L 배지는 중복이라 제거) */}
      <span
        className={clsx(
          'w-16 text-right font-semibold tabular-nums',
          bbDelta > 0 ? 'text-green-400' : bbDelta < 0 ? 'text-rose-400' : 'text-white/40',
        )}
      >
        {bbDelta > 0 ? '+' : ''}{bbDelta}BB
      </span>
    </div>
  );
}

// ─── Persona copy ─────────────────────────────────────────────────────────────

function buildPersonaCopy(
  personaName: string,
  won: boolean,
  tied: boolean,
  netBB: number,
  totalHands: number,
): string {
  if (tied) return `${personaName}와 치열한 ${totalHands}핸드 무승부.`;
  if (won) {
    if (netBB >= 20) return `${personaName}을 압도하며 큰 승리를 거뒀습니다.`;
    if (netBB >= 8) return `${personaName} 상대로 주도권을 잘 유지했습니다.`;
    return `${personaName} 상대로 박빙의 승리.`;
  }
  if (netBB <= -20) return `${personaName}의 페이스에 끌려갔습니다.`;
  if (netBB <= -8) return `${personaName} 상대로 흐름을 만들어내지 못했습니다.`;
  return `${personaName} 상대로 아쉬운 한 끗 차.`;
}
