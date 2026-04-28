import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '../../hooks/useSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, setNickname } = useSettings();
  const [draft, setDraft] = useState(settings.nickname);

  useEffect(() => {
    if (open) setDraft(settings.nickname);
  }, [open, settings.nickname]);

  const handleSave = () => {
    setNickname(draft);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <h3 className="mb-4 text-lg font-bold text-primary">설정</h3>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                닉네임
              </span>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                maxLength={20}
                placeholder="익명"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <span className="mt-1 block text-[10px] text-muted-foreground">
                친구와 플레이 시 상대에게 표시됩니다. 최대 20자.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-foreground hover:bg-secondary active:scale-95"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95"
              >
                저장
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
