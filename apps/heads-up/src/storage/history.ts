import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CompletedHand, GameMode } from '../types/game';

// 모노레포 통합 시 다른 sub-app과 IndexedDB 충돌 방지를 위해 `heads-up:` prefix.
const DB_NAME = 'heads-up:headsup-solo';
const DB_VERSION = 1;
const STORE = 'hands' as const;

interface HistoryDB extends DBSchema {
  hands: {
    key: string;
    value: CompletedHand;
    indexes: {
      playedAt: number;
      mode: GameMode;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<HistoryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'handId' });
        store.createIndex('playedAt', 'playedAt');
        store.createIndex('mode', 'mode');
      },
    });
  }
  return dbPromise;
}

/** Reset the cached connection — used by tests & after clearAll for fresh state. */
export async function _resetDBForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // swallow — caller is already discarding the connection
    }
    dbPromise = null;
  }
}

/**
 * Normalize a record read from IndexedDB.
 *
 * Legacy records (saved before the `gtoAnalysis` → `postHandInsight` rename)
 * still have the old field name in storage. We read either, write only the new.
 * This avoids needing a one-shot migration script.
 */
function normalizeRecord(rec: CompletedHand | undefined): CompletedHand | null {
  if (!rec) return null;
  // The cast is safe at runtime — old records carry `gtoAnalysis` but lack `postHandInsight`.
  const legacy = (rec as unknown as { gtoAnalysis?: CompletedHand['postHandInsight'] }).gtoAnalysis;
  if (legacy && !rec.postHandInsight) {
    return { ...rec, postHandInsight: legacy };
  }
  return rec;
}

export async function saveHand(hand: CompletedHand): Promise<void> {
  const db = await getDB();
  await db.put(STORE, hand);
}

export async function getHand(handId: string): Promise<CompletedHand | null> {
  const db = await getDB();
  const v = await db.get(STORE, handId);
  return normalizeRecord(v);
}

export interface ListOptions {
  /** Max items to return. Default 50. */
  limit?: number;
  /** Skip this many matching records (for pagination). Default 0. */
  offset?: number;
  /** If set, only return hands with this mode. */
  mode?: GameMode;
}

/**
 * Latest-first listing. Uses the `playedAt` index with a descending cursor so we
 * avoid loading the full store into memory when the user has thousands of hands.
 */
export async function listHands(opts: ListOptions = {}): Promise<CompletedHand[]> {
  const { limit = 50, offset = 0, mode } = opts;
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.store.index('playedAt');

  const results: CompletedHand[] = [];
  let skipped = 0;
  let cursor = await index.openCursor(null, 'prev');
  while (cursor && results.length < limit) {
    const value = cursor.value;
    if (!mode || value.mode === mode) {
      if (skipped < offset) {
        skipped++;
      } else {
        const normalized = normalizeRecord(value);
        if (normalized) results.push(normalized);
      }
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return results;
}

export interface HandStats {
  total: number;
  wins: number;
  losses: number;
  splits: number;
  netChips: number;
  avgGtoScore?: number;
  winRate: number;
}

/**
 * Aggregate stats across ALL saved hands. Linear scan — fine for a single-user
 * practice app. If history exceeds ~10k hands we'd need an aggregate rollup.
 */
export async function getStats(): Promise<HandStats> {
  const db = await getDB();
  const all = await db.getAll(STORE);

  let wins = 0;
  let losses = 0;
  let splits = 0;
  let netChips = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  for (const raw of all) {
    const h = normalizeRecord(raw);
    if (!h) continue;
    if (h.result === 'WIN') wins++;
    else if (h.result === 'LOSS') losses++;
    else splits++;
    netChips += h.myWinLoss;
    if (typeof h.postHandInsight?.overallScore === 'number') {
      scoreSum += h.postHandInsight.overallScore;
      scoreCount++;
    }
  }
  const total = all.length;
  return {
    total,
    wins,
    losses,
    splits,
    netChips,
    winRate: total > 0 ? wins / total : 0,
    avgGtoScore: scoreCount > 0 ? scoreSum / scoreCount : undefined,
  };
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}

export async function deleteHand(handId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, handId);
}
