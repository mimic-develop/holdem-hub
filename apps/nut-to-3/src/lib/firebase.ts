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
  // Hub 가 "hub" 이름으로 동일 config 로 초기화한 Firebase 앱을 우선 재사용한다.
  // 같은 앱을 공유해야 Hub 의 Firebase Auth state 가 Firestore 요청에 자동으로 첨부되어
  // rules 의 `request.auth.uid` 검증을 통과한다. 별도 앱이면 unauthenticated 로 가서 거부됨.
  // 폴백: hub 앱이 없으면(예: 단독 dev) 자체 "nut-to-3" 앱 생성.
  const hubApp = getApps().find((a) => a.name === "hub");
  const existing = hubApp ?? getApps().find((a) => a.name === APP_NAME);
  const app = existing ?? initializeApp(firebaseConfig, APP_NAME);
  _db = getFirestore(app);
}

export const db = _db as Firestore;
