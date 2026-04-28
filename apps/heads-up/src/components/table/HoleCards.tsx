import type { Card as CardType } from '../../engine/card';
import { Card } from './Card';

interface HoleCardsProps {
  cards: CardType[] | null;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function HoleCards({ cards, faceDown = false, size = 'md' }: HoleCardsProps) {
  const c1 = cards?.[0] ?? null;
  const c2 = cards?.[1] ?? null;
  return (
    <div className="flex gap-1">
      <Card card={c1} faceDown={faceDown} size={size} delay={0} />
      <Card card={c2} faceDown={faceDown} size={size} delay={80} />
    </div>
  );
}
