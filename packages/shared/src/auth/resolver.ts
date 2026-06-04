/**
 * 활성 인증 provider 결정 (lazy singleton).
 *
 * `VITE_AUTH_PROVIDER` 환경변수에 따라 분기:
 *  - `firebase` → registerAuthProvider()로 등록된 Firebase 인스턴스 사용.
 *                 미등록 상태면 "대기 프록시"를 반환 — 등록 즉시 자동 연결됨.
 *  - `mimic`    → `createMimicAuthStub()` (현재는 throw).
 *  - 기타/미설정 → `createNoneAuthStub()`.
 *
 * Hub App.tsx에서 Firebase 초기화 후 반드시 registerAuthProvider()를 호출해야
 * Navbar 로그인이 동작한다.
 */
import type { AuthProvider, AuthProviderName } from "./types.js";
import { createMimicAuthStub } from "./mimic.js";
import { createNoneAuthStub } from "./none.js";
import { createMockAuthStub } from "./mock.js";

let cached: AuthProvider | null = null;

/**
 * mock 모드 여부. `VITE_MOCK=true`이면 provider 설정(`VITE_AUTH_PROVIDER`)과 무관하게
 * 자동 로그인된 mock provider를 사용한다.
 *
 * import.meta.env 직접 접근 — optional chaining 금지 (Vite static 주입 패턴 보존).
 */
function isMockMode(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  return env?.VITE_MOCK === "true";
}
/** 외부에서 주입된 provider (registerAuthProvider로 설정) */
let registered: AuthProvider | null = null;
/** Firebase provider가 등록되길 기다리는 콜백 목록 */
const pendingCallbacks: Array<(provider: AuthProvider) => void> = [];

function readProviderName(): AuthProviderName {
  // Vite는 `import.meta.env` 패턴을 static으로 감지해 모듈 상단에 env 객체를 주입한다.
  // 따라서 `import.meta?.env` 같은 optional chaining은 절대 사용하지 말 것 — 패턴이 깨져
  // 주입이 일어나지 않고 런타임에 undefined가 된다.
  // ESM 모듈에서 `import.meta`는 항상 정의되므로 직접 접근이 안전하다.
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const raw = env?.VITE_AUTH_PROVIDER;
  if (typeof raw !== "string") return "none";
  const norm = raw.trim().toLowerCase();
  if (norm === "firebase" || norm === "mimic") return norm;
  return "none";
}

/**
 * Firebase SDK 동적 import가 완료되기 전에 useAuthState()가 호출될 수 있다.
 * 이 프록시는 즉시 반환되지만, registerAuthProvider()가 호출되는 순간 자동으로
 * 실제 provider에 위임한다. onAuthChange 구독도 등록 즉시 연결된다.
 */
function createFirebasePendingProxy(): AuthProvider {
  return {
    name: "firebase" as const,

    getCurrentUser() {
      return registered?.getCurrentUser() ?? null;
    },

    signIn() {
      if (!registered) {
        return Promise.reject(
          new Error("Firebase 로그인 준비 중입니다. 잠시 후 다시 시도하세요."),
        );
      }
      return registered.signIn();
    },

    signOut() {
      return registered?.signOut() ?? Promise.resolve();
    },

    onAuthChange(cb) {
      // 이미 등록돼 있으면 즉시 구독
      if (registered) {
        return registered.onAuthChange(cb);
      }
      // 아직 미등록 — registerAuthProvider() 호출 시 자동 연결
      let unsub: (() => void) | null = null;
      const onReady = (provider: AuthProvider) => {
        unsub = provider.onAuthChange(cb);
      };
      pendingCallbacks.push(onReady);
      return () => {
        unsub?.();
      };
    },
  };
}

/**
 * Hub(또는 sub-app) 진입 시 Firebase 초기화 후 이 함수로 provider를 등록한다.
 * 대기 중인 onAuthChange 구독자들이 있으면 즉시 연결한다.
 *
 * 예) apps/hub/src/App.tsx:
 *   registerAuthProvider(createFirebaseAuthProvider(firebaseAuth));
 */
export function registerAuthProvider(provider: AuthProvider): void {
  registered = provider;
  cached = provider; // 기존 캐시도 교체

  // 대기 중인 구독자 즉시 연결
  const waiting = pendingCallbacks.splice(0);
  waiting.forEach((cb) => cb(provider));
}

export function getActiveAuthProvider(): AuthProvider {
  if (cached) return cached;
  if (isMockMode()) {
    // VITE_MOCK=true — 로그인 없이 항상 인증된 mock 사용자
    cached = createMockAuthStub();
    return cached;
  }
  const name = readProviderName();
  if (name === "firebase") {
    // 이미 등록돼 있으면 바로 사용, 없으면 대기 프록시 반환
    cached = registered ?? createFirebasePendingProxy();
  } else if (name === "mimic") {
    cached = createMimicAuthStub();
  } else {
    cached = createNoneAuthStub();
  }
  return cached;
}

/** 테스트 / dev 도구용 — 캐시된 provider 강제 초기화. */
export function _resetAuthProviderForTests(): void {
  cached = null;
  registered = null;
  pendingCallbacks.length = 0;
}
