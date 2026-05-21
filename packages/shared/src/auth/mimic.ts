import type { AuthProvider, AuthUser } from "./types.js";
import { AuthError } from "./types.js";

const ACCESS_TOKEN_KEY = "mimic:accessToken";
const REFRESH_TOKEN_KEY = "mimic:refreshToken";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function payloadToUser(payload: Record<string, unknown>): AuthUser {
  return {
    id: String(payload.sub ?? payload.id ?? ""),
    email: typeof payload.email === "string" ? payload.email : null,
    displayName:
      typeof payload.nickname === "string"
        ? payload.nickname
        : typeof payload.name === "string"
          ? payload.name
          : null,
    photoURL: null,
  };
}

/**
 * MIMIC 서버 인증 provider.
 *
 * VITE_AUTH_PROVIDER=mimic 설정 시 활성화.
 * POST /v1/auth/login API를 호출하고 accessToken/refreshToken을 localStorage에 저장한다.
 */
export function createMimicAuthStub(): AuthProvider {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const apiUrl = String(env?.VITE_MIMIC_API_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "");
  const clientSecret = String(env?.VITE_MIMIC_CLIENT_SECRET ?? "");

  const listeners = new Set<(user: AuthUser | null) => void>();

  function readUser(): AuthUser | null {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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

    const data = await res.json() as { accessToken: string; refreshToken: string };
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

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
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      notify(null);
    },

    getCurrentUser(): AuthUser | null {
      return readUser();
    },

    onAuthChange(cb) {
      listeners.add(cb);
      cb(readUser());

      // SnsCallback 등 외부에서 토큰을 직접 localStorage에 저장한 뒤
      // 'mimic:token-set' 이벤트를 dispatch하면 여기서 감지해 상태를 갱신한다.
      const handleTokenSet = () => notify(readUser());
      window.addEventListener("mimic:token-set", handleTokenSet);

      return () => {
        listeners.delete(cb);
        window.removeEventListener("mimic:token-set", handleTokenSet);
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
      window.location.href = `${apiUrl}/oauth2/authorization/google-web`;
      return new Promise(() => {});
    },

    async signInWithNaver(): Promise<AuthUser> {
      window.location.href = `${apiUrl}/oauth2/authorization/naver`;
      return new Promise(() => {});
    },

    async signInWithApple(): Promise<AuthUser> {
      window.location.href = `${apiUrl}/oauth2/authorization/apple`;
      return new Promise(() => {});
    },
  };
}
