import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Vite의 import.meta.env 타입을 로컬에 자체 선언 (vite 의존성 없이도 타입 통과)
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

/**
 * Firebase 초기화 — VITE_FIREBASE_* env vars 필요.
 *
 * env 키가 비어 있으면 Firebase initializeApp이 throw하므로 일단 자리만 마련하고
 * 실제 동작은 사용자가 .env.local에 키를 채울 때 활성화된다.
 *
 * 키가 없을 때도 UI 자체는 로드되도록 try/catch로 감싼다.
 */
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

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "[concept-quiz] VITE_FIREBASE_API_KEY 가 비어 있습니다. .env.local 을 채워야 로그인/진행률 저장이 동작합니다.",
  );
}

// 호환성 유지: 기존 코드가 `auth`, `db` 를 직접 import 함.
// null인 채로 쓰면 런타임 에러가 나므로, AuthGuard/Login이 isFirebaseConfigured를 체크해야 안전.
export const auth = _auth as Auth;
export const db = _db as Firestore;
export const googleProvider = new GoogleAuthProvider();
