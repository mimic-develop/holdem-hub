/**
 * SubAppHeader — Sub-app 페이지 상단 헤더 (52px sticky)
 *
 * 좌측: BackToHub (← 홈), 중앙: 타이틀, 우측: 자유 슬롯
 *
 * Hub의 Navbar(52px) 바로 아래에 붙어 sticky 처리되며,
 * `top: 52px` 오프셋으로 Hub Navbar 아래에 고정됨.
 *
 * 라이트/다크 자동 — 부모의 `data-theme` 속성을 읽어 적절히 색상 결정.
 *
 * 사용 예:
 *   <SubAppHeader title="Poker IQ" right={<span>2/3</span>} />
 */
import type { ReactNode } from "react";
import { cn } from "@hh/shared";
import { BackToHub } from "./BackToHub";

export interface SubAppHeaderProps {
  title: string;
  /** 우측 슬롯 — 진행도, 설정 아이콘 등 */
  right?: ReactNode;
  /** 좌측 슬롯 커스터마이즈 — 기본은 BackToHub */
  left?: ReactNode;
  /** Hub Navbar 아래에 붙이려면 true (기본). false면 top:0 */
  belowHubNavbar?: boolean;
  className?: string;
}

export function SubAppHeader({
  title,
  right,
  left,
  belowHubNavbar = true,
  className,
}: SubAppHeaderProps) {
  const top = belowHubNavbar ? 52 : 0;
  return (
    <header
      className={cn(
        "sticky z-20 flex h-[52px] items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md",
        className,
      )}
      style={{ top }}
    >
      <div className="flex min-w-0 flex-1 items-center">
        {left ?? <BackToHub className="text-foreground/60 hover:text-foreground" />}
      </div>
      <h1 className="absolute left-1/2 -translate-x-1/2 text-[14px] font-bold tracking-[0.15em] uppercase text-foreground">
        {title}
      </h1>
      <div className="flex min-w-0 flex-1 items-center justify-end">
        {right}
      </div>
    </header>
  );
}
