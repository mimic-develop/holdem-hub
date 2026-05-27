/**
 * 공통 fetch 래퍼.
 *
 * - dev:        http://localhost:48081/api
 * - production: /api
 * - JSON 자동 파싱
 * - 에러는 ApiError로 통일
 * - Cookie["accessToken"] 자동 주입 (미지정 시)
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

interface ApiFetchOptions extends RequestInit {
  /** 명시적 토큰. 없으면 Cookie["accessToken"] 자동 사용. */
  authToken?: string | null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { authToken: explicitToken, headers, ...rest } = options;
  // 명시 토큰 없을 때 Cookie에서 자동 읽기
  const authToken =
    explicitToken !== undefined ? explicitToken : (Cookies.get("accessToken") ?? null);
  const merged: HeadersInit = {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  };
  if (authToken) {
    (merged as Record<string, string>).Authorization = `Bearer ${authToken}`;
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
    throw new ApiError(
      `API ${res.status} ${res.statusText} — ${path}`,
      res.status,
      data,
    );
  }
  return data as T;
}
