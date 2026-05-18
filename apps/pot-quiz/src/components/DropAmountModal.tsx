import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface DropAmountModalProps {
  open: boolean;
  fromSeatName: string;
  toPotLabel: string;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

/**
 * 좌석 → 팟 클릭 후 등장하는 컴팩트 액수 입력 팝.
 * 화면 가운데 작은 카드(≈220px) — 백드롭 클릭으로 취소.
 */
export default function DropAmountModal({
  open, fromSeatName, toPotLabel, onConfirm, onCancel,
}: DropAmountModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const submit = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    onConfirm(n);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onCancel}
          data-testid="drop-amount-modal"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-2xl"
            style={{ width: 220 }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold text-muted-foreground leading-tight mb-1.5 truncate">
              <span className="text-orange-400">{fromSeatName}</span>
              {' → '}
              <span className="text-primary">{toPotLabel}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min={1}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submit();
                  if (e.key === 'Escape') onCancel();
                }}
                placeholder="액수"
                data-testid="drop-amount-input"
                className="flex-1 bg-muted border border-input rounded-md px-2 py-1.5 text-sm text-foreground tabular-nums focus:outline-none focus:border-primary"
              />
              <button
                onClick={submit}
                data-testid="drop-amount-confirm"
                disabled={!value || parseInt(value, 10) <= 0}
                className="shrink-0 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
