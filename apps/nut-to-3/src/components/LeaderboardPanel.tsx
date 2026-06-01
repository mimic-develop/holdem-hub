/**
 * LeaderboardPanel — Top 100 리스트 + 하단 내 순위 고정 표시
 */

import { useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch, useAuthState } from "@hh/shared";

interface LeaderboardEntry {
  rank: number;
  accountId: string;
  nickname: string;
  streak: number;
  accuracy: number;
  avgResponseMs: number;
  score: number;
  updatedAt: string;
}

interface Props {
  uid: string | null;
  refreshKey?: number;
  onRankResolved?: (rank: number | "overflow" | null) => void;
}

const TOP_LIMIT = 100;

export function LeaderboardPanel({ uid, refreshKey, onRankResolved }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const { user } = useAuthState();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ entries: LeaderboardEntry[] }>("/nut-to/leaderboard").then(res => {
      if (cancelled) return;
      setEntries(res.entries);
      const myEntry = uid ? res.entries.find(e => e.nickname === user?.nickname) : null;
      setMyRank(myEntry?.rank ?? null);
      onRankResolved?.(myEntry?.rank ?? null);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setEntries([]);
        setLoading(false);
        setMyRank(null);
      }
    });
    return () => { cancelled = true; };
  }, [uid, refreshKey, onRankResolved]);

  const top = entries ? entries.slice(0, TOP_LIMIT) : null;
  const myEntry = uid && entries ? entries.find(e => e.nickname === user?.nickname) : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[480px]">
      {/* 헤더: 내 등수 표시 */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="font-display font-bold text-sm text-white tracking-tight">
          명예의 전당
        </span>
        <span className="ml-auto text-[10px] text-white/40 uppercase tracking-wider">All-time</span>
      </div>

      {/* 리스트 영역 (스크롤 가능) */}
      {!loading && top && (
        <ol className="flex-1 divide-y divide-white/5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {top.length > 0 ? (
            top.map((r) => {
              const isMe = uid !== null && r.accountId === uid;
              return (
                <li key={r.accountId} className={cn("px-3 py-2 flex items-center gap-2 text-xs", isMe && "bg-amber-400/10")}>
                  <RankBadge rank={r.rank} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("truncate font-semibold", isMe ? "text-amber-300" : "text-white/85")}>
                      {r.nickname} {isMe && <span className="ml-1 text-[9px] text-amber-400">(나)</span>}
                    </div>
                    <div className="text-[10px] text-white/40 tabular-nums">{Math.round(r.accuracy * 100)}% · {(r.avgResponseMs / 1000).toFixed(1)}s</div>
                  </div>
                  <span className="tabular-nums text-orange-300 font-bold w-14 text-right">{r.streak}연속</span>
                  <span className="tabular-nums text-emerald-300 font-bold w-16 text-right">{r.score.toLocaleString()}</span>
                </li>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs text-white/40">아직 기록이 없습니다.</div>
          )}
        </ol>
      )}

      {/* 하단 고정 영역: 내 등수 */}

        <div className="shrink-0 border-t border-white/10 bg-white/[0.02]">
          <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-white/50 font-bold border-b border-white/5">내 순위</div>
          {myRank != null ? (
            <div className="px-3 py-2 flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/10 text-white text-[10px] font-bold tabular-nums">
               {myRank}
              </div>
              <div className="flex-1 min-w-0 truncate font-semibold text-white/85">{myEntry.nickname}</div>
              <span className="tabular-nums text-orange-300 font-bold w-14 text-right">{myEntry.streak}연속</span>
              <span className="tabular-nums text-emerald-300 font-bold w-16 text-right">{myEntry.score.toLocaleString()}</span>
            </div>
          ) : (
            <div className="px-3 py-2 text-center text-[11px] text-white/40">순위권 밖입니다</div>
          )}
        </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow"><Crown className="w-3.5 h-3.5" /></div>;
  const colorBg = rank === 2 ? "bg-zinc-300/30 text-zinc-100" : rank === 3 ? "bg-amber-700/40 text-amber-200" : "bg-white/10 text-white/70";
  return <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums", colorBg)}>{rank}</div>;
}