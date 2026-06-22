import { apiFetch } from '@hh/shared';
import type { CompletedHand, GameMode } from '../types/game';

export async function saveHand(hand: CompletedHand): Promise<void> {
  await apiFetch<{ handId: string }>('/play-lab/heads-up/hands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hand),
  });
}

export async function getHand(handId: string): Promise<CompletedHand | null> {
  return apiFetch<CompletedHand>(`/play-lab/heads-up/hands/${handId}`).catch(() => null);
}

export interface ListOptions {
  /** Max items to return. Default 50. */
  limit?: number;
  /** Skip this many matching records (for pagination). Default 0. */
  offset?: number;
  /** If set, only return hands with this mode. */
  mode?: GameMode;
}

export async function listHands(opts: ListOptions = {}): Promise<CompletedHand[]> {
  const params = new URLSearchParams();
  if (opts.limit  != null) params.set('limit',  String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  if (opts.mode   != null) params.set('mode',   opts.mode);
  const qs = params.toString();
  const res = await apiFetch<{ hands: CompletedHand[]; total: number }>(
    `/play-lab/heads-up/hands${qs ? `?${qs}` : ''}`,
  ).catch(() => ({ hands: [], total: 0 }));
  return res.hands;
}

export interface HandStats {
  total: number;
  wins: number;
  losses: number;
  splits: number;
  netChips: number;
  /** Average overallScore across hands that have a postHandInsight. */
  avgGtoScore?: number;
  /** Number of hands with a postHandInsight (denominator for avgGtoScore). */
  evaluatedHands?: number;
  winRate: number;
}

export async function getStats(): Promise<HandStats> {
  return apiFetch<HandStats>('/play-lab/heads-up/stats').catch(() => ({
    total: 0,
    wins: 0,
    losses: 0,
    splits: 0,
    netChips: 0,
    evaluatedHands: 0,
    winRate: 0,
  }));
}
