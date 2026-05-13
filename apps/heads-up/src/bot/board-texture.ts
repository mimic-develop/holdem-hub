/**
 * 보드 텍스처 분류 — 단순 휴리스틱.
 *
 * 카테고리:
 *  - paired:       보드에 페어가 있음 (트립/풀하우스 가능)
 *  - monotone:     3장 이상이 같은 무늬 (플랍에서 3장 모두 같으면 monotone)
 *  - fourFlush:    4장이 같은 무늬 (턴/리버에서만 가능)
 *  - fourStraight: 4장 연결 가능 (스트레이트 가능 보드)
 *  - wet:          드로우/스트레이트 가능성 풍부
 *  - semiWet:      일부 드로우 가능
 *  - dry:          연결성·동일 무늬 없음
 *
 * 보드가 바뀌는 시점(flop/turn/river)에 한 번 호출하고 캐시.
 */

import type { Card } from '../engine/card';
import type { BoardTexture } from './decision-types';

/** 보드 텍스처 캐시 — 보드 문자열 키 → 텍스처 */
const textureCache = new Map<string, BoardTexture>();

function boardKey(board: Card[]): string {
  // 정렬해서 캐시 일관성 확보 (보드는 셔플 무관)
  return board.map((c) => `${c.rank}${c.suit}`).sort().join('');
}

export function classifyBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3) return 'dry'; // preflop — 무관

  const key = boardKey(board);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const result = computeTexture(board);
  textureCache.set(key, result);
  return result;
}

function computeTexture(board: Card[]): BoardTexture {
  const ranks = board.map((c) => c.rank).sort((a, b) => b - a);
  const suits = board.map((c) => c.suit);

  // 1. paired check (페어 우선 — 가장 영향 큰 텍스처)
  const rankCount: Record<number, number> = {};
  for (const r of ranks) rankCount[r] = (rankCount[r] ?? 0) + 1;
  const hasPair = Object.values(rankCount).some((c) => c >= 2);
  if (hasPair) return 'paired';

  // 2. monotone / fourFlush
  const suitCount: Record<string, number> = {};
  for (const s of suits) suitCount[s] = (suitCount[s] ?? 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCount));
  if (maxSuit >= 4) return 'fourFlush';
  if (maxSuit === 3 && board.length === 3) return 'monotone';

  // 3. fourStraight — 4장이 5장 윈도우 안에 들어옴
  const unique = Array.from(new Set(ranks)).sort((a, b) => b - a);
  // wheel A 처리: A가 있으면 1로도 사용
  const ranksForStraight = unique.includes(14)
    ? [...unique, 1]
    : unique;
  if (board.length >= 4 && hasFourInWindow(ranksForStraight)) {
    return 'fourStraight';
  }

  // 4. wet / semiWet / dry
  // gap 분석: 최고/최저 차이, 연결 카드 수
  const span = unique[0] - unique[unique.length - 1];
  const consecutivePairs = countConsecutivePairs(unique);
  // wet: 좁은 span + 연결 + 같은 무늬 2장 이상
  const flushDrawPossible = maxSuit >= 2;

  if (span <= 4 && consecutivePairs >= 1 && flushDrawPossible) return 'wet';
  if (span <= 5 && (consecutivePairs >= 1 || flushDrawPossible)) return 'semiWet';
  if (span <= 6 && flushDrawPossible) return 'semiWet';
  return 'dry';
}

function hasFourInWindow(ranks: number[]): boolean {
  // 정렬된 unique ranks에서 길이 5 윈도우 안에 4개가 있는지
  for (let i = 0; i < ranks.length; i++) {
    let count = 1;
    for (let j = i + 1; j < ranks.length; j++) {
      if (ranks[i] - ranks[j] <= 4) count++;
      else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

function countConsecutivePairs(ranks: number[]): number {
  // 인접 연결 페어 수 (eg [10, 9, 7] → 1, [10, 9, 8] → 2)
  let n = 0;
  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i] - ranks[i + 1] === 1) n++;
  }
  return n;
}

/** 테스트용. 캐시를 비워야 할 때만 호출 */
export function clearBoardTextureCache(): void {
  textureCache.clear();
}
