/**
 * 활성 인증 provider 결정 (lazy singleton).
 *
 * `VITE_AUTH_PROVIDER` 환경변수에 따라 분기:
 *  - `firebase` → 현재는 stub (실제 Firebase 인증은 concept-quiz 내부에서 자체 처리).
 *                Hub navbar 레벨의 통합 로그인은 추후 작업 (Mimic 통합 시 함께).
 *  - `mimic`    → `createMimicAuthStub()` (현재는 throw).
 *  - 기타/미설정 → `createNoneAuthStub()`.
 *
 * "stub" 단계에서는 실제 OAuth 흐름이 동작하지 않는 게 정상이다 — Hub navbar 버튼은
 * 사용자에게 "아직 구현되지 않음" 메시지를 띄우는 자리만 마련한다.
 */
import type { AuthProvider, AuthProviderName } from "./types.js";
import { createMimicAuthStub } from "./mimic.js";
import { createNoneAuthStub } from "./none.js";

let cached: AuthProvider | null = null;

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

export function getActiveAuthProvider(): AuthProvider {
  if (cached) return cached;
  const name = readProviderName();
  // Firebase 통합 로그인은 미구현 — concept-quiz가 자체 내부에서 Firebase Auth 사용.
  // Hub 레벨에서는 mimic 도입 시 함께 정리할 자리만 남겨둔다.
  cached = name === "mimic" ? createMimicAuthStub() : createNoneAuthStub();
  return cached;
}

/** 테스트 / dev 도구용 — 캐시된 provider 강제 초기화. */
export function _resetAuthProviderForTests(): void {
  cached = null;
}
