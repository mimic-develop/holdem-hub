/**
 * 공통 fetch 래퍼.
 *
 * - VITE_API_BASE_URL 환경변수 기반으로 절대 URL 생성
 * - JSON 자동 파싱
 * - 에러는 ApiError로 통일
 * - 인증 토큰 주입 자리 마련 (현재 비활성)
 */

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
  if (!baseUrl) return path; // dev: Vite proxy가 처리
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

interface ApiFetchOptions extends RequestInit {
  /** 인증 토큰 (장래에 자동 주입) */
  authToken?: string | null;
}

/**
 * GET 요청 in-flight 중복 제거 맵.
 * - React StrictMode의 useEffect 이중 실행으로 인한 이중 호출 방지
 * - 동일 컴포넌트가 여러 인스턴스로 mount될 때 중복 호출 방지
 * 동일 path로 이미 요청이 진행 중이면 새 fetch 없이 기존 Promise를 반환.
 * 요청 완료(성공/실패 무관) 후 맵에서 제거되어 다음 호출은 새 요청을 만든다.
 */
const _inflightGets = new Map<string, Promise<unknown>>();

async function _doFetch<T = unknown>(
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

export function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  if (method === "GET") {
    const inflight = _inflightGets.get(path);
    if (inflight) return inflight as Promise<T>;

    const promise = _doFetch<T>(path, options).finally(() => {
      _inflightGets.delete(path);
    });
    _inflightGets.set(path, promise);
    return promise;
  }

  return _doFetch<T>(path, options);
}
