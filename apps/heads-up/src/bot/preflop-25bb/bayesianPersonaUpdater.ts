import type { SpecPersonaKey } from './types';
import { EVENT_SENSITIVITY, clampState, type PersonaState } from './personaState';
import type { PersonaStateEvent, PersonaStateEventType } from './personaStateEvents';

/**
 * Bayesian-*inspired* (not actual Bayesian) persona-state updater.
 *
 * Each event has a baseline delta vector applied additively to the persona
 * state, scaled by per-persona sensitivity. Components are clamped to [0, 1]
 * after every event. We do NOT use likelihood ratios or update distributions
 * over opponent ranges — this is a single-vector mood loop, kept lightweight
 * on purpose.
 */

type StateDelta = Partial<PersonaState>;

/** Base deltas for each event. emotional_swinger receives a higher sensitivity
 *  multiplier (see EVENT_SENSITIVITY) so it overshoots these values; tight
 *  personas dampen them. */
const BASE_DELTAS: Record<PersonaStateEventType, StateDelta> = {
  hero_folded_to_ai_raise: {
    aggression: +0.05,
    confidence: +0.05,
  },
  hero_called_ai_raise: {
    aggression: -0.02,
    callDown:   +0.02,
  },
  hero_3bet_ai_open: {
    aggression: -0.05,
    tiltLevel:  +0.05,
    confidence: -0.03,
  },
  ai_won_big_pot: {
    confidence: +0.10,
    tiltLevel:  -0.10,
    aggression: +0.02,
  },
  ai_lost_big_pot: {
    confidence: -0.10,
    tiltLevel:  +0.15,
    aggression: -0.03,
  },
  ai_bluff_got_called: {
    aggression: -0.10,
    confidence: -0.05,
    tiltLevel:  +0.05,
  },
  ai_value_got_paid: {
    aggression: +0.05,
    confidence: +0.05,
  },
  hero_folded_multiple_times: {
    // Hero is exploitable → AI gets more bluffy.
    aggression: +0.10,
    confidence: +0.05,
  },
  hero_called_multiple_times: {
    // Hero is sticky → AI bluffs less, value-bets more cautiously.
    aggression: -0.05,
    callDown:   +0.05,
  },
  hero_raised_multiple_times: {
    // Hero is aggressive → AI tightens up & expects bigger sizes.
    aggression: -0.05,
    callDown:   +0.05,
    tiltLevel:  +0.03,
  },
};

/**
 * Apply a single event to the persona state and return the new state.
 * Pure function — does not mutate the input.
 *
 * Persona sensitivity scales every delta. tightSurvivor (0.4) barely shifts;
 * emotional_swinger (1.5) overshoots → reacts more strongly to losses, wins,
 * pressure, etc.
 */
export function applyEvent(
  state: PersonaState,
  event: PersonaStateEvent,
  persona: SpecPersonaKey,
): PersonaState {
  const sensitivity = EVENT_SENSITIVITY[persona];
  const delta = BASE_DELTAS[event.type];
  if (!delta) return state;

  const magnitudeScale = clampMagnitude(event.magnitude);

  const next: PersonaState = {
    aggression:    state.aggression    + (delta.aggression    ?? 0) * sensitivity * magnitudeScale,
    callDown:      state.callDown      + (delta.callDown      ?? 0) * sensitivity * magnitudeScale,
    riskTolerance: state.riskTolerance + (delta.riskTolerance ?? 0) * sensitivity * magnitudeScale,
    trapTendency:  state.trapTendency  + (delta.trapTendency  ?? 0) * sensitivity * magnitudeScale,
    tiltLevel:     state.tiltLevel     + (delta.tiltLevel     ?? 0) * sensitivity * magnitudeScale,
    confidence:    state.confidence    + (delta.confidence    ?? 0) * sensitivity * magnitudeScale,
  };
  return clampState(next);
}

/** Process a batch of events in order (e.g. all events emitted by one hand). */
export function applyEvents(
  state: PersonaState,
  events: PersonaStateEvent[],
  persona: SpecPersonaKey,
): PersonaState {
  let next = state;
  for (const e of events) next = applyEvent(next, e, persona);
  return next;
}

function clampMagnitude(m: number | undefined): number {
  // magnitude is optional — when absent we use 1.0 (the baseline scale).
  // When present, we clamp to [0.5, 2.0] so a single large event can't blow
  // the state vector out in one step.
  if (m === undefined || !Number.isFinite(m)) return 1;
  return Math.max(0.5, Math.min(2.0, m));
}
