/**
 * 정규화된 카드 타입.
 *
 * 기존 3개 앱은 각자 다른 형식을 사용했다:
 *   - MIMIC-Assets: "As" (string, 짧은 표기)
 *   - Nut-to-3:     "As" (string, 짧은 표기)
 *   - Poker-Quiz-Master: { suit: "spades", rank: "A" } (객체, 풀 단어)
 *   - mimic_heads_up: 자체 형식
 *
 * 모노레포에서는 이 모듈의 정규화 타입을 단일 진실로 삼고,
 * 각 앱은 입출력 시 어댑터를 통해 변환한다.
 *
 * Step 2에서 handEvaluator, potBuilder 등이 이 타입 위에 빌드됨.
 */

export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "T" | "J" | "Q" | "K" | "A";

/** 짧은 표기: 's'=스페이드, 'h'=하트, 'd'=다이아몬드, 'c'=클럽 */
export type Suit = "s" | "h" | "d" | "c";

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** 풀 단어 표기 (Poker-Quiz-Master에서 사용 중) */
export type SuitFull = "spades" | "hearts" | "diamonds" | "clubs";

const SUIT_SHORT_TO_FULL: Record<Suit, SuitFull> = {
  s: "spades",
  h: "hearts",
  d: "diamonds",
  c: "clubs",
};

const SUIT_FULL_TO_SHORT: Record<SuitFull, Suit> = {
  spades: "s",
  hearts: "h",
  diamonds: "d",
  clubs: "c",
};

const VALID_RANKS = new Set<Rank>([
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
]);
const VALID_SUITS = new Set<Suit>(["s", "h", "d", "c"]);

/**
 * "As" → { rank: "A", suit: "s" }
 * 잘못된 입력은 throw. (안전 변환은 tryParseCard 사용)
 */
export function parseCard(str: string): Card {
  if (typeof str !== "string" || str.length !== 2) {
    throw new Error(`Invalid card string: ${JSON.stringify(str)}`);
  }
  const rank = str[0] as Rank;
  const suit = str[1]?.toLowerCase() as Suit;
  if (!VALID_RANKS.has(rank)) {
    throw new Error(`Invalid rank: ${rank} (in ${str})`);
  }
  if (!VALID_SUITS.has(suit)) {
    throw new Error(`Invalid suit: ${suit} (in ${str})`);
  }
  return { rank, suit };
}

export function tryParseCard(str: string): Card | null {
  try {
    return parseCard(str);
  } catch {
    return null;
  }
}

/** { rank: "A", suit: "s" } → "As" */
export function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
}

/** Poker-Quiz-Master 형식 ↔ 정규화 형식 변환 */
export function fromFullSuit(rank: Rank, suit: SuitFull): Card {
  return { rank, suit: SUIT_FULL_TO_SHORT[suit] };
}

export function toFullSuit(card: Card): { rank: Rank; suit: SuitFull } {
  return { rank: card.rank, suit: SUIT_SHORT_TO_FULL[card.suit] };
}

/** 입력이 string이든 Card든 모두 정규화 Card로 강제 변환 */
export function asCard(input: Card | string): Card {
  return typeof input === "string" ? parseCard(input) : input;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** "As" 같은 짧은 표기의 unicode 슈트 기호 (UI 표시용 헬퍼) */
export const SUIT_SYMBOL: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export function isRedSuit(suit: Suit): boolean {
  return suit === "h" || suit === "d";
}
