import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { LegalActions } from '../../engine/game-engine';
import type { PlayerAction } from '../../types/game';
import { BetSlider } from './BetSlider';

interface ActionBarProps {
  legal: LegalActions | null;
  disabled: boolean;
  potSize: number;
  currentBet: number;
  onAction: (action: PlayerAction, amount?: number) => void;
}

export function ActionBar({
  legal,
  disabled,
  potSize,
  currentBet,
  onAction,
}: ActionBarProps) {
  const [showSlider, setShowSlider] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const raiseMin = legal?.canRaise
    ? legal.minRaiseTotal
    : legal?.canBet
      ? legal.minBetTotal
      : 0;
  const raiseMax = legal?.maxBetTotal ?? 0;
  const raiseLabel = legal?.canRaise ? '레이즈' : '벳';
  const raiseAvailable = !!legal && (legal.canBet || legal.canRaise) && raiseMax > 0;

  // Initialize raise amount when slider opens.
  useEffect(() => {
    if (showSlider && raiseAvailable) {
      // Default to ~2/3 pot or min, whichever is larger.
      const suggest = Math.round(currentBet + 0.67 * (potSize + currentBet));
      const clamped = Math.max(raiseMin, Math.min(raiseMax, suggest));
      setRaiseAmount(clamped);
    }
  }, [showSlider, raiseAvailable, raiseMin, raiseMax, potSize, currentBet]);

  // Close slider when it's no longer our turn.
  useEffect(() => {
    if (disabled || !legal) setShowSlider(false);
  }, [disabled, legal]);

  const canFold = !!legal && (legal.canCall || !legal.canCheck);
  const canCheckOrCall = !!legal && (legal.canCheck || legal.canCall);

  return (
    <div
      role="toolbar"
      aria-label="액션 선택"
      className="flex w-full flex-col gap-2 bg-black/40 p-3 backdrop-blur-sm"
    >
      {showSlider && raiseAvailable && (
        <BetSlider
          min={raiseMin}
          max={raiseMax}
          value={raiseAmount}
          onChange={setRaiseAmount}
          potSize={potSize}
          currentBet={currentBet}
        />
      )}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled || !canFold}
          onClick={() => {
            setShowSlider(false);
            onAction('fold');
          }}
          className={clsx(
            'rounded-lg py-3 font-semibold transition-colors',
            disabled || !canFold
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-red-900 text-white hover:bg-red-800 active:scale-95',
          )}
        >
          폴드
        </button>

        <button
          type="button"
          disabled={disabled || !canCheckOrCall}
          onClick={() => {
            setShowSlider(false);
            if (legal?.canCheck) onAction('check');
            else if (legal?.canCall) onAction('call', legal.callAmount);
          }}
          className={clsx(
            'rounded-lg py-3 font-semibold transition-colors',
            disabled || !canCheckOrCall
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              // 체크/콜은 중립 톤 다크 버튼 (펠트 위에서 폴드/레이즈와 시각 구분)
              : 'bg-neutral-700 text-white hover:bg-neutral-600 active:scale-95',
          )}
        >
          {legal?.canCheck
            ? '체크'
            : legal?.canCall
              ? `콜 ${legal.callAmount}`
              : '체크/콜'}
        </button>

        {!showSlider ? (
          <button
            type="button"
            disabled={disabled || !raiseAvailable}
            onClick={() => setShowSlider(true)}
            className={clsx(
              'rounded-lg py-3 font-semibold transition-colors',
              disabled || !raiseAvailable
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95',
            )}
          >
            {raiseLabel}
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || !raiseAvailable}
            onClick={() => {
              const act: PlayerAction = legal?.canRaise ? 'raise' : 'bet';
              onAction(act, raiseAmount);
              setShowSlider(false);
            }}
            className="rounded-lg bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 active:scale-95"
          >
            확정 {raiseAmount}
          </button>
        )}
      </div>
      {showSlider && (
        <button
          type="button"
          onClick={() => setShowSlider(false)}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          취소
        </button>
      )}
    </div>
  );
}
