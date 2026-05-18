import ChipStack from './ChipStack';

interface DeadMoneyPileProps {
  amount: number;
  active: boolean;
  onClick?: () => void;
}

/**
 * 펠트 위의 데드머니 더미. forming 중 데드머니 sub-step에서만 활성(클릭 가능 + 펄스).
 * 합쳐진 뒤(amount = 0)는 빈 자리만 차지하지 않도록 null 반환.
 */
export default function DeadMoneyPile({ amount, active, onClick }: DeadMoneyPileProps) {
  if (amount <= 0) return null;
  return (
    <button
      type="button"
      onClick={active ? onClick : undefined}
      disabled={!active}
      aria-label="데드머니"
      data-testid="dead-money-pile"
      data-flying-id="dead-money"
      className={[
        'absolute flex flex-col items-center gap-0.5 transition-opacity',
        active ? 'cursor-pointer' : 'cursor-default opacity-70',
      ].join(' ')}
      style={{ top: '50%', left: '50%', transform: 'translate(-50%, calc(-50% + 92px))' }}
    >
      <span
        className="font-extrabold uppercase leading-none"
        style={{
          fontSize: 10,
          letterSpacing: '0.10em',
          color: '#E9D5FF',
          padding: '2px 6px',
          borderRadius: 8,
          background: 'rgba(192,132,252,0.18)',
          border: '1px solid rgba(192,132,252,0.45)',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        데드머니
      </span>
      <ChipStack amount={amount} tone="dead" size="md" active={active} layoutId="dead-money-chip" />
    </button>
  );
}
