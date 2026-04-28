import type { AuthProvider } from "./types.js";

/**
 * 인증을 사용하지 않을 때의 no-op provider.
 *
 * `VITE_AUTH_PROVIDER`가 비어 있거나 `'none'`일 때 활성. signIn 호출은 명시적
 * 에러를 던져 호출 측에서 "인증 비활성" 메시지를 사용자에게 보여줄 수 있도록 한다.
 */
export function createNoneAuthStub(): AuthProvider {
  return {
    name: "none",
    async signIn() {
      throw new Error("인증 provider가 설정되지 않았습니다. VITE_AUTH_PROVIDER를 확인하세요.");
    },
    async signOut() {
      // no-op
    },
    getCurrentUser() {
      return null;
    },
    onAuthChange() {
      return () => undefined;
    },
  };
}
