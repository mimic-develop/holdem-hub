import { useEffect } from "react";
import { useLocation } from "wouter";

const ACCESS_TOKEN_KEY = "mimic:accessToken";
const REFRESH_TOKEN_KEY = "mimic:refreshToken";

type SnsType = "NAVER" | "GOOGLE" | "APPLE";

interface SnsCallbackProps {
  snsType: SnsType;
}

/**
 * Spring Security OAuth2 콜백 핸들러.
 * /oauth/redirect/{provider}?code=xxx 형태로 리다이렉트된다.
 * code를 MIMIC 백엔드에 전달해 토큰을 받아 localStorage에 저장 후 홈으로 이동.
 */
export function SnsCallback({ snsType }: SnsCallbackProps) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      navigate("/login?error=oauth_failed");
      return;
    }

    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const apiUrl = String(env?.VITE_MIMIC_API_URL ?? "");
    const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "");
    const clientSecret = String(env?.VITE_MIMIC_CLIENT_SECRET ?? "");

    fetch(`${apiUrl}/v1/auth/oauth/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        snsType,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || String(res.status));
        }
        return res.json() as Promise<{ accessToken: string; refreshToken?: string }>;
      })
      .then(({ accessToken, refreshToken }) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
        navigate("/");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_failed";
        navigate(`/login?error=${msg}`);
      });
  }, [snsType, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#000" }}>
      <p className="text-sm animate-pulse" style={{ color: "rgba(255,252,243,0.4)" }}>
        로그인 처리 중…
      </p>
    </div>
  );
}
