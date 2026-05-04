import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useSettings } from '../../hooks/useSettings';
import { BetPresetsEditor } from './BetPresetsEditor';
import {
  MIN_MATCH_LENGTH,
  MAX_MATCH_LENGTH,
} from '../../storage/settings';

interface InGameSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 인게임에서 호출하는 경량 설정 모달.
 * - 베팅 사이즈 프리셋 (즉시 BetSlider에 반영)
 * - 효과음 on/off
 *
 * 닉네임 변경은 의도적으로 제외 (인게임에서는 부적절). 풀 설정은 /settings 페이지로.
 */
export function InGameSettingsModal({ open, onClose }: InGameSettingsModalProps) {
  const { settings, setBetPresets, setSoundEnabled, setMatchLength } = useSettings();

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
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">인게임 설정</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Match length — 마스터 스펙 v2 §8.3 */}
            <section className="mb-4">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                매치 길이
              </h4>
              <p className="mb-2 text-[11px] text-muted-foreground">
                다음 매치부터 적용. 짧을수록 리매치하기 좋음.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={MIN_MATCH_LENGTH}
                  max={MAX_MATCH_LENGTH}
                  step={1}
                  value={settings.matchLength}
                  onChange={(e) => setMatchLength(Number(e.target.value))}
                  aria-label="매치 길이"
                  className="flex-1 accent-amber-400"
                />
                <span className="w-12 rounded-md bg-muted px-2 py-1 text-center text-sm font-bold text-foreground">
                  {settings.matchLength}
                </span>
                <span className="text-xs text-muted-foreground">핸드</span>
              </div>
            </section>

            {/* Bet sizing presets */}
            <section className="mb-4">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                베팅 사이즈 프리셋
              </h4>
              <p className="mb-2 text-[11px] text-muted-foreground">
                팟 대비 비율 단축 버튼. ALL-IN은 항상 표시됩니다.
              </p>
              <BetPresetsEditor value={settings.betPresets} onChange={setBetPresets} />
            </section>

            {/* Sound toggle */}
            <section className="mb-2">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                피드백
              </h4>
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">효과음</div>
                  <div className="text-[11px] text-muted-foreground">
                    카드 딜링, 액션, 차례 알림 톤
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.soundEnabled}
                  aria-label="효과음"
                  onClick={() => setSoundEnabled(!settings.soundEnabled)}
                  className={clsx(
                    'relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    settings.soundEnabled ? 'bg-primary' : 'bg-secondary',
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 inline-block h-5 w-5 rounded-full bg-card shadow transition-transform',
                      settings.soundEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            </section>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95"
              >
                완료
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
