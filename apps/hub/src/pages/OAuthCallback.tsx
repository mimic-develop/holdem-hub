import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiFetch, setTokens } from "@hh/shared";

const OAUTH_STATE_KEY = "hh:oauth-state";

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

/**
 * 통합 로그인 페이지 콜백 핸들러.
 * /oauth/callback?code=xxx&state=xxx 형태로 리다이렉트된다.
 * code를 브라우저가 직접 교환하지 않고 @hh/api(/api/auth/token)에 전달해
 * server-to-server로 토큰을 받아온다 (client_secret은 서버에만 존재).
 */
export function OAuthCallback() {
  const [, navigate] = useLocation();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    if (!code || !state || state !== savedState) {
      navigate("/login?error=oauth_failed");
      return;
    }

    apiFetch<TokenResponse>("/auth/token", {
      method: "POST",
      body: JSON.stringify({ code }),
      signal: controller.signal,
    })
      .then(({ accessToken, refreshToken }) => {
        setTokens(accessToken, refreshToken);
        navigate("/");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_failed";
        navigate(`/login?error=${msg}`);
      });

    return () => controller.abort();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-[rgba(255,252,243,0.4)] animate-pulse">로그인 처리 중…</p>
    </div>
  );
}
