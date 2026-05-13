/**
 * Decision pipeline 타입.
 *
 * 설계 의도: AI는 "한 액션 직접 선택"이 아니라 "모든 액션에 점수 부여 → modifier로 보정
 * → weighted random 선택" 방식. 페르소나는 *상황에 따라 다르게* 점수를 흔들고,
 * 난이도는 noise/exaggerate/punish로 일관성을 조절한다.
 *
 * 핵심 분리:
 *  - DecisionFeatures: 매 액션 시점의 "객관적 상황" (페르소나/난이도 무관)
 *  - ActionScore: 8가지 액션 후보의 가중치
 *  - Modifier: features를 보고 ActionScore를 조정하는 순수 함수들
 */

import type { Street } from '../types/game';

export type HandStrengthBucket =
  | 'air'
  | 'weakPair'
  | 'middlePair'
  | 'topPair'
  | 'overPair'
  | 'twoPairPlus'
  | 'monster';

export type DrawStrength =
  | 'none'
  | 'backdoor'
  | 'gutshot'
  | 'oesd'
  | 'flushDraw'
  | 'comboDraw';

export type ShowdownValue = 'none' | 'low' | 'medium' | 'high';

export type BoardTexture =
  | 'dry'
  | 'semiWet'
  | 'wet'
  | 'paired'
  | 'monotone'
  | 'fourStraight'
  | 'fourFlush';

export type FacingBetSize =
  | 'none'
  | 'small'   // ≤ 33% pot
  | 'medium'  // 34–66% pot
  | 'large'   // 67–110% pot
  | 'overbet' // 111–200% pot
  | 'allin';  // all-in or > 200% pot

export type AggressorRef = 'hero' | 'villain' | 'none';

export type Position = 'IP' | 'OOP';

export interface DecisionFeatures {
  street: Street;

  handStrengthBucket: HandStrengthBucket;
  drawStrength: DrawStrength;
  showdownValue: ShowdownValue;
  boardTexture: BoardTexture;

  position: Position;
  /** 이번 스트릿에서 마지막 어그레서가 hero인지 — c-bet/barrel 판정용 */
  initiative: boolean;
  /** pot odds (toCall / (pot + toCall)) */
  potOdds: number;
  /** Stack-to-pot ratio (effective stack / pot) */
  spr: number;

  facingBetSize: FacingBetSize;
  previousAggressor: AggressorRef;

  /** 캐시된 equity (0..1) — 모든 modifier가 재사용 */
  equity: number;

  /** 액션 합법성 (illegal action 필터링용) */
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
}

/**
 * 8가지 액션 후보의 점수.
 * 음수도 허용 (chooseAction이 0으로 clamp). 0 = 중립.
 */
export interface ActionScore {
  fold: number;
  check: number;
  call: number;
  betSmall: number;   // ≈ 33% pot
  betMedium: number;  // ≈ 66% pot
  betLarge: number;   // ≈ 100% pot
  raise: number;      // pot raise
  allIn: number;
}

export type ActionKey = keyof ActionScore;

export const ALL_ACTION_KEYS: ActionKey[] = [
  'fold', 'check', 'call', 'betSmall', 'betMedium', 'betLarge', 'raise', 'allIn',
];

/**
 * Modifier 강도 상수.
 *
 * 모든 페르소나/난이도 modifier가 이 상수를 참조해야 함.
 * 설계도의 raw 숫자(+25, -15 등)는 가이드일 뿐, 실제 점수는 여기 매핑됨.
 */
export const MOD = {
  TINY: 4,
  SMALL: 8,
  MEDIUM: 14,
  LARGE: 20,
  HUGE: 28,
} as const;

/** Base score 단위. 강한 핸드 monster bet = BASE.STRONG */
export const BASE = {
  WEAK: 8,
  NEUTRAL: 12,
  MEDIUM: 16,
  STRONG: 22,
  ANCHOR: 28,
} as const;
