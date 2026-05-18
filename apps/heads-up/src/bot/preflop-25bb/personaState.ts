import type { SpecPersonaKey } from './types';

/**
 * Per-match persona state vector. Values are 0..1.
 *
 * Default priors per spec persona are defined below. During a match,
 * `bayesianPersonaUpdater` mutates these in response to events.
 *
 * NOT a Bayesian poker solver — just a soft-state layer that nudges the
 * persona to "feel" different over time. Range estimation and EV math are
 * explicitly out of scope.
 */
export interface PersonaState {
  /** 0 = passive, 1 = fully aggressive — boosts raise/bet, dampens fold. */
  aggression: number;
  /** 0 = fold-to-pressure, 1 = sticky caller. */
  callDown: number;
  /** 0 = risk-averse, 1 = ships it. Mostly biases all-in 25 weight. */
  riskTolerance: number;
  /** 0 = no slow-play, 1 = limp/check-trap heavy. */
  trapTendency: number;
  /** 0 = calm, 1 = tilted. Pushes toward aggression + reduces fold. */
  tiltLevel: number;
  /** 0 = uncertain, 1 = on a heater. Mild raise boost. */
  confidence: number;
}

/** Clamp every component to [0, 1]. */
export function clampState(s: PersonaState): PersonaState {
  const c = (v: number) => Math.max(0, Math.min(1, v));
  return {
    aggression: c(s.aggression),
    callDown: c(s.callDown),
    riskTolerance: c(s.riskTolerance),
    trapTendency: c(s.trapTendency),
    tiltLevel: c(s.tiltLevel),
    confidence: c(s.confidence),
  };
}

/**
 * Default priors per spec persona. These represent "how this persona feels
 * at the start of a match" — the persona modifier handles their *strategy*,
 * this layer handles their *mood*.
 */
export const PRIOR_STATE: Record<SpecPersonaKey, PersonaState> = {
  balanced_pro:     { aggression: 0.50, callDown: 0.50, riskTolerance: 0.50, trapTendency: 0.30, tiltLevel: 0.00, confidence: 0.60 },
  pressure_maniac:  { aggression: 0.85, callDown: 0.30, riskTolerance: 0.80, trapTendency: 0.10, tiltLevel: 0.10, confidence: 0.70 },
  sticky_caller:    { aggression: 0.30, callDown: 0.85, riskTolerance: 0.40, trapTendency: 0.20, tiltLevel: 0.00, confidence: 0.55 },
  tight_survivor:   { aggression: 0.25, callDown: 0.40, riskTolerance: 0.30, trapTendency: 0.20, tiltLevel: 0.00, confidence: 0.45 },
  trap_master:      { aggression: 0.50, callDown: 0.55, riskTolerance: 0.55, trapTendency: 0.80, tiltLevel: 0.00, confidence: 0.55 },
  emotional_swinger:{ aggression: 0.55, callDown: 0.50, riskTolerance: 0.55, trapTendency: 0.30, tiltLevel: 0.20, confidence: 0.50 },
};

/**
 * Per-persona sensitivity to events — multiplier applied on top of each
 * event's base delta. emotional_swinger is the most reactive by design;
 * tight_survivor/sticky_caller are the least reactive.
 */
export const EVENT_SENSITIVITY: Record<SpecPersonaKey, number> = {
  balanced_pro:      0.70,
  pressure_maniac:   0.90,
  sticky_caller:     0.50,
  tight_survivor:    0.40,
  trap_master:       0.60,
  emotional_swinger: 1.50,
};

/** Construct a fresh state vector for a persona at match start. */
export function initialStateFor(persona: SpecPersonaKey): PersonaState {
  return { ...PRIOR_STATE[persona] };
}
