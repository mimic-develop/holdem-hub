import { motion } from 'framer-motion';
import type { Card as CardType } from '../../engine/card';
import { Card } from './Card';

interface CommunityBoardProps {
  board: CardType[];
}

/**
 * 5장 커뮤니티 보드. 미공개 슬롯은 옅은 outline + 가운데 점.
 *
 * 딜링 stagger:
 * - 플랍(0,1,2): 각 150ms 간격으로 뒤집히며 등장
 * - 턴(3): 단독으로 살짝 강조 등장
 * - 리버(4): 단독으로 살짝 강조 등장
 */
export function CommunityBoard({ board }: CommunityBoardProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3, 4].map((i) => {
        const c = board[i];
        if (!c) {
          return (
            <motion.div
              key={i}
              aria-hidden
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
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
            </motion.div>
          );
        }
        // Stagger: flop (0,1,2) cards stagger by 150ms each;
        // turn(3) and river(4) appear standalone with small delay.
        const delay = i < 3 ? i * 150 : 80;
        return <Card key={i} card={c} size="md" delay={delay} />;
      })}
    </div>
  );
}
