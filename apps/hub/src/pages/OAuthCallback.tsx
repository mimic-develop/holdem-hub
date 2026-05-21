import { useEffect } from "react";
import { useLocation } from "wouter";

const ACCESS_TOKEN_KEY = "mimic:accessToken";
const REFRESH_TOKEN_KEY = "mimic:refreshToken";

/**
 * MIMIC 서버 OAuth2 콜백 핸들러.
 * /oauth/redirect?accessToken=xxx&refreshToken=xxx 형태로 리다이렉트된다.
 * 토큰을 localStorage에 저장 후 홈으로 이동.
 */
export function OAuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const error = params.get("error");

    if (error || !accessToken) {
      const msg = error ? encodeURIComponent(error) : "oauth_failed";
      navigate(`/login?error=${msg}`);
      return;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }

    navigate("/");
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-[rgba(255,252,243,0.4)] animate-pulse">로그인 처리 중…</p>
    </div>
  );
}
