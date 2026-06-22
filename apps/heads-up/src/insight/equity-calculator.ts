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
 * Sequential (Bayesian-flavored) opponent-range inference from the FULL action
 * history — not just preflop. The opponent's range is updated street by street:
 *
 *  Prior (preflop):
 *   - 4bet+ → top 5%   · single raise → top 15%   · call → top 60%   · check → any
 *
 *  Postflop update (per street the opponent acts):
 *   - bet/raise (barrel) → range concentrates toward value/polar → ×0.6 (narrower)
 *   - call               → continues but capped/passive            → ×0.9
 *   - check              → range unchanged (uncapped)
 *
 * This is why a hand that called preflop then barreled flop+turn is treated as a
 * far stronger range on the river than its preflop "top 60%" — the review now
 * reflects the betting history instead of judging each street in isolation.
 */
export function inferOpponentRange(
  opponentActions: ReadonlyArray<Pick<ActionRecord, 'action' | 'street'>>,
): OpponentRangeInference {
  // --- Prior from preflop.
  const preflop = opponentActions.filter((a) => a.street === 'preflop');
  const pfRaises = preflop.filter((a) => a.action === 'raise').length;
  const pfCalls = preflop.filter((a) => a.action === 'call').length;

  let percentile: number;
  let prior: string;
  if (pfRaises >= 2) {
    percentile = 0.05;
    prior = '4벳';
  } else if (pfRaises === 1) {
    percentile = 0.15;
    prior = '레이즈';
  } else if (pfCalls >= 1) {
    percentile = 0.6;
    prior = '콜';
  } else {
    percentile = 1;
    prior = '';
  }

  // --- Bayesian update: fold each postflop action into the range.
  const postflop = opponentActions.filter((a) => a.street !== 'preflop');
  let barrels = 0;
  for (const a of postflop) {
    if (a.action === 'bet' || a.action === 'raise') {
      barrels += 1;
      percentile *= 0.6;
    } else if (a.action === 'call') {
      percentile *= 0.9;
    }
    // check → unchanged
  }
  percentile = Math.max(0.02, Math.min(1, percentile));

  // --- Label communicates the inferred line so the review shows history is used.
  const topPct = Math.round(percentile * 100);
  let label: string;
  if (!prior && barrels === 0) {
    label = `임의 핸드 (top ${topPct}%)`;
  } else {
    const base = prior || '체크';
    const aggro =
      barrels >= 2 ? ` 후 ${barrels}스트리트 공격` : barrels === 1 ? ' 후 공격' : '';
    label = `${base}${aggro} 레인지 (top ${topPct}%)`;
  }

  return { percentile, label };
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
