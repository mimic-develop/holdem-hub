import type { PersonaState } from './personaState';
import type { ActionFrequencies, SpecAction } from './types';

/**
 * Translate a persona-state vector into a multiplicative modifier dict that
 * the engine applies AFTER the persona modifier and BEFORE hand-class
 * correction.
 *
 * Hard constraints (verified by tests):
 *   - never invents new actions (baseline 0 stays 0 — handled by caller, but
 *     we also guard inside applyPersonaStateModifier just in case)
 *   - returns multipliers, not absolute frequencies
 *   - state at exactly priors (no events fired) → all multipliers ≈ 1.0
 *
 * Each state axis biases a *subset* of actions:
 *   - aggression  → raise_* & all_in_25 up,  fold & limp & check down
 *   - callDown    → call up,                 fold & raise down
 *   - tiltLevel   → all_in_25 up sharply,    fold down
 *   - trapTendency→ limp & check up,         raise down (slight)
 *   - riskTolerance→ all_in_25 up
 *   - confidence  → raise_* up gently
 *
 * Tunable in one place — see SCALE.
 */

const SCALE = {
  aggression: { raise: 0.45, allIn: 0.55, fold: 0.40, limp: 0.30, check: 0.15 },
  callDown:   { call: 0.50, fold: 0.40, raise: 0.25 },
  tilt:       { allIn: 0.80, fold: 0.50 },
  trap:       { limp: 0.60, check: 0.35, raise: 0.20 },
  risk:       { allIn: 0.45 },
  confidence: { raise: 0.20 },
};

const RAISE_ACTIONS: SpecAction[] = ['raise_2', 'raise_3', 'raise_5', 'raise_7', 'raise_7_5', 'raise_8'];

/**
 * Build a multiplier dict from a persona state. Each multiplier ≈ 1 + signed
 * deviation from 0.5 (or 0 for tilt) × scale. All multipliers are clamped to
 * [0.2, 2.5] so the state alone can't fully zero or quintuple an action.
 */
export function buildStateModifier(state: PersonaState): Partial<Record<SpecAction, number>> {
  // Center every axis on its neutral value so a "prior" state returns 1.0.
  const aggOff = (state.aggression - 0.5) * 2;   // [-1, 1]
  const callOff = (state.callDown - 0.5) * 2;    // [-1, 1]
  const tilt = state.tiltLevel;                  // [0, 1]
  const trap = (state.trapTendency - 0.5) * 2;   // [-1, 1]
  const risk = (state.riskTolerance - 0.5) * 2;  // [-1, 1]
  const conf = (state.confidence - 0.5) * 2;     // [-1, 1]

  const out: Partial<Record<SpecAction, number>> = {};

  // raise actions
  for (const a of RAISE_ACTIONS) {
    let m = 1
      + aggOff  * SCALE.aggression.raise
      - callOff * SCALE.callDown.raise
      - trap    * SCALE.trap.raise
      + conf    * SCALE.confidence.raise;
    out[a] = clampMult(m);
  }

  // all_in_25 — aggression + tilt + risk pile on
  out.all_in_25 = clampMult(
    1
    + aggOff * SCALE.aggression.allIn
    + tilt   * SCALE.tilt.allIn
    + risk   * SCALE.risk.allIn,
  );

  // fold
  out.fold = clampMult(
    1
    - aggOff * SCALE.aggression.fold
    - callOff * SCALE.callDown.fold
    - tilt    * SCALE.tilt.fold,
  );

  // call
  out.call = clampMult(
    1
    + callOff * SCALE.callDown.call,
  );

  // limp & check
  out.limp = clampMult(
    1
    - aggOff * SCALE.aggression.limp
    + trap   * SCALE.trap.limp,
  );
  out.check = clampMult(
    1
    - aggOff * SCALE.aggression.check
    + trap   * SCALE.trap.check,
  );

  return out;
}

/**
 * Apply the state modifier dict to a frequency dict. Mirrors the persona
 * modifier function (zero-baseline → zero, multiplicative otherwise).
 */
export function applyPersonaStateModifier(
  freqs: ActionFrequencies,
  state: PersonaState,
): ActionFrequencies {
  const mult = buildStateModifier(state);
  const out: ActionFrequencies = {};
  for (const action of Object.keys(freqs) as SpecAction[]) {
    const freq = freqs[action] ?? 0;
    if (freq <= 0) {
      out[action] = 0;
      continue;
    }
    const m = mult[action] ?? 1;
    out[action] = freq * m;
  }
  return out;
}

function clampMult(m: number): number {
  if (!Number.isFinite(m)) return 1;
  return Math.max(0.2, Math.min(2.5, m));
}
