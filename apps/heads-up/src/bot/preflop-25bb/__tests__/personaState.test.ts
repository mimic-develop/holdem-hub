import { describe, expect, it } from 'vitest';
import { applyEvent, applyEvents } from '../bayesianPersonaUpdater';
import { initialStateFor, PRIOR_STATE } from '../personaState';
import { applyPersonaStateModifier, buildStateModifier } from '../personaStateModifiers';
import type { ActionFrequencies } from '../types';

describe('PersonaState — priors + clamp', () => {
  it('returns the spec prior at match start', () => {
    expect(initialStateFor('balanced_pro')).toEqual(PRIOR_STATE.balanced_pro);
    expect(initialStateFor('emotional_swinger')).toEqual(PRIOR_STATE.emotional_swinger);
  });

  it('clamps all components to [0, 1] after extreme event stacks', () => {
    let s = initialStateFor('emotional_swinger');
    // 50 big-pot losses in a row → tilt + lost-confidence should saturate at 1/0.
    for (let i = 0; i < 50; i++) {
      s = applyEvent(s, { type: 'ai_lost_big_pot', magnitude: 2.0 }, 'emotional_swinger');
    }
    expect(s.tiltLevel).toBeLessThanOrEqual(1);
    expect(s.tiltLevel).toBeGreaterThanOrEqual(0);
    expect(s.confidence).toBe(0);
  });
});

describe('Reactivity asymmetry — emotional_swinger >> balanced_pro', () => {
  it('ai_lost_big_pot shifts emotional_swinger more than balanced_pro', () => {
    const ebefore = initialStateFor('emotional_swinger');
    const bbefore = initialStateFor('balanced_pro');
    const eafter = applyEvent(ebefore, { type: 'ai_lost_big_pot' }, 'emotional_swinger');
    const bafter = applyEvent(bbefore, { type: 'ai_lost_big_pot' }, 'balanced_pro');

    const eTiltDelta = eafter.tiltLevel - ebefore.tiltLevel;
    const bTiltDelta = bafter.tiltLevel - bbefore.tiltLevel;
    expect(eTiltDelta).toBeGreaterThan(bTiltDelta);

    const eConfDelta = ebefore.confidence - eafter.confidence;
    const bConfDelta = bbefore.confidence - bafter.confidence;
    expect(eConfDelta).toBeGreaterThan(bConfDelta);
  });

  it('cumulative stress: swinger overshoots balanced_pro after a streak', () => {
    let swinger = initialStateFor('emotional_swinger');
    let pro = initialStateFor('balanced_pro');
    const events = Array(5).fill({ type: 'ai_lost_big_pot' as const });
    swinger = applyEvents(swinger, events, 'emotional_swinger');
    pro = applyEvents(pro, events, 'balanced_pro');
    expect(swinger.tiltLevel).toBeGreaterThan(pro.tiltLevel);
  });
});

describe('State modifier — invariants', () => {
  it('prior state yields modest multipliers for non-tilted personas', () => {
    const m = buildStateModifier(PRIOR_STATE.balanced_pro);
    // balanced_pro has aggression 0.5, callDown 0.5, trapTendency 0.3,
    // confidence 0.6. The off-center trap value shrinks limp/check toward 0.75
    // and confidence nudges raise upward to ~1.12. All within ±0.30 of neutral.
    for (const v of Object.values(m)) {
      if (v === undefined) continue;
      expect(v).toBeGreaterThan(0.7);
      expect(v).toBeLessThan(1.30);
    }
  });

  it('does not invent actions with zero baseline', () => {
    const base: ActionFrequencies = { fold: 50, call: 50, raise_2: 0, all_in_25: 0 };
    const out = applyPersonaStateModifier(base, PRIOR_STATE.pressure_maniac);
    expect(out.raise_2).toBe(0);
    expect(out.all_in_25).toBe(0);
  });

  it('clamps multipliers to [0.2, 2.5]', () => {
    // Extreme state vector — aggression 1, tilt 1, callDown 0
    const extreme = {
      aggression: 1, callDown: 0, riskTolerance: 1,
      trapTendency: 0, tiltLevel: 1, confidence: 1,
    };
    const m = buildStateModifier(extreme);
    for (const v of Object.values(m)) {
      if (v === undefined) continue;
      expect(v).toBeGreaterThanOrEqual(0.2);
      expect(v).toBeLessThanOrEqual(2.5);
    }
  });
});
