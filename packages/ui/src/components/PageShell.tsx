/**
 * PageShell — 모바일-퍼스트 표준 컨테이너 (430px)
 *
 * 모든 sub-app 콘텐츠는 이 컴포넌트로 감쌀 것.
 * 데스크톱에서는 좌우 여백(max-width 430), 모바일에서는 풀폭.
 *
 * 사용 예:
 *   <PageShell padding="default">  // 16px
 *     ...content...
 *   </PageShell>
 *
 *   <PageShell padding="none">     // 패딩 없음 — 전체폭 카드 등
 *     ...
 *   </PageShell>
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@hh/shared";

export interface PageShellProps {
  children: ReactNode;
  /** 내부 가로 패딩 — default = 16px, none = 0, sm = 12px, lg = 24px */
  padding?: "default" | "none" | "sm" | "lg";
  /** 외부 div className 추가 */
  className?: string;
  /** 인라인 style 오버라이드 (가급적 className 권장) */
  style?: CSSProperties;
  /** 표준 폭 오버라이드. 기본 430. */
  maxWidth?: number;
  as?: "div" | "main" | "section" | "article";
}

const PADDING_MAP: Record<NonNullable<PageShellProps["padding"]>, number> = {
  none: 0,
  sm: 12,
  default: 16,
  lg: 24,
};

export function PageShell({
  children,
  padding = "default",
  className,
  style,
  maxWidth = 430,
  as = "div",
}: PageShellProps) {
  const Tag = as as "div";
  const px = PADDING_MAP[padding];
  return (
    <Tag
      className={cn("mx-auto w-full", className)}
      style={{
        maxWidth,
        paddingLeft: px,
        paddingRight: px,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
