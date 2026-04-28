import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스를 안전하게 병합한다.
 * shadcn/ui 표준 헬퍼 — 모든 워크스페이스에서 동일한 cn을 사용.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
