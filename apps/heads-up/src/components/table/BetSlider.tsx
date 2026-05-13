import clsx from 'clsx';
import { useCallback, useMemo, useRef, useState } from 'react';

/** 1 big blind = 20 chips (heads-up SB=10, BB=20). */
const DEFAULT_BIG_BLIND = 20;

interface BetSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  potSize: number;
  /** Current street's call amount (0 if nobody has bet yet). */
  currentBet: number;
  /** User-configured pot-fraction presets (e.g. [0.5, 0.67, 1.0]). ALL-IN always appended. */
  presetFractions: number[];
  /** Chips per big blind. Default 2. */
  bigBlind?: number;
  /** "Raise" or "Bet" — used on confirm button and labels. */
  raiseLabel?: string;
  /** Called when the user clicks the confirm (Raise/Bet) button. */
  onConfirm: () => void;
  /** Called when the user clicks 취소. */
  onCancel: () => void;
}

interface Preset {
  fracLabel: string;
  bbLabel: string;
  value: number;
  isAllIn: boolean;
}

/**
 * Common fractions get nice labels; otherwise show as a percentage.
 * Exported so BetPresetsEditor can re-use it.
 */
export function fractionLabel(f: number): string {
  if (Math.abs(f - 0.25) < 0.005) return '1/4';
  if (Math.abs(f - 0.33) < 0.005 || Math.abs(f - 1 / 3) < 0.005) return '1/3';
  if (Math.abs(f - 0.5) < 0.005) return '1/2';
  if (Math.abs(f - 0.67) < 0.005 || Math.abs(f - 2 / 3) < 0.005) return '2/3';
  if (Math.abs(f - 0.75) < 0.005) return '3/4';
  if (Math.abs(f - 1.0) < 0.005) return 'Pot';
  if (f >= 1) {
    const r = Math.round(f * 10) / 10;
    return Number.isInteger(r) ? `${r}x` : `${r.toFixed(1)}x`;
  }
  return `${Math.round(f * 100)}%`;
}

function toBBLabel(chips: number, bb: number): string {
  const val = chips / bb;
  return Number.isInteger(val) ? `${val}bb` : `${val.toFixed(1)}bb`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ─────────────────────────────────────────────────────────────────────────────
// NumpadModal — custom keypad overlay for precise amount entry
// ─────────────────────────────────────────────────────────────────────────────
function NumpadModal({
  initialBBValue,
  minBB,
  maxBB,
  bigBlind,
  raiseLabel,
  onConfirm,
  onClose,
}: {
  initialBBValue: number;
  minBB: number;
  maxBB: number;
  bigBlind: number;
  raiseLabel: string;
  onConfirm: (chips: number) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState(
    Number.isInteger(initialBBValue) ? String(Math.round(initialBBValue)) : initialBBValue.toFixed(1),
  );

  const parsedBB = parseFloat(input) || 0;
  const isAllIn = parsedBB >= maxBB;

  function appendChar(ch: string) {
    setInput((prev) => {
      if (ch === '.' && prev.includes('.')) return prev;
      if (ch !== '.' && prev === '0') return ch;
      if (prev.length >= 7) return prev;
      return prev + ch;
    });
  }

  function backspace() {
    setInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }

  function clearAll() {
    setInput('0');
  }

  function addBB(delta: number) {
    const next = clamp((parseFloat(input) || 0) + delta, minBB, maxBB);
    setInput(Number.isInteger(next) ? String(Math.round(next)) : next.toFixed(1));
  }

  function setAllIn() {
    setInput(Number.isInteger(maxBB) ? String(Math.round(maxBB)) : maxBB.toFixed(1));
  }

  function confirm() {
    if (!isNaN(parsedBB) && parsedBB > 0) {
      const chips = clamp(Math.round(parsedBB * bigBlind), Math.round(minBB * bigBlind), Math.round(maxBB * bigBlind));
      onConfirm(chips);
    }
    onClose();
  }

  const displayText = isAllIn ? 'ALL-IN' : `${input}bb`;

  const numBtnStyle = { background: '#2c2c2e' } as React.CSSProperties;
  const numBtnCls = 'rounded-xl py-3.5 text-center transition-opacity active:opacity-50';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl p-4"
        style={{
          background: '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.85)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">{raiseLabel} To 입력</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        {/* Input display */}
        <div
          className="mb-3 flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className={clsx('text-2xl font-bold tabular-nums', isAllIn ? 'text-amber-400' : 'text-white')}>
            {displayText}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 0a6 6 0 100 12A6 6 0 006 0zM9 8.29L8.29 9 6 6.71 3.71 9 3 8.29 5.29 6 3 3.71 3.71 3 6 5.29 8.29 3 9 3.71 6.71 6 9 8.29z" />
            </svg>
          </button>
        </div>

        {/* Keypad grid: 4 cols */}
        <div className="grid grid-cols-4 gap-1.5">
          {/* Row 1: 1 2 3 ⌫ */}
          {(['1', '2', '3'] as const).map((d) => (
            <button key={d} type="button" onClick={() => appendChar(d)}
              className={clsx(numBtnCls, 'text-lg font-semibold text-white')} style={numBtnStyle}>{d}</button>
          ))}
          <button type="button" onClick={backspace}
            className={clsx(numBtnCls, 'text-base text-white/60')} style={numBtnStyle}>⌫</button>

          {/* Row 2: 4 5 6 +1bb */}
          {(['4', '5', '6'] as const).map((d) => (
            <button key={d} type="button" onClick={() => appendChar(d)}
              className={clsx(numBtnCls, 'text-lg font-semibold text-white')} style={numBtnStyle}>{d}</button>
          ))}
          <button type="button" onClick={() => addBB(1)}
            className={clsx(numBtnCls, 'text-xs font-bold text-orange-400')} style={numBtnStyle}>+1bb</button>

          {/* Row 3: 7 8 9 +10bb */}
          {(['7', '8', '9'] as const).map((d) => (
            <button key={d} type="button" onClick={() => appendChar(d)}
              className={clsx(numBtnCls, 'text-lg font-semibold text-white')} style={numBtnStyle}>{d}</button>
          ))}
          <button type="button" onClick={() => addBB(10)}
            className={clsx(numBtnCls, 'text-xs font-bold text-orange-400')} style={numBtnStyle}>+10bb</button>

          {/* Row 4: . 0 All-In (span 2) */}
          <button type="button" onClick={() => appendChar('.')}
            className={clsx(numBtnCls, 'text-lg font-semibold text-white/50')} style={numBtnStyle}>.</button>
          <button type="button" onClick={() => appendChar('0')}
            className={clsx(numBtnCls, 'text-lg font-semibold text-white')} style={numBtnStyle}>0</button>
          <button type="button" onClick={setAllIn}
            className={clsx(numBtnCls, 'col-span-2 text-sm font-bold text-amber-400')} style={numBtnStyle}>All-In</button>
        </div>

        {/* Confirm */}
        <button
          type="button"
          onClick={confirm}
          className="mt-3 w-full rounded-xl py-3.5 text-base font-bold text-white transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
            boxShadow: '0 4px 12px rgba(249,115,22,0.45)',
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BetSlider — redesigned panel
//
// Layout (top → bottom):
//   1. 대형 금액 표시 + 상단 ± 버튼 (coarse step)
//   2. 프리셋 칩 버튼 (수평 스크롤)
//   3. 수평 슬라이더 + Min / All-In 레이블
//   4. 정보 그리드: 콜 금액 | 내 스택
//   5. 하단 ± 버튼 (fine-tune) + 직접 입력 버튼
//   6. 컨텍스트 레이블 + 금액 분해 수식
//   7. 취소 / Raise·Bet 확정 버튼
// ─────────────────────────────────────────────────────────────────────────────
export function BetSlider({
  min,
  max,
  value,
  onChange,
  potSize,
  currentBet,
  presetFractions,
  bigBlind = DEFAULT_BIG_BLIND,
  raiseLabel = 'Raise',
  onConfirm,
  onCancel,
}: BetSliderProps) {
  const [numpadOpen, setNumpadOpen] = useState(false);

  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const potAfterCall = potSize + currentBet;
  const step = bigBlind;

  // Long-press refs — mirrors current value to avoid stale closure
  const valueRef = useRef(value);
  valueRef.current = value;
  const pressTimerRef = useRef<number | null>(null);
  const pressIntervalRef = useRef<number | null>(null);

  const stopPress = useCallback(() => {
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    if (pressIntervalRef.current !== null) window.clearInterval(pressIntervalRef.current);
    pressTimerRef.current = null;
    pressIntervalRef.current = null;
  }, []);

  const startPress = useCallback(
    (delta: number) => {
      onChange(clamp(valueRef.current + delta, safeMin, safeMax));
      pressTimerRef.current = window.setTimeout(() => {
        pressIntervalRef.current = window.setInterval(() => {
          onChange(clamp(valueRef.current + delta, safeMin, safeMax));
        }, 80);
      }, 400);
    },
    [onChange, safeMin, safeMax],
  );

  // Presets — All-In is always kept separate so it's never deduped away
  const { regularPresets, allInPreset } = useMemo(() => {
    const list: Preset[] = presetFractions.map((frac) => {
      const raw = Math.round(currentBet + frac * (potSize + currentBet));
      const clamped = clamp(raw, safeMin, safeMax);
      return {
        fracLabel: fractionLabel(frac),
        bbLabel: toBBLabel(clamped, bigBlind),
        value: clamped,
        isAllIn: clamped >= safeMax,
      };
    });
    const seen = new Set<number>();
    seen.add(safeMax); // exclude any fraction that equals all-in value
    const regular = list
      .filter((p) => !p.isAllIn)
      .filter((p) => (seen.has(p.value) ? false : (seen.add(p.value), true)))
      .sort((a, b) => a.value - b.value);
    const allIn: Preset = {
      fracLabel: 'All-In',
      bbLabel: toBBLabel(safeMax, bigBlind),
      value: safeMax,
      isAllIn: true,
    };
    return { regularPresets: regular, allInPreset: allIn };
  }, [safeMin, safeMax, potSize, currentBet, presetFractions, bigBlind]);

  // Derived display values
  const isAllIn = value >= safeMax;
  const bbDisplay = toBBLabel(value, bigBlind);
  const myStackBB = toBBLabel(safeMax, bigBlind);
  const potPct = potAfterCall > 0 ? Math.round((value / potAfterCall) * 100) : 0;
  const fillPct = safeMax > safeMin ? ((value - safeMin) / (safeMax - safeMin)) * 100 : 0;

  // Shared ± button helper
  function PlusMinusBtn({
    delta,
    size,
    disabled: dis,
    ariaLabel,
  }: {
    delta: number;
    size: 'lg' | 'sm';
    disabled: boolean;
    ariaLabel: string;
  }) {
    const lg = size === 'lg';
    return (
      <button
        type="button"
        onPointerDown={() => !dis && startPress(delta)}
        onPointerUp={stopPress}
        onPointerLeave={stopPress}
        disabled={dis}
        aria-label={ariaLabel}
        className={clsx(
          'flex shrink-0 items-center justify-center rounded-2xl font-bold text-white transition-all',
          lg ? 'text-2xl' : 'text-lg',
          dis ? 'cursor-not-allowed opacity-30' : 'hover:bg-white/20 active:scale-95',
        )}
        style={{
          width: lg ? 44 : 36,
          height: lg ? 44 : 36,
          background: 'rgba(255,255,255,0.1)',
        }}
      >
        {delta < 0 ? '−' : '+'}
      </button>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col gap-2.5">

        {/* ── 1. Large amount + coarse ± ─────────────────────────── */}
        <div className="flex items-center gap-3">
          <PlusMinusBtn delta={-step} size="lg" disabled={value <= safeMin} ariaLabel="1bb 감소" />

          <div className="flex flex-1 flex-col items-center gap-0.5">
            <span
              className={clsx(
                'text-[30px] font-black leading-none tabular-nums tracking-tight',
                isAllIn ? 'text-amber-400' : 'text-white',
              )}
            >
              {isAllIn ? 'ALL-IN' : bbDisplay}
            </span>
            {!isAllIn && potAfterCall > 0 && (
              <span className="text-[11px] text-white/40">팟의 {potPct}%</span>
            )}
          </div>

          <PlusMinusBtn delta={step} size="lg" disabled={value >= safeMax} ariaLabel="1bb 증가" />
        </div>

        {/* ── 2. Preset chips ─────────────────────────────────────── */}
        <div className="flex items-stretch gap-1.5">
          {/* Regular fraction presets — horizontally scrollable */}
          <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {regularPresets.map((p) => {
              const active = value === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onChange(p.value)}
                  className={clsx(
                    'flex shrink-0 flex-col items-center rounded-xl px-3 py-1.5 transition-all active:scale-95',
                    active
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/[0.07] text-white/75 hover:bg-white/[0.13]',
                  )}
                >
                  <span className="text-[12px] font-bold leading-none">{p.fracLabel}</span>
                  <span className={clsx('mt-0.5 text-[10px] leading-none', active ? 'text-white/70' : 'text-white/40')}>
                    {p.bbLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* All-In — always pinned to the right, never scrolls away */}
          {(() => {
            const p = allInPreset;
            const active = value >= safeMax;
            return (
              <button
                type="button"
                onClick={() => onChange(p.value)}
                className={clsx(
                  'flex shrink-0 flex-col items-center rounded-xl px-3 py-1.5 transition-all active:scale-95',
                  active
                    ? 'bg-amber-500 text-black'
                    : 'border border-amber-500/50 text-amber-400 hover:bg-amber-500/10',
                )}
              >
                <span className="text-[12px] font-bold leading-none">{p.fracLabel}</span>
                <span className={clsx('mt-0.5 text-[10px] leading-none', active ? 'text-black/60' : 'text-amber-400/60')}>
                  {p.bbLabel}
                </span>
              </button>
            );
          })()}
        </div>

        {/* ── 3. Slider + Min / All-In labels ────────────────────── */}
        <div className="flex flex-col gap-1 px-0.5">
          <input
            type="range"
            min={safeMin}
            max={safeMax}
            step={step}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value), safeMin, safeMax))}
            aria-label="베팅 금액 슬라이더"
            className="w-full cursor-pointer"
            style={{
              accentColor: isAllIn ? '#f59e0b' : '#f97316',
              background: `linear-gradient(to right, ${isAllIn ? '#f59e0b' : '#f97316'} ${fillPct}%, rgba(255,255,255,0.12) ${fillPct}%)`,
              height: '4px',
              borderRadius: '2px',
              outline: 'none',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          />
          <div className="flex justify-between px-0.5">
            <span className="text-[10px] text-white/30">Min {toBBLabel(safeMin, bigBlind)}</span>
            <span className="text-[10px] text-white/30">All-In {toBBLabel(safeMax, bigBlind)}</span>
          </div>
        </div>

        {/* ── 4. Info grid: 콜 금액 | 내 스택 ────────────────────── */}
        <div
          className="grid grid-cols-2 overflow-hidden rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex flex-col items-center py-2">
            <span className="text-[10px] text-white/40">콜 금액</span>
            <span className="mt-0.5 text-[15px] font-bold text-white">
              {currentBet > 0 ? toBBLabel(currentBet, bigBlind) : '0bb'}
            </span>
          </div>
          <div
            className="flex flex-col items-center py-2"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-[10px] text-white/40">내 스택</span>
            <span className="mt-0.5 text-[15px] font-bold text-white">{myStackBB}</span>
          </div>
        </div>

        {/* ── 5. Fine-tune row + 직접 입력 ─────────────────────────── */}
        <div className="flex items-center gap-2">
          <PlusMinusBtn delta={-step} size="sm" disabled={value <= safeMin} ariaLabel="1bb 감소 (정밀)" />

          <div
            className="flex flex-1 items-center justify-center rounded-xl py-1.5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className={clsx('text-[17px] font-black tabular-nums', isAllIn ? 'text-amber-400' : 'text-white')}>
              {isAllIn ? 'ALL-IN' : bbDisplay}
            </span>
          </div>

          <PlusMinusBtn delta={step} size="sm" disabled={value >= safeMax} ariaLabel="1bb 증가 (정밀)" />

          <button
            type="button"
            onClick={() => setNumpadOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-orange-400 transition-all active:scale-95 hover:brightness-110"
            style={{
              border: '1px solid rgba(249,115,22,0.45)',
              background: 'rgba(249,115,22,0.08)',
            }}
          >
            {/* 3×3 grid icon */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="0"   y="0"   width="3" height="3" rx="0.4" />
              <rect x="4.5" y="0"   width="3" height="3" rx="0.4" />
              <rect x="9"   y="0"   width="3" height="3" rx="0.4" />
              <rect x="0"   y="4.5" width="3" height="3" rx="0.4" />
              <rect x="4.5" y="4.5" width="3" height="3" rx="0.4" />
              <rect x="9"   y="4.5" width="3" height="3" rx="0.4" />
              <rect x="0"   y="9"   width="3" height="3" rx="0.4" />
              <rect x="4.5" y="9"   width="3" height="3" rx="0.4" />
              <rect x="9"   y="9"   width="3" height="3" rx="0.4" />
            </svg>
            직접 입력
          </button>
        </div>

        {/* ── 6. Cancel + Confirm ──────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="col-span-2 rounded-xl py-2.5 text-sm font-semibold text-white/50 transition-colors active:scale-95"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="col-span-3 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{
              background: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
              boxShadow: '0 4px 12px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            {raiseLabel} {isAllIn ? 'ALL-IN' : bbDisplay}
          </button>
        </div>

      </div>

      {/* Numpad overlay — fixed, escapes any stacking context */}
      {numpadOpen && (
        <NumpadModal
          initialBBValue={value / bigBlind}
          minBB={safeMin / bigBlind}
          maxBB={safeMax / bigBlind}
          bigBlind={bigBlind}
          raiseLabel={raiseLabel}
          onConfirm={(chips) => onChange(chips)}
          onClose={() => setNumpadOpen(false)}
        />
      )}
    </>
  );
}
