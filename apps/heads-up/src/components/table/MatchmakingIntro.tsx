import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../../hooks/useSettings';
import { playMatchupSound } from '../../utils/audio';

interface MatchmakingIntroProps {
  myLabel: string;
  oppLabel: string;
  /** AI character avatar image URL. */
  oppAvatarSrc?: string;
  /** Optional subtitle (e.g. "100/200 블라인드 · 시작 스택 5000"). */
  subtitle?: string;
  /** Called once after intro animation completes (~1.8s). */
  onComplete: () => void;
}

const INTRO_DURATION_MS = 1800;

/**
 * VS 매치메이킹 인트로 오버레이.
 * 좌(나) ↔ 가운데(VS) ↔ 우(상대) 구도 + 짧은 사운드.
 * 자체 타이머로 onComplete 호출 후 부모가 언마운트.
 */
export function MatchmakingIntro({
  myLabel,
  oppLabel,
  oppAvatarSrc,
  subtitle,
  onComplete,
}: MatchmakingIntroProps) {
  const { settings } = useSettings();

  useEffect(() => {
    playMatchupSound(settings.soundEnabled);
    const t = window.setTimeout(onComplete, INTRO_DURATION_MS);
    return () => window.clearTimeout(t);
    // onComplete is stable enough (caller wraps in useCallback or uses store action).
    // settings.soundEnabled snapshot at mount is fine — only one play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-sm items-center justify-around gap-2 px-4">
        {/* Me */}
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
          className="flex flex-col items-center gap-2"
        >
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold text-white shadow-2xl ring-2 ring-white/20"
            style={{
              background: 'linear-gradient(145deg, #4b1e22 0%, #2c1114 100%)',
            }}
          >
            {(myLabel[0] ?? '나').toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-white/80">{myLabel}</span>
        </motion.div>

        {/* VS */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.35 }}
          className="select-none text-5xl font-black tracking-tighter text-mimic-red"
          style={{ textShadow: '0 0 24px rgba(186,12,25,0.7)' }}
        >
          VS
        </motion.div>

        {/* Opponent */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
          className="flex flex-col items-center gap-2"
        >
          {oppAvatarSrc ? (
            <motion.div
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.2 }}
              className="relative h-24 w-24 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-mimic-red/50"
            >
              <img
                src={oppAvatarSrc}
                alt=""
                aria-hidden
                draggable={false}
                className="h-full w-full object-cover object-top select-none"
              />
              <div className="absolute inset-0 rounded-2xl ring-inset ring-1 ring-white/10" />
            </motion.div>
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold text-white shadow-2xl ring-2 ring-mimic-red/40"
              style={{
                background: 'linear-gradient(145deg, #404145 0%, #1c1d20 100%)',
              }}
            >
              {(oppLabel[0] ?? 'AI').toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-white/80">{oppLabel}</span>
        </motion.div>
      </div>

      {subtitle && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-8 text-xs text-white/50"
        >
          {subtitle}
        </motion.div>
      )}
    </motion.div>
  );
}
