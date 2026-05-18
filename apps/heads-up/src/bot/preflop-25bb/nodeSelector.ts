import type { Position } from '../../types/game';
import type { NodeId } from './types';

/**
 * Map the (positionToAct, joined-token-history) pair to one of the 12 named
 * preflop nodes. Returns null when the action sequence is not in the spec
 * (e.g. 4bet, non-standard raise size) — callers must then fall back to the
 * legacy preflop pipeline.
 *
 * Token format produced by historyAdapter is per-action e.g.
 * ["SB_LIMP", "BB_RAISE_3"]. We join with "_" and compare against the
 * canonical `previousAction` strings from the spec.
 */
export function getPreflopNodeId(
  positionToAct: Position,
  actionHistory: string[],
): NodeId | null {
  const h = actionHistory.join('_');

  if (positionToAct === 'SB' && h === '') return 'SB_FIRST_IN_25BB';
  if (positionToAct === 'BB' && h === 'SB_LIMP') return 'BB_VS_SB_LIMP_25BB';
  if (positionToAct === 'BB' && h === 'SB_RAISE_2') return 'BB_VS_SB_OPEN_2BB_25BB';

  if (positionToAct === 'SB' && h === 'SB_RAISE_2_BB_ALL_IN_25') return 'SB_VS_BB_JAM_AFTER_OPEN_2BB';
  if (positionToAct === 'SB' && h === 'SB_RAISE_2_BB_RAISE_5') return 'SB_VS_BB_3BET_5_AFTER_OPEN_2BB';
  if (positionToAct === 'SB' && h === 'SB_RAISE_2_BB_RAISE_7') return 'SB_VS_BB_3BET_7_AFTER_OPEN_2BB';
  if (positionToAct === 'SB' && h === 'SB_RAISE_2_BB_RAISE_8') return 'SB_VS_BB_3BET_8_AFTER_OPEN_2BB';

  if (positionToAct === 'SB' && h === 'SB_LIMP_BB_RAISE_3') return 'SB_VS_BB_ISO_3_AFTER_LIMP';
  if (positionToAct === 'SB' && h === 'SB_LIMP_BB_RAISE_7_5') return 'SB_VS_BB_ISO_7_5_AFTER_LIMP';
  if (positionToAct === 'SB' && h === 'SB_LIMP_BB_ALL_IN_25') return 'SB_VS_BB_JAM_AFTER_LIMP';

  if (positionToAct === 'BB' && h === 'SB_LIMP_BB_RAISE_3_SB_ALL_IN_25') return 'BB_VS_SB_LIMP_JAM_AFTER_ISO_3';
  if (positionToAct === 'BB' && h === 'SB_LIMP_BB_RAISE_7_SB_ALL_IN_25') return 'BB_VS_SB_LIMP_JAM_AFTER_ISO_7';

  return null;
}
