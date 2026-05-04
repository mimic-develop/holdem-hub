import { createContext, useContext } from "react";
import { useAuthState } from "@hh/shared";

/**
 * concept-quiz 내부에서 사용하는 사용자 타입.
 * Firebase User 전체 대신 실제로 쓰는 필드만 선언.
 */
export interface ConceptUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextValue {
  user: ConceptUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export { AuthContext };

/**
 * Hub 전역 로그인 상태를 concept-quiz 내부 AuthContext 형식으로 변환.
 *
 * 실제 Google 로그인은 Hub 상단 네비게이션에서만 수행한다.
 * concept-quiz는 Firestore 읽기/쓰기만 담당하고, 인증 상태는 Hub에 위임.
 */
export function useAuthProvider(): AuthContextValue {
  const { user, busy, signIn, signOut: sharedSignOut } = useAuthState();

  return {
    user: user
      ? {
          uid: user.id,
          displayName: user.displayName ?? null,
          email: user.email ?? null,
          photoURL: user.photoURL ?? null,
        }
      : null,
    loading: busy,
    signInWithGoogle: async () => {
      await signIn();
    },
    signOut: async () => {
      await sharedSignOut();
    },
  };
}

export function useAuth() {
  return useContext(AuthContext);
}
