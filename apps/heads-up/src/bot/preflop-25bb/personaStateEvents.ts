/**
 * Persona-state events — lightweight signals the bot observes during a match
 * that shift its persona-state vector slightly. NOT opponent range / EV
 * estimation; just an "I noticed X, I feel Y about it" loop.
 */

export type PersonaStateEventType =
  | 'hero_folded_to_ai_raise'
  | 'hero_called_ai_raise'
  | 'hero_3bet_ai_open'
  | 'ai_won_big_pot'
  | 'ai_lost_big_pot'
  | 'ai_bluff_got_called'
  | 'ai_value_got_paid'
  | 'hero_folded_multiple_times'
  | 'hero_called_multiple_times'
  | 'hero_raised_multiple_times';

export interface PersonaStateEvent {
  type: PersonaStateEventType;
  /** Optional magnitude hint (chips for pot events, count for streak events).
   *  Updater may scale deltas by `magnitude` when relevant, otherwise ignores. */
  magnitude?: number;
}
