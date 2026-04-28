import { type Card } from "../lib/quizData";

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠\uFE0E",
  hearts: "♥\uFE0E",
  diamonds: "♦\uFE0E",
  clubs: "♣\uFE0E",
};

const RANK_DISPLAY: Record<string, string> = {
  T: "10",
  J: "J",
  Q: "Q",
  K: "K",
  A: "A",
};

function getDisplayRank(rank: string) {
  return RANK_DISPLAY[rank] ?? rank;
}

function getSuitColor(suit: string) {
  if (suit === "hearts" || suit === "diamonds") return "#E5343A";
  return "#1a1a1a";
}

interface PlayingCardProps {
  card: Card;
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
}

export function PlayingCard({ card, size = "md", faceDown = false }: PlayingCardProps) {
  const color = getSuitColor(card.suit);
  const suit = SUIT_SYMBOLS[card.suit];
  const rank = getDisplayRank(card.rank);

  const sizes = {
    sm: {
      card: "w-10 h-[56px] rounded-lg",
      rankSize: "text-[16px]",
      suitSize: "text-[14px]",
      rankOffset: "pl-1 pt-0.5",
      suitOffset: "pl-1 pt-0",
    },
    md: {
      card: "w-[48px] h-[68px] rounded-lg",
      rankSize: "text-[20px]",
      suitSize: "text-[16px]",
      rankOffset: "pl-1.5 pt-1",
      suitOffset: "pl-1.5 pt-0",
    },
    lg: {
      card: "w-[72px] h-[102px] rounded-xl",
      rankSize: "text-[36px]",
      suitSize: "text-[48px]",
      rankOffset: "pl-2.5 pt-1.5",
      suitOffset: "pr-2 pb-1.5",
    },
  }[size];

  const cardFont = "'Nunito', sans-serif";

  if (faceDown) {
    return (
      <div
        className={`${sizes.card} relative flex-shrink-0`}
        style={{
          background: "linear-gradient(135deg, #c0392b 0%, #922b21 100%)",
          border: "2px solid rgba(0,0,0,0.12)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}
      >
        <div
          className="absolute inset-1.5 rounded-lg"
          style={{
            background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 8px)",
          }}
        />
      </div>
    );
  }

  if (size === "lg") {
    return (
      <div
        data-testid={`card-${card.rank}-${card.suit}`}
        className={`${sizes.card} relative flex-shrink-0 flex flex-col justify-between select-none`}
        style={{
          background: "#ffffff",
          border: "2px solid rgba(0,0,0,0.08)",
          boxShadow: "0 3px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)",
          fontFamily: cardFont,
        }}
      >
        <span className={`${sizes.rankSize} ${sizes.rankOffset} leading-none font-black self-start`} style={{ color }}>{rank}</span>
        <span className={`${sizes.suitSize} ${sizes.suitOffset} leading-none self-end`} style={{ color }}>{suit}</span>
      </div>
    );
  }

  return (
    <div
      data-testid={`card-${card.rank}-${card.suit}`}
      className={`${sizes.card} relative flex-shrink-0 select-none`}
      style={{
        background: "#ffffff",
        border: "1.5px solid rgba(0,0,0,0.1)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        fontFamily: cardFont,
      }}
    >
      <div className={`${sizes.rankOffset}`}>
        <span className={`${sizes.rankSize} leading-none font-black block`} style={{ color }}>{rank}</span>
        <span className={`${sizes.suitSize} leading-none font-bold block`} style={{ color }}>{suit}</span>
      </div>
    </div>
  );
}

interface CardGroupProps {
  label: string;
  cards: Card[];
  size?: "sm" | "md" | "lg";
}

export function CardGroup({ label, cards, size = "md" }: CardGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">
        {cards.map((card, i) => (
          <PlayingCard key={`${card.rank}${card.suit}${i}`} card={card} size={size} />
        ))}
      </div>
    </div>
  );
}

interface HandDisplayProps {
  holeCards?: Card[];
  boardCards?: Card[];
}

export function HandDisplay({ holeCards, boardCards }: HandDisplayProps) {
  if (!holeCards && !boardCards) return null;

  return (
    <div className="bg-background border border-border rounded-xl p-4 flex flex-wrap gap-5 items-start">
      {boardCards && boardCards.length > 0 && (
        <CardGroup label="커뮤니티 카드 (보드)" cards={boardCards} size="md" />
      )}
      {holeCards && boardCards && boardCards.length > 0 && (
        <div className="w-px self-stretch bg-border hidden sm:block" />
      )}
      {holeCards && holeCards.length > 0 && (
        <CardGroup label="내 홀카드" cards={holeCards} size="md" />
      )}
    </div>
  );
}
