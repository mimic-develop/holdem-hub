/**
 * 세션 유지 — 밴 감지 heartbeat + accessToken 자동 갱신.
 *
 * - checkSession(): 1시간마다 GET /v1/auth/check로 MIMIC을 직접 호출해 밴 여부를 확인한다.
 *   clientSecret이 필요 없는 호출이라 (기존 /v1/auth/token과 동일하게) 브라우저가 직접 부른다.
 * - proactive refresh: accessToken의 exp가 얼마 안 남았으면 refreshAccessToken()을 미리 호출한다.
 *   refreshAccessToken() 자체는 clientSecret이 필요해 services/api를 경유한다 (client.ts 참고).
 */
import Cookies from "js-cookie";
import { refreshAccessToken } from "../api/client.js";
import { clearTokens, getAccessTokenExpiryMs } from "./mimic.js";

const BAN_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간 — 로그인 상태인 동안 무조건
const PROACTIVE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5분 (5~10분 권장 범위)
const EXPIRY_LEEWAY_MS = 5 * 60 * 1000; // exp까지 5분 미만이면 미리 갱신

let started = false;

function mimicApiUrl(): string {
  const env = (import.meta as unknown as { env?: { VITE_MIMIC_API_URL?: string } }).env;
  return env?.VITE_MIMIC_API_URL?.trim() ?? "";
}

/** MIMIC GET /v1/auth/check 호출. 밴이면 "banned", accessToken이 무효/만료면 "invalid". */
export async function checkSession(): Promise<"ok" | "invalid" | "banned"> {
  const token = Cookies.get("accessToken");
  if (!token) return "invalid";

  try {
    const res = await fetch(`${mimicApiUrl()}/v1/auth/check?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${token}` }, // query param + 헤더 둘 다 전송
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (data as { code?: string } | null)?.code;
      return code === "400026" ? "banned" : "invalid";
    }
    return data === true ? "ok" : "invalid";
  } catch {
    return "invalid";
  }
}

function forceLogoutForBan(): void {
  clearTokens();
  window.dispatchEvent(new CustomEvent("mimic:signed-out"));
  // 고정 경로 규약: BASE_URL + /login (docs/MIMIC_LOGIN_INTEGRATION.md 참고)
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = new URL(env?.BASE_URL ?? "/", window.location.origin);
  window.location.href = new URL("login", base).href;
}

async function banHeartbeatTick(): Promise<void> {
  if (!Cookies.get("accessToken")) return; // 로그아웃 상태면 건너뜀
  if ((await checkSession()) === "banned") forceLogoutForBan();
}

async function proactiveRefreshTick(): Promise<void> {
  const expiry = getAccessTokenExpiryMs();
  if (expiry === null) return; // 로그인 상태 아님
  if (expiry - Date.now() < EXPIRY_LEEWAY_MS) await refreshAccessToken();
}

/** mimic auth provider 활성화 시 한 번만 호출 — resolver.ts 참고. */
export function startSessionKeepAlive(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  setInterval(() => void banHeartbeatTick(), BAN_CHECK_INTERVAL_MS);
  setInterval(() => void proactiveRefreshTick(), PROACTIVE_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void proactiveRefreshTick();
  });
}
