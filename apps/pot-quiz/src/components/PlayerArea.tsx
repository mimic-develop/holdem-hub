import CardDisplay from './CardDisplay';
import type { PlayerPuzzleData } from "../types/poker";

interface PlayerAreaProps {
  player: PlayerPuzzleData;
  isSelected?: boolean;
  isWinner?: boolean;
  isLoser?: boolean;
  selectable?: boolean;
  onToggle?: (id: string) => void;
  showResult?: boolean;
  payout?: number;
  handDesc?: string;
}

export default function PlayerArea({
  player,
  isSelected = false,
  isWinner = false,
  isLoser = false,
  selectable = false,
  onToggle,
  showResult = false,
  payout,
  handDesc,
}: PlayerAreaProps) {
  const borderClass = showResult
    ? isWinner
      ? 'border-2 border-yellow-400 shadow-yellow-400/20 shadow-lg'
      : 'border border-border opacity-60'
    : isSelected
    ? 'border-2 border-blue-400 shadow-blue-400/20 shadow-lg'
    : 'border border-border';

  const bgClass = showResult
    ? isWinner
      ? 'bg-muted/80'
      : 'bg-card/60'
    : isSelected
    ? 'bg-muted'
    : 'bg-card';

  const clickable = selectable && !showResult ? 'cursor-pointer hover:border-blue-400/60 hover:bg-muted/70 transition-all' : '';

  return (
    <div
      className={`rounded-xl p-3 ${borderClass} ${bgClass} ${clickable} relative`}
      onClick={() => selectable && onToggle?.(player.id)}
      data-testid={`player-area-${player.id}`}
    >
      {/* Winner badge */}
      {showResult && isWinner && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
          승자
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && !showResult && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
          선택됨
        </div>
      )}

      {/* Player name */}
      <div className="text-center mb-2">
        <span className="text-xs font-semibold text-foreground uppercase tracking-widest">
          {player.name}
        </span>
      </div>

      {/* Hole cards */}
      <div className="flex gap-1.5 justify-center mb-2">
        {player.cards.map(c => (
          <CardDisplay key={c} card={c} size="md" highlight={showResult && isWinner} dimmed={showResult && isLoser} />
        ))}
      </div>

      {/* Hand description */}
      {showResult && handDesc && (
        <div className="text-center mb-1">
          <span className={`text-xs font-semibold ${isWinner ? 'text-yellow-400' : 'text-muted-foreground'}`}>
            {handDesc}
          </span>
        </div>
      )}

      {/* Invested chips */}
      <div className="text-center">
        <span className="text-xs text-muted-foreground">총 투자</span>
        <span className="ml-1 text-sm font-bold text-foreground" data-testid={`invested-${player.id}`}>
          {player.invested.toLocaleString()}
        </span>
      </div>

      {/* Payout */}
      {showResult && payout !== undefined && (
        <div className="text-center mt-1 pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">수령</span>
          <span className={`ml-1 text-sm font-bold ${payout > 0 ? 'text-green-400' : 'text-muted-foreground'}`} data-testid={`payout-${player.id}`}>
            {payout.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
