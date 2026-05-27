import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { setTokens } from "@hh/shared";

/**
 * MIMIC 서버 OAuth2 콜백 핸들러.
 * /oauth/redirect?token=xxx&refreshToken=xxx 형태로 리다이렉트된다.
 * 토큰을 Cookie에 저장 후 홈으로 이동.
 */
export function OAuthCallback() {
  const [, navigate] = useLocation();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("token");
    const refreshToken = params.get("refreshToken");
    const error = params.get("error");

    if (error || !accessToken) {
      const msg = error ? encodeURIComponent(error) : "oauth_failed";
      navigate(`/login?error=${msg}`);
      return;
    }

    // Cookie 저장 + mimic:token-set 이벤트 dispatch (onAuthChange 갱신)
    setTokens(accessToken, refreshToken ?? undefined);
    navigate("/");
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-[rgba(255,252,243,0.4)] animate-pulse">로그인 처리 중…</p>
    </div>
  );
}
