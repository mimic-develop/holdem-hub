/**
 * 세션 유지 — 밴 감지 heartbeat.
 *
 * accessToken 자동 갱신은 여기서 별도로 미리 하지 않는다 — apiFetch의 401 인터셉터
 * (client.ts의 refreshAccessToken)가 만료를 감지해 자동으로 갱신 후 재시도한다.
 * 밴 여부는 그 방식으로 감지되지 않으므로(만료가 아니라 계정 상태 문제) 이 heartbeat가 별도로 확인한다.
 */
import Cookies from "js-cookie";
import { clearTokens } from "./mimic.js";

const BAN_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간 — 로그인 상태인 동안 무조건

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

/** mimic auth provider 활성화 시 한 번만 호출 — resolver.ts 참고. */
export function startSessionKeepAlive(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const banTimer = setInterval(() => void banHeartbeatTick(), BAN_CHECK_INTERVAL_MS);

  // dev HMR로 이 모듈이 재평가되면 `started`는 새 모듈 인스턴스에서 false로 리셋되지만
  // 위 타이머는 정리되지 않아 중복으로 쌓인다 — dispose 시점에 명시적으로 정리.
  const hot = (import.meta as unknown as { hot?: { dispose: (cb: () => void) => void } }).hot;
  hot?.dispose(() => {
    clearInterval(banTimer);
  });
}
