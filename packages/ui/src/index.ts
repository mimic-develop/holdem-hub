/**
 * @hh/ui — 모노레포 공유 UI 컴포넌트
 *
 * 카드 스타일 사용 시 한 번 import 필요 (Hub의 main.tsx에서):
 *   import "@hh/ui/components/PlayingCard/styles.css";
 */
export { cn } from "@hh/shared";
export {
  PlayingCard,
  CardBackPattern,
  type PlayingCardProps,
  type PlayingCardSize,
} from "./components/PlayingCard/index.js";

// ── 레이아웃 프리미티브 ────────────────────────────
export { PageShell, type PageShellProps } from "./components/PageShell.js";
export { BackToHub, type BackToHubProps } from "./components/BackToHub.js";
export {
  SubAppHeader,
  type SubAppHeaderProps,
} from "./components/SubAppHeader.js";
export {
  CTAButton,
  type CTAButtonProps,
  type CTAVariant,
  type CTASize,
} from "./components/CTAButton.js";
export {
  Surface,
  type SurfaceProps,
  type SurfaceElevation,
  type SurfaceRadius,
  type SurfacePadding,
} from "./components/Surface.js";
export { LoginGate, type LoginGateProps } from "./components/LoginGate.js";
export {
  ScaleToFit,
  type ScaleToFitProps,
} from "./components/ScaleToFit/index.js";
