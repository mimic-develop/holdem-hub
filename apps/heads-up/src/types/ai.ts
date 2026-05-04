/**
 * AI 봇의 2층 모델: Persona(성향) × Level(일관성).
 * 마스터 스펙 v2 §10 — "정답 채점기"가 아니라 "성향 있는 상대".
 */

export type AiPersonaId = 'STANDARD' | 'NIT' | 'LAG' | 'CALLING' | 'MANIAC';
export type AiLevel = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Persona는 어떤 스타일로 플레이하는가를 결정.
 * 모든 bias 값은 `1.0`이 중립(STANDARD). 0.5 = 절반, 2.0 = 두 배.
 */
export interface AiPersonaProfile {
  id: AiPersonaId;
  displayName: string;
  /** 사용자에게 노출되는 1줄 설명. */
  description: string;
  /** 캐릭터 아바타 이미지 URL (undefined = 이니셜 폴백). */
  avatarSrc?: string;

  /** Voluntarily put money in pot — 프리플랍 fold 회피 경향. */
  vpipBias: number;
  /** Pre-flop raise — open/raise 비중. */
  pfrBias: number;
  /** 상대 raise에 3bet으로 응수하는 빈도. */
  threeBetBias: number;
  /** Continuation bet — flop 베팅 빈도. */
  cbetBias: number;
  /** Barrel — turn/river 연속 압박 빈도. */
  barrelBias: number;
  /** 약한 핸드로 블러프하는 비율. */
  bluffBias: number;
  /** Call down — 마지막 스트리트까지 콜할 의향. */
  callDownBias: number;
  /** Trap — 강한 패를 숨기고 체크/콜로 유도하는 빈도. */
  trapBias: number;
  /** 위험 감수 — raise 사이즈와 stack 노출. */
  riskTolerance: number;
  /** 쇼다운까지 가서 확인하려는 호기심 (콜 빈도 + 폴드 회피). */
  showdownCuriosity: number;
}

/**
 * Level은 얼마나 일관되게 persona를 수행하는가를 결정.
 * GTO 정확도가 아님 — "성향 일관성".
 */
export interface AiLevelModifiers {
  /** 0..1, 의사결정에 가해지는 random 교란. 클수록 들쑥날쑥. */
  decisionNoise: number;
  /** 0..1, 베팅 사이즈를 의도한 값에 얼마나 가깝게 맞추는가. */
  sizingAccuracy: number;
  /** 0..1, 상대에 적응하는 강도 (현재는 미사용 — Phase 6 후속). */
  adaptationStrength: number;
  /** 봇이 사고하는 듯한 시간 범위. */
  delayRangeMs: [number, number];
}
