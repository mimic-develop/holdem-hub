import { AnimatePresence, motion } from 'framer-motion';

export type FlightTone = 'seat-to-pot' | 'dead-to-pot' | 'pot-to-seat';

export interface Flight {
  id: number;
  /** 시작 좌표 (viewport 기준 — getBoundingClientRect 중심) */
  fromX: number;
  fromY: number;
  /** 도착 좌표 (viewport 기준) */
  toX: number;
  toY: number;
  amount: number;
  tone: FlightTone;
  /** 동시 여러 좌석이 발사될 때 stagger delay (ms) */
  delay?: number;
}

interface FlyingChipsLayerProps {
  flights: Flight[];
  onComplete: (id: number) => void;
}

const TONE_COLOR: Record<FlightTone, { face: string; rim: string; text: string; glow: string }> = {
  'seat-to-pot':  { face: '#F59E0B', rim: '#FED7AA', text: '#1F1410', glow: 'rgba(251,146,60,0.55)' },
  'dead-to-pot':  { face: '#A855F7', rim: '#E9D5FF', text: '#F5F3FF', glow: 'rgba(192,132,252,0.55)' },
  'pot-to-seat':  { face: '#22C55E', rim: '#BBF7D0', text: '#052E16', glow: 'rgba(74,222,128,0.55)' },
};

/**
 * Quiz 화면 위에 fixed-position 절대 레이어로 떠 있는 비행 칩 단편들.
 *
 * 각 Flight 는 (from, to) 좌표를 가진 짧은 motion.div — 0.6초 path 비행 후 자동 사라짐.
 *  - 좌석 → 팟: forming 단계에서 한 좌석당 한 비행 (stagger delay로 그룹 효과)
 *  - 데드머니 → 팟: deadMoney 단계 1회
 *  - 팟 → 승자 좌석: awarding 단계
 *
 * 좌석/팟의 amount 자체는 reducer가 즉시 변경하므로 본 컴포넌트는 시각적 "이동 중" 단편만 담당.
 */
export default function FlyingChipsLayer({ flights, onComplete }: FlyingChipsLayerProps) {
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <AnimatePresence>
        {flights.map(f => {
          const c = TONE_COLOR[f.tone];
          return (
            <motion.div
              key={f.id}
              initial={{ x: f.fromX, y: f.fromY, opacity: 0, scale: 0.5 }}
              animate={{
                x: [f.fromX, (f.fromX + f.toX) / 2, f.toX],
                y: [f.fromY, Math.min(f.fromY, f.toY) - 32, f.toY],
                opacity: [0, 1, 1, 0.8],
                scale: [0.6, 1.05, 0.9, 0.6],
              }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{
                duration: 0.62,
                ease: 'easeInOut',
                delay: (f.delay ?? 0) / 1000,
                times: [0, 0.3, 0.85, 1],
              }}
              onAnimationComplete={() => onComplete(f.id)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                translateX: '-50%',
                translateY: '-50%',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, ${c.face}, ${c.rim})`,
                border: `1.5px solid ${c.rim}`,
                boxShadow: `0 0 10px ${c.glow}, 0 1px 3px rgba(0,0,0,0.4)`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: c.text,
                fontSize: 10,
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                willChange: 'transform, opacity',
              }}
            >
              {f.amount.toLocaleString()}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
