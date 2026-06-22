import {
  DEFAULT_BET_PRESETS,
  MAX_BET_PRESETS,
} from '../../storage/settings';
import { fractionLabel } from '../table/BetSlider';

const QUICK_FRACTIONS = [0.25, 0.33, 0.5, 0.67, 0.75, 1.0, 1.5, 2.0];

interface BetPresetsEditorProps {
  value: number[];
  onChange: (next: number[]) => void;
}

/**
 * 팟 대비 비율 프리셋 편집기. 설정 페이지·인게임 모달 양쪽에서 재사용.
 */
export function BetPresetsEditor({ value, onChange }: BetPresetsEditorProps) {
  const updateAt = (idx: number, percent: number) => {
    const next = [...value];
    next[idx] = clampFraction(percent / 100);
    onChange(next);
  };
  const removeAt = (idx: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== idx));
  };
  const addPreset = (frac: number) => {
    if (value.length >= MAX_BET_PRESETS) return;
    if (value.some((v) => Math.abs(v - frac) < 0.005)) return;
    onChange([...value, frac].sort((a, b) => a - b));
  };
  const reset = () => onChange([...DEFAULT_BET_PRESETS]);

  const usedFractions = new Set(value.map((v) => Math.round(v * 100)));
  const canAdd = value.length < MAX_BET_PRESETS;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {value.map((frac, idx) => {
          const percent = Math.round(frac * 100);
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-12 text-center text-[11px] font-bold text-amber-400">
                {fractionLabel(frac)}
              </div>
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={percent}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) updateAt(idx, n);
                }}
                aria-label={`프리셋 ${idx + 1} 비율`}
                className="w-16 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">%</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                disabled={value.length <= 1}
                aria-label={`프리셋 ${idx + 1} 삭제`}
                className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                삭제
              </button>
            </div>
          );
        })}
      </div>

      {canAdd && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <span className="text-[11px] text-muted-foreground">빠른 추가:</span>
          {QUICK_FRACTIONS.filter(
            (f) => !usedFractions.has(Math.round(f * 100)),
          ).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => addPreset(f)}
              className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-secondary"
            >
              + {fractionLabel(f)}
            </button>
          ))}
          {QUICK_FRACTIONS.every((f) => usedFractions.has(Math.round(f * 100))) && (
            <span className="text-[11px] text-muted-foreground">
              자주 쓰는 비율을 모두 추가했습니다
            </span>
          )}
        </div>
      )}

      {!canAdd && (
        <p className="text-[11px] text-muted-foreground">
          최대 {MAX_BET_PRESETS}개까지 추가할 수 있습니다.
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        기본값(1/3 · 1/2 · 2/3 · 3/4 · Pot)으로 되돌리기
      </button>
    </div>
  );
}

function clampFraction(f: number): number {
  if (!Number.isFinite(f) || f <= 0) return 0.5;
  return Math.min(10, f);
}
