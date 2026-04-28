/**
 * Nut 평가 엔진 — Nut-to-3 원본 server 로직 그대로 이식
 *
 * 보드(3~5장)에서 가능한 모든 2장 홀카드 조합을 평가해 강도순으로 정렬하고,
 * 상위 3개 강도 티어(Nut / 2nd Nut / 3rd Nut)를 추출한다.
 * pokersolver의 `Hand.solve` / `Hand.winners`를 사용하므로 Node 환경 전용.
 */
// @ts-expect-error — pokersolver 는 자체 타입을 제공하지 않음
import pokersolver from "pokersolver";
const { Hand } = pokersolver;

export interface EvaluatedHand {
  cards: string[];          // all 2 hole cards dealt
  usedHoleCards: string[];  // which of the 2 hole cards actually appear in the best 5-card hand
  handRank: any;            // pokersolver Hand object (best 5 of 7)
  descr: string;            // pokersolver descr, e.g. "Flush, A High"
  categoryRank: number;     // 1–9 from pokersolver
}

export interface NutResult {
  cards: string[];      // the 2 hole cards
  descr: string;        // Korean description
  koreanDescr: string;  // short Korean hand name
}

const FULL_DECK: string[] = [];
for (const suit of ["s", "h", "d", "c"]) {
  for (const rank of ["2","3","4","5","6","7","8","9","T","J","Q","K","A"]) {
    FULL_DECK.push(rank + suit);
  }
}

/**
 * Evaluates all possible 2-card hole card combinations against the board.
 * Uses pokersolver's best-5-of-7 selection (hole cards do NOT have to be used).
 * Returns them sorted from strongest to weakest.
 */
export function evaluateAllHands(
  board: string[],
  usedCardSet: Set<string>
): EvaluatedHand[] {
  const remaining = FULL_DECK.filter(c => !usedCardSet.has(c));
  const evaluations: EvaluatedHand[] = [];

  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const hole = [remaining[i], remaining[j]];
      const combined = [...board, ...hole];
      try {
        const handRank = Hand.solve(combined);
        // Determine which hole cards are actually in the best 5.
        // pokersolver stores cards as { value, suit }. Special case:
        // In a wheel straight (A-2-3-4-5), the Ace is stored as value='1' (not 'A').
        const best5Keys = new Set(
          (handRank.cards as Array<{ value: string; suit: string }>)
            .map(c => c.value + c.suit)
        );
        const usedHoleCards = hole.filter(c => {
          if (best5Keys.has(c)) return true;
          // Handle Ace-as-low in wheel straights: 'As' may appear as '1s'
          const rank = c.slice(0, -1);
          const suit = c.slice(-1);
          return rank === "A" && best5Keys.has("1" + suit);
        });

        evaluations.push({
          cards: hole,
          usedHoleCards,
          handRank,
          descr: handRank.descr || handRank.name,
          categoryRank: handRank.rank,
        });
      } catch {
        // skip invalid
      }
    }
  }

  return sortEvaluations(evaluations);
}

/**
 * Sort evaluations from strongest to weakest.
 * Groups by rank category, then uses Hand.winners iteratively within each group.
 */
function sortEvaluations(evaluations: EvaluatedHand[]): EvaluatedHand[] {
  const groups = new Map<number, EvaluatedHand[]>();
  for (const ev of evaluations) {
    const r = ev.categoryRank;
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(ev);
  }

  const sortedRanks = [...groups.keys()].sort((a, b) => b - a);
  const result: EvaluatedHand[] = [];
  for (const rank of sortedRanks) {
    const group = groups.get(rank)!;
    result.push(...sortGroupByWinners(group));
  }
  return result;
}

/**
 * Sort a group of same-category hands from strongest to weakest
 * using Hand.winners iteratively.
 */
function sortGroupByWinners(group: EvaluatedHand[]): EvaluatedHand[] {
  if (group.length <= 1) return group;

  const result: EvaluatedHand[] = [];
  let remaining = [...group];

  while (remaining.length > 0) {
    const winners = Hand.winners(remaining.map(h => h.handRank));
    const winnerItems = remaining.filter(h => winners.includes(h.handRank));
    result.push(...winnerItems);
    remaining = remaining.filter(h => !winners.includes(h.handRank));
  }

  return result;
}

/**
 * NutTier describes one strength tier (Nut / 2nd Nut / 3rd Nut).
 * validCombos lists every 2-card hole combo that achieves this tier's strength.
 * exampleCards/exampleDescr give one representative combo for showing the answer.
 */
export interface NutTier {
  koreanDescr: string;
  descr: string;
  validCombos: string[][];
  validSingleCards: string[];  // hole cards that alone are sufficient (1-hole-card hands)
  isBoardPlay: boolean;        // true if ALL hands in tier use 0 hole cards
  exampleCards: string[];
  exampleDescr: string;
}

/**
 * Extracts the top N strength tiers from the given board.
 * Returns full validCombos for each tier (used for answer checking).
 */
export function extractNutTiers(board: string[], maxTiers = 3): NutTier[] {
  const usedCardSet = new Set(board);
  const sorted = evaluateAllHands(board, usedCardSet);
  if (sorted.length === 0) return [];

  const tiers: NutTier[] = [];
  let i = 0;

  while (i < sorted.length && tiers.length < maxTiers) {
    const tierLeader = sorted[i];
    let tierEnd = i + 1;
    while (
      tierEnd < sorted.length &&
      Hand.winners([tierLeader.handRank, sorted[tierEnd].handRank]).length === 2
    ) {
      tierEnd++;
    }

    const tierHands = sorted.slice(i, tierEnd);
    const validCombos = tierHands.map(ev => ev.cards);

    // Pick representative with minimum card conflicts against already-chosen examples
    const usedCards = new Set(tiers.flatMap(t => t.exampleCards));
    let representative = tierHands[0];
    let minConflicts = Infinity;
    for (const hand of tierHands) {
      const conflicts = hand.cards.filter(c => usedCards.has(c)).length;
      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        representative = hand;
        if (conflicts === 0) break;
      }
    }

    // Compute 1-hole-card info
    const singleCardHands = tierHands.filter(h => h.usedHoleCards.length === 1);
    const validSingleCards = [...new Set(singleCardHands.map(h => h.usedHoleCards[0]))];
    const isBoardPlay = tierHands.every(h => h.usedHoleCards.length === 0);

    tiers.push({
      koreanDescr: toKorean(tierLeader),
      descr: tierLeader.descr,
      validCombos,
      validSingleCards,
      isBoardPlay,
      exampleCards: representative.cards,
      exampleDescr: buildDescription(representative, board),
    });

    i = tierEnd;
  }

  return tiers;
}

/**
 * Build a Korean description that correctly reflects how many hole cards are used.
 *
 *  - 0 hole cards used → "족보 — 보드 플레이 (홀카드 불필요)"
 *  - 1 hole card used  → "족보 — 홀카드 1장: X♠"
 *  - 2 hole cards used → "족보 — 홀카드: X♠ Y♦"
 */
function buildDescription(ev: EvaluatedHand, _board: string[]): string {
  const korean = toKorean(ev);

  // Get detail from pokersolver descr e.g. "Straight, A High" → "A High"
  const rawDescr = ev.descr || "";
  const commaIdx = rawDescr.indexOf(",");
  const detail = commaIdx > -1 ? rawDescr.slice(commaIdx + 1).trim() : "";
  const prefix = detail ? `${korean} (${detail})` : korean;

  const used = ev.usedHoleCards;

  if (used.length === 0) {
    return `${prefix} — 보드 플레이 (홀카드 불필요)`;
  }
  if (used.length === 1) {
    const usedCard = formatCard(used[0]);
    const unusedCard = ev.cards.find(c => c !== used[0])!;
    return `${prefix} — 홀카드 1장: ${usedCard} (${formatCard(unusedCard)} 미사용)`;
  }
  return `${prefix} — 홀카드: ${used.map(formatCard).join(" ")}`;
}

/**
 * Korean hand name
 */
function toKorean(ev: EvaluatedHand): string {
  const descr = (ev.descr || "").toLowerCase();
  const rank = ev.categoryRank;

  if (descr.includes("royal")) return "로열 플러시";
  if (rank === 9) return "스트레이트 플러시";
  if (rank === 8 || descr.includes("four of a kind")) return "포카드";
  if (rank === 7 || descr.includes("full house")) return "풀하우스";
  if (rank === 6 || descr.includes("flush")) return "플러시";
  if (rank === 5 || descr.includes("straight")) return "스트레이트";
  if (rank === 4 || descr.includes("three of a kind")) return "트리플";
  if (rank === 3 || descr.includes("two pair")) return "투페어";
  if (rank === 2 || descr.includes("pair")) return "원페어";
  return "하이카드";
}

/**
 * Format a card like "As" => "A♠", "Kh" => "K♥"
 */
export function formatCard(card: string): string {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitSymbol: Record<string, string> = {
    s: "♠", h: "♥", d: "♦", c: "♣"
  };
  return rank + (suitSymbol[suit] || suit);
}
