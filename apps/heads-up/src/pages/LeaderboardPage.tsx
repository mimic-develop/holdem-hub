import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  getLeaderboard,
  type LeaderboardEntry,
  type LeaderboardResult,
} from '../storage/leaderboard';

/** 판단 점수(0–100) → 색상. GrowthStats/히스토리와 동일 기준(80/50). */
function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void getLeaderboard().then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const entries = data?.entries ?? [];
  const window = data?.window ?? 200;
  const minQualify = data?.minQualifyHands ?? 50;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← 홈
        </Link>
        <h1 className="text-base font-bold text-white">리더보드</h1>
        <Link to="/history" className="text-xs text-neutral-400 hover:text-neutral-100">
          히스토리 →
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <p className="mb-3 text-xs leading-relaxed text-neutral-500">
          순위는 <span className="text-neutral-300">평균 판단 점수</span>(AI 매치 · 최근 {window}핸드)
          기준입니다. 결과(운)가 아니라 의사결정의 질로 겨룹니다. 등록 자격: 평가 {minQualify}핸드 이상.
        </p>

        {/* 내 순위 / 진행 상황 */}
        {data?.me ? (
          <MyRankCard entry={data.me} />
        ) : data?.myProgress ? (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
            아직 리더보드 자격이 없습니다. 평가 <b>{data.myProgress.handsCounted}</b>핸드 / 필요{' '}
            {minQualify}핸드
            {data.myProgress.needed > 0 && (
              <>
                {' '}
                — <b>{data.myProgress.needed}핸드</b> 더 플레이하면 등록!
              </>
            )}
          </div>
        ) : null}

        {/* 보드 */}
        {loading ? (
          <div className="py-8 text-center text-sm text-neutral-500">불러오는 중…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
            아직 순위에 오른 플레이어가 없습니다.
            <br />
            AI 매치를 {minQualify}핸드 이상 플레이하면 등록됩니다.
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            <li className="flex items-center gap-3 px-3 text-[10px] uppercase tracking-wider text-neutral-600">
              <span className="w-8 text-center">순위</span>
              <span className="flex-1">플레이어</span>
              <span className="w-12 text-right">점수</span>
              <span className="w-16 text-right">bb/h</span>
              <span className="w-12 text-right">승률</span>
            </li>
            {entries.map((e) => (
              <Row key={`${e.rank}-${e.nickname}`} e={e} />
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

function Row({ e }: { e: LeaderboardEntry }) {
  return (
    <li
      className={clsx(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
        e.isMe
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-neutral-800 bg-neutral-900',
      )}
    >
      <span className="w-8 text-center text-base font-bold tabular-nums">
        {rankBadge(e.rank)}
      </span>
      <span className="flex-1 truncate font-semibold">
        {e.nickname}
        {e.isMe && <span className="ml-1.5 text-[10px] text-amber-300">나</span>}
      </span>
      <span className={clsx('w-12 text-right text-base font-black tabular-nums', scoreColor(e.avgScore))}>
        {e.avgScore}
      </span>
      <span
        className={clsx(
          'w-16 text-right tabular-nums',
          e.bbPerHand > 0
            ? 'text-emerald-400'
            : e.bbPerHand < 0
              ? 'text-rose-400'
              : 'text-neutral-400',
        )}
      >
        {e.bbPerHand > 0 ? '+' : ''}
        {e.bbPerHand}
      </span>
      <span className="w-12 text-right tabular-nums text-neutral-400">
        {Math.round(e.winRate * 100)}%
      </span>
    </li>
  );
}

function MyRankCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-amber-300/80">내 순위</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums text-amber-200">#{entry.rank}</span>
        <span className="truncate text-sm text-neutral-300">{entry.nickname}</span>
        <span className="ml-auto whitespace-nowrap text-right">
          <span className={clsx('text-xl font-black', scoreColor(entry.avgScore))}>
            {entry.avgScore}
          </span>
          <span className="ml-1 text-xs text-neutral-500">점 · {entry.handsCounted}핸드</span>
        </span>
      </div>
    </div>
  );
}
