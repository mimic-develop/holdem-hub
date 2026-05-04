import type { AiLevel, AiLevelModifiers } from '../types/ai';

/**
 * Level은 GTO 정확도가 아니라 "성향 일관성".
 * EASY일수록 noise가 커져서 같은 persona라도 들쑥날쑥하게 행동한다.
 * 마스터 스펙 v2 §10.8.
 */
export const AI_LEVELS: Record<AiLevel, AiLevelModifiers> = {
  EASY: {
    decisionNoise: 0.22,
    sizingAccuracy: 0.72,
    adaptationStrength: 0.6,
    delayRangeMs: [900, 2200],
  },
  MEDIUM: {
    decisionNoise: 0.12,
    sizingAccuracy: 0.84,
    adaptationStrength: 0.8,
    delayRangeMs: [700, 1800],
  },
  HARD: {
    decisionNoise: 0.06,
    sizingAccuracy: 0.93,
    adaptationStrength: 1.0,
    delayRangeMs: [600, 1400],
  },
};

export const ALL_LEVELS: AiLevel[] = ['EASY', 'MEDIUM', 'HARD'];

export const LEVEL_LABEL: Record<AiLevel, string> = {
  EASY: '쉬움',
  MEDIUM: '보통',
  HARD: '어려움',
};
