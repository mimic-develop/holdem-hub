import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useHandHistory } from '../hooks/useHandHistory';
import { groupHandsBySession, type SessionGroup } from '../lib/group-hands';
import type { Card } from '../engine/card';
import type { CompletedHand, GameMode, Street } from '../types/game';

type FilterMode = 'ALL' | GameMode;

const FILTER_TABS: { key: FilterMode; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'AI', label: 'AI' },
  { key: 'REMOTE', label: '원격' },
];

/** Big blind in chips — used to convert chip amounts to bb for display. */
const BB = 20;

export default function HistoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [confirmClear, setConfirmClear] = useState(false);
  const { hands, stats, isLoading, hasMore, loadMore, clearAll } = useHandHistory({
    mode: filter === 'ALL' ? undefined : filter,
  });

  const groups = useMemo(() => groupHandsBySession(hands), [hands]);

  // All groups collapsed by default; each card toggles open independently.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

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
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← 홈
        </Link>
        <h1 className="text-base font-bold text-white">히스토리</h1>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={!stats || stats.total === 0}
          className="rounded border border-red-900 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-30"
        >
          모두 삭제
        </button>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        {/* Stats summary */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="총 핸드" value={String(stats?.total ?? 0)} />
          <StatCard title="승률" value={`${winRatePct}%`} />
          <StatCard
            title="순이익"
            value={`${formatChips(stats?.netChips ?? 0)} (${fmtBB(stats?.netChips ?? 0)}bb)`}
            valueClass={
              (stats?.netChips ?? 0) > 0
                ? 'text-emerald-400'
                : (stats?.netChips ?? 0) < 0
                  ? 'text-red-400'
                  : 'text-neutral-100'
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
                  ? 'border-red-500/60 bg-red-500/10 text-red-300'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Action-code legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500">
          <span className="font-mono">F 폴드 · R 레이즈 · C 콜 · X 체크 · B 벳</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 내 액션
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> 상대
          </span>
        </div>

        {/* Game group list */}
        <section className="mt-4 flex flex-col gap-3">
          {!isLoading && groups.length === 0 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-500">
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
              className="mt-1 rounded-md border border-neutral-800 bg-neutral-900 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
            >
              더 보기
            </button>
          )}

          {isLoading && (
            <div className="py-3 text-center text-xs text-neutral-500">불러오는 중…</div>
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className={clsx('text-base font-bold text-neutral-100', valueClass)}>{value}</div>
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
    group.netChips > 0
      ? 'text-emerald-400'
      : group.netChips < 0
        ? 'text-red-400'
        : 'text-neutral-100';
  const modeBadge = group.mode === 'AI' ? `AI · ${group.aiDifficulty ?? ''}` : '원격';
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-neutral-800/60"
      >
        <span
          className={clsx(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center text-xs text-neutral-500 transition-transform',
            open ? 'rotate-90' : '',
          )}
          aria-hidden
        >
          ▶
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span className="font-semibold text-neutral-100">게임 #{index}</span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5">{modeBadge}</span>
            <span>{group.hands.length}핸드</span>
            {group.inferred && (
              <span
                className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500"
                title="이 그룹은 저장 당시 sessionId가 없어 시각/핸드번호로 추론됨"
              >
                추정
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
            <span>{formatRange(group.startedAt, group.endedAt)}</span>
            <span>·</span>
            <span>
              <span className="text-emerald-400">W{group.wins}</span>
              <span className="mx-0.5 text-neutral-600">·</span>
              <span className="text-red-400">L{group.losses}</span>
              {group.splits > 0 && (
                <>
                  <span className="mx-0.5 text-neutral-600">·</span>
                  <span>T{group.splits}</span>
                </>
              )}
            </span>
          </div>
        </div>
        <div className={clsx('flex-shrink-0 text-right', netColor)}>
          <div className="text-base font-bold">{fmtBB(group.netChips)}bb</div>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-neutral-800">
          <table className="w-full min-w-[660px] border-collapse text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-neutral-500">
                <Th className="pl-3">Pos</Th>
                <Th>Hand</Th>
                <Th>Board</Th>
                <Th>Pot Type</Th>
                <Th>Preflop</Th>
                <Th>Flop</Th>
                <Th>Turn</Th>
                <Th>River</Th>
                <Th className="text-right">Pot</Th>
                <Th className="pr-3 text-right">W/L</Th>
              </tr>
            </thead>
            <tbody>
              {group.hands.map((h) => (
                <HandRow key={h.handId} hand={h} onClick={() => onHandClick(h)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={clsx('px-2 py-2 font-medium', className)}>{children}</th>;
}

function HandRow({ hand, onClick }: { hand: CompletedHand; onClick: () => void }) {
  const wlColor =
    hand.myWinLoss > 0
      ? 'text-emerald-400'
      : hand.myWinLoss < 0
        ? 'text-red-400'
        : 'text-neutral-300';
  const finalPot = hand.actionLog.reduce((m, a) => Math.max(m, a.potAfter), 0);
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-t border-neutral-800/70 align-middle transition-colors hover:bg-neutral-800/50"
    >
      <td className="px-2 py-2 pl-3 font-semibold text-neutral-200">{hand.myPosition}</td>
      <td className="px-2">
        <div className="flex gap-0.5">
          {hand.myCards.map((c, i) => (
            <CardChip key={i} card={c} />
          ))}
        </div>
      </td>
      <td className="px-2">
        {hand.board.length > 0 ? (
          <div className="flex gap-0.5">
            {hand.board.map((c, i) => (
              <CardChip key={i} card={c} />
            ))}
          </div>
        ) : (
          <span className="text-neutral-700">–</span>
        )}
      </td>
      <td className="px-2 text-neutral-300">{potType(hand)}</td>
      <td className="px-2">
        <StreetActions hand={hand} street="preflop" />
      </td>
      <td className="px-2">
        <StreetActions hand={hand} street="flop" />
      </td>
      <td className="px-2">
        <StreetActions hand={hand} street="turn" />
      </td>
      <td className="px-2">
        <StreetActions hand={hand} street="river" />
      </td>
      <td className="px-2 text-right tabular-nums text-neutral-300">{fmtBB(finalPot)}</td>
      <td className={clsx('px-2 pr-3 text-right font-semibold tabular-nums', wlColor)}>
        {hand.myWinLoss > 0 ? '+' : ''}
        {fmtBB(hand.myWinLoss)}
      </td>
    </tr>
  );
}

/* ── card chip (4-color deck) ──────────────────────────────────────── */

const SUIT_BG: Record<string, string> = {
  s: 'bg-slate-500', // spades
  h: 'bg-red-600', // hearts
  d: 'bg-blue-600', // diamonds
  c: 'bg-green-600', // clubs
};

const RANK_CH: Record<number, string> = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' };

function rankCh(rank: number): string {
  return RANK_CH[rank] ?? String(rank);
}

function CardChip({ card }: { card: Card }) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 min-w-[16px] items-center justify-center rounded px-0.5 text-[11px] font-bold text-white',
        SUIT_BG[card.suit] ?? 'bg-neutral-600',
      )}
    >
      {rankCh(card.rank)}
    </span>
  );
}

/* ── per-street action encoding ────────────────────────────────────── */

const ACTION_CH: Record<string, string> = {
  fold: 'F',
  check: 'X',
  call: 'C',
  bet: 'B',
  raise: 'R',
};

function StreetActions({ hand, street }: { hand: CompletedHand; street: Street }) {
  const items = hand.actionLog.filter((a) => a.street === street);
  if (items.length === 0) return <span className="text-neutral-700">–</span>;
  return (
    <span className="font-mono text-xs tracking-wide">
      {items.map((a, i) => (
        <span
          key={i}
          className={a.playerLabel === '나' ? 'font-bold text-amber-400' : 'text-sky-400'}
        >
          {ACTION_CH[a.action] ?? '?'}
        </span>
      ))}
    </span>
  );
}

/* ── pot type derivation (heads-up) ────────────────────────────────── */

function potType(hand: CompletedHand): string {
  // No flop seen → resolved preflop (fold to a raise, or walk).
  if (hand.board.length === 0) return 'Preflop';
  const raises = hand.actionLog.filter(
    (a) => a.street === 'preflop' && a.action === 'raise',
  ).length;
  if (raises === 0) return 'Limp';
  if (raises === 1) return 'SRP';
  if (raises === 2) return '3Bet';
  return '4Bet';
}

/* ── helpers ───────────────────────────────────────────────────────── */

/** Chips → bb string, trimming trailing zeros (e.g. 50 → "2.5", 500 → "25"). */
function fmtBB(chips: number): string {
  const v = chips / BB;
  return String(Math.round(v * 100) / 100);
}

function formatChips(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatRange(start: number, end: number): string {
  const a = new Date(start);
  const b = new Date(end);
  const now = new Date();
  const sameDay =
    a.getFullYear() === now.getFullYear() &&
    a.getMonth() === now.getMonth() &&
    a.getDate() === now.getDate();
  const datePart = sameDay ? '오늘' : `${a.getMonth() + 1}/${a.getDate()}`;
  const aStr = `${pad2(a.getHours())}:${pad2(a.getMinutes())}`;
  const bStr = `${pad2(b.getHours())}:${pad2(b.getMinutes())}`;
  if (start === end) return `${datePart} ${aStr}`;
  return `${datePart} ${aStr}–${bStr}`;
}
