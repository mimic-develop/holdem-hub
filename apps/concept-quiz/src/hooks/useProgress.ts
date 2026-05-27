import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { CATEGORIES, type CategorySlug } from "../lib/categories";
import type { Difficulty } from "../lib/quizData";
import { useAuth } from "./useAuth";
import { apiFetch } from "@hh/shared";

const SUITS: Difficulty[] = ["club", "diamond", "heart", "spade"];
const TOTAL_CARDS = SUITS.length * CATEGORIES.length;
// 모노레포에서 다른 앱과 키 충돌을 막기 위해 `concept-quiz:` prefix 부여
const ANON_STORAGE_KEY = "concept-quiz:pokeriq_cleared_cards";
const MIMIC_TOKEN_KEY = "mimic:accessToken";

function storageKeyForUid(uid: string | null): string {
  return uid ? `concept-quiz:pokeriq_cleared_cards:${uid}` : ANON_STORAGE_KEY;
}

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

function readLocal(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeLocal(key: string, cards: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(cards)));
}

let activeKey = ANON_STORAGE_KEY;
let listeners: Array<() => void> = [];
let snapshot = readLocal(activeKey);

function emitChange() {
  snapshot = readLocal(activeKey);
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

function setActiveKey(key: string) {
  activeKey = key;
  emitChange();
}

function getToken(): string | null {
  return localStorage.getItem(MIMIC_TOKEN_KEY);
}

/** GET /api/play-lap/home → lastClearedCard로 cleared Set 복원 */
async function loadProgress(): Promise<Set<string>> {
  const token = getToken();
  if (!token) return new Set();
  try {
    const res = await apiFetch<{
      lastClearedCard: { category: string; difficulty: string } | null;
    }>("/play-lap/home", { authToken: token });
    if (!res.lastClearedCard) return new Set();
    const lastIndex = deckIndexOf(
      res.lastClearedCard.category as CategorySlug,
      res.lastClearedCard.difficulty as Difficulty,
    );
    if (lastIndex < 0) return new Set();
    return new Set(
      Array.from({ length: lastIndex + 1 }, (_, i) => {
        const card = cardAtDeckIndex(i);
        return card ? cardKey(card.slug, card.suit) : null;
      }).filter((k): k is string => k !== null),
    );
  } catch {
    return new Set();
  }
}

/** POST /api/play-lap/quiz-clear — 카드 클리어 기록 */
async function saveProgress(slug: CategorySlug, suit: Difficulty): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await apiFetch("/play-lap/quiz-clear", {
      method: "POST",
      authToken: token,
      body: JSON.stringify({ category: slug, difficulty: suit }),
    });
  } catch (e) {
    console.error("saveProgress error:", e);
  }
}

export function useProgress() {
  const { user } = useAuth();
  const cleared = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const prevUidRef = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.uid ?? null;
    if (uid === prevUidRef.current) return;
    prevUidRef.current = uid;

    if (uid) {
      const targetKey = storageKeyForUid(uid);
      setActiveKey(targetKey);
      loadProgress().then(remote => {
        const local = readLocal(targetKey);
        const merged = new Set([...local, ...remote]);
        writeLocal(targetKey, merged);
        emitChange();
      }).catch(() => {});
    } else {
      setActiveKey(storageKeyForUid(null));
    }
  }, [user]);

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
    const current = readLocal(activeKey);
    if (current.has(key)) return;
    current.add(key);
    writeLocal(activeKey, current);
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
