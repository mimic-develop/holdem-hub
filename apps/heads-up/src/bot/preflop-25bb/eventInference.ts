import type { ActionLogEntry, CompletedHand, PlayerAction } from '../../types/game';
import type { PersonaStateEvent } from './personaStateEvents';

/**
 * Translate a completed hand into a small set of persona-state events.
 *
 * Single-hand inference (called from game-store.finalizeHand). The store may
 * call `inferStreakEvents` with the recent N-hand window separately to detect
 * "hero_*_multiple_times" patterns — those require cross-hand context.
 *
 * Heuristics here are intentionally light. We avoid range / EV math:
 *   - "big pot" = |myWinLoss| ≥ 10 BB
 *   - "hero folded to AI raise" = hand ended by hero fold AND last bot action
 *     prior was a raise/bet/all-in
 *   - "hero called AI raise" = hand reached postflop or showdown AND last
 *     preflop bot raise was answered by a hero call (not just hero limp)
 *   - "hero 3bet AI open" = preflop sequence contained {bot raise, hero raise}
 *     with bot acting first
 *   - bluff/value classification: simplified to AI aggression × showdown win.
 *     A bluff-got-called event fires when AI was last preflop/postflop raiser
 *     AND lost at showdown.
 */
export function inferEventsFromHand(hand: CompletedHand, botId: string): PersonaStateEvent[] {
  const events: PersonaStateEvent[] = [];
  const bigBlind = stableBigBlindFromHand(hand);
  const bigPotThreshold = 10 * bigBlind;

  // 1. Big pot win/loss
  if (Math.abs(hand.myWinLoss) >= bigPotThreshold) {
    if (hand.result === 'WIN') {
      events.push({ type: 'ai_won_big_pot', magnitude: hand.myWinLoss / bigPotThreshold });
    } else if (hand.result === 'LOSS') {
      events.push({ type: 'ai_lost_big_pot', magnitude: Math.abs(hand.myWinLoss) / bigPotThreshold });
    }
  }

  const aiLog = hand.actionLog.filter((e) => e.playerId === botId);
  const heroLog = hand.actionLog.filter((e) => e.playerId !== botId);
  const heroLast = heroLog[heroLog.length - 1];
  const aiAggressed = aiLog.some(isAggressive);

  // 2. Hero fold to AI aggression
  if (heroLast?.action === 'fold' && aiAggressed) {
    const lastAggressorBeforeFold = lastAggressorBefore(hand.actionLog, heroLast);
    if (lastAggressorBeforeFold === botId) {
      events.push({ type: 'hero_folded_to_ai_raise' });
    }
  }

  // 3. Hero call to AI raise preflop
  const preflopBotRaise = hand.actionLog.find(
    (e) => e.street === 'preflop' && e.playerId === botId && isAggressive(e),
  );
  if (preflopBotRaise) {
    const idx = hand.actionLog.indexOf(preflopBotRaise);
    const heroResponse = hand.actionLog
      .slice(idx + 1)
      .find((e) => e.playerId !== botId && e.street === 'preflop');
    if (heroResponse?.action === 'call') {
      events.push({ type: 'hero_called_ai_raise' });
    }
    if (heroResponse && isAggressive(heroResponse)) {
      events.push({ type: 'hero_3bet_ai_open' });
    }
  }

  // 4. Bluff got called vs value got paid (rough — uses showdown result only)
  if (hand.wentToShowdown && aiAggressed) {
    if (hand.result === 'LOSS') {
      events.push({ type: 'ai_bluff_got_called' });
    } else if (hand.result === 'WIN') {
      events.push({ type: 'ai_value_got_paid' });
    }
  }

  return events;
}

/**
 * Streak detector — scan the last N hands of history and emit
 * `hero_*_multiple_times` events when a pattern crosses threshold.
 * Caller (game-store) maintains the window and calls this once per finalizeHand.
 */
export function inferStreakEvents(
  recentHands: CompletedHand[],
  botId: string,
  window = 4,
  threshold = 3,
): PersonaStateEvent[] {
  const slice = recentHands.slice(-window);
  if (slice.length < threshold) return [];

  let folds = 0;
  let calls = 0;
  let raises = 0;
  for (const h of slice) {
    const heroLog = h.actionLog.filter((e) => e.playerId !== botId);
    if (heroLog.some((e) => e.action === 'fold')) folds++;
    if (heroLog.some((e) => e.action === 'call')) calls++;
    if (heroLog.some((e) => isAggressive(e))) raises++;
  }

  const events: PersonaStateEvent[] = [];
  if (folds >= threshold) events.push({ type: 'hero_folded_multiple_times' });
  if (calls >= threshold) events.push({ type: 'hero_called_multiple_times' });
  if (raises >= threshold) events.push({ type: 'hero_raised_multiple_times' });
  return events;
}

function isAggressive(e: ActionLogEntry): boolean {
  const a: PlayerAction = e.action;
  return a === 'bet' || a === 'raise';
}

function lastAggressorBefore(
  log: ActionLogEntry[],
  marker: ActionLogEntry,
): string | undefined {
  const idx = log.indexOf(marker);
  for (let i = idx - 1; i >= 0; i--) {
    if (isAggressive(log[i])) return log[i].playerId;
  }
  return undefined;
}

/**
 * Best-effort big-blind recovery. CompletedHand doesn't carry bb directly,
 * but the smallest non-zero amount in actionLog is reliably the SB→BB
 * complete-to-call, and pot snapshots scale linearly. Fallback = 20 (default
 * heads-up BB in this app).
 */
function stableBigBlindFromHand(hand: CompletedHand): number {
  // First preflop call from SB is exactly 0.5 BB (the complete to BB amount),
  // so we look for the smallest preflop call amount > 0.
  const candidates = hand.actionLog
    .filter((e) => e.street === 'preflop' && e.action === 'call' && e.amount > 0)
    .map((e) => e.amount * 2);
  if (candidates.length > 0) {
    return Math.min(...candidates);
  }
  return 20;
}
