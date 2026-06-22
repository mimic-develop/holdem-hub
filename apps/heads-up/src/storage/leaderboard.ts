import { apiFetch } from '@hh/shared';

/** 리더보드 한 행. 순위 축은 avgScore(평균 판단 점수). */
export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  avgScore: number;
  bbPerHand: number;
  winRate: number;
  handsCounted: number;
  isMe: boolean;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  /** 자격을 갖춘 본인 엔트리 (top 100 밖이어도 채워짐). */
  me: LeaderboardEntry | null;
  /** 자격 미달 시 진행 상황. 자격 충족 시 null. */
  myProgress: { handsCounted: number; needed: number } | null;
  minQualifyHands: number;
  window: number;
}

const EMPTY: LeaderboardResult = {
  entries: [],
  me: null,
  myProgress: null,
  minQualifyHands: 50,
  window: 200,
};

export async function getLeaderboard(): Promise<LeaderboardResult> {
  return apiFetch<LeaderboardResult>('/play-lab/heads-up/leaderboard').catch(() => EMPTY);
}
