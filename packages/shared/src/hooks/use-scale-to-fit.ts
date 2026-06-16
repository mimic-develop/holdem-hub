import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

// SSR 안전: 서버에선 layout effect 경고를 피하려 useEffect로 폴백.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface ScaleToFitOptions {
  /** 디자인 좌표계 폭(px). 측정된 컨테이너 폭 / baseWidth = 스케일. */
  baseWidth: number;
  /** 디자인 좌표계 높이(px). `axis: "both"`일 때 필요. */
  baseHeight?: number;
  /** "width"(기본): 폭 비율만. "both": min(폭 비율, 높이 비율). */
  axis?: "width" | "both";
  /** 업스케일 상한. 기본 1 — 1을 넘기면 텍스트가 흐려지므로 축소만 한다. */
  maxScale?: number;
  /** 축소 하한. 기본 0(제한 없음). */
  minScale?: number;
}

export interface ScaleToFitResult<T extends HTMLElement = HTMLDivElement> {
  /** 가용 공간을 측정할 컨테이너에 부착. */
  containerRef: RefObject<T>;
  /** 적용할 transform scale 값. */
  scale: number;
}

/**
 * 고정 디자인 크기(`baseWidth`×`baseHeight`)의 레이아웃을 컨테이너 가용 공간에
 * 맞춰 비례 축소하기 위한 scale 값을 계산한다. `ResizeObserver`로 컨테이너 크기를
 * 추적하며, 반환된 `scale`을 `transform: scale(...)`에 그대로 쓰면 된다.
 *
 * concept-quiz의 ResizeObserver 측정 패턴을 일반화한 공용 훅.
 */
export function useScaleToFit<T extends HTMLElement = HTMLDivElement>({
  baseWidth,
  baseHeight,
  axis = "width",
  maxScale = 1,
  minScale = 0,
}: ScaleToFitOptions): ScaleToFitResult<T> {
  const containerRef = useRef<T>(null);
  const [scale, setScale] = useState<number>(maxScale);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    const calc = () => {
      let next = el.clientWidth / baseWidth;
      if (axis === "both" && baseHeight) {
        next = Math.min(next, el.clientHeight / baseHeight);
      }
      if (!Number.isFinite(next) || next <= 0) return;
      next = Math.min(maxScale, Math.max(minScale, next));
      // 미세 변화로 인한 불필요한 리렌더 방지.
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    calc();
    const obs = new ResizeObserver(calc);
    obs.observe(el);
    return () => obs.disconnect();
  }, [baseWidth, baseHeight, axis, maxScale, minScale]);

  return { containerRef, scale };
}
