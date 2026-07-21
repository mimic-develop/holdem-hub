/**
 * 통합 로그인(OAuth code 플로우) 공용 헬퍼.
 *
 * - Login 페이지의 "로그인" 버튼과 OAuthCallback의 실패 처리에서 공유한다.
 * - 로그인 실패 시 에러 메시지는 우리 앱 화면에 렌더링하지 않고,
 *   통합 로그인 페이지로 리다이렉트하며 `error` 파라미터로 함께 전달한다.
 */

export const OAUTH_STATE_KEY = "hh:oauth-state";

/** 서버 에러 code → 사용자용 한국어 메시지 매핑 */
export const ERROR_MESSAGES: Record<string, string> = {
  "40101": "존재하지 않는 계정입니다.",
  "40103": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "400025": "정지된 계정입니다. 관리자에게 문의해주세요.",
  "400026": "차단된 계정입니다. 관리자에게 문의해주세요.",
  "400000": "가입된 계정이 없습니다.",
  "400119": "직원 전용 서비스입니다. 일반 사용자는 이용하실 수 없습니다.",
  "None registered account": "가입된 계정이 없습니다.",
  oauth_failed: "로그인에 실패했습니다. 다시 시도해주세요.",
};

/**
 * 서버가 준 code/failReason을 사용자용 메시지로 변환한다.
 * 알려진 code면 한국어 매핑, 없으면 서버 failReason 원문, 그것도 없으면 일반 문구.
 */
export function resolveErrorMessage(
  code?: string | null,
  failReason?: string | null,
): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (failReason) return failReason;
  return ERROR_MESSAGES.oauth_failed;
}

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

  const redirectUri = window.location.origin + "/oauth/callback";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    cancel_url: window.location.origin + "/login",
    service_name: "플레이랩",
  });
  if (error) params.set("error", error);
  window.location.href = `${unifiedLoginUrl}?${params.toString()}`;
}
