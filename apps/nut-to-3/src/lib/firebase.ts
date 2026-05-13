import { getApps, initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

interface ViteEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}
const env = (import.meta as unknown as { env: ViteEnv }).env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

const APP_NAME = "nut-to-3";

let _db: Firestore | null = null;

if (isFirebaseConfigured) {
  // 전용 앱 이름으로 초기화 — Hub가 "hub" 이름으로 이미 초기화한 경우 기본 앱([DEFAULT])이 없어
  // getApp()을 호출하면 에러가 나므로, "nut-to-3" 이름으로 별도 관리.
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app = existing ?? initializeApp(firebaseConfig, APP_NAME);
  _db = getFirestore(app);
}

export const db = _db as Firestore;
