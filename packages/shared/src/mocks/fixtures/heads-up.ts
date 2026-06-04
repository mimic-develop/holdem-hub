/**
 * heads-up mock fixtures — 서버 응답 구조와 일치하는 정적 데이터.
 * (services/api/src/routes/heads-up.ts 참고)
 */

/** GET /settings 기본값 (서버 DEFAULT_SETTINGS와 동일). */
export const HEADS_UP_SETTINGS = {
  nickname: "테스트 유저",
  soundEnabled: true,
  hapticEnabled: true,
  betPresets: [0.5, 0.67, 1.0],
  matchLength: 12,
  displayUnit: "bb" as const,
};

/** GET /stats 더미 통계. */
export const HEADS_UP_STATS = {
  total: 0,
  wins: 0,
  losses: 0,
  splits: 0,
  netChips: 0,
  winRate: 0,
};
