/**
 * 공통 fetch 래퍼.
 *
 * - dev:        http://localhost:48081/api
 * - production: /api
 * - JSON 자동 파싱
 * - 에러는 ApiError로 통일
 * - 401 응답 시 /v1/auth/refresh 자동 호출 후 재시도 (동시 요청 큐잉)
 */
import Cookies from "js-cookie";

// Vite: import.meta.env.PROD === true in production build, false in dev
const baseUrl = (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD
  ? "/api"
  : "http://localhost:48081/api";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

// ── 401 refresh 상태 관리 (모듈 레벨) ─────────────────────────────────────
let _isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let _failedQueue: QueueItem[] = [];

function _processQueue(error: unknown, token: string | null) {
  for (const item of _failedQueue) {
    error ? item.reject(error) : item.resolve(token!);
  }
  _failedQueue = [];
}

async function _doRefresh(): Promise<string> {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const mimicApiUrl  = String(env?.VITE_MIMIC_API_URL  ?? "");
  const clientId     = String(env?.VITE_MIMIC_CLIENT_ID ?? "");
  const clientSecret = String(env?.VITE_MIMIC_CLIENT_SECRET ?? "");

  const res = await fetch(`${mimicApiUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",    // httpOnly refresh_token 쿠키 자동 전송
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error("refresh_failed");

  const { accessToken } = await res.json() as { accessToken: string };
  Cookies.set("accessToken", accessToken, {
    expires: 1,
    sameSite: "Lax",
    ...(typeof location !== "undefined" && location.protocol === "https:"
      ? { secure: true }
      : {}),
  });
  return accessToken;
}
// ────────────────────────────────────────────────────────────────────────────

interface ApiFetchOptions extends RequestInit {
  /** 명시적 토큰. 없으면 Cookie["accessToken"] 자동 사용. */
  authToken?: string | null;
  /** 내부 플래그 — 무한 refresh 루프 방지. 직접 사용 금지. */
  _retry?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { authToken, headers, _retry, ...rest } = options;

  // 명시된 토큰 우선, 없으면 Cookie에서 자동 읽기
  const token =
    authToken !== undefined
      ? authToken
      : typeof document !== "undefined"
        ? (Cookies.get("accessToken") ?? null)
        : null;

  const merged: HeadersInit = {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  };
  if (token) {
    (merged as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), { ...rest, headers: merged });

  let data: unknown = null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    // 401 처리: refresh → 재시도
    if (res.status === 401 && !_retry) {
      if (_isRefreshing) {
        // 이미 refresh 중 → 새 토큰 받을 때까지 큐에서 대기
        return new Promise<T>((resolve, reject) => {
          _failedQueue.push({
            resolve: (newToken) =>
              resolve(apiFetch<T>(path, { ...options, authToken: newToken, _retry: true })),
            reject,
          });
        });
      }

      _isRefreshing = true;
      try {
        const newToken = await _doRefresh();
        _processQueue(null, newToken);
        return apiFetch<T>(path, { ...options, authToken: newToken, _retry: true });
      } catch (refreshErr) {
        _processQueue(refreshErr, null);
        Cookies.remove("accessToken");
        Cookies.remove("refresh_token");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mimic:signed-out"));
        }
        throw refreshErr;
      } finally {
        _isRefreshing = false;
      }
    }

    throw new ApiError(
      `API ${res.status} ${res.statusText} — ${path}`,
      res.status,
      data,
    );
  }
  return data as T;
}
