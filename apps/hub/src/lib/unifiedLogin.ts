/**
 * 통합 로그인(OAuth code 플로우) 공용 헬퍼.
 *
 * - Login 페이지의 "로그인" 버튼과 OAuthCallback의 실패 처리에서 공유한다.
 * - 로그인 실패 시 에러 메시지는 우리 앱 화면에 렌더링하지 않고,
 *   통합 로그인 페이지로 리다이렉트하며 `error` 파라미터로 함께 전달한다.
 * - PKCE(RFC 7636): verifier는 이 클라이언트에만 보관하고, challenge(S256 해시)만
 *   로그인 페이지로 전달한다. 코드→토큰 교환 시 verifier를 함께 제시해 코드 탈취만으로는
 *   토큰을 교환할 수 없도록 한다.
 */

export const OAUTH_STATE_KEY = "hh:oauth-state";
export const OAUTH_PKCE_VERIFIER_KEY = "hh:oauth-pkce-verifier";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE code_verifier 생성 (32바이트 난수 → base64url, 43자 — RFC 7636 조건 만족). */
function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** PKCE code_challenge = base64url(SHA-256(verifier)). */
async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(digest));
}

/** 저장해둔 PKCE verifier를 1회성으로 꺼낸다 (읽는 즉시 제거). */
export function consumePkceVerifier(): string | null {
  const verifier = sessionStorage.getItem(OAUTH_PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_PKCE_VERIFIER_KEY);
  return verifier;
}

/**
 * 통합 로그인 페이지로 리다이렉트한다.
 * @param error 직전 로그인 실패 메시지. 전달 시 통합 로그인 페이지에 `error` 파라미터로 함께 넘긴다.
 */
export async function redirectToUnifiedLogin(error?: string): Promise<void> {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const unifiedLoginUrl = String(env?.VITE_UNIFIED_LOGIN_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "mimic-web");

  // state = CSRF 방지용 1회성 난수. sessionStorage에 저장했다가 콜백에서 대조.
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  // PKCE: verifier는 여기(클라이언트)에만 보관하고 challenge만 로그인 페이지에 전달.
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(OAUTH_PKCE_VERIFIER_KEY, verifier);
  const challenge = await sha256Base64Url(verifier);

  // BASE_URL은 vite.config.ts의 base 설정값(예: staging은 "/play-lab-stage/") — 배포 sub-path를 반영.
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const redirectUri = new URL("oauth/callback", base).href;
  const cancelUrl = new URL("login", base).href;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    cancel_url: cancelUrl,
    service_name: "플레이랩",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (error) params.set("error_code", error);
  window.location.href = `${unifiedLoginUrl}?${params.toString()}`;
}
