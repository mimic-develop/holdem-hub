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
  /** When true, render avatar above the name pill (top-of-table seat). False renders the cards above. */
  layout?: 'avatar-top' | 'cards-top';
  /** Stagger offset for hole-card dealing. */
  cardBaseDelay?: number;
  /** AI character avatar image URL. Shown only for opponent seat. */
  avatarSrc?: string;
  /** Compact mode — reduces avatar/pill sizes for small screens. */
  compact?: boolean;
}

/**
 * GTO Wizard 스타일 시트:
 * - 아바타(원형) + 이름/스택 다크 pill
 * - isToAct: 펄스 글로우 ring (애니메이션 반복) — 차례 명확히 인지
 * - 폴드: HoleCards가 위로 날아가며 사라지는 exit 애니메이션
 *
 * 카드는 별도로 TablePage에서 렌더링 (펠트와 겹치게 위치 잡기 위함).
 */
export function PlayerSeat({
  player,
  isMe,
  isToAct,
  isBotThinking = false,
  revealCards = false,
  label,
  layout = 'avatar-top',
  cardBaseDelay = 0,
  avatarSrc,
  compact = false,
}: PlayerSeatProps) {
  const faceDown = !isMe && !revealCards;
  const showCards = !!player.holeCards;

  // Pulse animation for active turn — visible signal of "your turn".
  // Stronger glow when it's the human player's turn (more salient).
  const pulseAnim = isToAct
    ? {
        boxShadow: isMe
          ? [
              '0 0 0 0px rgba(252,211,77,0.85), 0 4px 18px rgba(252,211,77,0.55)',
              '0 0 0 16px rgba(252,211,77,0), 0 4px 18px rgba(252,211,77,0)',
            ]
          : [
              '0 0 0 0px rgba(252,211,77,0.6), 0 4px 14px rgba(252,211,77,0.35)',
              '0 0 0 12px rgba(252,211,77,0), 0 4px 14px rgba(252,211,77,0)',
            ],
      }
    : {
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
      };

  const avatar = (
    <motion.div
      animate={
        isToAct
          ? {
              scale: [1, 1.06, 1],
            }
          : { scale: 1 }
      }
      transition={
        isToAct
          ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
      className={clsx(
        'relative flex items-center justify-center rounded-full transition-all',
        compact ? 'h-24 w-24' : 'h-24 w-24',
        isToAct &&
          (isMe
            ? 'ring-[3px] ring-amber-300 ring-offset-2 ring-offset-transparent'
            : 'ring-2 ring-amber-300 ring-offset-2 ring-offset-transparent'),
        player.hasFolded && 'opacity-40',
      )}
      style={{
        background: (!isMe && avatarSrc)
          ? 'transparent'
          : isMe
            ? 'linear-gradient(145deg, #4b1e22 0%, #2c1114 100%)'
            : 'linear-gradient(145deg, #404145 0%, #1c1d20 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {(!isMe && avatarSrc) ? (
        <img
          src={avatarSrc}
          alt=""
          aria-hidden
          draggable={false}
          className="h-full w-full rounded-full object-cover select-none"
        />
      ) : (
        <span className="text-3xl font-bold text-white/90">
          {(label[0] ?? (isMe ? '나' : 'AI')).toUpperCase()}
        </span>
      )}
      {isBotThinking && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 animate-pulse ring-2 ring-black/40"
        />
      )}
    </motion.div>
  );

  const namePill = (
    <motion.div
      animate={pulseAnim}
      transition={
        isToAct
          ? { repeat: Infinity, duration: 1.5, ease: 'easeOut' }
          : { duration: 0.3 }
      }
      className={clsx(
        'flex flex-col items-center rounded-xl transition-colors',
        compact ? 'min-w-[150px] px-5 py-2' : 'min-w-[150px] px-5 py-2',
        player.hasFolded && 'opacity-50',
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(28,28,32,0.95) 0%, rgba(15,15,18,0.95) 100%)',
        border: isToAct ? '1px solid rgba(252,211,77,0.5)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="text-[22px] font-semibold text-white/95 leading-tight">{label}</span>
      <motion.span
        key={`stack-${player.stack}`}
        initial={{ scale: 1.15, color: '#fcd34d' }}
        animate={{ scale: 1, color: 'rgba(255,255,255,0.7)' }}
        transition={{ duration: 0.4 }}
        className="text-[20px] font-bold leading-tight"
      >
        {player.stack / 2}bb
      </motion.span>
    </motion.div>
  );

  if (layout === 'cards-top') {
    // Player (me) — cards big above, pill below
    return (
      <div className="flex flex-col items-center gap-1">
        {showCards ? (
          <HoleCards
            cards={player.holeCards!}
            faceDown={faceDown}
            size="md"
            baseDelay={cardBaseDelay}
            folded={player.hasFolded}
          />
        ) : (
          <div className="h-20" />
        )}
        {namePill}
      </div>
    );
  }

  // Opponent — avatar above, pill below
  // 뒷면: 아바타 뒤에 숨김(-z-10) / 쇼다운 공개: 아바타 아래 normal flow로 표시
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {avatar}
        {showCards && faceDown && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -z-10 opacity-90">
            <HoleCards
              cards={player.holeCards!}
              faceDown={true}
              size="md"
              baseDelay={cardBaseDelay}
              folded={player.hasFolded}
            />
          </div>
        )}
      </div>
      {showCards && !faceDown && (
        <HoleCards
          cards={player.holeCards!}
          faceDown={false}
          size="md"
          baseDelay={cardBaseDelay}
          folded={player.hasFolded}
        />
      )}
      {namePill}
    </div>
  );
}
