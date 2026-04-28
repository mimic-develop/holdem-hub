import { useEffect, useRef } from 'react';

interface TimerBarProps {
  passSeconds: number;
  onTick?: (elapsed: number) => void;
  running: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export default function TimerBar({ passSeconds, onTick, running }: TimerBarProps) {
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    elapsedRef.current = 0;
    if (barRef.current) {
      barRef.current.style.width = '0%';
      barRef.current.style.backgroundColor = 'rgb(34 197 94)';
    }
    if (textRef.current) textRef.current.textContent = '0초';
    if (labelRef.current) labelRef.current.textContent = '경과 시간';
  }, [passSeconds]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      elapsedRef.current = elapsedRef.current + 0.1;
      const elapsed = elapsedRef.current;
      const pct = Math.min((elapsed / passSeconds) * 100, 100);

      if (barRef.current) {
        barRef.current.style.width = `${pct}%`;
        if (elapsed < passSeconds * 0.67) {
          barRef.current.style.backgroundColor = 'rgb(34 197 94)';
        } else if (elapsed < passSeconds) {
          barRef.current.style.backgroundColor = 'rgb(234 179 8)';
        } else {
          barRef.current.style.backgroundColor = 'rgb(239 68 68)';
        }
      }

      const elapsedFloor = Math.floor(elapsed);
      if (textRef.current) {
        textRef.current.textContent = formatTime(elapsedFloor);
      }
      if (labelRef.current) {
        if (elapsed >= passSeconds) {
          labelRef.current.textContent = `합격 타임 초과`;
          labelRef.current.style.color = 'rgb(239 68 68)';
        } else {
          labelRef.current.textContent = '경과 시간';
          labelRef.current.style.color = '';
        }
      }

      onTick?.(elapsed);
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, passSeconds, onTick]);

  return (
    <div className="w-full" data-testid="timer-bar-container">
      <div className="flex items-center justify-between mb-1">
        <span ref={labelRef} className="text-xs text-muted-foreground">경과 시간</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">합격: {formatTime(passSeconds)}</span>
          <span ref={textRef} className="text-xs font-bold text-foreground" data-testid="timer-text">
            0초
          </span>
        </div>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full transition-[width] duration-100"
          style={{ width: '0%', backgroundColor: 'rgb(34 197 94)' }}
          data-testid="timer-progress"
        />
      </div>
    </div>
  );
}
