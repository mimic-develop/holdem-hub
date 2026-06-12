import type { ReactNode } from "react";
import { cn, useScaleToFit } from "@hh/shared";

export interface ScaleToFitProps {
  /** 디자인 좌표계 폭(px). */
  baseWidth: number;
  /** 디자인 좌표계 높이(px). */
  baseHeight: number;
  /**
   * "both"(기본): 부모가 정해준 박스(w×h)에 맞춰 `min(폭비, 높이비)`로 fit.
   *   호출부가 컨테이너 높이를 제어해야 함(flex-1 / h-full 등).
   * "width": 폭 비율만 사용하고 높이는 `baseHeight*scale`로 normal flow에 예약.
   */
  axis?: "width" | "both";
  /** 업스케일 상한. 기본 1(축소 전용 — 1 초과 시 텍스트 흐려짐). */
  maxScale?: number;
  /** 축소 하한. */
  minScale?: number;
  /** "both"에서 스테이지 세로 정렬. 기본 "center". */
  align?: "top" | "center";
  /** 바깥(측정) 컨테이너에 적용. */
  className?: string;
  children: ReactNode;
}

/**
 * 자식(고정 `baseWidth`×`baseHeight` 레이아웃)을 가용 공간에 맞춰 `transform: scale()`로
 * 비례 축소한다. 포커 테이블처럼 고정 종횡비 다이어그램을 화면 크기에 맞추는 용도.
 *
 * - `axis: "both"`: 부모 박스를 가득 채우도록 fit. 스테이지는 absolute로 띄워 중앙
 *   배치하므로 스테이지 크기가 측정값에 되먹임되지 않는다. 세로 공간을 활용하려면
 *   이 모드를 쓰고 컨테이너에 높이를 준다(flex-1 등).
 * - `axis: "width"`: 폭 기준 축소 + 높이 예약. scroll 가능한 일반 흐름에 적합.
 */
export function ScaleToFit({
  baseWidth,
  baseHeight,
  axis = "both",
  maxScale = 1,
  minScale,
  align = "center",
  className,
  children,
}: ScaleToFitProps) {
  const { containerRef, scale } = useScaleToFit<HTMLDivElement>({
    baseWidth,
    baseHeight,
    axis,
    maxScale,
    minScale,
  });

  if (axis === "width") {
    return (
      <div
        ref={containerRef}
        className={cn("relative w-full", className)}
        style={{ height: baseHeight * scale }}
      >
        <div
          className="absolute left-1/2 top-0"
          style={{
            width: baseWidth,
            height: baseHeight,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // axis === "both": 부모 박스를 채우도록 fit. 컨테이너 높이는 호출부가 제어.
  return (
    <div ref={containerRef} className={cn("relative w-full h-full", className)}>
      <div
        className="absolute inset-0 flex justify-center"
        style={{ alignItems: align === "center" ? "center" : "flex-start" }}
      >
        <div
          style={{
            width: baseWidth,
            height: baseHeight,
            flex: "none",
            transform: `scale(${scale})`,
            transformOrigin: align === "center" ? "center" : "top center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
