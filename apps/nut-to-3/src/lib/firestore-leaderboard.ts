/**
 * NUT TO 3 — All-time leaderboard Firestore helpers.
 *
 * Collection: `nutTo3Leaderboard_all_time/{uid}`
 *   - Document key = uid → per-user single best record.
 *   - `submitIfBetter` uses a transaction to update only when the new result
 *     beats the previous best (sort priority below). 더 나쁘면 그대로 둠.
 *   - Sort / comparison priority (best-first, 2단계):
 *       1. streak (desc)
 *       2. score  (desc)  — score = totalCorrect × 10000 − avgResponseMs
 *                          정답 수가 1차, 같은 정답 수일 때만 속도가 tie-break.
 *
 * weekly secondary leaderboard 는 plan 단계에서 예약. `periodKey` 필드는 항상
 * "all_time" 로 stamping 되며 future PR 에서 `nutTo3Leaderboard_week_*` 컬렉션을
 * 추가할 때 데이터 모델 호환을 위해 둠.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export const LEADERBOARD_COLLECTION = "nutTo3Leaderboard_all_time" as const;

export interface LeaderboardRecord {
  uid: string;
  displayName: string;
  periodKey: "all_time";
  streak: number;
  accuracy: number;        // 0..1
  avgResponseMs: number;   // ms, 낮을수록 좋음
  score: number;
  /** Firestore serverTimestamp (write 직후엔 null 일 수 있음). */
  updatedAt: Timestamp | null;
  /** 클라이언트 Date.now() — 디버깅용. */
  recordedAt: number;
}

/** sort/비교 우선순위와 동일한 1-pair best 비교. streak → score 2단계. */
export function isBetterThan(
  candidate: Pick<LeaderboardRecord, "streak" | "score">,
  baseline: Pick<LeaderboardRecord, "streak" | "score">,
): boolean {
  if (candidate.streak !== baseline.streak) return candidate.streak > baseline.streak;
  return candidate.score > baseline.score;
}

export interface SubmitInput {
  uid: string;
  displayName: string;
  streak: number;
  accuracy: number;
  avgResponseMs: number;
  score: number;
}

export interface SubmitResult {
  wasUpdated: boolean;
  previousBest: LeaderboardRecord | null;
  /** 새 record 가 실제 적용된 경우 그 값 (server timestamp 는 아직 null). */
  newBest: LeaderboardRecord | null;
}

/**
 * Transactional best-record upsert.
 *   1. read 기존 best
 *   2. 새 결과가 더 나으면 set, 아니면 no-op
 *   3. result 반환 (wasUpdated + previousBest)
 *
 * Firebase 미설정 / 에러 시 wasUpdated=false 안전 반환.
 */
export async function submitIfBetter(input: SubmitInput): Promise<SubmitResult> {
  if (!isFirebaseConfigured) {
    return { wasUpdated: false, previousBest: null, newBest: null };
  }
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, LEADERBOARD_COLLECTION, input.uid);
      const snap = await tx.get(ref);
      const prev = snap.exists() ? (snap.data() as LeaderboardRecord) : null;
      const candidate = {
        streak: input.streak,
        score: input.score,
      };
      if (prev && !isBetterThan(candidate, prev)) {
        return { wasUpdated: false, previousBest: prev, newBest: null };
      }
      const payload: Omit<LeaderboardRecord, "updatedAt"> & {
        updatedAt: ReturnType<typeof serverTimestamp>;
      } = {
        uid: input.uid,
        displayName: input.displayName,
        periodKey: "all_time",
        streak: input.streak,
        accuracy: input.accuracy,
        avgResponseMs: input.avgResponseMs,
        score: input.score,
        updatedAt: serverTimestamp(),
        recordedAt: Date.now(),
      };
      tx.set(ref, payload);
      // newBest 의 updatedAt 은 server timestamp resolution 전이라 null 로 노출.
      const newBest: LeaderboardRecord = {
        ...payload,
        updatedAt: null,
      };
      return { wasUpdated: true, previousBest: prev, newBest };
    });
  } catch (e) {
    console.error("[nut-to-3] leaderboard submit error:", e);
    return { wasUpdated: false, previousBest: null, newBest: null };
  }
}

/** Top N best records, sort 우선순위 적용. */
export async function fetchTopRecords(topLimit: number): Promise<LeaderboardRecord[]> {
  if (!isFirebaseConfigured) return [];
  try {
    const q = query(
      collection(db, LEADERBOARD_COLLECTION),
      orderBy("streak", "desc"),
      orderBy("score", "desc"),
      fsLimit(topLimit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardRecord);
  } catch (e) {
    console.error("[nut-to-3] leaderboard top fetch error:", e);
    return [];
  }
}

export async function fetchMyBest(uid: string): Promise<LeaderboardRecord | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const snap = await getDoc(doc(db, LEADERBOARD_COLLECTION, uid));
    if (!snap.exists()) return null;
    return snap.data() as LeaderboardRecord;
  } catch (e) {
    console.error("[nut-to-3] leaderboard my-best fetch error:", e);
    return null;
  }
}

/**
 * 내 best 가 전체에서 몇 위인지 추정.
 *   - top N 안에 내 uid 가 있으면 정확한 순위 (1-based)
 *   - 없으면 'overflow' 반환 (호출자가 "N+위" 로 표시)
 *
 * 정확한 cardinality 쿼리는 Firestore count() 도입 시 후속.
 */
export async function estimateMyRank(
  uid: string,
  topLimit: number,
): Promise<number | "overflow"> {
  const top = await fetchTopRecords(topLimit);
  const idx = top.findIndex((r) => r.uid === uid);
  if (idx === -1) return "overflow";
  return idx + 1;
}
