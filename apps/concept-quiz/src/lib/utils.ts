// shadcn/ui 47개 컴포넌트가 `@/lib/utils`에서 cn을 import 하므로
// 기존 import 경로를 유지한 채 @hh/shared의 cn을 사용하도록 re-export.
export { cn } from "@hh/shared";
