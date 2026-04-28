import type { ReactNode } from "react";
import { motion, type MotionProps } from "framer-motion";
import {
  asCard,
  isRedSuit,
  SUIT_SYMBOL,
  type Card,
  type Rank,
} from "@hh/poker-engine";
import { cn } from "@hh/shared";
import { CardBackPattern } from "./CardBackPattern.js";

export type PlayingCardSize = "xs" | "sm" | "md" | "lg";

export interface PlayingCardProps {
  /**
   * 카드 데이터. 짧은 문자열("As") 또는 정규화 객체({rank, suit}) 둘 다 받음.
   * faceDown=true 일 때는 무시 가능 (그래도 타입 안전성 위해 요구).
   */
  card: Card | string;
  /** 카드 크기 — 4단계 */
  size?: PlayingCardSize;
  /** 뒷면 표시 (`true`면 card 무시하고 뒷면만 그림) */
  faceDown?: boolean;
  /**
   * 뒷면 이미지 URL. 지정 시 SVG 기본 패턴 대신 이 이미지 사용.
   * 예: nut-to-3는 자체 mimic-card-back.jpg를 prop으로 전달.
   */
  backImage?: string;
  /** 정답/강조 표시 (녹색 글로우) */
  highlight?: boolean;
  /** 비활성/dimmed 처리 (회색조) */
  dimmed?: boolean;
  /** framer-motion 등장 애니메이션 활성화 */
  animate?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 클릭 가능하게 만들 때 */
  onClick?: () => void;
  /** 접근성: aria-label */
  "aria-label"?: string;
}

const SIZE_CLASS: Record<PlayingCardSize, string> = {
  xs: "w-8 h-11",
  sm: "w-10 h-14",
  md: "w-[52px] h-[72px] sm:w-[60px] sm:h-[84px]",
  lg: "w-[68px] h-[96px] sm:w-[88px] sm:h-[124px]",
};

const PADDING_CLASS: Record<PlayingCardSize, string> = {
  xs: "p-[3px]",
  sm: "p-[5px]",
  md: "p-[6px] sm:p-[8px]",
  lg: "p-[8px] sm:p-[10px]",
};

const RANK_TEXT_CLASS: Record<PlayingCardSize, string> = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-[13px] sm:text-[15px]",
  lg: "text-base sm:text-xl",
};

const CENTER_SUIT_CLASS: Record<PlayingCardSize, string> = {
  xs: "text-[14px]",
  sm: "text-[18px]",
  md: "text-[22px] sm:text-[26px]",
  lg: "text-[32px] sm:text-[40px]",
};

const CORNER_OFFSET_CLASS: Record<PlayingCardSize, string> = {
  xs: "bottom-[3px] right-[3px]",
  sm: "bottom-[5px] right-[5px]",
  md: "bottom-[6px] right-[6px] sm:bottom-[8px] sm:right-[8px]",
  lg: "bottom-[8px] right-[8px] sm:bottom-[10px] sm:right-[10px]",
};

const ENTER_ANIMATION: MotionProps = {
  initial: { opacity: 0, y: 8, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.18, ease: "easeOut" },
};

/**
 * 카드 1장 표시. 모든 sub-app이 공유하는 단일 컴포넌트.
 *
 * @example
 *   <PlayingCard card="As" size="md" />
 *   <PlayingCard card={{ rank: "A", suit: "s" }} highlight />
 *   <PlayingCard card="?" faceDown backImage={cardBackImg} animate />
 */
export function PlayingCard(props: PlayingCardProps) {
  const {
    card,
    size = "md",
    faceDown = false,
    backImage,
    highlight = false,
    dimmed = false,
    animate = false,
    className,
    onClick,
    "aria-label": ariaLabel,
  } = props;

  const interactive = onClick != null;

  // ── faceDown ────────────────────────────────────────────────
  if (faceDown) {
    return (
      <CardContainer
        animate={animate}
        className={cn(
          "hh-playing-card relative shrink-0 select-none overflow-hidden rounded-lg",
          SIZE_CLASS[size],
          interactive && "cursor-pointer",
          className,
        )}
        data-highlight={highlight ? "true" : undefined}
        data-dimmed={dimmed ? "true" : undefined}
        onClick={onClick}
        aria-label={ariaLabel ?? "카드 뒷면"}
        role={interactive ? "button" : undefined}
      >
        {backImage ? (
          <img
            src={backImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <CardBackPattern />
        )}
      </CardContainer>
    );
  }

  // ── faceUp: 입력 정규화 ─────────────────────────────────────
  let parsed: Card | null = null;
  try {
    parsed = asCard(card);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return (
      <div
        className={cn(
          "hh-playing-card relative shrink-0 select-none overflow-hidden rounded-lg",
          SIZE_CLASS[size],
          "flex items-center justify-center bg-red-900/40 text-xs text-white",
          className,
        )}
        title={`Invalid card: ${String(card)}`}
      >
        Err
      </div>
    );
  }

  const { rank, suit } = parsed;
  const symbol = SUIT_SYMBOL[suit];
  const colorTone = isRedSuit(suit) ? "red" : "black";
  const displayRank = rankToDisplay(rank);

  return (
    <CardContainer
      animate={animate}
      className={cn(
        "hh-playing-card relative shrink-0 select-none overflow-hidden rounded-lg",
        "border border-zinc-200 bg-white",
        SIZE_CLASS[size],
        PADDING_CLASS[size],
        interactive && "cursor-pointer",
        className,
      )}
      data-suit={suit}
      data-suit-color={colorTone}
      data-highlight={highlight ? "true" : undefined}
      data-dimmed={dimmed ? "true" : undefined}
      onClick={onClick}
      aria-label={ariaLabel ?? `${displayRank}${symbol}`}
      role={interactive ? "button" : undefined}
    >
      {/* 좌상단: 랭크 */}
      <div className="relative z-10 text-left leading-none">
        <span
          className={cn(
            "font-black font-sans tracking-tight leading-none",
            RANK_TEXT_CLASS[size],
          )}
        >
          {displayRank}
        </span>
      </div>

      {/* 중앙: 슈트 심볼 */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <span
          className={cn(
            "leading-none select-none opacity-80",
            CENTER_SUIT_CLASS[size],
          )}
        >
          {symbol}
        </span>
      </div>

      {/* 우하단: 180도 회전된 랭크 */}
      <div
        className={cn(
          "absolute z-10 rotate-180 leading-none",
          CORNER_OFFSET_CLASS[size],
        )}
      >
        <span
          className={cn(
            "font-black font-sans tracking-tight leading-none",
            RANK_TEXT_CLASS[size],
          )}
        >
          {displayRank}
        </span>
      </div>
    </CardContainer>
  );
}

/**
 * 카드 컨테이너. animate=true면 framer-motion으로 등장 애니메이션, 아니면 일반 div.
 *
 * `display: contents` 같은 트릭을 쓰지 않고 컨테이너 자체에 transform이 적용되도록 한다.
 */
interface CardContainerProps {
  animate: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
  role?: string;
  title?: string;
  // data-* 속성들은 number/string/boolean 모두 허용
  [dataKey: `data-${string}`]: string | number | boolean | undefined;
}

function CardContainer({
  animate,
  className,
  children,
  onClick,
  ...rest
}: CardContainerProps) {
  if (animate) {
    return (
      <motion.div
        {...ENTER_ANIMATION}
        className={className}
        onClick={onClick}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div className={className} onClick={onClick} {...rest}>
      {children}
    </div>
  );
}

/** "T" → "10" 처럼 사람이 읽기 쉬운 형태로 변환. 그 외에는 그대로. */
function rankToDisplay(rank: Rank): string {
  return rank === "T" ? "10" : rank;
}
