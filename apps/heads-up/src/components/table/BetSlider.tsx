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
 * 베팅 사이저 패널 — 세로형.
 *
 * Layout (top → bottom):
 *   1. [−]  현재 금액 (BB · 팟%)  [+]   (정밀 조절, 롱프레스 지원)
 *   2. 프리셋 버튼 컬럼 + 세로 슬라이더 (휠 스크롤 지원)
 *   3. [취소]  [Raise / Bet  xbb]  (확정)
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
  // 팟 퍼센트 계산 기준: 내가 콜한 뒤의 팟
  const potAfterCall = potSize + currentBet;

  // ±1bb 스텝
  const step = bigBlind;

  // 롱프레스용 interval ref — 최신 value를 ref로 미러링해 closure 문제 방지
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
      // 첫 클릭 즉시 반응
      onChange(clamp(valueRef.current + delta, safeMin, safeMax));
      // 500ms 후 반복 시작
      pressTimerRef.current = window.setTimeout(() => {
        pressIntervalRef.current = window.setInterval(() => {
          onChange(clamp(valueRef.current + delta, safeMin, safeMax));
        }, 100);
      }, 400);
    },
    [onChange, safeMin, safeMax],
  );

  const presets: Preset[] = useMemo(() => {
    const list: Preset[] = presetFractions.map((frac) => {
      // raise-to = call_amount + frac × (pot_after_call)
      const raw = Math.round(currentBet + frac * (potSize + currentBet));
      const clamped = clamp(raw, safeMin, safeMax);
      return {
        fracLabel: fractionLabel(frac),
        bbLabel: toBBLabel(clamped, bigBlind),
        value: clamped,
        isAllIn: clamped >= safeMax,
      };
    });
    // All-In은 항상 추가
    list.push({
      fracLabel: 'All-In',
      bbLabel: toBBLabel(safeMax, bigBlind),
      value: safeMax,
      isAllIn: true,
    });
    // 칩 금액 기준 중복 제거
    const seen = new Set<number>();
    return list.filter((p) => (seen.has(p.value) ? false : (seen.add(p.value), true)));
  }, [safeMin, safeMax, potSize, currentBet, presetFractions, bigBlind]);

  // 위에서 아래로 = 큰 금액 → 작은 금액 순서
  const sortedDesc = useMemo(
    () => [...presets].sort((a, b) => b.value - a.value),
    [presets],
  );

  const isAllIn = value >= safeMax;
  const currentBBDisplay = toBBLabel(value, bigBlind);
  const currentPotPct = toPotPct(value, potAfterCall);

  return (
    <div className="flex w-full flex-col gap-1.5">

      {/* ── 1. 금액 표시 + ±1bb (롱프레스) ──────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={() => startPress(-step)}
          onPointerUp={stopPress}
          onPointerLeave={stopPress}
          disabled={value <= safeMin}
          aria-label="베팅 1bb 감소"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base font-bold text-white/80 transition-colors hover:bg-white/20 active:scale-95 disabled:opacity-30"
        >
          −
        </button>

        <div className="flex flex-1 flex-col items-center">
          <span
            className={clsx(
              'text-[20px] font-black leading-none tabular-nums tracking-tight',
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base font-bold text-white/80 transition-colors hover:bg-white/20 active:scale-95 disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* ── 2. 프리셋 버튼 + 세로 슬라이더 ─────────────── */}
      <div className="flex gap-2">

        {/* 프리셋 버튼 (좌) */}
        <div className="flex flex-1 flex-col gap-1">
          {sortedDesc.map((p) => {
            const active = value === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={clsx(
                  'flex w-full items-center justify-between rounded-lg px-3 py-1.5 transition-all active:scale-[0.98]',
                  p.isAllIn
                    ? active
                      ? 'bg-amber-500 text-black'
                      : 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                    : active
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/[0.07] text-white/80 hover:bg-white/[0.13]',
                )}
              >
                <span className="text-[12px] font-bold leading-none">{p.fracLabel}</span>
                <span
                  className={clsx(
                    'text-[11px] font-semibold leading-none',
                    active ? 'text-black/70' : 'text-white/50',
                  )}
                >
                  {p.bbLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* 세로 슬라이더 (우) — 휠 스크롤 지원 */}
        <div className="flex w-9 flex-col items-center gap-1 rounded-xl bg-white/[0.06] py-2">
          <span className="text-[9px] font-semibold text-white/35 leading-none">MAX</span>
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden"
            onWheel={(e) => {
              e.preventDefault();
              // 위로 스크롤 = deltaY < 0 = 금액 증가
              onChange(clamp(value + (e.deltaY > 0 ? -step : step), safeMin, safeMax));
            }}
          >
            <input
              type="range"
              min={safeMin}
              max={safeMax}
              step={step}
              value={value}
              onChange={(e) => onChange(clamp(Number(e.target.value), safeMin, safeMax))}
              aria-label="베팅 금액 슬라이더"
              // Firefox 전용 비표준 속성 — TS 타입에 없으므로 spread로 우회
              {...{ orient: "vertical" }}
              className="vertical-slider"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                WebkitAppearance: 'slider-vertical',
                appearance: 'none' as React.CSSProperties['appearance'],
                width: '28px',
                height: '100%',
                cursor: 'pointer',
                accentColor: isAllIn ? '#f59e0b' : '#f97316',
                background: 'transparent',
              }}
            />
          </div>
          <span className="text-[9px] font-semibold text-white/35 leading-none">MIN</span>
        </div>

      </div>

      {/* ── 3. 취소 + 확정 ──────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="col-span-2 rounded-lg border border-white/15 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/10"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="col-span-3 rounded-lg py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95"
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
