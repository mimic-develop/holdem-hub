import Cookies from "js-cookie";
import { getStoredItem, setStoredItem, storageKey } from "../lib/storage.js";
import type { AuthProvider, AuthUser } from "./types.js";

const COOKIE_ACCESS  = "accessToken";
const COOKIE_REFRESH = "refresh_token";
/** 로그인 페이지의 "자동 로그인" 체크 여부. 다음 로그인 화면의 기본값으로도 쓴다. */
const AUTO_LOGIN_KEY = storageKey("mimic", "auto-login");

/** 한 번도 고른 적이 없으면(또는 저장소를 못 읽으면) 꺼진 것으로 본다. */
export function isAutoLoginEnabled(): boolean {
  return getStoredItem(AUTO_LOGIN_KEY) === "1";
}

/** 저장소를 못 쓰는 환경(시크릿 모드 등)이면 저장되지 않고 기본값(꺼짐)으로 동작한다. */
export function setAutoLoginEnabled(enabled: boolean): void {
  setStoredItem(AUTO_LOGIN_KEY, enabled ? "1" : "0");
}

/**
 * production(HTTPS)은 Secure 플래그, localhost dev(HTTP)는 생략.
 * days를 생략하면 세션 쿠키가 된다 → 브라우저를 닫으면 사라진다.
 */
function cookieOpts(days?: number): Cookies.CookieAttributes {
  return {
    ...(days !== undefined ? { expires: days } : {}),
    sameSite: "Lax",
    ...(typeof location !== "undefined" && location.protocol === "https:"
      ? { secure: true }
      : {}),
  };
}

// ── 모듈 레벨 헬퍼 (SnsCallback / OAuthCallback 에서도 사용) ────────────

/**
 * 토큰을 쿠키에 저장하고 'mimic:token-set' 이벤트를 dispatch한다.
 * 쿠키 수명은 자동 로그인 여부(isAutoLoginEnabled)를 직접 읽어 정한다 — 콜백/갱신 어디서 불려도 같은 규칙.
 */
export function setTokens(accessToken: string, refreshToken?: string | null): void {
  const autoLogin = isAutoLoginEnabled();
  // 자동 로그인 켜짐: 1일짜리 쿠키 / 꺼짐: 세션 쿠키 (브라우저를 닫으면 삭제)
  Cookies.set(COOKIE_ACCESS, accessToken, cookieOpts(autoLogin ? 1 : undefined));
  // 우리 도메인 refresh_token 쿠키는 "로그아웃하지 않았다"는 표시다.
  // 자동 로그인을 끈 경우엔 저장하지 않는다(남아 있던 것도 지운다).
  if (!autoLogin) {
    Cookies.remove(COOKIE_REFRESH);
  } else if (refreshToken) {
    Cookies.set(COOKIE_REFRESH, refreshToken, cookieOpts(30));
  }
  // onAuthChange의 handleTokenSet이 이 이벤트를 받아 notify(readUser())를 호출함
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mimic:token-set"));
  }
}

/** 쿠키에서 토큰을 삭제한다. */
export function clearTokens(): void {
  Cookies.remove(COOKIE_ACCESS);
  Cookies.remove(COOKIE_REFRESH);
}

// ──────────────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // atob()는 Latin-1 바이너리 문자열을 반환 → UTF-8 한글이 깨짐.
    // Uint8Array로 변환 후 TextDecoder로 올바르게 디코딩.
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function payloadToUser(payload: Record<string, unknown>): AuthUser {
  const nick = typeof payload.nick === "string" ? payload.nick : null;
  return {
    id: String(payload.sub ?? payload.id ?? ""),
    email: typeof payload.email === "string" ? payload.email : null,
    displayName: nick ?? (typeof payload.name === "string" ? payload.name : null),
    photoURL: null,
    nickname: nick,
  };
}

/**
 * MIMIC 서버 인증 provider.
 *
 * VITE_AUTH_PROVIDER=mimic 설정 시 활성화.
 * 로그인 자체는 통합 로그인 페이지(리다이렉트 + code 플로우)가 전담하고,
 * 이 provider는 쿠키에 저장된 토큰을 읽어 세션 상태만 관리한다.
 */
export function createMimicAuthStub(): AuthProvider {
  const listeners = new Set<(user: AuthUser | null) => void>();

  function readUser(): AuthUser | null {
    try {
      const token = Cookies.get(COOKIE_ACCESS);
      if (!token) return null;
      return payloadToUser(decodeJwtPayload(token));
    } catch {
      return null;
    }
  }

  function notify(user: AuthUser | null) {
    listeners.forEach((cb) => cb(user));
  }

  return {
    name: "mimic",

    async signIn(): Promise<AuthUser> {
      throw new Error("로그인 페이지를 이용해 주세요.");
    },

    async signOut(): Promise<void> {
      clearTokens();
      notify(null);
    },

    getCurrentUser(): AuthUser | null {
      return readUser();
    },

    onAuthChange(cb) {
      listeners.add(cb);
      cb(readUser());

      // OAuthCallback 등 외부에서 토큰 저장 후 dispatch하는 이벤트
      const handleTokenSet = () => notify(readUser());
      window.addEventListener("mimic:token-set", handleTokenSet);

      // apiFetch의 401 refresh 실패, 또는 세션 heartbeat의 밴 감지 시 dispatch — 강제 로그아웃 처리
      const handleSignedOut = () => notify(null);
      window.addEventListener("mimic:signed-out", handleSignedOut);

      return () => {
        listeners.delete(cb);
        window.removeEventListener("mimic:token-set", handleTokenSet);
        window.removeEventListener("mimic:signed-out", handleSignedOut);
      };
    },
  };
}
