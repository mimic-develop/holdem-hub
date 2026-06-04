import type { AuthProvider, AuthUser } from "./types.js";

/**
 * mock 모드 전용 auth provider.
 *
 * `VITE_MOCK=true`일 때 resolver가 이걸 선택한다. 항상 로그인된 가짜 사용자를
 * 반환하므로, 로그인 없이도 인증이 필요한 화면/기능이 모두 동작한다.
 */
const MOCK_USER: AuthUser = {
  id: "mock-user-1",
  displayName: "테스트 유저",
  email: "test@mock.local",
  nickname: "목유저",
};

export function createMockAuthStub(): AuthProvider {
  return {
    name: "mock",
    async signIn() {
      return MOCK_USER;
    },
    async signOut() {
      // no-op — mock 모드에선 항상 로그인 상태 유지
    },
    getCurrentUser() {
      return MOCK_USER;
    },
    onAuthChange(cb) {
      // 즉시 로그인 상태 통지 (구독 시점에 동기 호출)
      cb(MOCK_USER);
      return () => undefined;
    },
  };
}
