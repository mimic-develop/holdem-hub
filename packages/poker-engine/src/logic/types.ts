/**
 * 도메인 타입 — handEvaluator/potBuilder/potResolver/scoring 가 의존.
 *
 * 카드 자체 타입은 card.ts와 단일화. 여기서는 게임 도메인 결과 타입만 정의.
 */

import type { Card } from "../card.js";

// re-export so logic 모듈 내부 import 경로가 단순해진다
export type { Card, Rank, Suit } from "../card.js";

export type HandRank =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH";

export interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  tiebreakers: number[];
  bestFive: Card[];
  description: string;
  descriptionKo: string;
}

export interface Pot {
  type: "main" | "side";
  label: string;
  amount: number;
  eligible: string[];
}

export interface PotResult {
  pot: Pot;
  winners: string[];
  perWinner: number;
}
