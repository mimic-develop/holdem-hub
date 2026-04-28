/**
 * @hh/tailwind-config
 *
 * Tailwind v4를 사용하므로 JS 설정은 거의 없다.
 * 디자인 토큰은 base.css의 @theme 블록에 있고,
 * 앱별 색상은 각 앱의 메인 CSS에서 추가로 @theme로 덮어쓴다.
 *
 * 이 파일은 향후 JS 레벨에서 공유할 토큰 (예: TypeScript 타입,
 * 색상 헬퍼 등)이 필요해질 때를 위한 placeholder.
 */

export const APP_SCOPE_CLASSES = {
  hub: "app-hub",
  potQuiz: "app-pot-quiz",
  nutTo3: "app-nut-to-3",
  conceptQuiz: "app-concept-quiz",
  headsUp: "app-heads-up",
} as const;

export type AppScopeKey = keyof typeof APP_SCOPE_CLASSES;
