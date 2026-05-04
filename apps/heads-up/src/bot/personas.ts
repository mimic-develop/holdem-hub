import type { AiPersonaId, AiPersonaProfile } from '../types/ai';
import standardAvatar   from '../assets/ai-profiles/standard.png';
import nitAvatar        from '../assets/ai-profiles/nit.png';
import lagAvatar        from '../assets/ai-profiles/loose-aggro.png';
import callingAvatar    from '../assets/ai-profiles/calling-station.png';
import maniacAvatar     from '../assets/ai-profiles/maniac.png';

/**
 * 5종 기본 Persona — 마스터 스펙 v2 §10.7.
 * 모든 bias는 STANDARD(=1.0) 기준 곱셈 가중치.
 */
export const AI_PERSONAS: Record<AiPersonaId, AiPersonaProfile> = {
  STANDARD: {
    id: 'STANDARD',
    displayName: '스탠다드',
    description: '가장 기본적인 균형형 상대',
    avatarSrc: standardAvatar,
    vpipBias: 1.0,
    pfrBias: 1.0,
    threeBetBias: 1.0,
    cbetBias: 1.0,
    barrelBias: 1.0,
    bluffBias: 1.0,
    callDownBias: 1.0,
    trapBias: 1.0,
    riskTolerance: 1.0,
    showdownCuriosity: 1.0,
  },
  NIT: {
    id: 'NIT',
    displayName: '니트',
    description: '잘 안 붙다가 강할 때 세게 옴',
    avatarSrc: nitAvatar,
    vpipBias: 0.72,
    pfrBias: 0.78,
    threeBetBias: 0.75,
    cbetBias: 0.92,
    barrelBias: 0.88,
    bluffBias: 0.55,
    callDownBias: 0.75,
    trapBias: 1.05,
    riskTolerance: 0.65,
    showdownCuriosity: 0.7,
  },
  LAG: {
    id: 'LAG',
    displayName: '루즈 어그로',
    description: '계속 불편하게 압박하는 상대',
    avatarSrc: lagAvatar,
    vpipBias: 1.25,
    pfrBias: 1.22,
    threeBetBias: 1.18,
    cbetBias: 1.12,
    barrelBias: 1.15,
    bluffBias: 1.2,
    callDownBias: 0.95,
    trapBias: 0.7,
    riskTolerance: 1.2,
    showdownCuriosity: 0.95,
  },
  CALLING: {
    id: 'CALLING',
    displayName: '콜링 스테이션',
    description: '잘 죽지 않고 콜이 많은 상대',
    avatarSrc: callingAvatar,
    vpipBias: 1.15,
    pfrBias: 0.82,
    threeBetBias: 0.7,
    cbetBias: 0.9,
    barrelBias: 0.82,
    bluffBias: 0.58,
    callDownBias: 1.32,
    trapBias: 0.95,
    riskTolerance: 0.98,
    showdownCuriosity: 1.3,
  },
  MANIAC: {
    id: 'MANIAC',
    displayName: '매니악',
    description: '과잉 공격과 높은 블러프의 상대',
    avatarSrc: maniacAvatar,
    vpipBias: 1.35,
    pfrBias: 1.4,
    threeBetBias: 1.35,
    cbetBias: 1.25,
    barrelBias: 1.3,
    bluffBias: 1.45,
    callDownBias: 1.05,
    trapBias: 0.45,
    riskTolerance: 1.45,
    showdownCuriosity: 1.05,
  },
};

/** UI 등에서 순회할 때 사용. */
export const ALL_PERSONA_IDS: AiPersonaId[] = [
  'STANDARD',
  'NIT',
  'LAG',
  'CALLING',
  'MANIAC',
];
