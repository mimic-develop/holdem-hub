/**
 * Difficulty modifiers — 난이도가 ActionScore에 가하는 보정.
 *
 * 난이도는 승률 조정 장치가 아니라:
 *  - 판단 일관성 (HARD = 일관, EASY = 들쑥날쑥)
 *  - 실수 빈도 (EASY = 자주, HARD = 드물게)
 *  - 보드 / 상황 반영 정도
 *  - 페르소나 약점 노출 정도
 */

import type { AiLevel } from '../types/ai';
import type { ActionScore, ActionKey, DecisionFeatures } from './decision-types';
import { ALL_ACTION_KEYS, MOD } from './decision-types';

export function applyDifficultyModifiers(
  scores: ActionScore,
  f: DecisionFeatures,
  difficulty: AiLevel,
  rng: () => number,
): ActionScore {
  let s: ActionScore = { ...scores };

  switch (difficulty) {
    case 'EASY':
      // EASY 플레이어는 "겁 많은 실수" — 페르소나 성향은 살짝 과장하되,
      // 액션 선택은 fold/check 쪽으로 기울게 해서 무모한 raise를 방지.
      s = exaggeratePersona(s, 1.10);
      s = applyPassiveBias(s, f);
      s = addNoise(s, 0.18, rng);
      break;
    case 'MEDIUM':
      s = addNoise(s, 0.10, rng);
      break;
    case 'HARD':
      s = addNoise(s, 0.04, rng);
      s = punishObviousMistakes(s, f);
      s = respectLargeBetsMore(s, f);
      s = rewardCorrectAggression(s, f);
      break;
  }

  return s;
}

/**
 * Noise 추가 — 모든 액션 score에 ±factor 배 가산 (uniform).
 * factor 0.22 = 평균 ±22% 의 가산 노이즈.
 *
 * 음수 score는 그대로 둠 (chooseAction에서 0으로 clamp).
 */
function addNoise(s: ActionScore, factor: number, rng: () => number): ActionScore {
  const out = { ...s };
  for (const k of ALL_ACTION_KEYS) {
    const base = Math.abs(out[k]);
    // zero-score 액션엔 노이즈 거의 안 줌 (chart가 0이면 0 유지) — 보너스 max 2.
    const noise = (rng() * 2 - 1) * factor * Math.max(base, 2);
    out[k] += noise;
  }
  return out;
}

/**
 * 페르소나 성향 과장 — score를 절대값 기준으로 amp 배 증폭.
 * MANIAC EASY → 더 자주 베팅 / NIT EASY → 더 자주 fold.
 */
function exaggeratePersona(s: ActionScore, amp: number): ActionScore {
  const out = { ...s };
  for (const k of ALL_ACTION_KEYS) {
    out[k] = out[k] * amp;
  }
  return out;
}

/**
 * HARD에서 명백한 실수 처벌 — 분명히 손해보는 action의 score를 낮춤.
 *
 * 예:
 *  - air 핸드로 raise/all-in 비합리적 → 더 강하게 깎음
 *  - equity 30% 미만 + facing large bet → fold 강제 (이미 base에 있지만 강화)
 *  - monster 핸드로 fold → 절대 안 하게 처벌
 */
function punishObviousMistakes(s: ActionScore, f: DecisionFeatures): ActionScore {
  const out = { ...s };

  // 1. monster를 fold하면 큰 손해
  if (f.handStrengthBucket === 'monster') {
    out.fold -= MOD.HUGE;
  }

  // 2. air + facing large bet → fold 강화
  if (
    f.handStrengthBucket === 'air' &&
    f.drawStrength === 'none' &&
    (f.facingBetSize === 'large' || f.facingBetSize === 'overbet' || f.facingBetSize === 'allin')
  ) {
    out.fold += MOD.LARGE;
    out.call -= MOD.LARGE;
  }

  // 3. equity < potOdds (콜 손해) → fold 강화
  if (f.facingBetSize !== 'none' && f.equity < f.potOdds - 0.08) {
    out.fold += MOD.MEDIUM;
    out.call -= MOD.MEDIUM;
  }

  // 4. air로 all-in은 거의 자살 — 강력 억제
  if (f.handStrengthBucket === 'air' && f.drawStrength === 'none') {
    out.allIn -= MOD.HUGE;
  }

  return out;
}

/**
 * HARD에서 큰 베팅에 더 잘 반응 — large/overbet에 fold 강화.
 * 페르소나 성향(CALLING의 호기심 콜)을 일부 완화.
 */
function respectLargeBetsMore(s: ActionScore, f: DecisionFeatures): ActionScore {
  const out = { ...s };
  if (f.facingBetSize === 'large') {
    if (f.handStrengthBucket !== 'monster' && f.handStrengthBucket !== 'twoPairPlus' && f.showdownValue !== 'high') {
      out.fold += MOD.SMALL;
      out.call -= MOD.SMALL;
    }
  }
  if (f.facingBetSize === 'overbet' || f.facingBetSize === 'allin') {
    if (f.handStrengthBucket !== 'monster') {
      out.fold += MOD.MEDIUM;
      out.call -= MOD.MEDIUM;
    }
  }
  return out;
}

/**
 * EASY passive bias — "겁 많은 실수" 패턴.
 * fold/check 쪽으로 살짝 가중, raise/bet 쪽으로 살짝 패널티.
 * 페르소나 성향(MANIAC의 raise 선호)은 보존되지만 무작위 raise는 줄어듦.
 */
function applyPassiveBias(s: ActionScore, _f: DecisionFeatures): ActionScore {
  const out = { ...s };
  out.fold       += MOD.SMALL;
  out.check      += MOD.SMALL;
  out.call       += MOD.TINY;
  out.betLarge   -= MOD.SMALL;
  out.raise      -= MOD.SMALL;
  out.allIn      -= MOD.MEDIUM;
  return out;
}

/**
 * HARD reward correct aggression — premium 핸드에서 raise/bet 가중치 ↑.
 * 페르소나(NIT 등)가 보수적이어도 monster/twoPairPlus는 적극 처리.
 */
function rewardCorrectAggression(s: ActionScore, f: DecisionFeatures): ActionScore {
  const out = { ...s };
  if (f.handStrengthBucket === 'monster' || f.handStrengthBucket === 'twoPairPlus') {
    out.raise     += MOD.MEDIUM;
    out.betLarge  += MOD.SMALL;
    out.betMedium += MOD.SMALL;
    out.check     -= MOD.SMALL;
    out.fold      -= MOD.LARGE;
  }
  if (f.handStrengthBucket === 'overPair' && !f.initiative) {
    out.raise     += MOD.SMALL;
    out.betMedium += MOD.SMALL;
  }
  // 드로우 자원 활용
  if (f.drawStrength === 'comboDraw' || f.drawStrength === 'flushDraw') {
    out.betMedium += MOD.SMALL;
    out.raise     += MOD.TINY;
  }
  return out;
}

/**
 * Softmax temperature 계산.
 * EASY 1.5 (더 무작위), MEDIUM 1.0, HARD 0.7 (더 결정적).
 */
export function temperatureFor(difficulty: AiLevel): number {
  switch (difficulty) {
    case 'EASY': return 1.5;
    case 'MEDIUM': return 1.0;
    case 'HARD': return 0.7;
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Export internal helpers for testing (typed but unused in production).
export const __test__ = { addNoise, exaggeratePersona, punishObviousMistakes, respectLargeBetsMore } as {
  addNoise: (s: ActionScore, factor: number, rng: () => number) => ActionScore;
  exaggeratePersona: (s: ActionScore, amp: number) => ActionScore;
  punishObviousMistakes: (s: ActionScore, f: DecisionFeatures) => ActionScore;
  respectLargeBetsMore: (s: ActionScore, f: DecisionFeatures) => ActionScore;
};
void (null as ActionKey | null); // ensure import retained
