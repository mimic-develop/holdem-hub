import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAggregateStats,
  type AggregateStats,
  type StatsRange,
} from '../storage/stats';

export interface UseStatsResult {
  stats: AggregateStats | null;
  isLoading: boolean;
  range: StatsRange;
  setRange: (r: StatsRange) => void;
  reload: () => Promise<void>;
}

/**
 * React hook that pulls aggregate stats for a given range. Identical
 * race-protection pattern as useHandHistory: every reload bumps a request id;
 * stale fetches drop their results.
 */
export function useStats(initialRange: StatsRange = 'today'): UseStatsResult {
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<StatsRange>(initialRange);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const result = await getAggregateStats(range);
      if (myId !== requestIdRef.current) return;
      setStats(result);
    } finally {
      if (myId === requestIdRef.current) setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { stats, isLoading, range, setRange, reload };
}
