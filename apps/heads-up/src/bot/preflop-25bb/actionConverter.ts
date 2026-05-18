import { getLegalActions } from '../../engine/game-engine';
import type { GameState, PlayerAction } from '../../types/game';
import type { SpecAction } from './types';

/**
 * Convert a sampled spec action (e.g. "raise_3" = raise to 3bb total) into the
 * concrete `{action, amount}` shape that engine.applyAction expects.
 *
 * Notes:
 *  - `amount` in engine.applyAction is the raise-to *total* in chips.
 *  - SB `limp` translates to a `call` for the missing 0.5bb (call amount).
 *  - `all_in_25` → max raise to the player's full chip commitment.
 *  - The engine clamps illegal amounts (min raise / max stack) defensively, so
 *    we trust it rather than re-validating here.
 *
 * Returns null when the requested spec action is illegal in the current state
 * (e.g. check while facing a bet) — caller should fall back to legacy logic.
 */
export interface ConvertedAction {
  action: PlayerAction;
  amount: number;
}

const RAISE_TO_BB: Partial<Record<SpecAction, number>> = {
  raise_2: 2,
  raise_3: 3,
  raise_5: 5,
  raise_7: 7,
  raise_7_5: 7.5,
  raise_8: 8,
};

export function convertSpecAction(
  spec: SpecAction,
  state: GameState,
  botId: string,
): ConvertedAction | null {
  const legal = getLegalActions(state, botId);
  const bb = state.bigBlind;

  switch (spec) {
    case 'fold':
      // Folding when free (canCheck) is converted to check by the engine; that's
      // still better than nothing — we keep returning fold and let the engine
      // coerce.
      return { action: 'fold', amount: 0 };

    case 'check':
      if (!legal.canCheck) return null;
      return { action: 'check', amount: 0 };

    case 'call':
      if (!legal.canCall) return null;
      return { action: 'call', amount: legal.callAmount };

    case 'limp':
      // Limp from SB = complete the small blind. legal.callAmount covers the
      // 0.5bb missing. If the spot is no longer a true limp (BB has raised),
      // signal illegal so caller falls back.
      if (!legal.canCall) return null;
      return { action: 'call', amount: legal.callAmount };

    case 'all_in_25':
      if (!legal.canRaise && !legal.canBet) return null;
      return { action: legal.canRaise ? 'raise' : 'bet', amount: legal.maxBetTotal };

    case 'raise_2':
    case 'raise_3':
    case 'raise_5':
    case 'raise_7':
    case 'raise_7_5':
    case 'raise_8': {
      if (!legal.canRaise && !legal.canBet) return null;
      const target = Math.round((RAISE_TO_BB[spec] ?? 0) * bb);
      // engine.applyAction clamps out-of-range targets to [minRaiseTotal,
      // maxBetTotal]. We log when that clamp will fire so callers can detect
      // unintended sizing drift (e.g. spec says 8bb but min raise = 9bb after
      // a prior 3bet, so engine snaps up to 9bb).
      if (target < legal.minRaiseTotal || target > legal.maxBetTotal) {
        const clamped = Math.max(legal.minRaiseTotal, Math.min(legal.maxBetTotal, target));
        // eslint-disable-next-line no-console
        console.warn(
          `[preflop-25bb] ${spec} clamp ` +
          `intendedAmount=${target} actualAmount=${clamped} ` +
          `min=${legal.minRaiseTotal} max=${legal.maxBetTotal}`,
        );
      }
      return { action: legal.canRaise ? 'raise' : 'bet', amount: target };
    }

    default:
      return null;
  }
}
