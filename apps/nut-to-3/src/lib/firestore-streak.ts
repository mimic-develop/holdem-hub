import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export interface FirestoreStreakData {
  streak: number;
  bestStreak: number;
}

export async function loadStreakFromFirestore(uid: string): Promise<FirestoreStreakData | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        streak: typeof data.nutTo3Streak === "number" ? data.nutTo3Streak : 0,
        bestStreak: typeof data.nutTo3BestStreak === "number" ? data.nutTo3BestStreak : 0,
      };
    }
    return { streak: 0, bestStreak: 0 };
  } catch (e) {
    console.error("[nut-to-3] Firestore load error:", e);
    return null;
  }
}

export async function saveStreakToFirestore(uid: string, streak: number, bestStreak: number): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { nutTo3Streak: streak, nutTo3BestStreak: bestStreak }, { merge: true });
  } catch (e) {
    console.error("[nut-to-3] Firestore save error:", e);
  }
}
