/**
 * 공통 fetch 래퍼.
 *
 * baseUrl 우선순위:
 *   1. VITE_API_BASE_URL  — 명시적 override (dev/prod 모두 적용)
 *   2. prod 빌드          — "/api" (프론트와 같은 도메인에 API 서버가 있을 때)
 *   3. dev 빌드           — "http://localhost:48081/api"
 *
 * - JSON 자동 파싱
 * - 에러는 ApiError로 통일
 * - Cookie["accessToken"] 자동 주입 (미지정 시)
 */
import Cookies from "js-cookie";
import { setTokens, clearTokens } from "../auth/mimic.js";

type Env = { PROD?: boolean; VITE_API_BASE_URL?: string; VITE_MIMIC_API_URL?: string };
const _env = (import.meta as unknown as { env?: Env }).env;

// 우선순위: VITE_API_BASE_URL > VITE_MIMIC_API_URL > 빌드 모드 기본값
const baseUrl =
  _env?.VITE_API_BASE_URL?.trim() ||
  _env?.VITE_MIMIC_API_URL?.trim() ||
  (_env?.PROD ? "/api" : "http://localhost:48081/api");

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

/** refresh 실패 시 재로그인이 필요함을 뜻하는 코드 — clearTokens + mimic:signed-out 발생. */
const SIGNED_OUT_CODES = new Set(["40110", "40107", "40108"]);

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * accessToken 갱신. clientSecret이 필요해 우리 백엔드(services/api)를 경유한다 — MIMIC을
 * 직접 부르는 apiFetch의 baseUrl(위 우선순위, MIMIC 도메인 지향)과는 별개로 항상 현재
 * origin 기준 상대경로("/api/auth/refresh")로 고정 호출한다. 동시 호출은 단일 in-flight
 * Promise를 공유해 중복 요청을 막는다(single-flight).
 */
export function refreshAccessToken(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = doRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" }); // same-origin → refresh_token 쿠키 자동 첨부
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (data as { code?: string } | null)?.code;
      if (code && SIGNED_OUT_CODES.has(code)) {
        clearTokens();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mimic:signed-out"));
        }
      } else if (code === "40104") {
        // eslint-disable-next-line no-console
        console.error("[auth] MIMIC_CLIENT_ID/MIMIC_CLIENT_SECRET 설정 오류 — 서버 env 확인 필요", data);
      }
      return false;
    }
    setTokens((data as { accessToken: string }).accessToken); // 2번째 인자 생략 → refresh_token 쿠키는 그대로 유지
    return true;
  } catch {
    return false; // 네트워크 오류 — 서명아웃 처리하지 않고 다음 타이머/재시도에 맡긴다
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
  allowRefreshRetry = true,
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
  if (res.status === 401 && allowRefreshRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, options, false); // 원 요청 그대로 1회만 재시도
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
