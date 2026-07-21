import { useState } from "react";
import { useLocation } from "wouter";

const ERROR_MESSAGES: Record<string, string> = {
  "40101": "존재하지 않는 계정입니다.",
  "40103": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "400025": "정지된 계정입니다. 관리자에게 문의해주세요.",
  "400026": "차단된 계정입니다. 관리자에게 문의해주세요.",
  "400000": "가입된 계정이 없습니다.",
  "400119": "직원 전용 서비스입니다. 일반 사용자는 이용하실 수 없습니다.",
  "None registered account": "가입된 계정이 없습니다.",
  oauth_failed: "로그인에 실패했습니다. 다시 시도해주세요.",
};

function resolveError(raw: string): string {
  const decoded = decodeURIComponent(raw);
  if (ERROR_MESSAGES[decoded]) return ERROR_MESSAGES[decoded];

  try {
    if (decoded.includes("{")) {
      const parsed = JSON.parse(decoded);
      const code = parsed.code || parsed.message;
      if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
      if (parsed.failReason) return parsed.failReason;
    }
  } catch {
    // decoded가 JSON이 아니면 그대로 표시
  }

  return decoded;
}

const OAUTH_STATE_KEY = "hh:oauth-state";

function redirectToUnifiedLogin() {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const unifiedLoginUrl = String(env?.VITE_UNIFIED_LOGIN_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "mimic-web");

  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const redirectUri = window.location.origin + "/oauth/callback";
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state, cancel_url: window.location.origin + "/login", service_name: "플레이랩" });
  window.location.href = `${unifiedLoginUrl}?${params.toString()}`;
}

export function Login() {
  const [, navigate] = useLocation();
  const [error] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("error");
    return raw ? resolveError(raw) : null;
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#000", color: "#fff" }}>
      <div className="w-full max-w-sm space-y-6 rounded-xl p-8 text-center" style={{ background: "rgb(0, 0, 0)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold tracking-[0.22em] uppercase text-[rgba(255,252,243,0.4)]">
            MIMIC PLAYLAB
          </p>
          <h1 className="text-xl font-bold tracking-tight">로그인</h1>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={redirectToUnifiedLogin}
          className="w-full rounded-md bg-[#E53935] py-2.5 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90 cursor-pointer"
        >
          MIMIC 계정으로 로그인
        </button>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xs text-[rgba(255,252,243,0.35)] hover:text-[rgba(255,252,243,0.6)] transition-colors cursor-pointer"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
