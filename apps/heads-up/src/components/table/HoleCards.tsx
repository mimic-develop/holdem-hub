import type { Card as CardType } from '../../engine/card';
import { Card } from './Card';

interface HoleCardsProps {
  cards: CardType[] | null;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 두 홀카드를 약간 겹쳐 fan(부채꼴) 형태로 표시. 실제 손에 든 카드 느낌.
 */
export function HoleCards({ cards, faceDown = false, size = 'md' }: HoleCardsProps) {
  const c1 = cards?.[0] ?? null;
  const c2 = cards?.[1] ?? null;
  return (
    <div className="relative inline-flex items-end">
      <div
        className="relative origin-bottom-right"
        style={{ transform: 'rotate(-6deg)', marginRight: '-6px', zIndex: 1 }}
      >
        <Card card={c1} faceDown={faceDown} size={size} delay={0} />
      </div>
      <div
        className="relative origin-bottom-left"
        style={{ transform: 'rotate(6deg)', marginLeft: '-6px', zIndex: 2 }}
      >
        <Card card={c2} faceDown={faceDown} size={size} delay={80} />
      </div>
    </div>
  );
}
