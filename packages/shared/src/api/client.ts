/**
 * 공통 fetch 래퍼.
 *
 * - VITE_API_BASE_URL 환경변수 기반으로 절대 URL 생성
 * - JSON 자동 파싱
 * - 에러는 ApiError로 통일
 * - 인증 토큰 주입 자리 마련 (현재 비활성)
 */

const baseUrl = (() => {
  // 주의: `import.meta.env` 직접 접근. optional chaining(`import.meta?.env`)을 쓰면 Vite가
  // env 주입 패턴을 감지하지 못해 런타임에 undefined가 된다 — auth/resolver.ts 주석 참조.
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  return (env?.VITE_API_BASE_URL as string | undefined) ?? "";
})();

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
  if (!baseUrl) return path; // dev: Vite proxy가 처리
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

interface ApiFetchOptions extends RequestInit {
  /** 인증 토큰 (장래에 자동 주입) */
  authToken?: string | null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { authToken, headers, ...rest } = options;
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
