import type { GameState, Position } from '../../types/game';
import type { NodeId } from './types';

export interface AdaptedHistory {
  positionToAct: Position;
  /** Action sequence encoded as `${POS}_${ACTION}` or `${POS}_${ACTION}_${BB}` tokens. */
  actionHistory: string[];
}

/**
 * Encode a single ActionRecord into the canonical token expected by the node
 * selector. Examples: "SB_LIMP", "BB_RAISE_3", "SB_ALL_IN_25", "SB_CHECK".
 *
 * Limp is detected when a SB call equals exactly 1 big blind worth of chips
 * (completing from 0.5bb to 1bb total). Raise amount is encoded in BB units
 * (Math.round) so a raise-to-50 with bb=20 becomes "RAISE_3" (50/20=2.5≈3 floor
 * gives 2; we use round to land on the conventional buckets used by the spec).
 */
function encodeAction(args: {
  position: Position;
  action: string;
  amountChips: number;
  bigBlind: number;
  isPreflopFirstCall: boolean;
  allInThreshold: number;
}): string {
  const { position, action, amountChips, bigBlind, isPreflopFirstCall, allInThreshold } = args;

  if (action === 'fold') return `${position}_FOLD`;
  if (action === 'check') return `${position}_CHECK`;

  // SB completing from blind for the first preflop turn → limp.
  if (action === 'call' && position === 'SB' && isPreflopFirstCall) {
    return `${position}_LIMP`;
  }
  if (action === 'call') return `${position}_CALL`;

  // raise / bet → bb-scaled bucket. Detect all-in 25 separately.
  if (amountChips >= allInThreshold) return `${position}_ALL_IN_25`;
  const bbAmount = amountChips / bigBlind;
  // Conventional buckets in the spec: 2, 3, 5, 7, 7.5, 8.
  // Use nearest bucket so a small offset (rounding chip totals) still maps.
  const buckets = [2, 3, 5, 7, 7.5, 8];
  let nearest = buckets[0];
  let bestDelta = Math.abs(bbAmount - nearest);
  for (const b of buckets) {
    const d = Math.abs(bbAmount - b);
    if (d < bestDelta) { bestDelta = d; nearest = b; }
  }
  // 7.5 → token "RAISE_7_5"
  const suffix = String(nearest).replace('.', '_');
  return `${position}_RAISE_${suffix}`;
}

/**
 * Walk the GameState's preflop action history and produce the encoded token
 * list plus positionToAct (the player whose turn it currently is).
 *
 * Returns null when the state isn't preflop, when no player is to act, or when
 * the bot's hand isn't a 25bb HU setup (effective stack significantly off).
 */
export function adaptHistory(state: GameState): AdaptedHistory | null {
  if (state.street !== 'preflop') return null;
  const toActPlayer = state.players.find((p) => p.id === state.toActId);
  if (!toActPlayer) return null;
  const positionToAct = toActPlayer.position;

  // 25bb gate — at least one live player should sit ≥ ~23bb effective at start
  // of the hand (stack + chips already committed). Loose so blinds posted don't
  // disqualify the hand. Beta: simply detect bb=20 setup.
  const bb = state.bigBlind;
  if (bb <= 0) return null;
  const effectiveBB =
    Math.min(...state.players.map((p) => (p.stack + p.currentBet) / bb));
  if (effectiveBB < 22 || effectiveBB > 30) return null;

  // All-in threshold ≈ 23bb worth of chips for the ALL_IN_25 token detection.
  const allInThreshold = bb * 23;

  const tokens: string[] = [];
  // SB acts first preflop in HU. Track whether SB has acted yet this street;
  // its first 'call' there = limp.
  const sbId = state.players.find((p) => p.position === 'SB')?.id;
  let sbHasActedPreflop = false;
  for (const rec of state.history) {
    if (rec.street !== 'preflop') continue;
    const actor = state.players.find((p) => p.id === rec.playerId);
    if (!actor) continue;
    const isPreflopFirstCall = actor.id === sbId && !sbHasActedPreflop;
    tokens.push(
      encodeAction({
        position: actor.position,
        action: rec.action,
        amountChips: rec.amount,
        bigBlind: bb,
        isPreflopFirstCall,
        allInThreshold,
      }),
    );
    if (actor.id === sbId) sbHasActedPreflop = true;
  }

  return { positionToAct, actionHistory: tokens };
}

/**
 * Pure helper exported for the node selector tests — joins history tokens into
 * the underscore-separated key used by getPreflopNodeId.
 */
export function joinHistoryKey(tokens: string[]): string {
  // Strip the position prefix on every token because the spec keys use
  // "SB_LIMP_BB_RAISE_3" (position is part of each segment already).
  return tokens.join('_');
}

/** Re-export for engine import convenience. */
export type { NodeId };
