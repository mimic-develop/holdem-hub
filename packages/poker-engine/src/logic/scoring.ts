export const PASS_SECONDS = 90;

export const STEP1_PTS = 40;
export const STEP2_PTS = 65;
export const STEP3_PTS = 45;

export function calcTimeScore(elapsedSeconds: number, maxBonus = 100): number {
  if (elapsedSeconds < PASS_SECONDS) {
    return Math.round(((PASS_SECONDS - elapsedSeconds) / PASS_SECONDS) * maxBonus);
  }
  const overtime = Math.round(elapsedSeconds - PASS_SECONDS);
  if (overtime === 0) return 0;
  return -Math.min(overtime * 2, 100);
}

export function calcStreakBonus(streak: number): number {
  return Math.min(streak * 20, 150);
}

export function scoreRanking(correct: boolean): number {
  return correct ? STEP1_PTS : 0;
}

export function scorePayout(correctCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round(STEP3_PTS * (correctCount / totalCount));
}
