/**
 * @hh/poker-engine — 핵심 포커 도메인 로직
 *
 * 카드 정규화 (card.ts):
 *   - parseCard (strict, throw on invalid) — alias: parseCardStrict
 *   - tryParseCard, formatCard, asCard
 *   - 객체 ↔ 풀 단어 슈트 변환 (Poker-Quiz-Master 호환)
 *
 * 카드 유틸 (logic/cardUtils.ts) — MIMIC-Assets 호환:
 *   - parseCard, parseCards (lenient, 자동 대소문자 보정)
 *   - getRankValue, getRankLabel, getSuitSymbol, isRedSuit, combinations
 *
 * 도메인 로직: handEvaluator, potBuilder, potResolver, scoring
 */

// 카드 타입 + 변환 (객체↔객체) — 신규 표준
export type {
  Rank,
  Suit,
  Card,
  SuitFull,
} from "./card.js";
export {
  formatCard,
  asCard,
  fromFullSuit,
  toFullSuit,
  cardsEqual,
  tryParseCard,
  SUIT_SYMBOL,
  // strict parseCard와 isRedSuit는 lenient 버전과 충돌하므로 별칭으로 노출
  parseCard as parseCardStrict,
  isRedSuit as isRedSuitTyped,
} from "./card.js";

// MIMIC 호환 카드 유틸 — 마이그레이션 코드는 이 이름들을 그대로 사용
export {
  parseCard,
  parseCards,
  getRankValue,
  getRankLabel,
  getSuitSymbol,
  isRedSuit,
  combinations,
} from "./logic/cardUtils.js";

// 도메인 결과 타입
export type {
  HandRank,
  HandEvaluation,
  Pot,
  PotResult,
} from "./logic/types.js";

// 핸드 평가
export {
  evaluateHand,
  compareHands,
} from "./logic/handEvaluator.js";

// 팟 계산
export {
  buildPots,
  totalPot,
  type PlayerContribution,
} from "./logic/potBuilder.js";

// 팟 분배
export {
  resolvePots,
  type PlayerHandMap,
  type ResolutionResult,
} from "./logic/potResolver.js";

// 스코어링
export {
  PASS_SECONDS,
  STEP1_PTS,
  STEP2_PTS,
  STEP3_PTS,
  calcTimeScore,
  calcStreakBonus,
  scoreRanking,
  scorePayout,
} from "./logic/scoring.js";
