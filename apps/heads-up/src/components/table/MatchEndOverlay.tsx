import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { AiPersonaId } from '../../types/ai';
import type { CompletedHand } from '../../types/game';
import { AI_PERSONAS } from '../../bot/personas';

interface MatchEndOverlayProps {
  /** Net BB diff for the human player. Negative = lost. 승패 판정에만 사용(표시 X). */
  netBB: number;
  /** Configured match length (e.g. 12). 실제 표시는 handHistory.length 기준. */
  totalHands: number;
  /** Persona of the AI opponent (REMOTE 모드는 null). */
  personaId: AiPersonaId | null;
  /** All completed hands in this match — 평균 판단 점수 산출 + 핸드 수 표시. */
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
 *
 * 설계 의도: 25BB 고정 스택 매치는 보통 버스트로 끝나 netBB가 ±25로 고정된다.
 * 따라서 결과(승/패)와 과정(의사결정 품질)을 분리해, 운으로 고정된 BB 대신
 * 매번 달라지는 "판단 점수"(매치 평균 overallScore)를 히어로로 보여주고
 * 핸드 리뷰로 유도한다. 핸드별 내역은 결과창에서 빼고 /history에서 본다.
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

  // 실제로 플레이한 핸드 수 (버스트로 조기 종료 시 totalHands보다 적음).
  const handsPlayed = handHistory.length || totalHands;

  // 매치 평균 판단 점수 — 결과와 무관하게 매번 달라지는 실력 지표.
  const scores = handHistory
    .map((h) => h.postHandInsight?.overallScore)
    .filter((s): s is number => typeof s === 'number');
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  const band = avgScore !== null ? scoreBand(avgScore) : null;

  const titleColor = tied
    ? 'text-neutral-100'
    : won
      ? 'text-amber-400'
      : 'text-rose-400';

  const copy = buildResultCopy({ personaName, won, tied, handsPlayed, score: avgScore });

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
        <div className={clsx('text-2xl font-bold', titleColor)}>{title}</div>

        {/* 판단 점수 — 가장 큰 시각 요소 (netBB 대체) */}
        {avgScore !== null && band ? (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-baseline gap-1">
              <span className={clsx('text-6xl font-black tracking-tight tabular-nums', band.color)}>
                {avgScore}
              </span>
              <span className="text-base text-neutral-500">점</span>
            </div>
            <div className={clsx('text-xs font-semibold tracking-wide', band.color)}>
              {band.label} · 판단 점수
            </div>
          </div>
        ) : (
          /* 점수 데이터가 없을 때(예: 즉시 종료) — 점수 영역 생략 */
          <div className="h-1" />
        )}

        {/* Match meta */}
        <div className="text-center text-xs text-neutral-500">
          상대: <span className="font-semibold text-neutral-100">{personaName}</span>
          <span className="mx-1.5">·</span>
          <span>{handsPlayed}핸드</span>
        </div>

        {/* 결과 카피 — 승패 × 점수 조합으로 매번 달라짐 */}
        <p className="text-center text-sm leading-relaxed text-neutral-200">{copy}</p>

        {/* Primary CTA — 리매치 (스펙 §21: 분석보다 리매치 우선) */}
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

        {/* Secondary CTA — 핸드 리뷰로 유도 (핸드별 상세는 /history에서) */}
        <Link
          to="/history"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-center text-sm font-semibold text-neutral-100 transition-colors hover:bg-neutral-700 active:scale-95"
        >
          📋 핸드 리뷰 보기
        </Link>

        {/* Secondary CTA — 다른 상대 */}
        <button
          type="button"
          onClick={onFindNew}
          className="w-full rounded-lg px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-100 active:scale-95"
        >
          다른 상대 찾기
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── 판단 점수 밴드 ───────────────────────────────────────────────────────────

/** overallScore(0–100) → 밴드 라벨 + 색. 90+=탁월, 75+ 양호 기준(insight 채점기 참조). */
function scoreBand(score: number): { label: string; color: string } {
  if (score >= 85) return { label: '탁월', color: 'text-emerald-400' };
  if (score >= 70) return { label: '안정적', color: 'text-amber-400' };
  if (score >= 50) return { label: '보통', color: 'text-orange-400' };
  return { label: '개선 필요', color: 'text-rose-400' };
}

// ─── 결과 카피 ────────────────────────────────────────────────────────────────

/**
 * 승패 × 판단 점수 조합 카피.
 * 결과(운)와 과정(실력)을 분리해, 같은 승/패라도 점수에 따라 다른 피드백을 준다.
 * - 이겼지만 점수 낮음 → 운 경고 + 리뷰 유도
 * - 졌지만 점수 높음 → 판단은 좋았다 위로
 */
function buildResultCopy(opts: {
  personaName: string;
  won: boolean;
  tied: boolean;
  handsPlayed: number;
  score: number | null;
}): string {
  const { personaName, won, tied, handsPlayed, score } = opts;

  if (tied) return `${personaName}와 막상막하의 ${handsPlayed}핸드 승부였습니다.`;

  // 점수 데이터가 없으면 결과만 언급.
  if (score === null) {
    return won
      ? `${personaName}을 꺾고 매치를 가져왔습니다.`
      : `${personaName}에게 이번 매치를 내줬습니다.`;
  }

  const high = score >= 70;
  const mid = score >= 50;

  if (won) {
    if (high) return `주도권을 쥐고 ${personaName}을 깔끔하게 눌렀습니다. 좋은 판단이 결과로 이어졌어요.`;
    if (mid) return `${personaName} 상대로 승리. 흔들린 장면도 있었으니 리뷰로 다져보세요.`;
    return `운이 따른 승리였습니다. 위험했던 판단을 리뷰에서 꼭 확인해보세요.`;
  }

  // lost
  if (high) return `결과는 아쉽지만 판단의 질은 좋았습니다. ${personaName}에게 흐름이 갔을 뿐이에요.`;
  if (mid) return `${personaName}에게 패배. 몇 번의 선택이 갈림길이었습니다. 리뷰에서 찾아보세요.`;
  return `이번엔 실수가 패배로 이어졌습니다. 리뷰에서 분기점을 점검해보세요.`;
}
