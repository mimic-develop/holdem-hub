import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Card as CardView } from '../components/table/Card';
import { HandRank } from '../engine/hand-evaluator';
import { evaluateHand } from '../insight/hand-evaluator-main';
import { getHand, saveHand } from '../storage/history';
import type {
  ActionEvaluation,
  ActionLogEntry,
  CompletedHand,
  Mistake,
  MistakeType,
  Street,
} from '../types/game';

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

const ACTION_KO: Record<string, string> = {
  fold: '폴드',
  check: '체크',
  call: '콜',
  bet: '벳',
  raise: '레이즈',
};

const MISTAKE_LABEL: Record<MistakeType, { tag: string; tip: string }> = {
  VALUE_MISS: {
    tag: '밸류 미스',
    tip: '강한 핸드를 가지고 있을 때 베팅으로 가치를 받아내는 것을 잊지 마세요.',
  },
  BLUFF_TOO_OFTEN: {
    tag: '블러프 과다',
    tip: '드로우 없이 약한 핸드로 계속 베팅하면 EV가 마이너스입니다.',
  },
  SIZE_MISS: {
    tag: '사이즈 미스',
    tip: '베팅 크기는 가치/방어/블러프 빈도에 큰 영향을 줍니다. 권장 범위를 익히세요.',
  },
  RANGE_MISREAD: {
    tag: '레인지 오독',
    tip: '상대 레인지에 비해 내 핸드가 충분한 에쿼티를 가질 때는 폴드하지 않는 게 좋습니다.',
  },
};

export default function AnalysisPage() {
  const { handId } = useParams<{ handId: string }>();
  const [hand, setHand] = useState<CompletedHand | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    if (!handId) return;
    let cancelled = false;
    setLoading(true);
    void getHand(handId).then((h) => {
      if (cancelled) return;
      if (!h) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setHand(h);
      setLoading(false);
      // If analysis is missing (legacy hand or evaluator hadn't finished),
      // run it now and persist back.
      if (!h.postHandInsight) {
        setEvaluating(true);
        // Defer via setTimeout — microtasks drain before React commits, so
        // queueMicrotask wouldn't let the "평가 중…" UI actually render.
        // A macro-task boundary lets one paint happen before evaluateHand
        // blocks the main thread for 200-800ms.
        setTimeout(() => {
          if (cancelled) return;
          try {
            const analysis = evaluateHand(h);
            const enriched = { ...h, postHandInsight: analysis };
            if (cancelled) return;
            setHand(enriched);
            void saveHand(enriched).catch((err) => {
              console.error('[AnalysisPage] saveHand failed', err);
            });
          } catch (err) {
            console.error('[AnalysisPage] evaluateHand failed', err);
          } finally {
            if (!cancelled) setEvaluating(false);
          }
        }, 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [handId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        불러오는 중…
      </main>
    );
  }

  if (notFound || !hand) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
        <p>해당 핸드를 찾을 수 없습니다.</p>
        <Link to="/history" className="rounded bg-muted px-3 py-1.5 text-sm hover:bg-secondary">
          ← 히스토리로
        </Link>
      </main>
    );
  }

  const resultColor =
    hand.result === 'WIN'
      ? 'text-green-400'
      : hand.result === 'LOSS'
        ? 'text-red-400'
        : 'text-foreground';
  const resultLabel = hand.result === 'WIN' ? '승리' : hand.result === 'LOSS' ? '패배' : '무승부';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground">
          ← 히스토리
        </Link>
        <h1 className="text-base font-bold text-primary">핸드 #{hand.handNumber}</h1>
        <div className={clsx('text-sm font-bold', resultColor)}>
          {resultLabel} {formatChips(hand.myWinLoss)}
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <p className="text-[11px] text-muted-foreground text-center -mb-1">
          정답 채점이 아닌, 회고용 보조 자료입니다.
        </p>

        {/* Summary card */}
        <ScoreSummary hand={hand} evaluating={evaluating} />

        {/* Cards & board */}
        <CardsSection hand={hand} />

        {/* Action timeline */}
        <Timeline hand={hand} />

        {/* Take-aways */}
        <TakeAways hand={hand} />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Score summary                                                     */
/* ------------------------------------------------------------------ */

function ScoreSummary({
  hand,
  evaluating,
}: {
  hand: CompletedHand;
  evaluating: boolean;
}) {
  const a = hand.postHandInsight;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Info label="날짜" value={new Date(hand.playedAt).toLocaleString()} />
        <Info
          label="모드"
          value={hand.mode === 'AI' ? `AI · ${hand.aiDifficulty}` : '원격'}
        />
        <Info label="포지션" value={hand.myPosition} />
        <Info label="종료" value={hand.wentToShowdown ? '쇼다운' : '폴드'} />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
        <div className="flex-shrink-0">
          <CircularScore
            score={a?.overallScore ?? null}
            evaluating={evaluating}
          />
        </div>
        <div className="flex-1 min-w-0">
          {a ? (
            <>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                핸드 회고
              </div>
              <div className="mt-1 text-sm text-foreground">{a.summary}</div>
              {a.strengths.length > 0 && (
                <ul className="mt-2 text-xs text-green-400">
                  {a.strengths.slice(0, 2).map((s, i) => (
                    <li key={i}>· {s}</li>
                  ))}
                </ul>
              )}
            </>
          ) : evaluating ? (
            <div className="text-sm text-muted-foreground">인사이트 준비 중…</div>
          ) : (
            <div className="text-sm text-muted-foreground">회고 데이터 없음</div>
          )}
        </div>
      </div>

      {a && Object.keys(a.streetScores).length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(['preflop', 'flop', 'turn', 'river'] as Street[]).map((st) => {
            const v = a.streetScores[st];
            if (v === undefined) {
              return (
                <div key={st} className="rounded bg-background p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">{STREET_KO[st]}</div>
                  <div className="text-xs text-foreground">—</div>
                </div>
              );
            }
            return (
              <div
                key={st}
                className="rounded bg-background p-2 text-center"
              >
                <div className="text-[10px] text-muted-foreground">
                  {STREET_KO[st]}
                </div>
                <div
                  className={clsx('text-sm font-bold', scoreColorClass(v))}
                >
                  {v}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CircularScore({
  score,
  evaluating,
}: {
  score: number | null;
  evaluating: boolean;
}) {
  const sz = 84;
  const stroke = 8;
  const r = (sz - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: sz, height: sz }}
    >
      <svg width={sz} height={sz} className="absolute inset-0 -rotate-90">
        <circle
          cx={sz / 2}
          cy={sz / 2}
          r={r}
          stroke="rgb(38 38 38)"
          strokeWidth={stroke}
          fill="none"
        />
        {score != null && (
          <circle
            cx={sz / 2}
            cy={sz / 2}
            r={r}
            stroke={
              score >= 80 ? '#34d399' : score >= 50 ? '#facc15' : '#f87171'
            }
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${(circ * pct).toFixed(1)} ${circ.toFixed(1)}`}
          />
        )}
      </svg>
      <div className="text-center">
        {score != null ? (
          <>
            <div className={clsx('text-2xl font-bold', scoreColorClass(score))}>
              {score}
            </div>
            <div className="text-[10px] text-muted-foreground">/ 100</div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            {evaluating ? '…' : '—'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cards section                                                     */
/* ------------------------------------------------------------------ */

function CardsSection({ hand }: { hand: CompletedHand }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        카드
      </h2>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-12 text-xs text-muted-foreground">내 핸드</span>
          <div className="flex gap-1">
            <CardView card={hand.myCards[0]} animate={false} />
            <CardView card={hand.myCards[1]} animate={false} />
          </div>
        </div>
        {hand.opponentCards && (
          <div className="flex items-center gap-3">
            <span className="w-12 text-xs text-muted-foreground">상대</span>
            <div className="flex gap-1">
              <CardView card={hand.opponentCards[0]} animate={false} />
              <CardView card={hand.opponentCards[1]} animate={false} />
            </div>
          </div>
        )}
        {hand.board.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="w-12 text-xs text-muted-foreground">보드</span>
            <div className="flex gap-1">
              {hand.board.map((c, i) => (
                <CardView key={i} card={c} animate={false} />
              ))}
            </div>
          </div>
        )}
      </div>
      {hand.winningHand && (
        <div className="mt-3 text-xs text-muted-foreground">
          승자 핸드:{' '}
          <span className="text-primary font-semibold">
            {HAND_RANK_KO[hand.winningHand.rank] ?? hand.winningHand.rank}
          </span>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Action timeline                                                   */
/* ------------------------------------------------------------------ */

function Timeline({ hand }: { hand: CompletedHand }) {
  // Map actionIndex → evaluation, mistake (for fast lookup)
  const evalMap = useMemo(() => {
    const m = new Map<number, ActionEvaluation>();
    for (const e of hand.postHandInsight?.actionEvaluations ?? []) m.set(e.actionIndex, e);
    return m;
  }, [hand.postHandInsight]);
  const mistakeMap = useMemo(() => {
    const m = new Map<number, Mistake>();
    for (const x of hand.postHandInsight?.mistakes ?? []) m.set(x.actionIndex, x);
    return m;
  }, [hand.postHandInsight]);

  const grouped = useMemo(() => groupByStreet(hand.actionLog), [hand.actionLog]);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        액션 타임라인
      </h2>
      <div className="space-y-4">
        {(['preflop', 'flop', 'turn', 'river'] as Street[]).map((st) => {
          const items = grouped[st];
          if (!items || items.length === 0) return null;
          return (
            <div key={st}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <div className="text-xs font-bold text-primary">{STREET_KO[st]}</div>
                {hand.postHandInsight?.streetScores[st] !== undefined && (
                  <div
                    className={clsx(
                      'text-[11px] font-semibold',
                      scoreColorClass(hand.postHandInsight.streetScores[st]!),
                    )}
                  >
                    스트리트 평균 {hand.postHandInsight.streetScores[st]}
                  </div>
                )}
              </div>
              <ol className="space-y-2">
                {items.map((a) => (
                  <ActionCard
                    key={a.index}
                    entry={a.entry}
                    evalu={evalMap.get(a.index) ?? null}
                    mistake={mistakeMap.get(a.index) ?? null}
                  />
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActionCard({
  entry,
  evalu,
  mistake,
}: {
  entry: ActionLogEntry;
  evalu: ActionEvaluation | null;
  mistake: Mistake | null;
}) {
  const isMine = entry.playerLabel === '나';
  return (
    <li
      className={clsx(
        'rounded-lg border bg-background p-2.5',
        isMine ? 'border-border' : 'border-border/50',
        evalu && evalu.score < 50 && 'border-red-900/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
              isMine ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {entry.playerLabel}
          </span>
          <span className="text-sm font-bold text-white">
            {ACTION_KO[entry.action] ?? entry.action}
          </span>
          {(entry.action === 'bet' || entry.action === 'raise' || entry.action === 'call') &&
            entry.amount > 0 && (
              <span className="text-xs text-primary">{entry.amount}</span>
            )}
        </div>
        <div className="flex items-center gap-2">
          {mistake && (
            <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
              ⚠ {MISTAKE_LABEL[mistake.type]?.tag ?? mistake.type}
            </span>
          )}
          {evalu && isMine && <ScoreBadge score={evalu.score} />}
          <span className="text-[10px] text-muted-foreground">팟 {entry.potAfter}</span>
        </div>
      </div>

      {evalu && isMine && (
        <div className="mt-2 space-y-1 border-t border-border/70 pt-2 text-xs">
          {typeof evalu.equity === 'number' && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-muted-foreground">에쿼티:</span>
              <EquityBar equity={evalu.equity} />
              <span className="font-mono text-foreground">
                {(evalu.equity * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="text-foreground">
            <span className="text-muted-foreground">권장:</span>{' '}
            <span className="text-primary">{evalu.recommended}</span>
          </div>
          {evalu.reasoning && (
            <div className="text-muted-foreground">{evalu.reasoning}</div>
          )}
          {mistake && (
            <div className="rounded bg-red-950/40 px-2 py-1 text-[11px] leading-relaxed text-red-200">
              💡 {MISTAKE_LABEL[mistake.type]?.tip ?? mistake.description}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function EquityBar({ equity }: { equity: number }) {
  const pct = Math.max(0, Math.min(1, equity)) * 100;
  return (
    <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-muted">
      <div
        className={clsx(
          'h-full',
          equity >= 0.6
            ? 'bg-green-400'
            : equity >= 0.4
              ? 'bg-yellow-400'
              : 'bg-red-400',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={clsx(
        'inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-full px-2 text-xs font-bold',
        score >= 80
          ? 'bg-green-500/15 text-green-400'
          : score >= 50
            ? 'bg-yellow-500/15 text-yellow-400'
            : 'bg-red-500/15 text-red-400',
      )}
    >
      {score}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Take-aways                                                        */
/* ------------------------------------------------------------------ */

function TakeAways({ hand }: { hand: CompletedHand }) {
  const a = hand.postHandInsight;
  if (!a) return null;
  if (a.mistakes.length === 0 && a.strengths.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        이 핸드에서 배울 점
      </h2>
      <ul className="space-y-2 text-sm">
        {a.mistakes.map((m, i) => (
          <li key={`m-${i}`} className="rounded bg-red-950/30 px-3 py-2 text-red-200">
            <div className="text-[11px] font-semibold uppercase tracking-wide">
              {MISTAKE_LABEL[m.type]?.tag ?? m.type}
            </div>
            <div className="mt-0.5 text-xs">{m.description}</div>
          </li>
        ))}
        {a.strengths.map((s, i) => (
          <li key={`s-${i}`} className="rounded bg-green-950/30 px-3 py-2 text-green-200">
            <div className="text-[11px] font-semibold uppercase tracking-wide">
              ✓ 잘한 플레이
            </div>
            <div className="mt-0.5 text-xs">{s}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground text-sm">{value}</div>
    </div>
  );
}

function formatChips(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

interface IndexedEntry {
  entry: ActionLogEntry;
  index: number;
}

function groupByStreet(log: ActionLogEntry[]): Record<Street, IndexedEntry[]> {
  const out: Record<Street, IndexedEntry[]> = {
    preflop: [],
    flop: [],
    turn: [],
    river: [],
  };
  for (let i = 0; i < log.length; i++) {
    out[log[i].street].push({ entry: log[i], index: i });
  }
  return out;
}

function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}
