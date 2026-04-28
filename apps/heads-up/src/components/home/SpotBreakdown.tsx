import clsx from 'clsx';
import type { AggregateStats, SpotPerformance } from '../../storage/stats';

interface SpotBreakdownProps {
  stats: AggregateStats | null;
}

/**
 * Bottom slot for the home dashboard. Highlights the user's strong + weak
 * spots based on per-action GTO scoring grouped by situation.
 *
 * "약점" = lowest avgScore among spots with >= 3 hands.
 * "강점" = highest avgScore among spots with >= 3 hands.
 */
export function SpotBreakdown({ stats }: SpotBreakdownProps) {
  if (!stats) return null;
  const meaningful = stats.spotPerformance.filter((s) => s.handsCount >= 3);

  if (meaningful.length === 0) {
    if (stats.totalHands === 0) return null;
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-foreground">스팟 분석</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          더 플레이하면 패턴이 보여요. (스팟별 3회 이상 필요)
        </p>
      </section>
    );
  }

  const sortedAsc = [...meaningful].sort((a, b) => a.avgScore - b.avgScore);
  const weakest = sortedAsc.slice(0, 3);
  const strongest = [...meaningful]
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 2);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">스팟 분석</h2>

      {weakest.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-red-400">⚠ 약한 스팟</div>
          <ul className="mt-1 space-y-1.5">
            {weakest.map((s) => (
              <SpotRow key={s.spotKey} spot={s} tone="weak" />
            ))}
          </ul>
        </div>
      )}

      {strongest.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-green-400">✓ 잘 하는 스팟</div>
          <ul className="mt-1 space-y-1.5">
            {strongest.map((s) => (
              <SpotRow key={s.spotKey} spot={s} tone="strong" />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SpotRow({
  spot,
  tone,
}: {
  spot: SpotPerformance;
  tone: 'weak' | 'strong';
}) {
  const avg = Math.round(spot.avgScore);
  const ratio = spot.handsCount > 0 ? spot.perfectCount / spot.handsCount : 0;
  const ratioPct = Math.round(ratio * 100);
  return (
    <li className="rounded bg-background px-2.5 py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{spot.spotName}</span>
        <span
          className={clsx(
            'font-bold',
            tone === 'weak'
              ? 'text-red-400'
              : tone === 'strong'
                ? 'text-green-400'
                : 'text-foreground',
          )}
        >
          {avg}점
        </span>
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {spot.handsCount}회 중 {spot.perfectCount}회 GTO 근접
        {spot.handsCount > 0 && ` (${ratioPct}%)`}
      </div>
    </li>
  );
}
