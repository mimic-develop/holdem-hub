import type { Card as CardType } from '../../engine/card';
import { Card } from './Card';

interface CommunityBoardProps {
  board: CardType[];
}

/**
 * 5장 커뮤니티 보드. 미공개 슬롯은 옅은 outline + 가운데 점.
 */
export function CommunityBoard({ board }: CommunityBoardProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3, 4].map((i) => {
        const c = board[i];
        if (!c) {
          return (
            <div
              key={i}
              aria-hidden
              className="relative w-14 h-20 rounded-[7px]"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 100%)',
                boxShadow:
                  'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 12px rgba(0,0,0,0.25)',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
              </div>
            </div>
          );
        }
        // Stagger flop reveal by index (50ms per spec) for "deal" feel.
        const delay = i < 3 ? i * 50 : 0;
        return <Card key={i} card={c} size="md" delay={delay} />;
      })}
    </div>
  );
}
