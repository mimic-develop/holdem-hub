/**
 * LeaderboardPanel — NUT TO 3 all-time top N + 내 순위.
 *
 * 진입 시 Top 100 을 한 번에 fetch → 그 안에서 Top 10 slice + 본인 rank·record 도출.
 *  - 로그인 사용자
 *      • 본인이 Top 10 안: 해당 row highlight
 *      • 본인이 11~100위: Top 10 아래에 본인 row 별도 표시 (정확 rank)
 *      • 본인이 100위 밖 OR 아직 기록 없음: fetchMyBest 로 본인 best 가져와 표시
 *  - 비로그인: Top 10 + "로그인하면 기록이 영구 저장됩니다" 안내
 */

import { useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";
import { cn } from "../lib/utils";
import {
  fetchMyBest,
  fetchTopRecords,
  type LeaderboardRecord,
} from "../lib/firestore-leaderboard";

interface Props {
  /** 현재 로그인 uid (없으면 null — 익명 사용자) */
  uid: string | null;
  /** Submit 직후 forced refresh — 의존성으로 받음 */
  refreshKey?: number;
  /** Optional callback 으로 부모(헤더) 가 my rank 를 표시할 수 있게 노출. */
  onRankResolved?: (rank: number | "overflow" | null) => void;
}

const TOP_LIMIT = 10;
const RANK_SEARCH_LIMIT = 100;

export function LeaderboardPanel({ uid, refreshKey, onRankResolved }: Props) {
  const [top, setTop] = useState<LeaderboardRecord[] | null>(null);
  const [myRank, setMyRank] = useState<number | "overflow" | null>(null);
  const [myBest, setMyBest] = useState<LeaderboardRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Top 100 한 번에 가져와 Top 10 + 본인 rank/record 모두 도출.
      const top100 = await fetchTopRecords(RANK_SEARCH_LIMIT);
      if (cancelled) return;
      setTop(top100.slice(0, TOP_LIMIT));

      if (!uid) {
        setMyRank(null);
        setMyBest(null);
        onRankResolved?.(null);
        setLoading(false);
        return;
      }

      const idx = top100.findIndex((r) => r.uid === uid);
      if (idx !== -1) {
        const rank = idx + 1;
        setMyRank(rank);
        setMyBest(top100[idx] ?? null);
        onRankResolved?.(rank);
      } else {
        // 100위 밖 — 본인 best 는 따로 fetch (있을 수도, 아직 게임 안 했을 수도)
        const my = await fetchMyBest(uid);
        if (cancelled) return;
        setMyBest(my);
        const rank: "overflow" | null = my ? "overflow" : null;
        setMyRank(rank);
        onRankResolved?.(rank);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, refreshKey, onRankResolved]);

  // 본인 row 를 Top 10 아래 별도 표시할 조건: 본인이 Top 10 밖 (11~100 또는 overflow) 이면서 record 가 존재.
  const showMyRowBelow = uid !== null && myBest !== null && (
    myRank === "overflow" || (typeof myRank === "number" && myRank > TOP_LIMIT)
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="font-display font-bold text-sm text-white tracking-tight">
          명예의 전당
        </span>
        <span className="ml-auto text-[10px] text-white/40 uppercase tracking-wider">
          All-time
        </span>
      </div>

      {loading && (
        <div className="px-4 py-6 text-center text-xs text-white/40">불러오는 중…</div>
      )}

      {!loading && top && top.length === 0 && (
        <div className="px-4 py-6 text-center text-xs text-white/40">
          아직 기록이 없습니다. 가장 먼저 도전하세요!
        </div>
      )}

      {!loading && top && top.length > 0 && (
        <ol className="divide-y divide-white/5">
          {top.map((r, i) => {
            const rank = i + 1;
            const isMe = uid !== null && r.uid === uid;
            return (
              <li
                key={r.uid}
                className={cn(
                  "px-3 py-2 flex items-center gap-2 text-xs",
                  isMe && "bg-amber-400/10",
                )}
              >
                <RankBadge rank={rank} />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "truncate font-semibold",
                      isMe ? "text-amber-300" : "text-white/85",
                    )}
                  >
                    {r.displayName || `익명-${r.uid.slice(0, 6)}`}
                    {isMe && <span className="ml-1 text-[9px] text-amber-400">(나)</span>}
                  </div>
                  <div className="text-[10px] text-white/40 tabular-nums">
                    {Math.round(r.accuracy * 100)}% · {(r.avgResponseMs / 1000).toFixed(1)}s
                  </div>
                </div>
                <span className="tabular-nums text-orange-300 font-bold w-14 text-right">
                  {r.streak}연속
                </span>
                <span className="tabular-nums text-emerald-300 font-bold w-16 text-right">
                  {r.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && showMyRowBelow && myBest && (
        <div className="border-t border-amber-400/30 bg-amber-400/[0.06]">
          <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-amber-400/80 font-bold border-b border-amber-400/15">
            내 기록
          </div>
          <div className="px-3 py-2 flex items-center gap-2 text-xs">
            <div className="w-6 h-auto min-h-[1.5rem] rounded-full flex items-center justify-center bg-amber-400/20 text-amber-300 text-[10px] font-bold tabular-nums px-1">
              {myRank === "overflow" ? `${RANK_SEARCH_LIMIT}+` : myRank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate font-semibold text-amber-300">
                {myBest.displayName || `익명-${myBest.uid.slice(0, 6)}`}
                <span className="ml-1 text-[9px] text-amber-400">(나)</span>
              </div>
              <div className="text-[10px] text-white/40 tabular-nums">
                {Math.round(myBest.accuracy * 100)}% · {(myBest.avgResponseMs / 1000).toFixed(1)}s
              </div>
            </div>
            <span className="tabular-nums text-orange-300 font-bold w-14 text-right">
              {myBest.streak}연속
            </span>
            <span className="tabular-nums text-emerald-300 font-bold w-16 text-right">
              {myBest.score.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {!loading && uid === null && (
        <div className="px-4 py-3 text-center text-[11px] text-white/50 border-t border-white/5 bg-white/[0.02]">
          로그인하면 기록이 영구 저장됩니다
        </div>
      )}

      {!loading && uid !== null && myBest === null && top && top.length > 0 && (
        <div className="px-4 py-3 text-center text-[11px] text-white/45 border-t border-white/5 bg-white/[0.02]">
          첫 도전 결과가 여기에 표시됩니다
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow">
        <Crown className="w-3.5 h-3.5" />
      </div>
    );
  }
  const colorBg =
    rank === 2 ? "bg-zinc-300/30 text-zinc-100" : rank === 3 ? "bg-amber-700/40 text-amber-200" : "bg-white/10 text-white/70";
  return (
    <div
      className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums",
        colorBg,
      )}
    >
      {rank}
    </div>
  );
}
