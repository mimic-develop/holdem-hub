/**
 * CTAButton — 메인 액션 버튼 (primary / outline / ghost)
 *
 * MIMIC red 토큰(`var(--primary)`) 기반. 다크/라이트 자동 대응.
 *
 * 사용 예:
 *   <CTAButton onClick={...}>시작하기 →</CTAButton>
 *   <CTAButton variant="outline" size="sm">취소</CTAButton>
 *   <CTAButton variant="ghost" disabled>잠금</CTAButton>
 */
import { useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@hh/shared";

export type CTAVariant = "primary" | "outline" | "ghost";
export type CTASize = "sm" | "md" | "lg";

export interface CTAButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  variant?: CTAVariant;
  size?: CTASize;
  /** 풀폭 여부 (기본 true). false면 컨텐츠에 맞춤. */
  fullWidth?: boolean;
}

const SIZE_CLASS: Record<CTASize, string> = {
  sm: "h-10 px-4 text-[13px] font-semibold",
  md: "h-12 px-5 text-[14px] font-bold",
  lg: "h-14 px-6 text-[16px] font-extrabold tracking-tight",
};

export function CTAButton({
  children,
  variant = "primary",
  size = "md",
  fullWidth = true,
  disabled,
  className,
  type = "button",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  ...rest
}: CTAButtonProps) {
  const [pressed, setPressed] = useState(false);

  const variantClass: Record<CTAVariant, string> = {
    primary: disabled
      ? "bg-muted text-muted-foreground border border-border"
      : "bg-primary text-primary-foreground shadow-[0_2px_12px_rgba(186,12,25,0.25)] hover:opacity-95",
    outline: disabled
      ? "border border-border text-muted-foreground bg-transparent"
      : "border border-border text-foreground bg-transparent hover:bg-foreground/5",
    ghost: disabled
      ? "text-muted-foreground bg-transparent"
      : "text-foreground/70 bg-transparent hover:text-foreground hover:bg-foreground/5",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onPointerDown={(e) => {
        setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[12px] font-bold transition-[transform,opacity] duration-100 ease-out outline-none",
        fullWidth && "w-full",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        SIZE_CLASS[size],
        variantClass[variant],
        className,
      )}
      style={{
        transform: pressed && !disabled ? "scale(0.97)" : "scale(1)",
        WebkitTapHighlightColor: "transparent",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
