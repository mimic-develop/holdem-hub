/**
 * Heads-up 100bb GTO-ish preflop charts.
 *
 * Source: approximated from public HU solver outputs (GTO Wizard free samples,
 * UpSwing HU charts, 2p2 consensus ranges). Not a literal solver dump — the
 * exact mix percentages are smoothed into plausible ranges. Sufficient for a
 * practice-mode evaluator.
 *
 * ALL action frequencies within a single {fold, call, raise} entry sum to 1.
 */

export interface ActionFrequency {
  /** Probability the GTO strategy folds. Range [0, 1]. */
  fold: number;
  /** Probability of call / check (call & check are equivalent preflop). */
  call: number;
  /** Probability of raise. */
  raise: number;
  /**
   * Recommended raise-to target in big blinds. Only present when `raise > 0`.
   * Used by the evaluator to score sizing errors.
   */
  raiseSize?: number;
}

export type PreflopSituation =
  | 'SB_FIRST_ACTION'
  | 'BB_VS_LIMP'
  | 'BB_VS_RAISE'
  | 'SB_VS_3BET'
  | 'BB_VS_4BET'
  | 'SB_VS_5BET';

export type PreflopChart = Readonly<Record<string, ActionFrequency>>;

/* ------------------------------------------------------------------ */
/*  Hand-key enumeration                                              */
/* ------------------------------------------------------------------ */

const RANK_CHARS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

/** Yields all 169 canonical hand keys (13 pairs + 78 suited + 78 offsuit). */
export function* allHandKeys(): Iterable<string> {
  for (let hi = 14; hi >= 2; hi--) {
    for (let lo = hi; lo >= 2; lo--) {
      const c1 = RANK_CHARS[hi];
      const c2 = RANK_CHARS[lo];
      if (hi === lo) {
        yield c1 + c2;
      } else {
        yield c1 + c2 + 's';
        yield c1 + c2 + 'o';
      }
    }
  }
}

/** Parses a hand key back into rank-ranks & suitedness. */
export function parseHandKey(key: string): {
  hi: number;
  lo: number;
  suited: boolean;
  isPair: boolean;
} {
  const hi = charToRank(key[0]);
  const lo = charToRank(key[1]);
  const isPair = key.length === 2;
  const suited = !isPair && key[2] === 's';
  return { hi, lo, suited, isPair };
}

function charToRank(c: string): number {
  const r = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    T: 10, J: 11, Q: 12, K: 13, A: 14,
  }[c];
  if (r === undefined) throw new Error(`Invalid rank char: "${c}"`);
  return r;
}

/* ------------------------------------------------------------------ */
/*  Frequency helpers                                                 */
/* ------------------------------------------------------------------ */

function mkFreq(
  fold: number,
  call: number,
  raise: number,
  raiseSize?: number,
): ActionFrequency {
  const out: ActionFrequency = { fold, call, raise };
  if (raise > 0 && raiseSize !== undefined) out.raiseSize = raiseSize;
  return out;
}

const FOLD: ActionFrequency = mkFreq(1, 0, 0);

/* ------------------------------------------------------------------ */
/*  SB_FIRST_ACTION — 169-hand coverage                               */
/*                                                                    */
/*  HU 100bb, 2.5x open. Published solvers open ~80-90% here; we      */
/*  approximate with a tier system. Overall open rate ~65-75%         */
/*  (conservative but within defensible GTO range).                   */
/* ------------------------------------------------------------------ */

const SB_OPEN_SIZE = 2.5;

function sbOpenFreq(hi: number, lo: number, suited: boolean): ActionFrequency {
  const S = SB_OPEN_SIZE;

  // Pairs: all raise 100%.
  if (hi === lo) return mkFreq(0, 0, 1, S);

  if (suited) {
    // Any suited hand with a T+ kicker: 100% raise.
    if (hi >= 10) return mkFreq(0, 0, 1, S);
    // 9xs: 100% raise (wide suited coverage is cheap).
    if (hi === 9) return mkFreq(0, 0, 1, S);
    if (hi === 8) {
      if (lo >= 5) return mkFreq(0, 0, 1, S); // 87s, 86s, 85s
      return mkFreq(0.3, 0, 0.7, S); // 84s, 83s, 82s mixed
    }
    if (hi === 7) {
      if (lo >= 4) return mkFreq(0, 0, 1, S); // 76s, 75s, 74s
      return mkFreq(0.4, 0, 0.6, S); // 73s, 72s mixed
    }
    if (hi === 6) {
      if (lo >= 3) return mkFreq(0, 0, 1, S); // 65s, 64s, 63s
      return mkFreq(0.5, 0, 0.5, S); // 62s
    }
    if (hi === 5) {
      if (lo >= 3) return mkFreq(0, 0, 1, S); // 54s, 53s
      return mkFreq(0.6, 0, 0.4, S); // 52s
    }
    if (hi === 4) return mkFreq(0.4, 0, 0.6, S); // 43s, 42s
    return mkFreq(0.6, 0, 0.4, S); // 32s
  }

  // Offsuit: narrower.
  if (hi === 14) {
    if (lo >= 5) return mkFreq(0, 0, 1, S); // AKo..A5o
    return mkFreq(0.2, 0, 0.8, S); // A4o..A2o
  }
  if (hi === 13) {
    if (lo >= 7) return mkFreq(0, 0, 1, S); // KQo..K7o
    if (lo >= 4) return mkFreq(0.2, 0, 0.8, S); // K6o..K4o
    return mkFreq(0.55, 0, 0.45, S); // K3o, K2o
  }
  if (hi === 12) {
    if (lo >= 9) return mkFreq(0, 0, 1, S); // QJo, QTo, Q9o
    if (lo >= 6) return mkFreq(0.3, 0, 0.7, S); // Q8o, Q7o, Q6o
    return mkFreq(0.65, 0, 0.35, S); // Q5o..Q2o
  }
  if (hi === 11) {
    if (lo >= 9) return mkFreq(0, 0, 1, S); // JTo, J9o
    if (lo >= 6) return mkFreq(0.4, 0, 0.6, S); // J8o, J7o, J6o
    return mkFreq(0.75, 0, 0.25, S); // J5o..J2o
  }
  if (hi === 10) {
    if (lo >= 7) return mkFreq(0, 0, 1, S); // T9o, T8o, T7o
    if (lo >= 5) return mkFreq(0.5, 0, 0.5, S); // T6o, T5o
    return mkFreq(0.8, 0, 0.2, S); // T4o..T2o
  }
  if (hi === 9) {
    if (lo >= 7) return mkFreq(0.2, 0, 0.8, S); // 98o, 97o
    if (lo === 6) return mkFreq(0.7, 0, 0.3, S); // 96o
    return FOLD; // 95o..92o (low-kicker nine-high trash)
  }
  if (hi === 8) {
    if (lo === 7) return mkFreq(0.5, 0, 0.5, S); // 87o
    if (lo === 6) return mkFreq(0.8, 0, 0.2, S); // 86o
    return FOLD; // 85o..82o
  }
  if (hi === 7) {
    if (lo === 6) return mkFreq(0.6, 0, 0.4, S); // 76o
    return FOLD;
  }
  // 6xo and below: fold.
  return FOLD;
}

/* ------------------------------------------------------------------ */
/*  BB_VS_LIMP — SB limped; BB can check or iso-raise                */
/* ------------------------------------------------------------------ */

const BB_ISO_SIZE = 3.5;

function bbVsLimpFreq(hi: number, lo: number, suited: boolean): ActionFrequency {
  const S = BB_ISO_SIZE;

  if (hi === lo) {
    if (hi >= 10) return mkFreq(0, 0.15, 0.85, S); // TT+
    if (hi >= 7) return mkFreq(0, 0.35, 0.65, S); // 77-99
    if (hi >= 4) return mkFreq(0, 0.6, 0.4, S); // 44-66
    return mkFreq(0, 0.75, 0.25, S); // 22, 33
  }

  // Premium/strong → frequent iso-raise.
  if (hi === 14) {
    if (suited) {
      if (lo >= 10) return mkFreq(0, 0.1, 0.9, S); // AK-AT suited
      return mkFreq(0, 0.5, 0.5, S); // A9-A2 suited (mix)
    }
    if (lo >= 11) return mkFreq(0, 0.2, 0.8, S); // AKo, AQo, AJo
    if (lo >= 8) return mkFreq(0, 0.55, 0.45, S); // ATo, A9o, A8o
    return mkFreq(0, 0.85, 0.15, S);
  }

  if (hi === 13) {
    if (suited) {
      if (lo >= 10) return mkFreq(0, 0.2, 0.8, S); // KQ/KJ/KT suited
      return mkFreq(0, 0.6, 0.4, S);
    }
    if (lo >= 11) return mkFreq(0, 0.4, 0.6, S); // KQo, KJo
    if (lo >= 9) return mkFreq(0, 0.7, 0.3, S);
    return mkFreq(0, 0.95, 0.05, S);
  }

  if (hi === 12) {
    if (suited) {
      if (lo >= 9) return mkFreq(0, 0.45, 0.55, S); // QJ/QT/Q9 suited
      return mkFreq(0, 0.8, 0.2, S);
    }
    if (lo >= 10) return mkFreq(0, 0.6, 0.4, S);
    return mkFreq(0, 0.95, 0.05, S);
  }

  if (hi === 11 && suited && lo >= 8) return mkFreq(0, 0.7, 0.3, S); // JT, J9, J8 suited

  // Suited connectors & one-gappers: mostly check (see flop for free).
  if (suited && hi - lo === 1) return mkFreq(0, 0.85, 0.15, S);

  // Default: BB checks (free option — never fold here).
  return mkFreq(0, 1, 0);
}

/* ------------------------------------------------------------------ */
/*  BB_VS_RAISE — SB open-raised; BB folds / calls / 3bets           */
/* ------------------------------------------------------------------ */

const BB_3BET_SIZE = 10;

function bbVsRaiseFreq(hi: number, lo: number, suited: boolean): ActionFrequency {
  const S = BB_3BET_SIZE;

  if (hi === lo) {
    if (hi >= 12) return mkFreq(0, 0.35, 0.65, S); // QQ+: 3bet-heavy
    if (hi >= 10) return mkFreq(0, 0.6, 0.4, S); // TT-JJ mix
    if (hi >= 5) return mkFreq(0.05, 0.85, 0.1, S); // 55-99 mostly call
    return mkFreq(0.15, 0.75, 0.1, S); // 22-44
  }

  if (hi === 14) {
    if (suited) {
      if (lo >= 12) return mkFreq(0, 0.4, 0.6, S); // AKs/AQs
      if (lo >= 10) return mkFreq(0, 0.75, 0.25, S); // AJs, ATs
      if (lo >= 5) return mkFreq(0, 0.8, 0.2, S); // A9s..A5s
      return mkFreq(0, 0.75, 0.25, S); // A4s..A2s
    }
    if (lo === 13) return mkFreq(0, 0.4, 0.6, S); // AKo
    if (lo >= 11) return mkFreq(0, 0.75, 0.25, S); // AQo, AJo
    if (lo >= 8) return mkFreq(0.15, 0.75, 0.1, S); // ATo..A8o
    if (lo >= 5) return mkFreq(0.45, 0.5, 0.05, S);
    return mkFreq(0.65, 0.35, 0, S);
  }

  if (hi === 13) {
    if (suited) {
      if (lo >= 11) return mkFreq(0, 0.7, 0.3, S); // KQs, KJs
      if (lo >= 9) return mkFreq(0.05, 0.85, 0.1, S); // KTs, K9s
      return mkFreq(0.25, 0.7, 0.05, S);
    }
    if (lo >= 11) return mkFreq(0.05, 0.85, 0.1, S); // KQo, KJo
    if (lo >= 9) return mkFreq(0.35, 0.65, 0, S);
    return mkFreq(0.7, 0.3, 0, S);
  }

  if (hi === 12) {
    if (suited) {
      if (lo >= 9) return mkFreq(0.05, 0.85, 0.1, S); // QJs, QTs, Q9s
      return mkFreq(0.35, 0.65, 0, S);
    }
    if (lo >= 10) return mkFreq(0.2, 0.8, 0, S);
    return mkFreq(0.8, 0.2, 0, S);
  }

  if (hi === 11) {
    if (suited) {
      if (lo >= 8) return mkFreq(0.1, 0.85, 0.05, S); // JTs, J9s, J8s
      return mkFreq(0.5, 0.5, 0, S);
    }
    if (lo >= 9) return mkFreq(0.4, 0.6, 0, S);
    return mkFreq(0.9, 0.1, 0, S);
  }

  if (hi === 10) {
    if (suited) {
      if (lo >= 7) return mkFreq(0.2, 0.8, 0, S);
      return mkFreq(0.65, 0.35, 0, S);
    }
    if (lo >= 8) return mkFreq(0.55, 0.45, 0, S);
    return mkFreq(0.95, 0.05, 0, S);
  }

  if (suited && hi - lo === 1 && hi >= 6) {
    return mkFreq(0.3, 0.65, 0.05, S); // 98s, 87s, 76s, 65s
  }
  if (suited && hi - lo <= 2 && hi >= 6) {
    return mkFreq(0.5, 0.5, 0, S);
  }

  // Default: fold.
  return FOLD;
}

/* ------------------------------------------------------------------ */
/*  SB_VS_3BET — BB 3bet; SB folds / calls / 4bets                   */
/* ------------------------------------------------------------------ */

const SB_4BET_SIZE = 24;

function sbVs3BetFreq(hi: number, lo: number, suited: boolean): ActionFrequency {
  const S = SB_4BET_SIZE;

  if (hi === lo) {
    if (hi >= 13) return mkFreq(0, 0.15, 0.85, S); // KK+: 4bet
    if (hi === 12) return mkFreq(0, 0.5, 0.5, S); // QQ: mix
    if (hi >= 10) return mkFreq(0.1, 0.7, 0.2, S); // TT-JJ mostly call
    if (hi >= 5) return mkFreq(0.55, 0.45, 0, S);
    return mkFreq(0.75, 0.25, 0, S);
  }

  if (hi === 14) {
    if (suited) {
      if (lo === 13) return mkFreq(0, 0.3, 0.7, S); // AKs: 4bet-heavy
      if (lo >= 11) return mkFreq(0, 0.7, 0.3, S); // AQs, AJs
      if (lo >= 9) return mkFreq(0.15, 0.8, 0.05, S);
      if (lo >= 2) return mkFreq(0.5, 0.4, 0.1, S); // wheel/suited-bluff 4bet
    }
    if (lo === 13) return mkFreq(0.05, 0.4, 0.55, S); // AKo
    if (lo === 12) return mkFreq(0.2, 0.7, 0.1, S); // AQo
    if (lo >= 10) return mkFreq(0.55, 0.45, 0, S);
    return mkFreq(0.85, 0.15, 0, S);
  }

  if (hi === 13 && suited) {
    if (lo >= 11) return mkFreq(0.2, 0.75, 0.05, S);
    if (lo >= 9) return mkFreq(0.5, 0.5, 0, S);
    return mkFreq(0.85, 0.15, 0, S);
  }

  if (hi === 13 && !suited) {
    if (lo === 12) return mkFreq(0.35, 0.65, 0, S);
    if (lo === 11) return mkFreq(0.65, 0.35, 0, S);
    return FOLD;
  }

  if (hi === 12 && suited) {
    if (lo >= 10) return mkFreq(0.3, 0.7, 0, S); // QJs, QTs
    return mkFreq(0.8, 0.2, 0, S);
  }

  if (suited && hi - lo === 1 && hi >= 6) {
    return mkFreq(0.6, 0.4, 0, S);
  }

  return FOLD;
}

/* ------------------------------------------------------------------ */
/*  BB_VS_4BET — SB 4bet; BB folds / calls / 5bets                   */
/* ------------------------------------------------------------------ */

const BB_5BET_SIZE = 100; // usually shove (all-in)

function bbVs4BetFreq(hi: number, lo: number, suited: boolean): ActionFrequency {
  const S = BB_5BET_SIZE;

  if (hi === lo) {
    if (hi >= 13) return mkFreq(0, 0.2, 0.8, S); // KK+: shove
    if (hi === 12) return mkFreq(0.1, 0.55, 0.35, S); // QQ mix
    if (hi === 11) return mkFreq(0.4, 0.55, 0.05, S);
    if (hi === 10) return mkFreq(0.6, 0.4, 0, S);
    return FOLD;
  }

  if (hi === 14 && lo === 13) {
    // AK
    if (suited) return mkFreq(0, 0.35, 0.65, S);
    return mkFreq(0.1, 0.5, 0.4, S);
  }
  if (hi === 14 && lo === 12) {
    if (suited) return mkFreq(0.3, 0.65, 0.05, S);
    return mkFreq(0.7, 0.3, 0, S);
  }
  if (hi === 14 && suited && lo >= 2 && lo <= 5) {
    // Wheel Ax suited as occasional bluff-5bet jam.
    return mkFreq(0.6, 0.3, 0.1, S);
  }

  return FOLD;
}

/* ------------------------------------------------------------------ */
/*  SB_VS_5BET — BB shoved all-in; SB calls or folds                 */
/* ------------------------------------------------------------------ */

function sbVs5BetFreq(hi: number, lo: number, suited: boolean): ActionFrequency {
  // All-in facing — no further raise. Treat as call vs fold only.
  if (hi === lo) {
    if (hi >= 13) return mkFreq(0, 1, 0); // KK+: snap-call
    if (hi === 12) return mkFreq(0.25, 0.75, 0); // QQ
    if (hi === 11) return mkFreq(0.7, 0.3, 0); // JJ
    return mkFreq(0.95, 0.05, 0);
  }
  if (hi === 14 && lo === 13) {
    return suited ? mkFreq(0, 1, 0) : mkFreq(0.15, 0.85, 0); // AK
  }
  if (hi === 14 && lo === 12 && suited) return mkFreq(0.6, 0.4, 0); // AQs
  return FOLD;
}

/* ------------------------------------------------------------------ */
/*  Build the six charts                                              */
/* ------------------------------------------------------------------ */

function buildChart(
  compute: (hi: number, lo: number, suited: boolean) => ActionFrequency,
): PreflopChart {
  const chart: Record<string, ActionFrequency> = {};
  for (const key of allHandKeys()) {
    const { hi, lo, suited, isPair } = parseHandKey(key);
    const freq = isPair ? compute(hi, hi, false) : compute(hi, lo, suited);
    // Freeze each entry so downstream consumers can't accidentally mutate a
    // chart row (e.g. through `getFreq(...).raise = 0`).
    chart[key] = Object.freeze(freq);
  }
  return Object.freeze(chart);
}

export const HU_100BB_CHARTS: Readonly<Record<PreflopSituation, PreflopChart>> =
  Object.freeze({
    SB_FIRST_ACTION: buildChart(sbOpenFreq),
    BB_VS_LIMP: buildChart(bbVsLimpFreq),
    BB_VS_RAISE: buildChart(bbVsRaiseFreq),
    SB_VS_3BET: buildChart(sbVs3BetFreq),
    BB_VS_4BET: buildChart(bbVs4BetFreq),
    SB_VS_5BET: buildChart(sbVs5BetFreq),
  });

/**
 * Look up the recommended action distribution for a (situation, hand) pair.
 * Returns a fold-default when a hand is missing from a chart (shouldn't happen
 * for SB_FIRST_ACTION but other charts may be sparse).
 */
export function getFreq(
  situation: PreflopSituation,
  handKey: string,
): ActionFrequency {
  return HU_100BB_CHARTS[situation][handKey] ?? FOLD;
}
