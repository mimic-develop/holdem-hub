// 정적 자산 import 타입 — Vite가 런타임에 URL로 변환.
// vite/client 의존성을 피하기 위해 필요한 모듈만 자체 선언.

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.mp4" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}
