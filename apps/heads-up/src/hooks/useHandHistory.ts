import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompletedHand, GameMode } from '../types/game';
import {
  clearAll as clearAllInDb,
  getStats,
  listHands,
  type HandStats,
} from '../storage/history';

const PAGE_SIZE = 20;

export interface UseHandHistoryOptions {
  mode?: GameMode;
}

export interface UseHandHistoryResult {
  hands: CompletedHand[];
  stats: HandStats | null;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * Load-and-paginate hook for CompletedHand records stored in IndexedDB.
 *
 * Race semantics: every reload/loadMore bumps a shared requestId. When a
 * fetch resolves, it checks whether its id is still the latest — if not, it
 * drops its results silently. This is critical for the filter tabs: if the
 * user flips AI → REMOTE while the AI fetch is in flight, we must NOT let the
 * AI results overwrite the REMOTE results that arrive next.
 */
export function useHandHistory(opts: UseHandHistoryOptions = {}): UseHandHistoryResult {
  const [hands, setHands] = useState<CompletedHand[]>([]);
  const [stats, setStats] = useState<HandStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const [first, s] = await Promise.all([
        listHands({ limit: PAGE_SIZE, offset: 0, mode: opts.mode }),
        getStats(),
      ]);
      if (myId !== requestIdRef.current) return; // stale — a newer request superseded us
      setHands(first);
      setStats(s);
      setHasMore(first.length === PAGE_SIZE);
      pageRef.current = 1;
    } finally {
      if (myId === requestIdRef.current) setIsLoading(false);
    }
  }, [opts.mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    const myId = ++requestIdRef.current;
    const targetOffset = pageRef.current * PAGE_SIZE;
    setIsLoading(true);
    try {
      const next = await listHands({
        limit: PAGE_SIZE,
        offset: targetOffset,
        mode: opts.mode,
      });
      if (myId !== requestIdRef.current) return;
      setHands((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
      pageRef.current += 1;
    } finally {
      if (myId === requestIdRef.current) setIsLoading(false);
    }
  }, [hasMore, opts.mode]);

  const clearAll = useCallback(async () => {
    await clearAllInDb();
    await reload();
  }, [reload]);

  return { hands, stats, isLoading, hasMore, loadMore, reload, clearAll };
}
