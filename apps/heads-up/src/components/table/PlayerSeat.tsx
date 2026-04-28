import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { Player } from '../../types/game';
import { HoleCards } from './HoleCards';

interface PlayerSeatProps {
  player: Player;
  isMe: boolean;
  isToAct: boolean;
  isBotThinking?: boolean;
  revealCards?: boolean;
  label: string;
}

export function PlayerSeat({
  player,
  isMe,
  isToAct,
  isBotThinking = false,
  revealCards = false,
  label,
}: PlayerSeatProps) {
  const faceDown = !isMe && !revealCards;
  const showCards = !!player.holeCards && !player.hasFolded;

  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
        isToAct
          ? 'border-primary bg-black/30 shadow-[0_0_12px_rgba(212,175,55,0.35)]'
          : 'border-white/10 bg-black/20',
        player.hasFolded && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
            // 펠트 위에 떠있는 좌석 배지라 다크 contrast 유지 (라이트 테마에서도 felt 위로 다크 박스 OK)
            isMe ? 'bg-primary text-primary-foreground' : 'bg-neutral-700 text-white',
          )}
        >
          {isMe ? '나' : 'AI'}
        </div>
        <div className="text-left leading-tight">
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-muted-foreground">
            {player.position} · {player.stack} BB
          </div>
        </div>
      </div>

      {showCards ? (
        <HoleCards cards={player.holeCards!} faceDown={faceDown} size="sm" />
      ) : (
        <div className="h-12" />
      )}

      {player.currentBet > 0 && (
        <motion.div
          key={`bet-${player.currentBet}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-full border border-primary/60 bg-black/60 px-2 py-0.5 text-xs font-semibold text-primary"
        >
          {player.currentBet}
        </motion.div>
      )}

      {isBotThinking && (
        <div className="text-xs italic text-foreground animate-pulse">생각 중...</div>
      )}
      {player.hasFolded && <div className="text-xs font-semibold text-red-400">폴드</div>}
    </div>
  );
}
