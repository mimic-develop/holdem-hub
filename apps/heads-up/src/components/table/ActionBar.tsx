import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { LegalActions } from '../../engine/game-engine';
import type { PlayerAction } from '../../types/game';
import { BetSlider } from './BetSlider';
import { useSettings } from '../../hooks/useSettings';

const BIG_BLIND = 2; // SB=1, BB=2

function chipsToBB(chips: number): string {
  const val = chips / BIG_BLIND;
  return Number.isInteger(val) ? `${val}bb` : `${val.toFixed(1)}bb`;
}

interface ActionBarProps {
  legal: LegalActions | null;
  disabled: boolean;
  potSize: number;
  currentBet: number;
  onAction: (action: PlayerAction, amount?: number) => void;
}

/**
 * 액션바 — GGPoker/PokerStars 모바일 스타일.
 *
 * 기본 상태: Fold · Call/Check · Raise/Bet  (3버튼 row)
 * 사이징 모드: BetSlider 패널이 3버튼 row 전체를 교체.
 *   - 프리셋 버튼 / 큰 금액 표시 / ±1bb 버튼 / 슬라이더 / [취소][확정]
 *   - 이전 구조(버튼 위에 슬라이더 적층 + 두 번 탭해야 확정)를 완전 제거.
 *
 * 키보드 단축키: Q (fold) / W (call/check) / E (raise 열기·확정)
 */
export function ActionBar({
  legal,
  disabled,
  potSize,
  currentBet,
  onAction,
}: ActionBarProps) {
  const { settings } = useSettings();
  const [showSlider, setShowSlider] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const raiseMin = legal?.canRaise
    ? legal.minRaiseTotal
    : legal?.canBet
      ? legal.minBetTotal
      : 0;
  const raiseMax = legal?.maxBetTotal ?? 0;
  const raiseLabel = legal?.canRaise ? 'Raise' : 'Bet';
  const raiseAvailable = !!legal && (legal.canBet || legal.canRaise) && raiseMax > 0;

  // 슬라이더를 열 때 기본값을 최소 베팅/레이즈 금액으로 설정.
  useEffect(() => {
    if (showSlider && raiseAvailable) {
      setRaiseAmount(raiseMin);
    }
  }, [showSlider, raiseAvailable, raiseMin]);

  // 내 차례가 끝나면 슬라이더 닫기.
  useEffect(() => {
    if (disabled || !legal) setShowSlider(false);
  }, [disabled, legal]);

  const canFold = !!legal && (legal.canCall || !legal.canCheck);
  const canCheckOrCall = !!legal && (legal.canCheck || legal.canCall);

  function confirmRaise() {
    const act: PlayerAction = legal?.canRaise ? 'raise' : 'bet';
    onAction(act, raiseAmount);
    setShowSlider(false);
  }

  // Keyboard shortcuts: Q (fold) / W (call/check) / E (raise open · confirm)
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'q' && canFold) {
        setShowSlider(false);
        onAction('fold');
      } else if (k === 'w' && canCheckOrCall) {
        setShowSlider(false);
        if (legal?.canCheck) onAction('check');
        else if (legal?.canCall) onAction('call', legal.callAmount);
      } else if (k === 'e' && raiseAvailable) {
        if (showSlider) {
          confirmRaise();
        } else {
          setShowSlider(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, legal, canFold, canCheckOrCall, raiseAvailable, showSlider, raiseAmount, onAction]);

  return (
    <div
      role="toolbar"
      aria-label="액션 선택"
      className="flex w-full flex-col gap-2 p-3 sm:max-w-md"
    >
      {showSlider && raiseAvailable ? (
        /* ── 사이징 모드: 3버튼 row를 패널로 전체 교체 ── */
        <div
          className="w-full rounded-xl p-3"
          style={{
            background: 'rgba(18,18,22,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
          }}
        >
          <BetSlider
            min={raiseMin}
            max={raiseMax}
            value={raiseAmount}
            onChange={setRaiseAmount}
            potSize={potSize}
            currentBet={currentBet}
            presetFractions={settings.betPresets}
            raiseLabel={raiseLabel}
            onConfirm={confirmRaise}
            onCancel={() => setShowSlider(false)}
          />
        </div>
      ) : (
        /* ── 기본 상태: 3버튼 row ── */
        <div className="grid w-full grid-cols-3 gap-2">
          <ActionButton
            variant="fold"
            shortcut="Q"
            label="Fold"
            disabled={disabled || !canFold}
            onClick={() => {
              setShowSlider(false);
              onAction('fold');
            }}
          />
          <ActionButton
            variant="call"
            shortcut="W"
            label={
              legal?.canCheck
                ? 'Check'
                : legal?.canCall
                  ? `Call ${chipsToBB(legal.callAmount)}`
                  : 'Check'
            }
            disabled={disabled || !canCheckOrCall}
            onClick={() => {
              setShowSlider(false);
              if (legal?.canCheck) onAction('check');
              else if (legal?.canCall) onAction('call', legal.callAmount);
            }}
          />
          <ActionButton
            variant="raise"
            shortcut="E"
            label={raiseLabel}
            disabled={disabled || !raiseAvailable}
            onClick={() => setShowSlider(true)}
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  variant,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  variant: 'fold' | 'call' | 'raise';
  label: string;
  shortcut: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const palette = {
    fold: {
      bg: 'linear-gradient(180deg, #b45454 0%, #6b1a1a 100%)',
      ring: 'rgba(107,26,26,0.45)',
    },
    call: {
      bg: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
      ring: 'rgba(34,197,94,0.5)',
    },
    raise: {
      bg: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
      ring: 'rgba(249,115,22,0.5)',
    },
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'group relative flex flex-col items-center justify-center rounded-lg py-3 font-bold text-white shadow-lg transition-all',
        disabled
          ? 'cursor-not-allowed opacity-40 grayscale'
          : 'hover:scale-[1.02] active:scale-95',
      )}
      style={{
        background: palette.bg,
        boxShadow: disabled
          ? 'none'
          : `0 4px 12px ${palette.ring}, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}
    >
      <span className="text-sm leading-tight">{label}</span>
      <span className="absolute right-1.5 top-1 text-[9px] font-bold text-white/60">
        {shortcut}
      </span>
    </button>
  );
}
