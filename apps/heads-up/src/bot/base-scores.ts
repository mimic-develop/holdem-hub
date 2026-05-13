/**
 * Base action scores — 페르소나·난이도 적용 전 "STANDARD 무난한 기준".
 *
 * 입력: DecisionFeatures (객관적 상황)
 * 출력: ActionScore (8가지 액션 후보의 가중치)
 *
 * 원칙:
 *  - 강한 핸드 → value action (bet/raise) 점수 ↑
 *  - 약한 핸드 → fold/check 점수 ↑
 *  - 드로우 → 적당한 공격 가능 (semi-bluff)
 *  - 큰 베팅 페이스 → fold/call bias
 *  - illegal action 점수는 0 유지 (chooseAction에서 필터링)
 */

import type { ActionScore, DecisionFeatures } from './decision-types';
import { BASE, MOD } from './decision-types';

export function getBaseActionScores(f: DecisionFeatures): ActionScore {
  const s: ActionScore = {
    fold: 0,
    check: 0,
    call: 0,
    betSmall: 0,
    betMedium: 0,
    betLarge: 0,
    raise: 0,
    allIn: 0,
  };

  // ─────────────────────────────────────────
  // 1. 핸드 강도 기반 — 모든 스트릿 공통 베이스
  // ─────────────────────────────────────────
  switch (f.handStrengthBucket) {
    case 'monster':
      s.betMedium += BASE.STRONG;
      s.betLarge  += BASE.STRONG;
      s.raise     += BASE.STRONG;
      s.allIn     += BASE.MEDIUM;
      break;
    case 'twoPairPlus':
      s.betMedium += BASE.STRONG;
      s.betLarge  += BASE.MEDIUM;
      s.raise     += BASE.MEDIUM;
      break;
    case 'overPair':
      s.betMedium += BASE.MEDIUM;
      s.betLarge  += BASE.WEAK;
      s.raise     += BASE.WEAK;
      s.call      += BASE.MEDIUM;
      break;
    case 'topPair':
      s.betSmall  += BASE.MEDIUM;
      s.betMedium += BASE.NEUTRAL;
      s.call      += BASE.STRONG;
      break;
    case 'middlePair':
      s.check     += BASE.MEDIUM;
      s.call      += BASE.NEUTRAL;
      s.betSmall  += BASE.WEAK;
      break;
    case 'weakPair':
      s.check     += BASE.MEDIUM;
      s.call      += BASE.WEAK;
      s.fold      += BASE.WEAK;
      break;
    case 'air':
      s.fold      += BASE.STRONG;
      s.check     += BASE.MEDIUM;
      break;
  }

  // ─────────────────────────────────────────
  // 2. 드로우 — semi-bluff 가능 영역
  // ─────────────────────────────────────────
  switch (f.drawStrength) {
    case 'comboDraw':
      s.call      += MOD.LARGE;
      s.betMedium += MOD.MEDIUM;
      s.raise     += MOD.SMALL;
      // air 핸드여도 콤보드로우는 valuable
      s.fold       -= MOD.MEDIUM;
      break;
    case 'flushDraw':
      s.call      += MOD.MEDIUM;
      s.betMedium += MOD.SMALL;
      s.fold       -= MOD.SMALL;
      break;
    case 'oesd':
      s.call      += MOD.MEDIUM;
      s.betSmall  += MOD.SMALL;
      s.fold       -= MOD.SMALL;
      break;
    case 'gutshot':
      s.call      += MOD.SMALL;
      s.fold       -= MOD.TINY;
      break;
    case 'backdoor':
    case 'none':
      break;
  }

  // ─────────────────────────────────────────
  // 3. Facing bet — toCall 있을 때 fold/call/raise 조정
  // ─────────────────────────────────────────
  if (f.facingBetSize !== 'none') {
    s.check = 0; // illegal 가까운 상태 (toCall>0이면 check 불가)
    switch (f.facingBetSize) {
      case 'small':
        s.fold       += MOD.SMALL;
        s.call       += MOD.MEDIUM;
        break;
      case 'medium':
        s.fold       += MOD.MEDIUM;
        s.call       += MOD.SMALL;
        s.betSmall   -= MOD.SMALL;
        s.betMedium  -= MOD.SMALL;
        break;
      case 'large':
        s.fold       += MOD.LARGE;
        s.call       -= MOD.SMALL;
        s.betSmall   -= MOD.MEDIUM;
        s.betMedium  -= MOD.MEDIUM;
        s.betLarge   -= MOD.MEDIUM;
        break;
      case 'overbet':
        s.fold       += MOD.HUGE;
        s.call       -= MOD.MEDIUM;
        s.raise      -= MOD.SMALL;
        break;
      case 'allin':
        s.fold       += MOD.HUGE;
        s.call       -= MOD.MEDIUM;
        // raise/all-in 의미 없음
        s.raise      = 0;
        break;
    }
  }

  // ─────────────────────────────────────────
  // 4. Pot odds — fold 합리화
  // ─────────────────────────────────────────
  if (f.potOdds > 0) {
    if (f.equity < f.potOdds - 0.05) {
      // 명백히 콜 손해 — fold 강화, call 약화
      s.fold += MOD.LARGE;
      s.call -= MOD.MEDIUM;
    } else if (f.equity > f.potOdds + 0.15) {
      // 명백히 콜 이득 — fold 약화
      s.fold -= MOD.MEDIUM;
      s.call += MOD.MEDIUM;
    }
  }

  // ─────────────────────────────────────────
  // 5. SPR — 깊은 스택은 valuable, 얕은 스택은 commitment
  // ─────────────────────────────────────────
  if (f.spr < 2 && f.handStrengthBucket !== 'air') {
    // 얕은 스택 + 손이 있으면 commitment (allIn 매력 ↑)
    s.allIn += MOD.MEDIUM;
    s.raise += MOD.SMALL;
  }
  if (f.spr > 8) {
    // 깊은 스택 → 큰 사이즈 자제 (실수 비용 큼)
    s.allIn  -= MOD.LARGE;
    s.betLarge -= MOD.SMALL;
  }

  // ─────────────────────────────────────────
  // 6. Initiative — c-bet/barrel 기본 보정 (STANDARD baseline)
  // ─────────────────────────────────────────
  if (f.initiative && f.facingBetSize === 'none') {
    // 어그레서로서 check-back보다 c-bet 약하게 선호
    s.betSmall  += MOD.SMALL;
    s.betMedium += MOD.SMALL;
  }

  // ─────────────────────────────────────────
  // 7. Illegal action 점수 제거 (chooseAction에서 한 번 더 필터되지만 명확화)
  // ─────────────────────────────────────────
  if (!f.canCheck) s.check = 0;
  if (!f.canCall) s.call = 0;
  if (!f.canRaise) {
    s.betSmall = 0;
    s.betMedium = 0;
    s.betLarge = 0;
    s.raise = 0;
    s.allIn = 0;
  }

  return s;
}

/**
 * Preflop은 hand-chart의 raise/call/fold 분포를 base score로 변환.
 *
 * 설계도와의 통합: preflop도 동일 score 파이프라인을 거쳐 persona/difficulty
 * modifier가 일관적으로 적용되도록 함.
 *
 * 단, hand-chart의 분포 신호(예: AA = raise:1)를 보존하려면 큰 가중치를 주어야 함.
 * → MULT = 30 로 scale.
 */
export function getBasePreflopScores(
  chart: { raise: number; call: number; fold: number },
  f: DecisionFeatures,
): ActionScore {
  const MULT = 30;
  const s: ActionScore = {
    fold: chart.fold * MULT,
    check: 0,
    call: chart.call * MULT,
    betSmall: 0,
    betMedium: 0,
    betLarge: 0,
    raise: chart.raise * MULT,
    allIn: 0,
  };

  // can-check 상황 (BB free play) — fold를 check로 흡수
  if (f.canCheck) {
    s.check = s.fold + s.call;
    s.fold = 0;
    s.call = 0;
  }
  if (!f.canCall) s.call = 0;
  if (!f.canRaise) s.raise = 0;

  return s;
}
