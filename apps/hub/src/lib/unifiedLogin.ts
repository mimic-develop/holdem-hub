/**
 * 통합 로그인(OAuth code 플로우) 공용 헬퍼.
 *
 * - Login 페이지의 "로그인" 버튼과 OAuthCallback의 실패 처리에서 공유한다.
 * - 로그인 실패 시 에러 메시지는 우리 앱 화면에 렌더링하지 않고,
 *   통합 로그인 페이지로 리다이렉트하며 `error` 파라미터로 함께 전달한다.
 */

export const OAUTH_STATE_KEY = "hh:oauth-state";

/**
 * 통합 로그인 페이지로 리다이렉트한다.
 * @param error 직전 로그인 실패 메시지. 전달 시 통합 로그인 페이지에 `error` 파라미터로 함께 넘긴다.
 */
export function redirectToUnifiedLogin(error?: string): void {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const unifiedLoginUrl = String(env?.VITE_UNIFIED_LOGIN_URL ?? "");
  const clientId = String(env?.VITE_MIMIC_CLIENT_ID ?? "mimic-web");

  // state = CSRF 방지용 1회성 난수. sessionStorage에 저장했다가 콜백에서 대조.
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

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
  });
  if (error) params.set("error_code", error);
  window.location.href = `${unifiedLoginUrl}?${params.toString()}`;
}
