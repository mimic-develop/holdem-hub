import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface SeatChipTowerProps {
  amount: number;
  max: number;
  layoutId?: string;
  highlight?: boolean;
}

/**
 * 하이앵글(위에서 살짝 비스듬히 본) 카지노 칩 stack.
 *
 *  - 각 칩 = 측면 띠(rect, 얇음) + 윗면 타원(ellipse, 납작) — 위에서 본 perspective
 *  - 칩 개수 = amount/max 비율로 1~10
 *  - 어두운/밝은 색 alternation + 가장 위 칩에 inner ring + edge notch dots
 *  - 가장 아래에 그림자 ellipse로 바닥 그림자 표현
 */

const MAX_CHIPS = 10;
const MIN_CHIPS = 1;

// high-angle 비율: 가로 ↔ 세로(타원 ry) ↔ 두께
const CHIP_RX = 15;       // 타원 가로 반지름
const CHIP_RY = 4;        // 타원 세로 반지름 (작을수록 위에서 본 시점)
const CHIP_H = 2.5;       // 한 칩 측면 두께 (얇은 띠)
const SVG_PAD = 4;
const SVG_W = CHIP_RX * 2 + SVG_PAD * 2;

// 단일 톤 칩 (이전 갈색/주황 alternation에서 갈색 제거)
const CHIP_SIDE = '#F59E0B';
const CHIP_TOP = '#FBBF24';
const CHIP_EDGE = '#B45309'; // 외곽 stroke

const HL_SIDE = '#FFE066';
const HL_TOP = '#FFF6B0';
const HL_EDGE = '#C2920E';

export default function SeatChipTower({ amount, max, layoutId, highlight = false }: SeatChipTowerProps) {
  const prev = useRef(amount);
  const [shrinkTick, setShrinkTick] = useState(0);
  useEffect(() => {
    if (prev.current > amount) setShrinkTick(t => t + 1);
    prev.current = amount;
  }, [amount]);

  if (amount <= 0) {
    return <div style={{ width: SVG_W, height: CHIP_RY * 2 + 4 }} />;
  }

  const ratio = max > 0 ? Math.min(1, amount / max) : 0;
  const chipCount = Math.max(MIN_CHIPS, Math.round(ratio * MAX_CHIPS) || MIN_CHIPS);

  // 전체 높이: 가장 아래 그림자(CHIP_RY) + 마지막 칩의 top ellipse 절반(CHIP_RY)
  //   + (chipCount - 1) * CHIP_H (각 칩 측면 두께가 누적되며 stack 형성)
  const stackInnerH = (chipCount - 1) * CHIP_H + CHIP_RY * 2;
  const svgH = stackInnerH + CHIP_RY * 0.6; // 바닥 그림자 ellipse 여유

  const sideFill = highlight ? HL_SIDE : CHIP_SIDE;
  const topFill = highlight ? HL_TOP : CHIP_TOP;
  const edge = highlight ? HL_EDGE : CHIP_EDGE;

  const cx = SVG_W / 2;
  // 가장 아래 칩 top ellipse의 cy (가장 아래 시점). 위로 갈수록 cy 감소.
  const baseCy = svgH - CHIP_RY * 0.6 - CHIP_RY;

  return (
    <motion.div
      layout
      layoutId={layoutId}
      style={{
        width: SVG_W,
        height: svgH,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
      }}
      animate={{
        scale: highlight ? [1, 1.06, 1] : shrinkTick > 0 ? [1, 0.92, 1] : 1,
      }}
      transition={
        highlight
          ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.3 }
      }
    >
      <svg width={SVG_W} height={svgH} viewBox={`0 0 ${SVG_W} ${svgH}`}>
        {/* 바닥 그림자 ellipse — 칩이 놓인 면 시각 */}
        <ellipse
          cx={cx}
          cy={svgH - CHIP_RY * 0.4}
          rx={CHIP_RX * 0.9}
          ry={CHIP_RY * 0.5}
          fill="rgba(0,0,0,0.35)"
        />

        {/* bottom-up render — 각 칩의 측면 + 윗면 타원. 위 칩이 아래 칩 일부를 가림. */}
        {Array.from({ length: chipCount }).map((_, idx) => {
          // 가장 아래 idx=0 → 가장 위 idx=chipCount-1
          const topCy = baseCy - idx * CHIP_H;
          const sideTopY = topCy;
          const sideBottomY = topCy + CHIP_H;

          // 측면: ellipse top arc + rect 형태 → path 로 그림 (양 끝이 ellipse 반지름)
          const sidePath = `
            M ${cx - CHIP_RX} ${sideTopY}
            A ${CHIP_RX} ${CHIP_RY} 0 0 0 ${cx + CHIP_RX} ${sideTopY}
            L ${cx + CHIP_RX} ${sideBottomY}
            A ${CHIP_RX} ${CHIP_RY} 0 0 1 ${cx - CHIP_RX} ${sideBottomY}
            Z
          `.trim();

          const isTopChip = idx === chipCount - 1;
          return (
            <g key={idx}>
              {/* 측면 — 위쪽 호(가려짐) + 측면 직선 + 아래쪽 호. 윗면 ellipse를 그 위에 덮어 가림. */}
              <path
                d={sidePath}
                fill={sideFill}
                stroke={edge}
                strokeWidth={0.4}
                opacity={0.95}
              />
              {/* 측면 가장자리에 edge notch — 작은 흰 마크 4개 */}
              {[0, 1, 2, 3].map(k => {
                const angle = (k + 1) * 36; // 36, 72, 108, 144도 (좌우 분산)
                const ax = cx - Math.cos((angle * Math.PI) / 180) * (CHIP_RX - 1);
                return (
                  <rect
                    key={k}
                    x={ax}
                    y={topCy + 0.4}
                    width={1.2}
                    height={CHIP_H - 0.8}
                    fill="rgba(255,255,255,0.55)"
                  />
                );
              })}
              {/* 윗면 타원 — 모든 칩에 그림 (다음 칩의 측면이 윗면을 살짝 가림) */}
              <ellipse
                cx={cx}
                cy={topCy}
                rx={CHIP_RX}
                ry={CHIP_RY}
                fill={topFill}
                stroke={edge}
                strokeWidth={0.4}
              />
              {isTopChip && (
                <>
                  {/* 가장 위 칩 inner ring (실제 칩 윗면 디자인) */}
                  <ellipse
                    cx={cx}
                    cy={topCy}
                    rx={CHIP_RX - 4}
                    ry={Math.max(1, CHIP_RY - 1.2)}
                    fill="none"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={0.5}
                  />
                  {/* 윗면 highlight — 좌상단 반사광 */}
                  <ellipse
                    cx={cx - CHIP_RX * 0.4}
                    cy={topCy - CHIP_RY * 0.3}
                    rx={CHIP_RX * 0.35}
                    ry={Math.max(0.6, CHIP_RY * 0.35)}
                    fill="rgba(255,255,255,0.35)"
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}
