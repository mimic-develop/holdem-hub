import type { AuthProvider } from "./types.js";

/**
 * Mimic 서버 OAuth provider stub.
 *
 * TODO: Mimic 서버 인증 사양 확정 후 실제 구현.
 *  - signIn() 시 Mimic OAuth 페이지로 redirect (또는 popup)
 *  - 콜백 처리 후 토큰을 sessionStorage에 보관
 *  - getCurrentUser() / onAuthChange()는 토큰 만료 감시
 */
export function createMimicAuthStub(): AuthProvider {
  return {
    name: "mimic",
    async signIn() {
      throw new Error("Mimic 인증은 아직 구현되지 않았습니다.");
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
