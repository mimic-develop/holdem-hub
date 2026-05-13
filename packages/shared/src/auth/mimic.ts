import type { AuthProvider, AuthUser } from "./types.js";

const STORAGE_KEY = "mimic:auth_user";

const MIMIC_USER: AuthUser = {
  id: "mimic-user-001",
  displayName: "MIMIC User",
  email: "user@mimic.gg",
  photoURL: null,
};

/**
 * Mimic 인증 provider — sessionStorage 기반 로컬 mock.
 *
 * VITE_AUTH_PROVIDER=mimic 설정 시 활성화.
 * Firebase 없이 로그인 흐름을 테스트할 때 사용.
 * 탭을 닫으면 세션이 초기화된다.
 */
export function createMimicAuthStub(): AuthProvider {
  const listeners = new Set<(user: AuthUser | null) => void>();

  function readUser(): AuthUser | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  function notify(user: AuthUser | null) {
    listeners.forEach((cb) => cb(user));
  }

  return {
    name: "mimic",

    async signIn() {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(MIMIC_USER));
      notify(MIMIC_USER);
      return MIMIC_USER;
    },

    async signOut() {
      sessionStorage.removeItem(STORAGE_KEY);
      notify(null);
    },

    getCurrentUser() {
      return readUser();
    },

    onAuthChange(cb) {
      listeners.add(cb);
      // 현재 세션 상태를 즉시 전달
      cb(readUser());
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
