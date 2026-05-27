import { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { CATEGORIES, type CategorySlug } from "../lib/categories";
import type { Difficulty } from "../lib/quizData";
import { useAuth } from "./useAuth";
import { apiFetch } from "@hh/shared";
import { LastClearedCardContext } from "../contexts/LastClearedCard";

const SUITS: Difficulty[] = ["club", "diamond", "heart", "spade"];
const TOTAL_CARDS = SUITS.length * CATEGORIES.length;

function cardKey(slug: CategorySlug, suit: Difficulty): string {
  return `${slug}:${suit}`;
}

function deckIndexOf(slug: CategorySlug, suit: Difficulty): number {
  const catIdx = CATEGORIES.findIndex(c => c.slug === slug);
  const suitIdx = SUITS.indexOf(suit);
  if (catIdx < 0 || suitIdx < 0) return -1;
  return suitIdx * CATEGORIES.length + catIdx;
}

function cardAtDeckIndex(idx: number): { slug: CategorySlug; suit: Difficulty } | null {
  if (idx < 0 || idx >= TOTAL_CARDS) return null;
  const catIdx = idx % CATEGORIES.length;
  const suitIdx = Math.floor(idx / CATEGORIES.length);
  return { slug: CATEGORIES[catIdx].slug, suit: SUITS[suitIdx] };
}

/** lastClearedCard 기준으로 덱 0번 ~ lastIndex 범위의 cleared Set 생성 */
function computeClearedSet(
  lastClearedCard: { category: string; difficulty: string } | null,
): Set<string> {
  if (!lastClearedCard) return new Set();
  const lastIndex = deckIndexOf(
    lastClearedCard.category as CategorySlug,
    lastClearedCard.difficulty as Difficulty,
  );
  if (lastIndex < 0) return new Set();
  const result = new Set<string>();
  for (let i = 0; i <= lastIndex; i++) {
    const card = cardAtDeckIndex(i);
    if (card) result.add(cardKey(card.slug, card.suit));
  }
  return result;
}

// ── module-level in-memory store ──────────────────────────────────────────
// localStorage 완전 제거. lastClearedCard prop → computeClearedSet() → snapshot.
let listeners: Array<() => void> = [];
let snapshot: Set<string> = new Set();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function getSnapshot() {
  return snapshot;
}
// ─────────────────────────────────────────────────────────────────────────

/** POST /play-lab/quiz-clear — 카드 클리어 기록 */
async function saveProgress(slug: CategorySlug, suit: Difficulty): Promise<void> {
  try {
    await apiFetch("/play-lab/quiz-clear", {
      method: "POST",
      body: JSON.stringify({ category: slug, difficulty: suit }),
    });
  } catch (e) {
    console.error("saveProgress error:", e);
  }
}

export function useProgress() {
  const { user } = useAuth();
  const lastClearedCard = useContext(LastClearedCardContext);
  const cleared = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const prevCardKeyRef = useRef<string | undefined>(undefined);

  // lastClearedCard 변경 시마다 snapshot 재계산 (in-memory only, no localStorage)
  useEffect(() => {
    const cardStr = lastClearedCard
      ? `${lastClearedCard.category}:${lastClearedCard.difficulty}`
      : "";
    if (cardStr === prevCardKeyRef.current) return;
    prevCardKeyRef.current = cardStr;
    snapshot = computeClearedSet(lastClearedCard);
    emitChange();
  }, [lastClearedCard]);

  const isCardCleared = useCallback(
    (slug: CategorySlug, suit: Difficulty) => cleared.has(cardKey(slug, suit)),
    [cleared],
  );

  const isCardUnlocked = useCallback(
    (slug: CategorySlug, suit: Difficulty) => {
      const di = deckIndexOf(slug, suit);
      if (di === 0) return true;
      if (di < 0) return false;
      const prev = cardAtDeckIndex(di - 1);
      if (!prev) return false;
      return cleared.has(cardKey(prev.slug, prev.suit));
    },
    [cleared],
  );

  const markCardCleared = useCallback((slug: CategorySlug, suit: Difficulty) => {
    const key = cardKey(slug, suit);
    if (snapshot.has(key)) return;
    snapshot = new Set([...snapshot, key]);
    emitChange();
    if (user) void saveProgress(slug, suit);
  }, [user]);

  const getNextCard = useCallback(
    (slug: CategorySlug, suit: Difficulty): { slug: CategorySlug; suit: Difficulty } | null => {
      const di = deckIndexOf(slug, suit);
      return cardAtDeckIndex(di + 1);
    },
    [],
  );

  const currentStepIndex = (() => {
    for (let i = 0; i < TOTAL_CARDS; i++) {
      const card = cardAtDeckIndex(i);
      if (!card) continue;
      if (i === 0 || (() => {
        const prev = cardAtDeckIndex(i - 1);
        return prev ? cleared.has(cardKey(prev.slug, prev.suit)) : false;
      })()) {
        if (!cleared.has(cardKey(card.slug, card.suit))) return i;
      }
    }
    return TOTAL_CARDS - 1;
  })();

  return { isCardCleared, isCardUnlocked, markCardCleared, getNextCard, currentStepIndex, cleared };
}
