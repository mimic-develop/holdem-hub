/**
 * BackToHub — 허브 홈(/)으로 항상 안전하게 돌아가는 링크
 *
 * Sub-app은 wouter / react-router-dom 의 nested router 안에서 동작하므로
 * `<Link to="/">` 가 sub-app 내부 root만 가리키고 실제 허브로는 못 감.
 *
 * 이 컴포넌트는 브라우저 네이티브 `<a href="/">` 를 사용해 router 컨텍스트를
 * 우회하고 실제 origin 루트로 이동.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@hh/shared";

export interface BackToHubProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function BackToHub({
  children = "← 홈",
  className,
  style,
  ariaLabel = "허브 홈으로 이동",
}: BackToHubProps) {
  return (
    <a
      href="/"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 text-[13px] font-semibold leading-none tracking-tight no-underline transition-colors",
        className,
      )}
      style={{
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </a>
  );
}
