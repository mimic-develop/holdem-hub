/**
 * Persona modifiers — 페르소나별로 ActionScore를 *상황에 따라 다르게* 보정.
 *
 * 설계 핵심: 단순 비율 조정이 아니라, features.handStrengthBucket / drawStrength /
 * facingBetSize / street 등에 따라 점수 가감이 달라짐.
 *
 * 5개 페르소나:
 *  - STANDARD: 기준 — 약한 가감만
 *  - NIT: 약한 핸드 빠르게 포기, 강한 핸드 신뢰도 있게 베팅
 *  - LAG: 주도권·드라이 보드 적극, 드로우 공격 자원화
 *  - CALLING: 작은/중간 베팅 끈질김, 레이즈/블러프 자제
 *  - MANIAC: 베팅·레이즈로 팟 키움, 드로우 강하게 공격
 */

import type { AiPersonaId } from '../types/ai';
import type { ActionScore, DecisionFeatures } from './decision-types';
import { MOD } from './decision-types';

export function applyPersonaModifiers(
  scores: ActionScore,
  f: DecisionFeatures,
  persona: AiPersonaId,
): ActionScore {
  // shallow copy — modifier가 in-place 수정해도 호출자 영향 없게
  const s: ActionScore = { ...scores };

  switch (persona) {
    case 'STANDARD':
      applyStandard(s, f);
      break;
    case 'NIT':
      applyNit(s, f);
      break;
    case 'LAG':
      applyLag(s, f);
      break;
    case 'CALLING':
      applyCalling(s, f);
      break;
    case 'MANIAC':
      applyManiac(s, f);
      break;
  }

  return s;
}

// ─────────────────────────────────────────────────────
// STANDARD — 기준 상대 (약한 modifier로 정체성 부여)
// ─────────────────────────────────────────────────────
function applyStandard(s: ActionScore, f: DecisionFeatures): void {
  // 강한 핸드는 살짝 더 value
  if (f.handStrengthBucket === 'monster' || f.handStrengthBucket === 'twoPairPlus') {
    s.betMedium += MOD.SMALL;
    s.raise     += MOD.TINY;
  }
  // postflop air 핸드는 살짝 더 fold (preflop은 chart가 이미 처리)
  if (f.street !== 'preflop' && f.handStrengthBucket === 'air' && f.facingBetSize !== 'none') {
    s.fold += MOD.SMALL;
  }
  // 큰 베팅(overbet/allin)에는 살짝 더 신중 — 모든 스트릿
  if (f.facingBetSize === 'overbet' || f.facingBetSize === 'allin') {
    s.fold += MOD.SMALL;
  }
}

// ─────────────────────────────────────────────────────
// NIT — 거의 안 들어오지만, 들어오면 진짜 강해 보임
// ─────────────────────────────────────────────────────
function applyNit(s: ActionScore, f: DecisionFeatures): void {
  // 1. 약한 핸드는 빠르게 포기
  if (f.handStrengthBucket === 'air' || f.handStrengthBucket === 'weakPair') {
    s.fold      += MOD.HUGE;
    s.call      -= MOD.MEDIUM;
    s.betLarge  -= MOD.LARGE;
    s.raise     -= MOD.LARGE;
  }

  // 2. 리버 + 낮은 쇼다운 밸류 → 안 콜함
  if (f.street === 'river' && f.showdownValue === 'low') {
    s.fold += MOD.LARGE;
    s.call -= MOD.LARGE;
  }

  // 3. 블러프 거의 안 함 — air에서 어그레션 강력 억제
  if (f.handStrengthBucket === 'air' && f.drawStrength === 'none') {
    s.betSmall  -= MOD.MEDIUM;
    s.betMedium -= MOD.LARGE;
    s.betLarge  -= MOD.HUGE;
    s.raise     -= MOD.HUGE;
    s.allIn     -= MOD.HUGE;
  }

  // 4. 강한 핸드는 신뢰도 있게 value
  if (f.handStrengthBucket === 'twoPairPlus' || f.handStrengthBucket === 'monster') {
    s.betMedium += MOD.MEDIUM;
    s.betLarge  += MOD.SMALL;
    s.raise     += MOD.SMALL;
  }

  // 5. OOP에서 monster일 때 가끔 trap (체크/콜)
  if (f.handStrengthBucket === 'monster' && f.position === 'OOP') {
    s.check += MOD.SMALL;
    s.call  += MOD.SMALL;
  }

  // 6. 프리플랍 진입 기준 ↑ — call 약화, fold 강화
  if (f.street === 'preflop' && f.handStrengthBucket !== 'monster' && f.handStrengthBucket !== 'twoPairPlus' && f.handStrengthBucket !== 'overPair') {
    s.fold += MOD.MEDIUM;
    s.call -= MOD.SMALL;
    s.raise -= MOD.SMALL;
  }

  // 7. 큰 베팅에 더 잘 죽음
  if (f.facingBetSize === 'large' || f.facingBetSize === 'overbet' || f.facingBetSize === 'allin') {
    if (f.handStrengthBucket !== 'monster' && f.handStrengthBucket !== 'twoPairPlus') {
      s.fold += MOD.LARGE;
      s.call -= MOD.MEDIUM;
    }
  }
}

// ─────────────────────────────────────────────────────
// LAG — 압박하지만 랜덤은 아님
// ─────────────────────────────────────────────────────
function applyLag(s: ActionScore, f: DecisionFeatures): void {
  // 1. 주도권 있으면 자주 압박
  if (f.initiative && f.facingBetSize === 'none') {
    s.betSmall  += MOD.LARGE;
    s.betMedium += MOD.MEDIUM;
    s.check     -= MOD.MEDIUM;
  }

  // 2. IP에서 더 적극적
  if (f.position === 'IP') {
    s.betSmall  += MOD.SMALL;
    s.betMedium += MOD.SMALL;
    s.raise     += MOD.TINY;
  }

  // 3. 드라이 보드 + initiative → 작은 c-bet 강하게 선호
  if (f.boardTexture === 'dry' && f.initiative && f.facingBetSize === 'none') {
    s.betSmall  += MOD.LARGE;
    s.check     -= MOD.MEDIUM;
  }

  // 4. 드로우를 공격 자원으로 — comboDraw/flushDraw/oesd에서 어그레션
  if (f.drawStrength === 'comboDraw' || f.drawStrength === 'flushDraw' || f.drawStrength === 'oesd') {
    s.betMedium += MOD.LARGE;
    s.raise     += MOD.SMALL;
    s.call      += MOD.SMALL;
    s.check     -= MOD.SMALL;
  }
  if (f.drawStrength === 'gutshot' && f.initiative) {
    s.betSmall += MOD.SMALL;
  }

  // 5. 완전 쓰레기 핸드로 대형 공격 제한 — 자살 방지
  if (f.handStrengthBucket === 'air' && f.drawStrength === 'none') {
    s.betLarge -= MOD.SMALL;
    s.allIn    -= MOD.HUGE;
  }

  // 6. 콜다운은 콜링스테이션처럼 하지 않음 — 큰 베팅엔 fold
  if (f.facingBetSize === 'large' || f.facingBetSize === 'overbet') {
    if (f.handStrengthBucket === 'weakPair' || f.handStrengthBucket === 'air') {
      s.call -= MOD.SMALL;
      s.fold += MOD.SMALL;
    }
  }

  // 7. 프리플랍 참여 범위 ↑
  if (f.street === 'preflop') {
    s.fold  -= MOD.MEDIUM;
    s.raise += MOD.SMALL;
    s.call  += MOD.SMALL;
  }

  // 8. 강한 핸드 빠른 밸류 (slowplay 회피)
  if (f.handStrengthBucket === 'twoPairPlus' || f.handStrengthBucket === 'monster') {
    s.betMedium += MOD.MEDIUM;
    s.raise     += MOD.SMALL;
    s.check     -= MOD.MEDIUM;
  }
}

// ─────────────────────────────────────────────────────
// CALLING — 안 죽지만 무조건 콜은 아님
// ─────────────────────────────────────────────────────
function applyCalling(s: ActionScore, f: DecisionFeatures): void {
  // 1. 쇼다운 밸류 있으면 콜 선호
  if (f.showdownValue !== 'none') {
    s.call += MOD.LARGE;
    s.fold -= MOD.MEDIUM;
  }

  // 2. 작은/중간 베팅엔 끈질김
  if (f.facingBetSize === 'small' || f.facingBetSize === 'medium') {
    s.call += MOD.LARGE;
    s.fold -= MOD.MEDIUM;
  }

  // 3. 리버에서 호기심 콜
  if (f.street === 'river' && f.showdownValue === 'low') {
    s.call += MOD.MEDIUM;
    s.fold -= MOD.SMALL;
  }

  // 4. 레이즈/블러프 빈도 ↓
  s.raise     -= MOD.MEDIUM;
  s.betLarge  -= MOD.SMALL;
  s.allIn     -= MOD.MEDIUM;

  // 5. 강한 핸드도 가끔 raise 대신 콜 (방어적)
  if (f.handStrengthBucket === 'twoPairPlus' || f.handStrengthBucket === 'monster') {
    s.call  += MOD.SMALL;
    s.raise -= MOD.TINY;
  }

  // 6. 큰 오버벳/all-in엔 어느 정도 폴드해야 인간적
  if (f.facingBetSize === 'overbet' || f.facingBetSize === 'allin') {
    if (f.handStrengthBucket !== 'monster' && f.handStrengthBucket !== 'twoPairPlus') {
      s.call -= MOD.MEDIUM;
      s.fold += MOD.MEDIUM;
    }
  }

  // 7. 프리플랍 콜 빈도 ↑ (raise는 안 함)
  if (f.street === 'preflop') {
    s.call  += MOD.MEDIUM;
    s.fold  -= MOD.SMALL;
    s.raise -= MOD.MEDIUM;
  }

  // 8. 블러프성 어그레션 억제 — air에서 베팅 안 함
  if (f.handStrengthBucket === 'air' && f.drawStrength === 'none') {
    s.betSmall  -= MOD.LARGE;
    s.betMedium -= MOD.LARGE;
    s.betLarge  -= MOD.HUGE;
  }
}

// ─────────────────────────────────────────────────────
// MANIAC — 콜이 아니라 베팅·레이즈로 판 키움
// ─────────────────────────────────────────────────────
function applyManiac(s: ActionScore, f: DecisionFeatures): void {
  // 1. 기본 공격 액션 선호
  s.betMedium += MOD.MEDIUM;
  s.betLarge  += MOD.LARGE;
  s.raise     += MOD.LARGE;
  s.check     -= MOD.MEDIUM;
  s.call      -= MOD.TINY;

  // 2. 드로우는 강하게 공격
  if (f.drawStrength !== 'none' && f.drawStrength !== 'backdoor') {
    s.betLarge  += MOD.MEDIUM;
    s.raise     += MOD.MEDIUM;
    s.check     -= MOD.SMALL;
  }

  // 3. air 핸드도 공격 자원으로 사용 — 단 all-in은 제한
  if (f.handStrengthBucket === 'air') {
    s.betMedium += MOD.SMALL;
    s.betLarge  += MOD.SMALL;
    s.fold      -= MOD.SMALL;
    if (f.street !== 'river' && f.drawStrength === 'none') {
      s.allIn -= MOD.MEDIUM; // 자살 방지
    }
  }

  // 4. 강한 핸드 빠르게 공격 (slowplay 거의 없음)
  if (f.handStrengthBucket === 'twoPairPlus' || f.handStrengthBucket === 'monster') {
    s.betLarge += MOD.LARGE;
    s.raise    += MOD.MEDIUM;
    s.check    -= MOD.LARGE;
  }

  // 5. 주도권 있으면 사이즈 ↑ (배럴)
  if (f.initiative && f.facingBetSize === 'none') {
    s.betLarge  += MOD.MEDIUM;
    s.betMedium += MOD.SMALL;
  }

  // 6. 프리플랍 광범위 참여 + 3bet ↑
  if (f.street === 'preflop') {
    s.fold  -= MOD.LARGE;
    s.raise += MOD.LARGE;
    s.call  += MOD.SMALL;
  }

  // 7. 큰 베팅 페이스에는 colorful — fold도 가끔, raise도 가끔
  if (f.facingBetSize === 'large' || f.facingBetSize === 'overbet') {
    // 강한 핸드면 raise로 응수
    if (f.handStrengthBucket === 'twoPairPlus' || f.handStrengthBucket === 'monster') {
      s.raise += MOD.MEDIUM;
    }
  }
}
