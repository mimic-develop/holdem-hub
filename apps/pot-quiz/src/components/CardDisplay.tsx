import { parseCard, getRankLabel, getSuitSymbol, isRedSuit } from '@hh/poker-engine';

interface CardDisplayProps {
  card: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  highlight?: boolean;
  dimmed?: boolean;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-9',
  sm: 'w-8 h-11 text-sm',
  md: 'w-11 h-16 text-base',
  lg: 'w-14 h-20 text-lg',
};

const RANK_SIZE = {
  xs: 'text-[9px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const SUIT_SIZE = {
  xs: 'text-xs',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
};

export default function CardDisplay({ card, size = 'md', faceDown = false, highlight = false, dimmed = false }: CardDisplayProps) {
  if (faceDown) {
    return (
      <div className={`${SIZE_CLASSES[size]} rounded-md flex items-center justify-center bg-primary border border-blue-700 shadow-md`}>
        <div className="text-primary text-lg">🂠</div>
      </div>
    );
  }

  const parsed = parseCard(card);
  const red = isRedSuit(parsed.suit);

  const borderClass = highlight
    ? 'border-2 border-yellow-400 shadow-yellow-400/30 shadow-lg'
    : 'border border-input';

  // 카드 배경은 항상 밝은 zinc 톤 (실제 포커 카드). 그 위 글씨는 contrast 보장:
  //   red suit → text-red-600, black suit → text-zinc-900 (흰 바탕 위 검은 글씨)
  const bgClass = dimmed ? 'bg-zinc-300' : 'bg-zinc-100';
  const textColor = red ? 'text-red-600' : 'text-zinc-900';
  const dimClass = dimmed ? 'opacity-40' : '';

  return (
    <div
      className={`${SIZE_CLASSES[size]} ${borderClass} ${bgClass} ${dimClass} rounded-md flex flex-col items-center justify-center shadow-md select-none transition-all`}
      data-testid={`card-${card}`}
    >
      <span className={`font-bold leading-tight ${RANK_SIZE[size]} ${textColor}`}>
        {getRankLabel(parsed.rank)}
      </span>
      <span className={`leading-none ${SUIT_SIZE[size]} ${textColor}`}>
        {getSuitSymbol(parsed.suit)}
      </span>
    </div>
  );
}
