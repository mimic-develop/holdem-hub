import clsx from 'clsx';
import { useMemo } from 'react';

interface BetSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  potSize: number;
  /** Current total bet on the street (raise target must clear this). */
  currentBet: number;
}

interface Preset {
  label: string;
  value: number;
}

export function BetSlider({ min, max, value, onChange, potSize, currentBet }: BetSliderProps) {
  const presets: Preset[] = useMemo(() => {
    const fractions: [string, number][] = [
      ['1/2', 0.5],
      ['2/3', 0.67],
      ['팟', 1.0],
    ];
    const list: Preset[] = fractions.map(([label, frac]) => {
      // pot-relative raise: raise-to = currentBet + frac * (pot + bet-to-call for caller)
      // We approximate: raise-to = round(currentBet + frac * (potSize + currentBet))
      const rt = Math.round(currentBet + frac * (potSize + currentBet));
      return { label, value: clamp(rt, min, max) };
    });
    list.push({ label: '올인', value: max });
    // Dedupe & sort asc.
    const seen = new Set<number>();
    return list
      .filter((p) => (seen.has(p.value) ? false : (seen.add(p.value), true)))
      .sort((a, b) => a.value - b.value);
  }, [min, max, potSize, currentBet]);

  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-foreground">
        <span>최소 {safeMin}</span>
        <span className="text-primary text-base font-bold">{value}</span>
        <span>올인 {safeMax}</span>
      </div>
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        value={clamp(value, safeMin, safeMax)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold"
      />
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.value)}
            className={clsx(
              'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              value === p.value
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-white/20 bg-black/40 text-white hover:bg-black/60',
            )}
          >
            {p.label} <span className="ml-0.5 text-muted-foreground">{p.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
