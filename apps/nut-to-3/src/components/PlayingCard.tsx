import { motion } from "framer-motion";
import { parseCard } from "../lib/poker";
import { cn } from "../lib/utils";
import cardBackImg from "../assets/card-back.jpg";

interface PlayingCardProps {
  card: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  isFacedown?: boolean;
  noAnimation?: boolean;
}

const SUIT_COLOR: Record<string, string> = {
  s: "playing-card-black",
  h: "playing-card-red",
  d: "playing-card-red",
  c: "playing-card-black",
};

export function PlayingCard({
  card,
  size = "md",
  className,
  isFacedown = false,
  noAnimation = false,
}: PlayingCardProps) {
  if (isFacedown) {
    return (
      <div
        className={cn(
          "relative rounded-lg playing-card-shadow overflow-hidden shrink-0",
          size === "sm" && "w-10 h-14",
          size === "md" && "w-[52px] h-[72px] sm:w-[60px] sm:h-[84px]",
          size === "lg" && "w-[68px] h-[96px] sm:w-[88px] sm:h-[124px]",
          className
        )}
      >
        <img
          src={cardBackImg}
          alt="card back"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }

  try {
    const { suit, displayRank } = parseCard(card);
    const suitSymbols: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
    const symbol = suitSymbols[suit] ?? "?";
    const color = SUIT_COLOR[suit] ?? "playing-card-black";

    const rankCls = cn(
      "font-black font-sans leading-none tracking-tight",
      size === "sm"  && "text-[10px]",
      size === "md"  && "text-[13px] sm:text-[15px]",
      size === "lg"  && "text-base sm:text-xl",
    );

    const centerSuitCls = cn(
      "leading-none select-none",
      size === "sm" && (suit === "s" || suit === "h" || suit === "c") ? "text-[12px]" : size === "sm" ? "text-[14px]" : "",
      size === "md"  && "text-[22px] sm:text-[26px]",
      size === "lg"  && "text-[32px] sm:text-[40px]",
    );

    const pad = cn(
      size === "sm"  && "p-[5px]",
      size === "md"  && "p-[6px] sm:p-[8px]",
      size === "lg"  && "p-[8px] sm:p-[10px]",
    );

    return (
      <motion.div
        initial={noAnimation ? false : { opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={cn(
          "bg-white border border-gray-200 rounded-lg playing-card-shadow select-none relative overflow-hidden shrink-0",
          size === "sm"  && "w-10 h-14",
          size === "md"  && "w-[52px] h-[72px] sm:w-[60px] sm:h-[84px]",
          size === "lg"  && "w-[68px] h-[96px] sm:w-[88px] sm:h-[124px]",
          pad,
          color,
          className
        )}
      >
        {/* Top-left index: rank only */}
        <div className="relative z-10 leading-none text-left">
          <span className={rankCls}>{displayRank}</span>
        </div>

        {/* Center: suit symbol (all sizes) */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <span
            className={cn(centerSuitCls, size === "sm" ? "opacity-90" : "opacity-70")}
            style={(size !== "sm" && (suit === "s" || suit === "h" || suit === "c")) ? { fontSize: "0.85em" } : undefined}
          >{symbol}</span>
        </div>

        {/* Bottom-right index: rotated 180° — rank only */}
        <div className={cn(
          "absolute rotate-180 z-10 leading-none",
          size === "sm"  && "bottom-[5px] right-[5px]",
          size === "md"  && "bottom-[6px] right-[6px] sm:bottom-[8px] sm:right-[8px]",
          size === "lg"  && "bottom-[8px] right-[8px] sm:bottom-[10px] sm:right-[10px]",
        )}>
          <span className={rankCls}>{displayRank}</span>
        </div>
      </motion.div>
    );
  } catch {
    return (
      <div className="w-[52px] h-[72px] bg-red-900/50 rounded-lg flex items-center justify-center text-white text-xs">
        Err
      </div>
    );
  }
}
