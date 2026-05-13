/**
 * Equity 캐싱 — 동일 (board + hole cards) 조합에 대해 한 번만 몬테카를로 실행.
 *
 * 설계도 §1.1 "매 액션마다 무거운 equity 계산 금지"를 충족.
 * 같은 스트릿 안에서는 보드가 그대로이므로 캐시 hit 율이 매우 높음.
 *
 * 캐시 크기는 의도적으로 작게 유지 (LRU 64) — 핸드 종료 시 자동 회전.
 */

import type { Card } from '../engine/card';
import { calculateEquity } from './equity';

const MAX_CACHE = 64;

export class EquityCache {
  private readonly cache = new Map<string, number>();

  get(
    hole: [Card, Card],
    board: Card[],
    iterations: number,
    rng: () => number,
  ): number {
    const key = cacheKey(hole, board);
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      // LRU touch
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }

    const result = calculateEquity(hole, board, [], { iterations, rng });
    if (this.cache.size >= MAX_CACHE) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    this.cache.set(key, result);
    return result;
  }

  clear(): void {
    this.cache.clear();
  }
}

function cacheKey(hole: [Card, Card], board: Card[]): string {
  const h = [hole[0], hole[1]]
    .map((c) => `${c.rank}${c.suit}`)
    .sort()
    .join('');
  const b = board.map((c) => `${c.rank}${c.suit}`).sort().join('');
  return `${h}|${b}`;
}
