import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Tone:
   *  - 'seat' (기본): 좌석 옆 베팅 칩 (오렌지)
   *  - 'pot': 가운데 팟 (파란)
   *  - 'dead': 데드머니 (보라/회색)
   *  - 'win': 분배된 칩 (녹색)
   */
  tone?: 'seat' | 'pot' | 'dead' | 'win';
  /** framer-motion shared layout id — pot로 이동 애니메이션에 사용 */
  layoutId?: string;
  /** 활성(클릭 가능) 시각화 — 펄스 애니메이션 */
  active?: boolean;
  /** 0 일 때 렌더 여부 (false면 amount === 0 일 때 빈 컨테이너 반환) */
  showZero?: boolean;
}

const SIZE_MAP = {
  sm: { dim: 26, fontSize: 10 },
  md: { dim: 34, fontSize: 12 },
  lg: { dim: 42, fontSize: 14 },
};

interface ChipTone {
  faceA: string;       // 중앙 radial light
  faceB: string;       // 가장자리 어두운 색
  rim: string;         // 외곽 ring
  dash: string;        // 외곽 dash 마크
  text: string;
  glow: string;        // active pulse glow rgba
}

const TONE_STYLE: Record<NonNullable<ChipStackProps['tone']>, ChipTone> = {
  seat: {
    faceA: '#FB923C', faceB: '#9A3412', rim: '#FED7AA',
    dash: '#7C2D12', text: '#1F1410', glow: 'rgba(251,146,60,0.55)',
  },
  pot: {
    faceA: '#60A5FA', faceB: '#1E3A8A', rim: '#BFDBFE',
    dash: '#172554', text: '#F8FAFC', glow: 'rgba(96,165,250,0.55)',
  },
  dead: {
    faceA: '#C084FC', faceB: '#581C87', rim: '#E9D5FF',
    dash: '#3B0764', text: '#F5F3FF', glow: 'rgba(192,132,252,0.55)',
  },
  win: {
    faceA: '#4ADE80', faceB: '#14532D', rim: '#BBF7D0',
    dash: '#052E16', text: '#F0FDF4', glow: 'rgba(74,222,128,0.55)',
  },
};

export default function ChipStack({
  amount,
  size = 'sm',
  tone = 'seat',
  layoutId,
  active = false,
  showZero = false,
}: ChipStackProps) {
  // amount 변화 감지 → 짧은 pulse trigger (양의 변화면 burst, 음이면 sink)
  const prev = useRef(amount);
  const [pulseTick, setPulseTick] = useState(0);
  const [pulseDir, setPulseDir] = useState<'up' | 'down' | 'none'>('none');
  useEffect(() => {
    if (prev.current !== amount) {
      setPulseDir(amount > prev.current ? 'up' : 'down');
      setPulseTick(t => t + 1);
      prev.current = amount;
    }
  }, [amount]);

  if (amount <= 0 && !showZero) {
    return <span className="inline-block" style={{ width: SIZE_MAP[size].dim, height: SIZE_MAP[size].dim }} />;
  }
  const { dim, fontSize } = SIZE_MAP[size];
  const t = TONE_STYLE[tone];

  const isActivePulse = active;
  const scaleAnim = isActivePulse
    ? [1, 1.08, 1]
    : pulseDir === 'up'
      ? [1, 1.35, 1]
      : pulseDir === 'down'
        ? [1, 0.75, 1]
        : 1;

  // 카지노 칩 외형: SVG로 외곽 dash 8개 + 내부 ring + 중앙 면.
  // viewBox 100×100 기준. amount 텍스트는 위에 motion HTML로 overlay.
  const inner = (
    <svg viewBox="0 0 100 100" className="block" style={{ width: dim, height: dim }}>
      <defs>
        <radialGradient id={`chip-face-${tone}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={t.faceA} />
          <stop offset="100%" stopColor={t.faceB} />
        </radialGradient>
      </defs>
      {/* 외곽 dark ring (rim base) */}
      <circle cx="50" cy="50" r="48" fill={t.dash} />
      {/* 8개 dash 마크 — 외곽을 따라 색 dash (rim 패턴) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        const x = 50 + Math.cos(angle) * 44;
        const y = 50 + Math.sin(angle) * 44;
        return (
          <rect
            key={i}
            x={x - 4}
            y={y - 9}
            width={8}
            height={18}
            rx={2}
            fill={t.rim}
            transform={`rotate(${(i * 45) + 90} ${x} ${y})`}
          />
        );
      })}
      {/* 칩 표면(face) — radial gradient로 입체감 */}
      <circle cx="50" cy="50" r="35" fill={`url(#chip-face-${tone})`} />
      {/* 내부 ring */}
      <circle cx="50" cy="50" r="35" fill="none" stroke={t.rim} strokeWidth="1.5" opacity="0.55" />
    </svg>
  );

  return (
    <motion.div
      layout
      layoutId={layoutId}
      className="relative inline-flex items-center justify-center select-none"
      style={{
        width: dim,
        height: dim,
        filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.45))`,
        boxShadow: isActivePulse ? `0 0 14px 2px ${t.glow}` : 'none',
        borderRadius: '50%',
      }}
      key={isActivePulse ? 'active' : `pulse-${pulseTick}`}
      animate={{ scale: scaleAnim }}
      transition={
        isActivePulse
          ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.45, ease: 'easeOut' }
      }
    >
      {inner}
      <span
        className="absolute font-black tabular-nums leading-none"
        style={{ color: t.text, fontSize, textShadow: '0 1px 1px rgba(0,0,0,0.4)' }}
      >
        {amount.toLocaleString()}
      </span>
    </motion.div>
  );
}
