import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiFetch, setTokens, ApiError } from "@hh/shared";
import { OAUTH_STATE_KEY, redirectToUnifiedLogin } from "../lib/unifiedLogin";

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

/**
 * 통합 로그인 페이지 콜백 핸들러.
 * /oauth/callback?code=xxx&state=xxx 형태로 리다이렉트된다.
 * state 검증 후 MIMIC 서버 /v1/auth/token으로 code를 교환해 토큰을 받는다.
 * 실패 시 우리 앱 화면에 표시하지 않고 통합 로그인 페이지로 에러와 함께 되돌린다.
 */
export function OAuthCallback() {
  const [, navigate] = useLocation();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;

    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "mimic-web");
    const clientSecret = String(env?.VITE_MIMIC_CLIENT_SECRET ?? "");

    if (!code || !state || state !== savedState) {
      redirectToUnifiedLogin("400");
      return;
    }

    apiFetch<TokenResponse>("/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ code, clientId }),
      signal: controller.signal,
    })
      .then(({ accessToken, refreshToken }) => {
        setTokens(accessToken, refreshToken);
        navigate("/");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // 실패 시 우리 앱 화면에 표시하지 않고, 통합 로그인 페이지로 에러와 함께 리다이렉트한다.
        let message: string | undefined;
        if (err instanceof ApiError) {
          const data = err.data as { code?: string; failReason?: string } | null;
          message = data?.code;
        } else {
          message = "400";
        }
        redirectToUnifiedLogin(message);
      });

    return () => controller.abort();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-[rgba(255,252,243,0.4)] animate-pulse">로그인 처리 중…</p>
    </div>
  );
}
