import clsx from 'clsx';
import { useCallback, useMemo, useRef } from 'react';

/** 1 big blind = 2 chips (heads-up SB=1, BB=2). */
const DEFAULT_BIG_BLIND = 2;

interface BetSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  potSize: number;
  /** Current total bet on the street (used for pot-% calc and preset calculation). */
  currentBet: number;
  /** User-configured pot-fraction presets (e.g. [0.5, 0.67, 1.0]). ALL-IN always appended. */
  presetFractions: number[];
  /** Chips per big blind. Default 2. */
  bigBlind?: number;
  /** "Raise" or "Bet" — used on the confirm button. */
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

function toPotPct(chips: number, potAfterCall: number): string {
  if (potAfterCall <= 0) return '';
  return `${Math.round((chips / potAfterCall) * 100)}%`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 베팅 사이저 패널 — 수평 컴팩트 레이아웃.
 *
 * Layout (top → bottom):
 *   1. 금액 표시 (중앙) + [−] [+] 버튼
 *   2. 프리셋 칩 버튼 (수평 스크롤)
 *   3. 수평 슬라이더 (표준 range input — 크로스브라우저 안정적)
 *   4. [취소] [Raise / Bet  xbb]
 */
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
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const potAfterCall = potSize + currentBet;
  const step = bigBlind;

  // 롱프레스용 ref — 최신 value를 미러링해 closure 문제 방지
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

  const presets: Preset[] = useMemo(() => {
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
    list.push({
      fracLabel: 'All-In',
      bbLabel: toBBLabel(safeMax, bigBlind),
      value: safeMax,
      isAllIn: true,
    });
    const seen = new Set<number>();
    return list.filter((p) => (seen.has(p.value) ? false : (seen.add(p.value), true)));
  }, [safeMin, safeMax, potSize, currentBet, presetFractions, bigBlind]);

  // 작은 금액 → 큰 금액 순 (좌→우)
  const sortedAsc = useMemo(
    () => [...presets].sort((a, b) => a.value - b.value),
    [presets],
  );

  const isAllIn = value >= safeMax;
  const currentBBDisplay = toBBLabel(value, bigBlind);
  const currentPotPct = toPotPct(value, potAfterCall);

  // 슬라이더 fill 퍼센트 (배경 gradient용)
  const fillPct = safeMax > safeMin
    ? ((value - safeMin) / (safeMax - safeMin)) * 100
    : 0;

  return (
    <div className="flex w-full flex-col gap-2">

      {/* ── 1. 금액 표시 + ±bb 버튼 ─────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={() => startPress(-step)}
          onPointerUp={stopPress}
          onPointerLeave={stopPress}
          disabled={value <= safeMin}
          aria-label="베팅 1bb 감소"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-white/80 transition-colors hover:bg-white/20 active:scale-95 disabled:opacity-30"
        >
          −
        </button>

        <div className="flex flex-1 flex-col items-center">
          <span
            className={clsx(
              'text-[22px] font-black leading-none tabular-nums tracking-tight',
              isAllIn ? 'text-amber-400' : 'text-white',
            )}
          >
            {isAllIn ? 'ALL-IN' : currentBBDisplay}
          </span>
          {!isAllIn && currentPotPct && (
            <span className="mt-0.5 text-[10px] text-white/40">팟의 {currentPotPct}</span>
          )}
        </div>

        <button
          type="button"
          onPointerDown={() => startPress(step)}
          onPointerUp={stopPress}
          onPointerLeave={stopPress}
          disabled={value >= safeMax}
          aria-label="베팅 1bb 증가"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-white/80 transition-colors hover:bg-white/20 active:scale-95 disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* ── 2. 프리셋 칩 — 수평 스크롤 ──────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {sortedAsc.map((p) => {
          const active = value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className={clsx(
                'flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 transition-all active:scale-95',
                p.isAllIn
                  ? active
                    ? 'bg-amber-500 text-black'
                    : 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                  : active
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.14]',
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

      {/* ── 3. 수평 슬라이더 ─────────────────────────────────────── */}
      <div className="px-1">
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
            // fill track via background gradient
            background: `linear-gradient(to right, ${isAllIn ? '#f59e0b' : '#f97316'} ${fillPct}%, rgba(255,255,255,0.15) ${fillPct}%)`,
            height: '4px',
            borderRadius: '2px',
            outline: 'none',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        />
      </div>

      {/* ── 4. 취소 + 확정 ───────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="col-span-2 rounded-lg border border-white/15 py-2.5 text-sm font-semibold text-white/55 transition-colors hover:bg-white/10 active:scale-95"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="col-span-3 rounded-lg py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
            boxShadow: '0 4px 12px rgba(249,115,22,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          {raiseLabel} {isAllIn ? 'ALL-IN' : currentBBDisplay}
        </button>
      </div>

    </div>
  );
}
