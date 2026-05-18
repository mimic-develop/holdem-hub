import type { CompletedHand, GameMode } from '../types/game';

/**
 * A group of consecutive hands that belong to one continuous game/session.
 *
 * Identity:
 *   - For records saved with explicit `sessionId`, all hands sharing that id form a group.
 *   - For legacy records without `sessionId`, the group is inferred:
 *       * a fresh group starts at `handNumber === 1`, OR
 *       * a fresh group starts when more than `LEGACY_GAP_MS` (default 30 min) elapsed
 *         since the previous hand of the same mode.
 */
export interface SessionGroup {
  /** Stable id — the real sessionId, or a synthetic id derived from the first handId. */
  sessionId: string;
  /** True when this group was inferred from legacy records (no real sessionId). */
  inferred: boolean;
  mode: GameMode;
  aiDifficulty?: string;
  opponentName: string;
  startedAt: number;
  endedAt: number;
  hands: CompletedHand[];
  wins: number;
  losses: number;
  splits: number;
  netChips: number;
}

const LEGACY_GAP_MS = 30 * 60 * 1000; // 30 min

/**
 * Group hands by game/session. Output is sorted latest-first (the first group
 * has the newest endedAt). Hands within each group are sorted by handNumber asc
 * (1, 2, 3, ...) so the first played hand renders first inside a group.
 *
 * The input `hands` does not need to be pre-sorted.
 */
export function groupHandsBySession(hands: CompletedHand[]): SessionGroup[] {
  if (hands.length === 0) return [];

  // Sort hands by playedAt asc for grouping pass (legacy gap detection needs
  // chronological order). We'll resort the final groups by endedAt desc.
  const sorted = [...hands].sort((a, b) => a.playedAt - b.playedAt);

  const groupsByKey = new Map<string, SessionGroup>();

  // For legacy gap detection: remember the last hand we placed into a legacy
  // group so we can decide whether the next legacy hand continues or splits.
  let lastLegacy: { hand: CompletedHand; key: string } | null = null;

  for (const h of sorted) {
    let key: string;
    let inferred: boolean;

    if (h.sessionId) {
      key = h.sessionId;
      inferred = false;
    } else {
      // Legacy: synthesize a key.
      const shouldStartNew =
        !lastLegacy ||
        lastLegacy.hand.mode !== h.mode ||
        h.handNumber === 1 ||
        h.playedAt - lastLegacy.hand.playedAt > LEGACY_GAP_MS;
      if (shouldStartNew) {
        key = `legacy:${h.handId}`;
      } else {
        key = lastLegacy!.key;
      }
      inferred = true;
    }

    let g = groupsByKey.get(key);
    if (!g) {
      g = {
        sessionId: key,
        inferred,
        mode: h.mode,
        aiDifficulty: h.aiDifficulty,
        opponentName: h.opponentName,
        startedAt: h.playedAt,
        endedAt: h.playedAt,
        hands: [],
        wins: 0,
        losses: 0,
        splits: 0,
        netChips: 0,
      };
      groupsByKey.set(key, g);
    }

    g.hands.push(h);
    g.endedAt = Math.max(g.endedAt, h.playedAt);
    g.startedAt = Math.min(g.startedAt, h.playedAt);
    g.netChips += h.myWinLoss;
    if (h.result === 'WIN') g.wins++;
    else if (h.result === 'LOSS') g.losses++;
    else g.splits++;

    if (!h.sessionId) {
      lastLegacy = { hand: h, key };
    }
  }

  // Sort hands within each group by handNumber, then by playedAt as tiebreaker
  // so an interrupted legacy group still renders sensibly.
  for (const g of groupsByKey.values()) {
    g.hands.sort((a, b) => a.handNumber - b.handNumber || a.playedAt - b.playedAt);
  }

  // Latest game first.
  return [...groupsByKey.values()].sort((a, b) => b.endedAt - a.endedAt);
}
