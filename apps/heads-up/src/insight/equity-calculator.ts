import {
  ALL_RANKS,
  ALL_SUITS,
  type Card,
  type Suit,
} from '../engine/card';
import { calculateEquity, type HandCombo } from '../bot/equity';
import type { ActionRecord } from '../types/game';
import { allHandKeys, parseHandKey } from './preflop-chart';
import { HU_100BB_CHARTS } from './preflop-chart';

/* ------------------------------------------------------------------ */
/*  169-hand strength ordering                                        */
/*                                                                    */
/*  For range inference we need to know what "top 15%" means. We      */
/*  derive a coarse ordering from the SB open chart's raise frequency */
/*  (a hand that's always opened is stronger than one mixed/folded),  */
/*  breaking ties by pair > suited ace > suited king ... and then by  */
/*  rank. This is not a real solver strength list but is sufficient   */
/*  for "top X% → this-many-combos" bucketing.                        */
/* ------------------------------------------------------------------ */

function handStrengthScore(key: string): number {
  const { hi, lo, isPair, suited } = parseHandKey(key);
  const openFreq = HU_100BB_CHARTS.SB_FIRST_ACTION[key].raise;
  // Primary: open frequency. Secondary: pair bonus. Tertiary: high-rank weight.
  const pairBonus = isPair ? 10_000 + hi * 100 : 0;
  const rankBonus = hi * 50 + lo * 4 + (suited ? 20 : 0);
  return openFreq * 1_000_000 + pairBonus + rankBonus;
}

const RANKED_HAND_KEYS: readonly string[] = (() => {
  const keys = Array.from(allHandKeys());
  keys.sort((a, b) => handStrengthScore(b) - handStrengthScore(a));
  return keys;
})();

/** Expose for tests. */
export function getRankedHandKeys(): readonly string[] {
  return RANKED_HAND_KEYS;
}

/* ------------------------------------------------------------------ */
/*  Range inference                                                    */
/* ------------------------------------------------------------------ */

export interface OpponentRangeInference {
  /** Top-X% of all 169 canonical hands. */
  percentile: number;
  label: string;
}

/**
 * Very coarse opponent-range inference from preflop action history.
 *
 *  - Opponent 4bet (or more) → top 5%
 *  - Opponent 3bet (single raise over the open) → top 15%
 *  - Opponent open-raised first-in → top 25%
 *  - Opponent only called → top 60% (wide caller)
 *  - Opponent only checked (free BB option) → any hand
 */
export function inferOpponentRange(
  opponentActions: ReadonlyArray<Pick<ActionRecord, 'action' | 'street'>>,
): OpponentRangeInference {
  const preflopActions = opponentActions.filter((a) => a.street === 'preflop');
  const raises = preflopActions.filter((a) => a.action === 'raise').length;
  const calls = preflopActions.filter((a) => a.action === 'call').length;

  if (raises >= 2) {
    return { percentile: 0.05, label: '4벳 레인지 (top 5%)' };
  }
  if (raises === 1) {
    // Could be a first-in open or a 3bet — use ordering as a proxy.
    // If there was a call before the raise, it's a 3bet; otherwise an open.
    // For simplicity we lump both: a 3bettor is tighter than an opener.
    return { percentile: 0.15, label: '레이즈 레인지 (top 15%)' };
  }
  if (calls >= 1) {
    return { percentile: 0.6, label: '콜 레인지 (top 60%)' };
  }
  return { percentile: 1, label: '임의 핸드' };
}

/* ------------------------------------------------------------------ */
/*  Card-id helpers                                                   */
/* ------------------------------------------------------------------ */

const SUIT_INDEX: Record<Suit, number> = { s: 0, h: 1, d: 2, c: 3 };
function cardId(c: Card): number {
  return SUIT_INDEX[c.suit] * 13 + (c.rank - 2);
}
const DECK_BY_ID: Card[] = (() => {
  const deck: Card[] = new Array(52);
  for (const s of ALL_SUITS) {
    for (const r of ALL_RANKS) {
      deck[SUIT_INDEX[s] * 13 + (r - 2)] = { suit: s, rank: r };
    }
  }
  return deck;
})();

/** Canonical 169-hand key for an arbitrary card pair. */
function canonicalKey(c1: Card, c2: Card): string {
  const [hi, lo] = c1.rank >= c2.rank ? [c1, c2] : [c2, c1];
  const rankChars = '--23456789TJQKA';
  const r1 = rankChars[hi.rank];
  const r2 = rankChars[lo.rank];
  if (hi.rank === lo.rank) return r1 + r2;
  return r1 + r2 + (hi.suit === lo.suit ? 's' : 'o');
}

/* ------------------------------------------------------------------ */
/*  Building a HandCombo range from a percentile                      */
/* ------------------------------------------------------------------ */

/**
 * Enumerate all (52C2 - illegal) combos whose canonical key falls in the
 * top-`percentile` slice of the strength ordering, excluding any card already
 * visible (my hole + board).
 */
export function buildPercentileRange(
  percentile: number,
  excluded: ReadonlyArray<Card>,
): HandCombo[] {
  const keyCount = Math.max(1, Math.round(169 * percentile));
  const allowed = new Set(RANKED_HAND_KEYS.slice(0, keyCount));
  const excludedIds = new Uint8Array(52);
  for (const c of excluded) excludedIds[cardId(c)] = 1;

  const combos: HandCombo[] = [];
  for (let i = 0; i < 52; i++) {
    if (excludedIds[i]) continue;
    const c1 = DECK_BY_ID[i];
    for (let j = i + 1; j < 52; j++) {
      if (excludedIds[j]) continue;
      const c2 = DECK_BY_ID[j];
      if (allowed.has(canonicalKey(c1, c2))) {
        combos.push([c1, c2]);
      }
    }
  }
  return combos;
}

/* ------------------------------------------------------------------ */
/*  Range-aware equity                                                */
/* ------------------------------------------------------------------ */

export interface EquityVsRangeOptions {
  iterations?: number;
  rng?: () => number;
}

export function equityVsPercentile(
  myHand: HandCombo,
  board: Card[],
  percentile: number,
  options: EquityVsRangeOptions = {},
): number {
  const excluded: Card[] = [myHand[0], myHand[1], ...board];
  const range = buildPercentileRange(percentile, excluded);
  if (range.length === 0) {
    // Degenerate — fall back to random opponent to avoid returning 0.5 noise.
    return calculateEquity(myHand, board, [], options);
  }
  return calculateEquity(myHand, board, range, options);
}

/**
 * Convenience: given an inference object (from inferOpponentRange) plus my
 * hand and the current board, return equity.
 */
export function equityVsInferredRange(
  myHand: HandCombo,
  board: Card[],
  inference: OpponentRangeInference,
  options: EquityVsRangeOptions = {},
): number {
  return equityVsPercentile(myHand, board, inference.percentile, options);
}

/* ------------------------------------------------------------------ */
/*  Pot-odds helper                                                   */
/* ------------------------------------------------------------------ */

export function potOddsRequired(pot: number, toCall: number): number {
  if (toCall <= 0) return 0;
  return toCall / (pot + toCall);
}

/** Re-export for convenience from the GTO barrel. */
export type { HandCombo };
export { calculateEquity };
