import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../store/toast-store';
import type { MilestoneId } from '../../storage/stats';

const CONFETTI_FOR: ReadonlySet<MilestoneId> = new Set<MilestoneId>([
  'PERFECT_HAND',
  'HUNDRED_HANDS',
  'PREFLOP_MASTER',
  'WIN_STREAK_5',
]);

/**
 * Top-of-screen milestone toast queue. Renders all active toasts vertically
 * stacked. Auto-dismisses each via expiresAt. High-tier milestones trigger a
 * brief confetti burst.
 *
 * Mounted once at the app root.
 */
export function MilestoneToast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  // Auto-dismiss timer per toast.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => {
      const ms = Math.max(50, t.expiresAt - Date.now());
      return setTimeout(() => dismiss(t.id), ms);
    });
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-3">
      <AnimatePresence>
        {toasts.map((t) => {
          const showConfetti = CONFETTI_FOR.has(t.milestone.id);
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              // NB: NO overflow-hidden — confetti must escape the toast bounds.
              className="pointer-events-auto relative rounded-xl border border-primary/40 bg-card/95 px-4 py-3 shadow-xl backdrop-blur"
              role="status"
              aria-live="polite"
            >
              {/* Confetti rendered first as a sibling, positioned absolutely so
                  particles can fly out past the toast's rounded edges. */}
              {showConfetti && <ConfettiBurst />}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="알림 닫기"
                className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
              <div className="relative flex items-start gap-3">
                <div className="text-3xl leading-none">{t.milestone.emoji}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-primary">
                    {t.milestone.title}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground">
                    {t.milestone.detail}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny CSS-only confetti                                            */
/* ------------------------------------------------------------------ */

const COLORS = [
  '#facc15', // yellow
  '#34d399', // green
  '#60a5fa', // blue
  '#f87171', // red
  '#c084fc', // purple
];

/** ~30 particles, random initial spread + gravity drop. ~1.6s total.
 *  Container has NO overflow-hidden so particles fly past the toast edges. */
function ConfettiBurst() {
  // We generate particles once on mount with stable randomness via
  // useMemo + Math.random — fine for visual flair.
  const particles = useConfettiParticles(30);
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.dx,
            y: p.dy,
            opacity: 0,
            rotate: p.rot,
          }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-sm"
          style={{ backgroundColor: p.color, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
}

interface Particle {
  dx: number;
  dy: number;
  rot: number;
  color: string;
}

function useConfettiParticles(n: number): Particle[] {
  return useMemo(() => {
    const out: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI; // upper hemisphere
      const speed = 60 + Math.random() * 80;
      const dx = Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1);
      const dy = -Math.abs(Math.sin(angle)) * speed * 0.7 + 90; // gravity-biased
      out.push({
        dx,
        dy,
        rot: (Math.random() - 0.5) * 720,
        color: COLORS[i % COLORS.length],
      });
    }
    return out;
  }, [n]);
}
