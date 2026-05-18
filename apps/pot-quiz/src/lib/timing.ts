import { PASS_SECONDS as ENGINE_PASS_SECONDS } from '@hh/poker-engine';

/**
 * 클릭 기반 워크플로우(좌석 클릭으로 팟 형성·승자 결정)는 텍스트 입력 워크플로우보다
 * sub-step 수가 많아 표준 PASS_SECONDS(90s) 보다 더 긴 시간이 필요.
 * 1.4배 적용 → 126초.
 */
export const POT_QUIZ_PASS_SECONDS = Math.round(ENGINE_PASS_SECONDS * 1.4);

/**
 * `@hh/poker-engine`의 `calcTimeScore`와 동일한 곡선이지만 PASS_SECONDS를 위 값으로 재해석.
 * 점수 분포의 의미를 보존(0~100 보너스 / 초과 시 -100까지 페널티).
 */
export function calcTimeScore(elapsedSeconds: number, maxBonus = 100): number {
  if (elapsedSeconds < POT_QUIZ_PASS_SECONDS) {
    return Math.round(((POT_QUIZ_PASS_SECONDS - elapsedSeconds) / POT_QUIZ_PASS_SECONDS) * maxBonus);
  }
  const overtime = Math.round(elapsedSeconds - POT_QUIZ_PASS_SECONDS);
  if (overtime === 0) return 0;
  return -Math.min(overtime * 2, 100);
}
