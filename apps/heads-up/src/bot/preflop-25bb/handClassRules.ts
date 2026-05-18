import type { HandClass, SpecAction } from './types';

/**
 * Lightweight hand-class correction layer — keeps the AI from making clearly
 * absurd actions (e.g. premium folds, trash jams) while preserving the
 * baseline distribution as much as possible.
 *
 * Translated from the spec JSON to TS for static import and easy tuning.
 */

export interface HandClassRule {
  /** Actions whose final frequency must remain > 0 (used for premium ≠ fold). */
  preventActions?: SpecAction[];
  /** Multiplicative boosts applied AFTER persona modifier, BEFORE normalize. */
  boostActions?: Partial<Record<SpecAction, number>>;
  /** Multiplicative reductions applied AFTER persona modifier, BEFORE normalize. */
  reduceActions?: Partial<Record<SpecAction, number>>;
}

export const HAND_CLASS_RULES: Record<HandClass, HandClassRule> = {
  premium: {
    // Hard zero — premium hands are forbidden from folding. preventActions is
    // applied LAST inside applyHandClassCorrection so subsequent normalization
    // cannot resurrect fold mass.
    preventActions: ['fold'],
    boostActions: {
      raise_2: 1.5,    // SB open / 3bet bucket — strongly prefer raise over limp
      raise_3: 1.4,
      raise_5: 1.4,
      raise_7: 1.4,
      raise_8: 1.4,
      all_in_25: 1.6,
      call: 1.15,
    },
    // Premium should not over-limp at SB_FIRST_IN — limp is a trap line.
    // Persona-aware exemption for trap_master happens in applyHandClassCorrection.
    reduceActions: {
      limp: 0.25,
      check: 0.85,
    },
  },
  strong: {
    boostActions: {
      call: 1.1,
      raise_2: 1.15,
      raise_3: 1.1,
      all_in_25: 1.15,
    },
  },
  playable: {
    boostActions: {
      call: 1.1,
      limp: 1.1,
      check: 1.05,
    },
  },
  trash: {
    boostActions: {
      fold: 1.4,
      check: 1.1,
    },
    // Hard cap on aggression — trash must not bluff-jam or large-bet often
    // even when baseline frequency exists. Stronger reductions than the spec
    // defaults; cumulative caps applied below in correction layer.
    reduceActions: {
      all_in_25: 0.15,
      raise_7_5: 0.25,
      raise_7:   0.30,
      raise_8:   0.30,
      raise_5:   0.45,
      raise_3:   0.60,
      raise_2:   0.80,
    },
  },
};

/** Absolute frequency cap (post-normalize, in % of 100) applied to trash hands
 *  for the *sum* of all aggressive lines (raise_*, all_in_25). Even if the
 *  per-action reduce factors were too gentle, this cap clamps total aggression. */
export const TRASH_AGGRESSION_CAP_PCT = 4;

