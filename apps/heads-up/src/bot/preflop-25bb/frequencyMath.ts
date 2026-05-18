import { HAND_CLASS_RULES, TRASH_AGGRESSION_CAP_PCT } from './handClassRules';
import type { ActionFrequencies, HandClass, SpecAction, SpecPersonaKey } from './types';

const AGGRESSIVE_ACTIONS: SpecAction[] = [
  'raise_2', 'raise_3', 'raise_5', 'raise_7', 'raise_7_5', 'raise_8', 'all_in_25',
];

/**
 * Multiplicative persona modifier applied to a baseline distribution. Zero
 * baseline frequencies are preserved as zero (spec constraint: persona may not
 * invent new actions).
 */
export function applyPersonaModifier(
  baseline: ActionFrequencies,
  globalModifiers: Partial<Record<SpecAction, number>>,
  nodeSpecificModifiers?: Partial<Record<SpecAction, number>>,
): ActionFrequencies {
  const out: ActionFrequencies = {};
  for (const action of Object.keys(baseline) as SpecAction[]) {
    const freq = baseline[action] ?? 0;
    if (freq <= 0) {
      out[action] = 0;
      continue;
    }
    const g = globalModifiers[action] ?? 1;
    const n = nodeSpecificModifiers?.[action] ?? 1;
    out[action] = freq * g * n;
  }
  return out;
}

/**
 * Hand-class correction layer.
 *
 * Order of operations (each step preserves zero-baseline as zero):
 *   1. boost  — multiplicative bump for class-appropriate actions
 *   2. reduce — multiplicative cut for class-inappropriate actions
 *   3. persona-aware exemptions (e.g. trap_master skips premium-limp cut)
 *   4. preventActions → hard zero (applied last so nothing resurrects it)
 *   5. trash absolute aggression cap (post-normalize-style soft cap on
 *      aggregate raise_* + all_in_25 mass)
 *
 * The `persona` parameter is optional because only premium × trap_master needs
 * special-case handling; everything else is class-uniform.
 */
export function applyHandClassCorrection(
  freqs: ActionFrequencies,
  handClass: HandClass,
  persona?: SpecPersonaKey,
): ActionFrequencies {
  const rule = HAND_CLASS_RULES[handClass];
  const out: ActionFrequencies = { ...freqs };

  if (rule.boostActions) {
    for (const [action, mult] of Object.entries(rule.boostActions) as [SpecAction, number][]) {
      const cur = out[action] ?? 0;
      if (cur > 0) out[action] = cur * mult;
    }
  }
  if (rule.reduceActions) {
    for (const [action, mult] of Object.entries(rule.reduceActions) as [SpecAction, number][]) {
      // Persona-aware exemption: trap_master keeps the premium-limp option
      // intact so its trap identity still surfaces with monsters. Other personas
      // (incl. tight_survivor / NIT) consume the limp/check reduction.
      if (handClass === 'premium' && persona === 'trap_master' && (action === 'limp' || action === 'check')) {
        continue;
      }
      const cur = out[action] ?? 0;
      if (cur > 0) out[action] = cur * mult;
    }
  }
  if (rule.preventActions) {
    for (const action of rule.preventActions) {
      out[action] = 0;
    }
  }

  // Trash absolute aggression cap — scale aggressive lines so that, after
  // normalization, aggregate aggression share equals TRASH_AGGRESSION_CAP_PCT.
  //
  // Math:
  //   passive = total - agg            (unchanged by the cap)
  //   We want    new_agg / (passive + new_agg) = cap / 100
  //   ⇒ new_agg = passive × cap / (100 - cap)
  //   scale = new_agg / agg
  if (handClass === 'trash') {
    const totalMass = Object.values(out).reduce((s, v) => s + (v ?? 0), 0);
    if (totalMass > 0) {
      const aggMass = AGGRESSIVE_ACTIONS.reduce((s, a) => s + (out[a] ?? 0), 0);
      const passiveMass = totalMass - aggMass;
      const aggPctOfTotal = (aggMass / totalMass) * 100;
      if (aggPctOfTotal > TRASH_AGGRESSION_CAP_PCT && aggMass > 0 && passiveMass > 0) {
        const targetAggMass =
          (passiveMass * TRASH_AGGRESSION_CAP_PCT) / (100 - TRASH_AGGRESSION_CAP_PCT);
        const scale = targetAggMass / aggMass;
        for (const a of AGGRESSIVE_ACTIONS) {
          const cur = out[a] ?? 0;
          if (cur > 0) out[a] = cur * scale;
        }
      }
    }
  }

  return out;
}

/** Re-scale to sum 100. Returns input unchanged when total ≤ 0 (defensive). */
export function normalizeFrequencies(freqs: ActionFrequencies): ActionFrequencies {
  const total = Object.values(freqs).reduce((s: number, v) => s + (v ?? 0), 0);
  if (total <= 0) return { ...freqs };
  const out: ActionFrequencies = {};
  for (const [action, freq] of Object.entries(freqs) as [SpecAction, number][]) {
    out[action] = (freq / total) * 100;
  }
  return out;
}

/**
 * Weighted random selection. `rng` returns float in [0, 1). Returns the first
 * action key whose cumulative frequency window crosses the roll. Falls back to
 * the first non-zero key when floating-point drift causes the roll to land at
 * the tail end.
 */
export function sampleWeightedAction(
  freqs: ActionFrequencies,
  rng: () => number,
): SpecAction {
  const entries = Object.entries(freqs) as [SpecAction, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) {
    // No probability mass — return the first action key as a safe fallback.
    return entries[0]?.[0] ?? 'fold';
  }
  const roll = rng() * total;
  let cum = 0;
  for (const [action, freq] of entries) {
    cum += freq;
    if (roll < cum) return action;
  }
  // Floating-point fallback — return last non-zero key.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1] > 0) return entries[i][0];
  }
  return entries[0][0];
}
