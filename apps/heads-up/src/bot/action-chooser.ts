/**
 * Action chooser — softmax 기반 weighted random.
 *
 * 1. illegal action 점수를 0으로 (canCheck/canCall/canRaise 기반)
 * 2. 음수 score → 0으로 clamp
 * 3. Softmax: exp(score / temperature) 후 정규화
 * 4. Weighted random sample
 *
 * temperature 낮을수록 결정적 (HARD), 높을수록 무작위 (EASY).
 */

import type { PlayerAction } from '../types/game';
import type { ActionKey, ActionScore, DecisionFeatures } from './decision-types';
import { ALL_ACTION_KEYS } from './decision-types';

export interface ChosenAction {
  key: ActionKey;
  /** PlayerAction (game state로 전달용) */
  playerAction: PlayerAction;
  /** Bet/raise일 때 사이즈 힌트 (pot ratio). 0 = N/A */
  sizeRatio: number;
}

/**
 * key별 sizing ratio (pot에 대한 비율).
 * bet/raise 변환 시 사용.
 */
const SIZE_RATIO: Record<ActionKey, number> = {
  fold: 0,
  check: 0,
  call: 0,
  betSmall: 0.33,
  betMedium: 0.66,
  betLarge: 1.0,
  raise: 1.5,   // 3-bet 사이즈
  allIn: 999,   // sentinel
};

const PLAYER_ACTION_MAP: Record<ActionKey, PlayerAction> = {
  fold: 'fold',
  check: 'check',
  call: 'call',
  betSmall: 'bet',
  betMedium: 'bet',
  betLarge: 'bet',
  raise: 'raise',
  allIn: 'raise', // game-engine은 raise + max amount로 처리
};

export function chooseAction(
  scores: ActionScore,
  f: DecisionFeatures,
  temperature: number,
  rng: () => number,
): ChosenAction {
  // 1. illegal filter
  const filtered = filterIllegalActions(scores, f);

  // 2. clamp + softmax
  const weights = softmax(filtered, temperature);

  // 3. weighted random
  const key = weightedRandom(weights, rng);

  return {
    key,
    playerAction: PLAYER_ACTION_MAP[key],
    sizeRatio: SIZE_RATIO[key],
  };
}

function filterIllegalActions(scores: ActionScore, f: DecisionFeatures): ActionScore {
  const out: ActionScore = { ...scores };
  // facing bet → check 불가
  if (!f.canCheck) out.check = -Infinity;
  if (!f.canCall) out.call = -Infinity;
  if (!f.canRaise) {
    out.betSmall = -Infinity;
    out.betMedium = -Infinity;
    out.betLarge = -Infinity;
    out.raise = -Infinity;
    out.allIn = -Infinity;
  }
  // canCheck 상태에서 fold는 통상 합리적이지 않음 (무료 카드 거부)
  if (f.canCheck) out.fold = -Infinity;

  // bet은 toCall=0일 때만 가능. facing bet에선 raise로 흡수.
  if (f.facingBetSize !== 'none') {
    // bet sizes를 raise로 흡수 — score 보존, action만 raise로 매핑
    // 가장 큰 bet 점수를 raise에 합산해 정보 손실 최소화
    const maxBet = Math.max(out.betSmall, out.betMedium, out.betLarge);
    if (Number.isFinite(maxBet) && maxBet > 0 && Number.isFinite(out.raise)) {
      out.raise = Math.max(out.raise, maxBet);
    }
    out.betSmall = -Infinity;
    out.betMedium = -Infinity;
    out.betLarge = -Infinity;
  }
  return out;
}

function softmax(scores: ActionScore, temperature: number): Record<ActionKey, number> {
  const t = Math.max(0.1, temperature);
  // 최대값 정렬 (overflow 방지)
  let max = -Infinity;
  for (const k of ALL_ACTION_KEYS) {
    const v = scores[k];
    if (v > max && Number.isFinite(v)) max = v;
  }
  if (!Number.isFinite(max)) max = 0;

  const exps: Record<ActionKey, number> = {
    fold: 0, check: 0, call: 0, betSmall: 0, betMedium: 0, betLarge: 0, raise: 0, allIn: 0,
  };
  let sum = 0;
  for (const k of ALL_ACTION_KEYS) {
    const v = scores[k];
    if (!Number.isFinite(v)) { exps[k] = 0; continue; }
    // 매우 낮은 점수는 거의 0이 되도록 scale 조정 (점수 단위 ~5-30 가정)
    // scale 5 = 점수 5 차이당 e ≈ 0.37배 (HARD 0.7 t에서 더 결정적)
    const scaled = (v - max) / (5 * t);
    const e = Math.exp(scaled);
    exps[k] = e;
    sum += e;
  }

  if (sum === 0) {
    // 모든 액션이 illegal — fallback: 가능한 첫 합법 액션에 1.0
    const safe: ActionKey = scores.check !== -Infinity ? 'check'
      : scores.call !== -Infinity ? 'call'
      : 'fold';
    return { ...exps, [safe]: 1 };
  }

  for (const k of ALL_ACTION_KEYS) {
    exps[k] /= sum;
  }
  return exps;
}

function weightedRandom(weights: Record<ActionKey, number>, rng: () => number): ActionKey {
  let total = 0;
  for (const k of ALL_ACTION_KEYS) total += weights[k];
  if (total <= 0) return 'check';

  let r = rng() * total;
  for (const k of ALL_ACTION_KEYS) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'check'; // 안전 폴백 (rounding)
}
