import type { AiPersonaId } from '../../types/ai';
import type { SpecPersonaKey } from './types';

/**
 * Map the existing in-app persona IDs (5) to the 6 spec persona keys.
 *
 * **NIT → `tight_survivor`** — UI에서 "NIT" 라벨로 노출되는 페르소나는
 * tight-passive 정체성이 직관적이므로 `tight_survivor`로 매핑한다.
 *
 * `trap_master` 는 별도 UI 페르소나(예: "Tricky Nit" / "Trap Nit")가 추가되면
 * 새 `AiPersonaId` 와 매핑하도록 예약. 현재는 어느 UI 페르소나도 사용하지
 * 않지만 JSON 데이터(modifier + nodeSpecific)는 유지해 향후 활성화가
 * 코드 한 줄 추가로 끝나도록 한다.
 *
 * 영향:
 *  - NIT 가 premium 핸드(AA/KK/...)를 들었을 때 SB_FIRST_IN_25BB 에서
 *    limp 분포가 hand-class correction(premium.reduceActions.limp = 0.25)
 *    에 의해 0.25 배 축소되어 raise-dominant 가 된다 (trap_master 예외가
 *    NIT에 적용되지 않음).
 *  - postflop은 여전히 [persona-modifiers.ts:applyNit] 의 tight + slow-play
 *    분기가 작동하여 모인스터 OOP 트랩 행동은 유지된다.
 */
const PERSONA_MAP: Record<AiPersonaId, SpecPersonaKey> = {
  STANDARD: 'balanced_pro',
  MANIAC:   'pressure_maniac',
  CALLING:  'sticky_caller',
  NIT:      'tight_survivor',
  LAG:      'emotional_swinger',
};

export function resolveSpecPersona(p: AiPersonaId): SpecPersonaKey {
  return PERSONA_MAP[p];
}
