/**
 * Firebase Auth → AuthProvider 팩토리.
 *
 * Firebase SDK는 packages/shared의 직접 의존이 아닌 peerDependency이므로,
 * 호출측(Hub, concept-quiz)이 초기화된 `Auth` 인스턴스를 주입한다.
 *
 * 사용 예 (apps/hub/src/App.tsx):
 *   import { getAuth } from "firebase/auth";
 *   import { createFirebaseAuthProvider, registerAuthProvider } from "@hh/shared";
 *   registerAuthProvider(createFirebaseAuthProvider(getAuth(firebaseApp)));
 */

import type { AuthProvider, AuthUser } from "./types.js";

// Firebase 타입만 import (런타임 SDK는 호출측이 제공하는 Auth 인스턴스에 의존)
type Auth = import("firebase/auth").Auth;
type GoogleAuthProvider = import("firebase/auth").GoogleAuthProvider;

function toAuthUser(fbUser: import("firebase/auth").User): AuthUser {
  return {
    id: fbUser.uid,
    displayName: fbUser.displayName,
    email: fbUser.email,
    photoURL: fbUser.photoURL,
  };
}

/**
 * Firebase Auth 인스턴스를 받아 AuthProvider를 반환한다.
 *
 * @param auth         - getAuth(app) 결과
 * @param provider     - new GoogleAuthProvider() 결과 (선택; 미제공 시 내부에서 생성)
 */
export function createFirebaseAuthProvider(
  auth: Auth,
  provider?: GoogleAuthProvider,
): AuthProvider {
  // dynamic import로 Firebase SDK 런타임 함수 로드 — peerDependency이므로 호출측 번들에만 존재.
  // NOTE: Vite는 dynamic import를 정적 분석에서 제외하므로 tree-shaking 문제 없음.
  async function getFirebaseFns() {
    const { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider: GAPCtor } =
      await import("firebase/auth");
    const resolvedProvider = provider ?? new GAPCtor();
    return { signInWithPopup, signOut, onAuthStateChanged, resolvedProvider };
  }

  return {
    name: "firebase",

    getCurrentUser() {
      const u = auth.currentUser;
      return u ? toAuthUser(u) : null;
    },

    async signIn() {
      const { signInWithPopup, resolvedProvider } = await getFirebaseFns();
      const result = await signInWithPopup(auth, resolvedProvider);
      return toAuthUser(result.user);
    },

    async signOut() {
      const { signOut } = await getFirebaseFns();
      await signOut(auth);
    },

    onAuthChange(cb) {
      // onAuthStateChanged는 동기적으로 unsubscribe 함수를 반환한다.
      // dynamic import 전에 등록해야 초기 상태를 놓치지 않으므로, 동기 등록.
      // firebase/auth가 peerDependency이므로 번들에 이미 포함됨 (Hub가 deps에 추가한 경우).
      let unsubscribe: (() => void) | null = null;
      import("firebase/auth").then(({ onAuthStateChanged }) => {
        unsubscribe = onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
      });
      return () => {
        unsubscribe?.();
      };
    },
  };
}
