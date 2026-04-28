import type { Card as CardType } from '../../engine/card';
import { Card } from './Card';

interface CommunityBoardProps {
  board: CardType[];
}

export function CommunityBoard({ board }: CommunityBoardProps) {
  // 5 slots — show card when dealt, empty slot otherwise.
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const c = board[i];
        if (!c) {
          return (
            <div
              key={i}
              className="w-12 h-16 rounded-md border border-dashed border-white/20 bg-black/10"
            />
          );
        }
        // Stagger flop reveal by index (50ms per spec) for "deal" feel.
        const delay = i < 3 ? i * 50 : 0;
        return <Card key={i} card={c} size="md" delay={delay} />;
      })}
    </div>
  );
}
