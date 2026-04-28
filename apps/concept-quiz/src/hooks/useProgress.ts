import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { CATEGORIES, type CategorySlug } from "../lib/categories";
import type { Difficulty } from "../lib/quizData";
import { useAuth } from "./useAuth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

const SUITS: Difficulty[] = ["club", "diamond", "heart", "spade"];
const TOTAL_CARDS = SUITS.length * CATEGORIES.length;
// 모노레포에서 다른 앱과 키 충돌을 막기 위해 `concept-quiz:` prefix 부여
const ANON_STORAGE_KEY = "concept-quiz:pokeriq_cleared_cards";

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

async function loadFromFirestore(uid: string): Promise<Set<string>> {
  if (!isFirebaseConfigured) return new Set();
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.clearedCards)) {
        return new Set(data.clearedCards as string[]);
      }
    }
  } catch (e) {
    console.error("Firestore load error:", e);
  }
  return new Set();
}

async function saveToFirestore(uid: string, cards: Set<string>) {
  if (!isFirebaseConfigured) return;
  try {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { clearedCards: Array.from(cards), updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error("Firestore save error:", e);
  }
}

let syncVersion = 0;

async function mergeAndSync(uid: string) {
  const myVersion = ++syncVersion;
  const targetKey = storageKeyForUid(uid);

  setActiveKey(targetKey);

  const anonData = readLocal(ANON_STORAGE_KEY);
  const remoteData = await loadFromFirestore(uid);

  if (syncVersion !== myVersion) return;

  const freshUserData = readLocal(targetKey);
  const merged = new Set(Array.from(freshUserData));
  anonData.forEach(v => merged.add(v));
  remoteData.forEach(v => merged.add(v));

  writeLocal(targetKey, merged);
  emitChange();
  await saveToFirestore(uid, merged);
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
      mergeAndSync(uid);
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
    if (user) {
      saveToFirestore(user.uid, current);
    }
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
