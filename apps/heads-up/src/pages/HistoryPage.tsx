import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Card as CardView } from '../components/table/Card';
import { useHandHistory } from '../hooks/useHandHistory';
import { groupHandsBySession, type SessionGroup } from '../lib/group-hands';
import type { CompletedHand, GameMode } from '../types/game';

type FilterMode = 'ALL' | GameMode;

const FILTER_TABS: { key: FilterMode; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'AI', label: 'AI' },
  { key: 'REMOTE', label: '원격' },
];

export default function HistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [confirmClear, setConfirmClear] = useState(false);
  const { hands, stats, isLoading, hasMore, loadMore, clearAll } = useHandHistory({
    mode: filter === 'ALL' ? undefined : filter,
  });

  const groups = useMemo(() => groupHandsBySession(hands), [hands]);

  // Default-open: only the latest game. Tracked as a Set so each card can
  // independently toggle without recomputing the group list.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (groups.length === 0) {
      setOpenIds(new Set());
      return;
    }
    setOpenIds((prev) => (prev.size === 0 ? new Set([groups[0].sessionId]) : prev));
  }, [groups]);

  const toggleGroup = (sessionId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const winRatePct = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round(stats.winRate * 100);
  }, [stats]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
        <h1 className="text-base font-bold text-primary">히스토리</h1>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={!stats || stats.total === 0}
          className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-30"
        >
          모두 삭제
        </button>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* Stats summary */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="총 핸드" value={String(stats?.total ?? 0)} />
          <StatCard title="승률" value={`${winRatePct}%`} />
          <StatCard
            title="순이익"
            value={formatChips(stats?.netChips ?? 0)}
            valueClass={
              (stats?.netChips ?? 0) > 0
                ? 'text-green-400'
                : (stats?.netChips ?? 0) < 0
                  ? 'text-red-400'
                  : 'text-foreground'
            }
          />
          <StatCard
            title="승 / 패 / 무"
            value={`${stats?.wins ?? 0} / ${stats?.losses ?? 0} / ${stats?.splits ?? 0}`}
          />
        </section>

        {/* Filter tabs */}
        <div className="mt-5 flex gap-2">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === t.key
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Game group list */}
        <section className="mt-4 flex flex-col gap-3">
          {!isLoading && groups.length === 0 && (
            <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              아직 기록된 핸드가 없습니다.
              <br />
              AI와 한 판 플레이해보세요.
            </div>
          )}

          {groups.map((g, idx) => (
            <GameGroupCard
              key={g.sessionId}
              group={g}
              index={groups.length - idx}
              open={openIds.has(g.sessionId)}
              onToggle={() => toggleGroup(g.sessionId)}
              onHandClick={(h) => navigate(`/analysis/${h.handId}`)}
            />
          ))}

          {hasMore && !isLoading && groups.length > 0 && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="mt-1 rounded-md border border-border bg-card py-2 text-sm text-foreground hover:bg-muted"
            >
              더 보기
            </button>
          )}

          {isLoading && (
            <div className="py-3 text-center text-xs text-muted-foreground">불러오는 중…</div>
          )}
        </section>
      </div>

      <ConfirmModal
        open={confirmClear}
        title="모든 기록 삭제"
        message={
          '저장된 모든 핸드 기록이 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.'
        }
        confirmLabel="삭제"
        danger
        onConfirm={async () => {
          await clearAll();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </main>
  );
}

function StatCard({
  title,
  value,
  valueClass,
}: {
  title: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className={clsx('text-lg font-bold', valueClass)}>{value}</div>
    </div>
  );
}

function GameGroupCard({
  group,
  index,
  open,
  onToggle,
  onHandClick,
}: {
  group: SessionGroup;
  index: number;
  open: boolean;
  onToggle: () => void;
  onHandClick: (h: CompletedHand) => void;
}) {
  const netColor =
    group.netChips > 0 ? 'text-green-400' : group.netChips < 0 ? 'text-red-400' : 'text-foreground';
  const modeBadge = group.mode === 'AI' ? `AI · ${group.aiDifficulty ?? ''}` : '원격';
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span
          className={clsx(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center text-xs text-muted-foreground transition-transform',
            open ? 'rotate-90' : '',
          )}
          aria-hidden
        >
          ▶
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">게임 #{index}</span>
            <span className="rounded bg-muted px-1.5 py-0.5">{modeBadge}</span>
            <span>{group.hands.length}핸드</span>
            {group.inferred && (
              <span
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                title="이 그룹은 저장 당시 sessionId가 없어 시각/핸드번호로 추론됨"
              >
                추정
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{formatRange(group.startedAt, group.endedAt)}</span>
            <span>·</span>
            <span>
              <span className="text-green-400">W{group.wins}</span>
              <span className="mx-0.5 text-muted-foreground">·</span>
              <span className="text-red-400">L{group.losses}</span>
              {group.splits > 0 && (
                <>
                  <span className="mx-0.5 text-muted-foreground">·</span>
                  <span>T{group.splits}</span>
                </>
              )}
            </span>
          </div>
        </div>
        <div className={clsx('flex-shrink-0 text-right', netColor)}>
          <div className="text-base font-bold">{formatChips(group.netChips)}</div>
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 border-t border-border bg-background/40 px-2 py-2">
          {group.hands.map((h) => (
            <HandListItem key={h.handId} hand={h} onClick={() => onHandClick(h)} />
          ))}
        </div>
      )}
    </div>
  );
}

function HandListItem({ hand, onClick }: { hand: CompletedHand; onClick: () => void }) {
  const resultColor =
    hand.result === 'WIN' ? 'text-green-400' : hand.result === 'LOSS' ? 'text-red-400' : 'text-foreground';
  const resultLabel =
    hand.result === 'WIN' ? '승' : hand.result === 'LOSS' ? '패' : '무';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-card/70 p-2.5 text-left transition-colors hover:border-border hover:bg-muted/80 active:scale-[0.99]"
    >
      <div className={clsx('w-8 flex-shrink-0 text-center text-base font-bold', resultColor)}>
        {resultLabel}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">#{hand.handNumber}</span>
          <span>{formatTime(hand.playedAt)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex gap-0.5">
            <CardView card={hand.myCards[0]} size="sm" animate={false} />
            <CardView card={hand.myCards[1]} size="sm" animate={false} />
          </div>
          {hand.board.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">→</span>
              <div className="flex gap-0.5">
                {hand.board.map((c, i) => (
                  <CardView key={i} card={c} size="sm" animate={false} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className={clsx('flex-shrink-0 text-right', resultColor)}>
        <div className="text-sm font-bold">{formatChips(hand.myWinLoss)}</div>
        <div className="text-[10px] text-muted-foreground">
          {hand.wentToShowdown ? '쇼다운' : '폴드'}
        </div>
      </div>
    </button>
  );
}

function formatChips(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatRange(start: number, end: number): string {
  const a = new Date(start);
  const b = new Date(end);
  const now = new Date();
  const sameDay =
    a.getFullYear() === now.getFullYear() &&
    a.getMonth() === now.getMonth() &&
    a.getDate() === now.getDate();
  const datePart = sameDay
    ? '오늘'
    : `${a.getMonth() + 1}/${a.getDate()}`;
  const aStr = `${pad2(a.getHours())}:${pad2(a.getMinutes())}`;
  const bStr = `${pad2(b.getHours())}:${pad2(b.getMinutes())}`;
  if (start === end) return `${datePart} ${aStr}`;
  return `${datePart} ${aStr}–${bStr}`;
}
