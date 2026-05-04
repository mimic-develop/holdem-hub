import { useMemo } from 'react';
import clsx from 'clsx';
import type {
  AggregateStats,
  ScorePoint,
  StatsRange,
} from '../../storage/stats';

interface GrowthStatsProps {
  stats: AggregateStats | null;
  range: StatsRange;
  onRangeChange: (r: StatsRange) => void;
  isLoading: boolean;
}

const RANGES: { key: StatsRange; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '주간' },
  { key: 'month', label: '월간' },
  { key: 'all', label: '전체' },
];

/** Top-of-home dashboard summarizing user growth. */
export function GrowthStats({
  stats,
  range,
  onRangeChange,
  isLoading,
}: GrowthStatsProps) {
  const isEmpty = !isLoading && (!stats || stats.totalHands === 0);

  const winRatePct = stats ? Math.round(stats.winRate * 100) : 0;
  const avgScore = stats ? Math.round(stats.avgGtoScore) : 0;
  const delta = stats?.avgScoreDelta ?? null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">내 성장 지표</h2>
        <RangePicker range={range} onChange={onRangeChange} />
      </div>

      {isEmpty ? (
        <EmptyState range={range} />
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="핸드" value={String(stats?.totalHands ?? 0)} />
            <Stat label="승률" value={`${winRatePct}%`} />
            <Stat
              label="평균 점수"
              value={
                stats?.evaluatedHands && stats.evaluatedHands > 0
                  ? String(avgScore)
                  : '—'
              }
              suffix={
                delta !== null && Math.abs(delta) >= 0.5 ? (
                  <span
                    className={clsx(
                      'ml-1 text-xs font-semibold',
                      delta > 0 ? 'text-green-400' : 'text-rose-400',
                    )}
                  >
                    {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                  </span>
                ) : null
              }
              valueClass={scoreColor(avgScore)}
            />
          </div>

          {/* Win streak hot strip */}
          {stats && stats.winStreak >= 2 && (
            <div className="mt-2 rounded-md bg-orange-950/50 px-3 py-1.5 text-center text-xs font-semibold text-orange-300">
              🔥 {stats.winStreak}연승 중
            </div>
          )}

          {/* Trend line chart */}
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted-foreground">점수 추이</div>
            {stats && stats.scoreTrend.length >= 2 ? (
              <TrendChart points={stats.scoreTrend} />
            ) : (
              <div className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                {stats && stats.scoreTrend.length === 1
                  ? '2일 이상의 평가된 핸드가 필요해요'
                  : '평가된 핸드 부족'}
              </div>
            )}
          </div>

          {/* Top mistakes — horizontal bar */}
          {stats && stats.topMistakes.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-muted-foreground">자주 하는 실수</div>
              <ul className="space-y-1.5">
                {stats.topMistakes.slice(0, 3).map((m) => (
                  <MistakeBar
                    key={m.type}
                    label={m.label}
                    count={m.count}
                    maxCount={stats.topMistakes[0].count}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Per-street averages */}
          {stats && Object.keys(stats.streetAvgScores).length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-1 text-center">
              {(['preflop', 'flop', 'turn', 'river'] as const).map((st) => {
                const v = stats.streetAvgScores[st];
                if (v === undefined) {
                  return (
                    <div key={st} className="rounded bg-background px-1 py-1">
                      <div className="text-[10px] text-muted-foreground">
                        {streetLabel(st)}
                      </div>
                      <div className="text-xs text-foreground">—</div>
                    </div>
                  );
                }
                return (
                  <div key={st} className="rounded bg-background px-1 py-1">
                    <div className="text-[10px] text-muted-foreground">
                      {streetLabel(st)}
                    </div>
                    <div
                      className={clsx(
                        'text-xs font-bold',
                        scoreColor(Math.round(v)),
                      )}
                    >
                      {Math.round(v)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RangePicker({
  range,
  onChange,
}: {
  range: StatsRange;
  onChange: (r: StatsRange) => void;
}) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={clsx(
            'rounded px-2 py-0.5 text-[11px] font-medium',
            range === r.key
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
  suffix,
}: {
  label: string;
  value: string;
  valueClass?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="rounded bg-background px-2 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={clsx('text-lg font-bold text-white', valueClass)}>
        {value}
        {suffix}
      </div>
    </div>
  );
}

function EmptyState({ range }: { range: StatsRange }) {
  const msg =
    range === 'today'
      ? '오늘 플레이한 핸드가 없습니다.'
      : range === 'week'
        ? '최근 7일간 데이터가 없습니다.'
        : range === 'month'
          ? '최근 30일간 데이터가 없습니다.'
          : '아직 플레이한 핸드가 없습니다.';
  return (
    <div className="rounded-md border border-dashed border-border bg-background px-4 py-8 text-center">
      <div className="text-sm text-foreground">{msg}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        첫 게임을 시작해보세요.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny SVG line chart                                               */
/* ------------------------------------------------------------------ */

function TrendChart({ points }: { points: ScorePoint[] }) {
  // Layout
  const W = 280;
  const H = 60;
  const padX = 4;
  const padY = 6;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const { path, dots } = useMemo(() => {
    const xs = points.map((_, i) => padX + (i / (points.length - 1)) * innerW);
    // Y: invert (higher score = higher on screen)
    const ys = points.map(
      (p) => padY + (1 - p.avgScore / 100) * innerH,
    );
    const cmds: string[] = [];
    cmds.push(`M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`);
    for (let i = 1; i < points.length; i++) {
      cmds.push(`L ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`);
    }
    return {
      path: cmds.join(' '),
      dots: points.map((p, i) => ({
        x: xs[i],
        y: ys[i],
        score: Math.round(p.avgScore),
      })),
    };
  }, [points, innerW, innerH]);

  const lastScore = Math.round(points[points.length - 1].avgScore);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block w-full h-16 rounded bg-background"
        role="img"
        aria-label={`최근 ${points.length}일 점수 추이, 최신 ${lastScore}점`}
      >
        {/* baseline 50pt */}
        <line
          x1={padX}
          y1={padY + (1 - 50 / 100) * innerH}
          x2={W - padX}
          y2={padY + (1 - 50 / 100) * innerH}
          stroke="rgb(64 64 64)"
          strokeDasharray="2 3"
          strokeWidth={0.5}
        />
        <path
          d={path}
          fill="none"
          stroke="rgb(217 169 71)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={1.6} fill="rgb(217 169 71)" />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mistake bar                                                       */
/* ------------------------------------------------------------------ */

function MistakeBar({
  label,
  count,
  maxCount,
}: {
  label: string;
  count: number;
  maxCount: number;
}) {
  const pct = Math.round((count / maxCount) * 100);
  return (
    <li>
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{count}회</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-rose-400/70"
          style={{ width: `${Math.max(8, pct)}%` }}
        />
      </div>
    </li>
  );
}

function streetLabel(s: 'preflop' | 'flop' | 'turn' | 'river'): string {
  return s === 'preflop' ? '프리' : s === 'flop' ? '플랍' : s === 'turn' ? '턴' : '리버';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  if (score > 0) return 'text-rose-400';
  return 'text-foreground';
}
