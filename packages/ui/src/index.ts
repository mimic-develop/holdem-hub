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
