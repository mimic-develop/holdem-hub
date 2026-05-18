import { describe, expect, it } from 'vitest';
import type { AiPersonaId } from '../../../types/ai';
import type { SpecPersonaKey } from '../types';
import { resolveSpecPersona } from '../personaResolver';

describe('resolveSpecPersona — UI persona → spec persona mapping', () => {
  const expected: Record<AiPersonaId, SpecPersonaKey> = {
    STANDARD: 'balanced_pro',
    MANIAC:   'pressure_maniac',
    CALLING:  'sticky_caller',
    NIT:      'tight_survivor',
    LAG:      'emotional_swinger',
  };

  for (const [ui, spec] of Object.entries(expected) as Array<[AiPersonaId, SpecPersonaKey]>) {
    it(`${ui} → ${spec}`, () => {
      expect(resolveSpecPersona(ui)).toBe(spec);
    });
  }

  it('NIT is intentionally mapped to tight_survivor (not trap_master)', () => {
    // Sanity guard: NIT 라벨은 tight-passive 아이덴티티가 직관적이므로
    // `tight_survivor` 로 매핑되어야 한다. trap_master 는 별도 UI persona
    // 추가 시 사용하도록 예약. 의도적으로 다시 flip하려면 두 곳을 같이 수정.
    expect(resolveSpecPersona('NIT')).toBe('tight_survivor');
    expect(resolveSpecPersona('NIT')).not.toBe('trap_master');
  });
});
