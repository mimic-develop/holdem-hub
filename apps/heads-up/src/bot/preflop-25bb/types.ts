/**
 * Shared types for the 25bb HU preflop decision engine (beta).
 *
 * This is an *aggregate baseline* engine — not a combo-level GTO solver.
 * It picks a preflop action by sampling a node's action-frequency distribution
 * after applying persona and hand-class adjustments.
 */

/** All action keys that may appear in the baseline JSON. Mirrors `actionTypes`. */
export type SpecAction =
  | 'fold'
  | 'call'
  | 'check'
  | 'limp'
  | 'raise_2'
  | 'raise_3'
  | 'raise_5'
  | 'raise_7'
  | 'raise_7_5'
  | 'raise_8'
  | 'all_in_25';

/** The 12 named preflop nodes defined in the baseline JSON. */
export type NodeId =
  | 'SB_FIRST_IN_25BB'
  | 'BB_VS_SB_LIMP_25BB'
  | 'BB_VS_SB_OPEN_2BB_25BB'
  | 'SB_VS_BB_JAM_AFTER_OPEN_2BB'
  | 'SB_VS_BB_3BET_5_AFTER_OPEN_2BB'
  | 'SB_VS_BB_3BET_7_AFTER_OPEN_2BB'
  | 'SB_VS_BB_3BET_8_AFTER_OPEN_2BB'
  | 'SB_VS_BB_ISO_3_AFTER_LIMP'
  | 'SB_VS_BB_ISO_7_5_AFTER_LIMP'
  | 'SB_VS_BB_JAM_AFTER_LIMP'
  | 'BB_VS_SB_LIMP_JAM_AFTER_ISO_3'
  | 'BB_VS_SB_LIMP_JAM_AFTER_ISO_7';

/** Persona keys defined in preflopPersonaModifiers.json. */
export type SpecPersonaKey =
  | 'balanced_pro'
  | 'pressure_maniac'
  | 'sticky_caller'
  | 'tight_survivor'
  | 'trap_master'
  | 'emotional_swinger';

/** Partial action → frequency dict. 0 ≤ freq ≤ 100 (or higher pre-normalize). */
export type ActionFrequencies = Partial<Record<SpecAction, number>>;

/** Hand-class tiers used by the lightweight correction layer. */
export type HandClass = 'premium' | 'strong' | 'playable' | 'trash';
