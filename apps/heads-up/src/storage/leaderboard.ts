import { apiFetch } from '@hh/shared';
import type { AiPersonaId } from '../types/ai';

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
  /** 이 보드의 페르소나. null이면 전체(모든 페르소나 합산). */
  persona: AiPersonaId | null;
  entries: LeaderboardEntry[];
  /** 자격을 갖춘 본인 엔트리 (top 100 밖이어도 채워짐). */
  me: LeaderboardEntry | null;
  /** 자격 미달 시 진행 상황. 자격 충족 시 null. */
  myProgress: { handsCounted: number; needed: number } | null;
  minQualifyHands: number;
  window: number;
}

function empty(persona: AiPersonaId | null): LeaderboardResult {
  return { persona, entries: [], me: null, myProgress: null, minQualifyHands: 50, window: 200 };
}

/** persona 생략 시 전체 보드, 지정 시 해당 페르소나 상대 보드. */
export async function getLeaderboard(persona?: AiPersonaId): Promise<LeaderboardResult> {
  const qs = persona ? `?persona=${persona}` : '';
  return apiFetch<LeaderboardResult>(`/play-lab/heads-up/leaderboard${qs}`).catch(() =>
    empty(persona ?? null),
  );
}
