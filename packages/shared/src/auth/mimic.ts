import Cookies from "js-cookie";
import type { AuthProvider, AuthUser } from "./types.js";
import { AuthError } from "./types.js";

const COOKIE_ACCESS  = "accessToken";
const COOKIE_REFRESH = "refresh_token";

/** production(HTTPS)은 Secure 플래그, localhost dev(HTTP)는 생략 */
function cookieOpts(days: number): Cookies.CookieAttributes {
  return {
    expires: days,
    sameSite: "Lax",
    ...(typeof location !== "undefined" && location.protocol === "https:"
      ? { secure: true }
      : {}),
  };
}

// ── 모듈 레벨 헬퍼 (SnsCallback / OAuthCallback 에서도 사용) ────────────

/** 토큰을 쿠키에 저장하고 'mimic:token-set' 이벤트를 dispatch한다. */
export function setTokens(accessToken: string, refreshToken?: string | null): void {
  Cookies.set(COOKIE_ACCESS, accessToken, cookieOpts(1));
  if (refreshToken) Cookies.set(COOKIE_REFRESH, refreshToken, cookieOpts(30));
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
 * POST /v1/auth/login API를 호출하고 accessToken/refreshToken을 Cookie에 저장한다.
 */
export function createMimicAuthStub(): AuthProvider {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const apiUrl = String(env?.VITE_MIMIC_API_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "");
  const clientSecret = String(env?.VITE_MIMIC_CLIENT_SECRET ?? "");

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

  async function callLoginApi(body: Record<string, unknown>): Promise<AuthUser> {
    const res = await fetch(`${apiUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      const code = String(data.code ?? res.status);
      throw new AuthError(code);
    }

    const data = await res.json() as { accessToken: string; refreshToken?: string };

    // 쿠키 저장 — setTokens가 mimic:token-set 이벤트 dispatch까지 처리
    setTokens(data.accessToken, data.refreshToken ?? null);
    const user = payloadToUser(decodeJwtPayload(data.accessToken));
    notify(user);
    return user;
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

      // SnsCallback/OAuthCallback 등 외부에서 토큰 저장 후 dispatch하는 이벤트
      const handleTokenSet = () => notify(readUser());
      window.addEventListener("mimic:token-set", handleTokenSet);

      // apiFetch 401 refresh 실패 시 dispatch — 강제 로그아웃 처리
      const handleSignedOut = () => notify(null);
      window.addEventListener("mimic:signed-out", handleSignedOut);

      return () => {
        listeners.delete(cb);
        window.removeEventListener("mimic:token-set", handleTokenSet);
        window.removeEventListener("mimic:signed-out", handleSignedOut);
      };
    },

    async signInWithEmail(email: string, password: string): Promise<AuthUser> {
      return callLoginApi({
        email,
        password,
        client_id: clientId,
        client_secret: clientSecret,
        remember_me: true,
      });
    },

    async signInWithGoogle(): Promise<AuthUser> {
      const redirectUri = encodeURIComponent(window.location.origin + "/oauth/redirect");
      window.location.href = `${apiUrl}/oauth2/authorization/google-web?redirect_uri=${redirectUri}`;
      return new Promise(() => {});
    },

    async signInWithNaver(): Promise<AuthUser> {
      const redirectUri = encodeURIComponent(window.location.origin + "/oauth/redirect");
      window.location.href = `${apiUrl}/oauth2/authorization/naver?redirect_uri=${redirectUri}`;
      return new Promise(() => {});
    },

    async signInWithApple(): Promise<AuthUser> {
      const redirectUri = encodeURIComponent(window.location.origin + "/oauth/redirect");
window.location.href = `https://gore-ravioli-alkaline.ngrok-free.dev/api/oauth2/authorization/apple-web?redirect_uri=${redirectUri}`;      return new Promise(() => {});
    },

    // async signInWithApple(): Promise<AuthUser> {
    //   const redirectUri = encodeURIComponent(window.location.origin + "/oauth/redirect");
    //   window.location.href = `${apiUrl}/oauth2/authorization/apple?redirect_uri=${redirectUri}`;
    //   return new Promise(() => {});
    // },
  };
}
