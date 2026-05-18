import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import CardDisplay from './CardDisplay';
import SeatChipTower from './SeatChipTower';
import { rankColor, rankLabel } from '../lib/ranking';
import type { Puzzle } from '../types/poker';
import type { Phase } from '../lib/game-logic';

interface PlayerSeatProps {
  player: Puzzle['players'][number];
  correctRank?: number;
  handDesc?: string;
  payout?: number;
  phase: Phase;
  assignedRank?: number;
  chipsLeft?: number;
  maxInvested?: number;
  onSeatClick?: (id: string) => void;
  highlight?: boolean;
  shakeTick?: number;
  selected?: boolean;
  isDealer?: boolean;
}

/**
 * PlayerSeat — 활성 좌석.
 * FoldedSeat 과 동일한 폭(80px) / min-h(56px) / 세로 column 레이아웃 으로 ellipse 좌표
 * 위에서 정렬감 유지. 색상은 인트로 토큰(bg-card / border-border / ring-primary)을
 * 그대로 따르며, 베팅 칩 액수는 GOLD 톤(인트로의 칩 도메인 액센트) 으로 표시.
 */
export default function PlayerSeat({
  player,
  correctRank: _correctRank,
  handDesc: _handDesc,
  payout: _payout,
  phase,
  assignedRank,
  chipsLeft,
  maxInvested,
  onSeatClick,
  highlight = false,
  shakeTick = 0,
  selected = false,
  isDealer = false,
}: PlayerSeatProps) {
  const isAssigned = assignedRank !== undefined;
  const isFrozen = phase === 'result' || phase === 'wrong';
  const clickable = (phase === 'ranking' || phase === 'pot') && !isFrozen;
  const showChips = phase !== 'ranking';

  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (shakeTick === 0) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 420);
    return () => clearTimeout(t);
  }, [shakeTick]);

  const remaining = chipsLeft ?? player.invested;

  // assigned rank 별 테두리 색 — 1위 골드 / 2위 실버 / 3위 브론즈, 그 외 1위가 아니면 BLUE 액센트.
  // (inline style 로 명시해 className 의 border-color 가 cascade 로 override 되는 케이스 회피)
  const rankBorder =
    assignedRank === 1 ? '#EAB308' :        // gold (yellow-500)
    assignedRank === 2 ? '#A1A1AA' :        // silver (zinc-400)
    assignedRank === 3 ? '#F97316' :        // bronze (orange-500)
    assignedRank !== undefined ? '#60A5FA' : // 4위+: BLUE 액센트
    'rgba(255,255,255,0.10)';                // 미할당: 미세 white outline

  return (
    <motion.div
      data-testid={`seat-${player.id}`}
      onClick={clickable ? () => onSeatClick?.(player.id) : undefined}
      animate={shaking ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={shaking ? { duration: 0.42 } : { duration: 0.15 }}
      className={[
        'relative flex flex-col items-center justify-center rounded-xl transition-all select-none',
        'w-[80px]',
        clickable
          ? isAssigned ? `cursor-pointer active:scale-95 shadow-md ${rankColor(assignedRank)}` : 'cursor-pointer active:scale-95'
          : '',
        highlight ? 'ring-2 ring-blue-400/80 ring-offset-1 ring-offset-background' : '',
        selected ? 'ring-2 ring-yellow-300/85 ring-offset-1 ring-offset-background' : '',
      ].join(' ')}
      style={{
        padding: '6px 5px',
        gap: 3,
        minHeight: 56,
        background: isFrozen ? '#15171D' : '#181A20',
        // border-color / width 를 inline 으로 명시 (assigned 시 rank 컬러로 강조).
        borderStyle: 'solid',
        borderWidth: isAssigned ? 2 : 1,
        borderColor: rankBorder,
        boxShadow: isAssigned ? `0 0 12px ${rankBorder}55` : undefined,
      }}
    >
      {isDealer && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center rounded-full font-black shadow-md select-none"
          style={{
            width: 16, height: 16, fontSize: 9, lineHeight: 1,
            background: '#FAFAF8', color: '#0A0C12',
            border: '1px solid rgba(0,0,0,0.20)',
          }}
        >
          D
        </span>
      )}

      {/* 1) assigned rank emoji — ranking/pot phase 에서만 */}
      {(phase === 'ranking' || phase === 'pot') && isAssigned && (
        <span className="text-[15px] leading-none">{rankLabel(assignedRank)}</span>
      )}

      {/* 2) hole cards */}
      <div className="flex gap-px">
        {player.cards.map(c => <CardDisplay key={c} card={c} size="sm" />)}
      </div>

      {/* 3) 포지션 이름 */}
      <span
        className="leading-tight"
        style={{
          fontSize: 11, fontWeight: 600,
          color: 'rgba(250,250,248,0.90)',
          letterSpacing: 0,
        }}
      >
        {player.name}
      </span>

      {/* 4) 베팅 칩 — ranking 외 phase 에서만.
            SeatChipTower 는 amount > 0 일 때만 그래픽. 숫자 텍스트는 항상 표시(awarding 단계에서
            chipsAtSeat=0 인 경우에도 "0" 또는 분배 후 누적값을 좌석 옆에 명시) */}
      {showChips && (
        <>
          {chipsLeft !== undefined && chipsLeft > 0 && (
            <SeatChipTower
              amount={chipsLeft}
              max={maxInvested ?? player.invested}
              layoutId={`seat-chip-${player.id}`}
              highlight={highlight}
            />
          )}
          <span
            className="tabular-nums leading-none"
            style={{
              fontSize: 10.5, fontWeight: 700,
              color: remaining > 0 ? '#F59E0B' : 'rgba(255,255,255,0.40)',
              letterSpacing: 0,
            }}
            data-testid={`seat-stack-${player.id}`}
          >
            {remaining.toLocaleString()}
          </span>
        </>
      )}
    </motion.div>
  );
}
