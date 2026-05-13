import type { AiPersonaId, AiPersonaProfile } from '../types/ai';
import standardAvatar   from '../assets/ai-profiles/standard.png';
import nitAvatar        from '../assets/ai-profiles/nit.png';
import lagAvatar        from '../assets/ai-profiles/loose-aggro.png';
import callingAvatar    from '../assets/ai-profiles/calling-station.png';
import maniacAvatar     from '../assets/ai-profiles/maniac.png';

type BiasSet = Omit<AiPersonaProfile, 'id' | 'displayName' | 'description' | 'avatarSrc'>;

/** V1 — 원본 수치 (보존용) */
const PERSONA_BIASES_V1: Record<AiPersonaId, BiasSet> = {
  STANDARD: { vpipBias:1.00, pfrBias:1.00, threeBetBias:1.00, cbetBias:1.00, barrelBias:1.00, bluffBias:1.00, callDownBias:1.00, trapBias:1.00, riskTolerance:1.00, showdownCuriosity:1.00 },
  NIT:      { vpipBias:0.72, pfrBias:0.78, threeBetBias:0.75, cbetBias:0.92, barrelBias:0.88, bluffBias:0.55, callDownBias:0.75, trapBias:1.05, riskTolerance:0.65, showdownCuriosity:0.70 },
  LAG:      { vpipBias:1.25, pfrBias:1.22, threeBetBias:1.18, cbetBias:1.12, barrelBias:1.15, bluffBias:1.20, callDownBias:0.95, trapBias:0.70, riskTolerance:1.20, showdownCuriosity:0.95 },
  CALLING:  { vpipBias:1.15, pfrBias:0.82, threeBetBias:0.70, cbetBias:0.90, barrelBias:0.82, bluffBias:0.58, callDownBias:1.32, trapBias:0.95, riskTolerance:0.98, showdownCuriosity:1.30 },
  MANIAC:   { vpipBias:1.35, pfrBias:1.40, threeBetBias:1.35, cbetBias:1.25, barrelBias:1.30, bluffBias:1.45, callDownBias:1.05, trapBias:0.45, riskTolerance:1.45, showdownCuriosity:1.05 },
};

/**
 * V2 — 플레이어 체험 튜닝 (Training Mode).
 * 각 페르소나의 성향 차이를 더 명확하게 캐리커처화.
 * 참조: heads_up_ai_persona_tuning_request.md
 */
const PERSONA_BIASES_V2: Record<AiPersonaId, BiasSet> = {
  STANDARD: { vpipBias:1.00, pfrBias:1.00, threeBetBias:1.00, cbetBias:1.00, barrelBias:1.00, bluffBias:1.00, callDownBias:1.00, trapBias:1.00, riskTolerance:1.00, showdownCuriosity:1.00 },
  NIT:      { vpipBias:0.58, pfrBias:0.62, threeBetBias:0.48, cbetBias:0.78, barrelBias:0.62, bluffBias:0.32, callDownBias:0.58, trapBias:1.20, riskTolerance:0.58, showdownCuriosity:0.52 },
  LAG:      { vpipBias:1.32, pfrBias:1.32, threeBetBias:1.35, cbetBias:1.22, barrelBias:1.28, bluffBias:1.32, callDownBias:0.92, trapBias:0.62, riskTolerance:1.25, showdownCuriosity:0.90 },
  CALLING:  { vpipBias:1.22, pfrBias:0.62, threeBetBias:0.45, cbetBias:0.72, barrelBias:0.58, bluffBias:0.35, callDownBias:1.70, trapBias:0.90, riskTolerance:0.82, showdownCuriosity:1.75 },
  MANIAC:   { vpipBias:1.55, pfrBias:1.65, threeBetBias:1.75, cbetBias:1.42, barrelBias:1.55, bluffBias:1.85, callDownBias:1.15, trapBias:0.35, riskTolerance:1.70, showdownCuriosity:1.10 },
};

/**
 * 현재 활성 버전.
 * 'v1' → 원본 수치 / 'v2' → 플레이어 체험 튜닝
 */
export const ACTIVE_PERSONA_BIAS_VERSION: 'v1' | 'v2' = 'v2';

const ACTIVE_BIASES = ACTIVE_PERSONA_BIAS_VERSION === 'v2' ? PERSONA_BIASES_V2 : PERSONA_BIASES_V1;

const META: Record<AiPersonaId, Pick<AiPersonaProfile, 'id' | 'displayName' | 'description' | 'avatarSrc'>> = {
  STANDARD: { id: 'STANDARD', displayName: '스탠다드', description: '가장 기본적인 균형형 상대',        avatarSrc: standardAvatar },
  NIT:      { id: 'NIT',      displayName: '니트',      description: '잘 안 붙다가 강할 때 세게 옴',    avatarSrc: nitAvatar     },
  LAG:      { id: 'LAG',      displayName: '루즈 어그로', description: '계속 불편하게 압박하는 상대',    avatarSrc: lagAvatar     },
  CALLING:  { id: 'CALLING',  displayName: '콜링 스테이션', description: '잘 죽지 않고 콜이 많은 상대', avatarSrc: callingAvatar },
  MANIAC:   { id: 'MANIAC',   displayName: '매니악',     description: '과잉 공격과 높은 블러프의 상대', avatarSrc: maniacAvatar  },
};

export const AI_PERSONAS: Record<AiPersonaId, AiPersonaProfile> = {
  STANDARD: { ...META.STANDARD, ...ACTIVE_BIASES.STANDARD },
  NIT:      { ...META.NIT,      ...ACTIVE_BIASES.NIT      },
  LAG:      { ...META.LAG,      ...ACTIVE_BIASES.LAG      },
  CALLING:  { ...META.CALLING,  ...ACTIVE_BIASES.CALLING  },
  MANIAC:   { ...META.MANIAC,   ...ACTIVE_BIASES.MANIAC   },
};

export const ALL_PERSONA_IDS: AiPersonaId[] = ['STANDARD', 'NIT', 'LAG', 'CALLING', 'MANIAC'];
