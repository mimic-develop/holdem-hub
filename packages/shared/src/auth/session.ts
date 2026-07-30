/**
 * 세션 유지 — 밴 감지 heartbeat.
 *
 * 밴 감지는 인증된 API 호출이 서버의 JwtFilter를 타야만 이루어진다. 그런데 사용자가
 * 아무 API도 안 부르고 방치해두면 그 필터를 탈 일이 없다 — 그래서 GET /v1/auth/check를
 * "그 필터를 강제로 타게 만드는" 더미 호출로 1시간마다 부른다.
 *
 * 즉 이 heartbeat 자체가 apiFetch가 부르는 다른 API와 동급의 "인증된 호출"이다. 그래서
 * 실패 처리도 apiFetch의 401 인터셉터와 동일하게 맞춘다 — invalid(만료/무효)면 refresh 후
 * 같은 호출을 한 번 재시도하고, banned면 강제 로그아웃한다. (accessToken 만료 자체를
 * 미리 감지하는 별도 proactive 타이머는 두지 않는다 — client.ts의 401 인터셉터 참고.)
 */
import Cookies from "js-cookie";
import { refreshAccessToken } from "../api/client.js";
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

  const status = await checkSession();
  if (status === "banned") {
    forceLogoutForBan();
    return;
  }
  if (status === "invalid") {
    // apiFetch의 401 인터셉터와 동일한 패턴: 갱신 후 이 호출(밴 확인)을 한 번 재시도한다.
    // 재시도하지 않으면 이번 tick은 밴 여부를 사실상 확인하지 못한 채 그냥 지나간다.
    const refreshed = await refreshAccessToken();
    if (refreshed && (await checkSession()) === "banned") forceLogoutForBan();
  }
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
