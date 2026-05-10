/**
 * Surface — 카드/패널 표면 프리미티브
 *
 * 라이트 앱: 화이트 배경 + 그림자
 * 다크 앱: 약간 밝은 카드 톤 + 미세 보더
 *
 * `bg-card`, `border-border` 토큰 기반 — `data-theme` 자동 반영.
 *
 * 사용 예:
 *   <Surface padding="md">...</Surface>
 *   <Surface elevation="lg">...</Surface>
 *   <Surface as="section" padding="lg" radius="xl">...</Surface>
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@hh/shared";

export type SurfaceElevation = "none" | "sm" | "md" | "lg";
export type SurfaceRadius = "sm" | "md" | "lg" | "xl";
export type SurfacePadding = "none" | "sm" | "md" | "lg";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  elevation?: SurfaceElevation;
  radius?: SurfaceRadius;
  padding?: SurfacePadding;
  /** border 표시 여부. 기본 true. */
  bordered?: boolean;
  as?: "div" | "section" | "article" | "li";
}

const RADIUS_CLASS: Record<SurfaceRadius, string> = {
  sm: "rounded-md",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-[20px]",
};

const PADDING_CLASS: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const ELEVATION_STYLE: Record<SurfaceElevation, CSSProperties> = {
  none: {},
  sm: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  md: { boxShadow: "0 1px 6px rgba(0,0,0,0.05)" },
  lg: { boxShadow: "0 4px 16px rgba(0,0,0,0.08)" },
};

export function Surface({
  children,
  elevation = "sm",
  radius = "md",
  padding = "md",
  bordered = true,
  as = "div",
  className,
  style,
  ...rest
}: SurfaceProps) {
  const Tag = as as "div";
  return (
    <Tag
      className={cn(
        "bg-card text-card-foreground",
        bordered && "border border-border",
        RADIUS_CLASS[radius],
        PADDING_CLASS[padding],
        className,
      )}
      style={{ ...ELEVATION_STYLE[elevation], ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
