import CardDisplay from './CardDisplay';
import PlayerSeat from './PlayerSeat';
import DeadMoneyPile from './DeadMoneyPile';
import { POSITION_ORDER, computeSeatPositions } from '../lib/seats';
import type { Puzzle, BlindInfo } from '../types/poker';
import type { LastResult, Phase } from '../lib/game-logic';

type FoldablePos = 'BTN' | 'SB' | 'BB';

/**
 * 폴드된 좌석 자리(빈칸). puzzle.players 에 BTN/SB/BB가 없으면 폴드로 간주하여
 * 좌석 ellipse 외곽 자리에 점선 슬롯으로 표시. SB/BB는 블라인드 금액도 함께.
 */
function FoldedSeat({ position, blindInfo }: { position: FoldablePos; blindInfo?: BlindInfo }) {
  const isDealer = position === 'BTN';
  const blindAmount = position === 'SB' ? blindInfo?.sb : position === 'BB' ? blindInfo?.bb : undefined;
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-card/20 w-[80px] py-2 px-1 select-none"
      style={{ minHeight: 56, opacity: 0.55 }}
    >
      {isDealer && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center rounded-full bg-white text-foreground font-black shadow-md"
          style={{ width: 16, height: 16, fontSize: 9, lineHeight: 1, border: '1px solid rgba(0,0,0,0.15)' }}
        >
          D
        </span>
      )}
      <span className="text-[11px] font-semibold text-white/70 leading-tight">{position}</span>
      <span className="text-[9px] font-medium text-white/45 leading-tight mt-0.5">폴드</span>
      {blindAmount !== undefined && (
        <span className="text-[10px] font-bold text-orange-300/70 tabular-nums leading-none mt-0.5">
          {blindAmount.toLocaleString()}
        </span>
      )}
    </div>
  );
}

interface PokerTableProps {
  puzzle: Puzzle;
  phase: Phase;
  rankAssignments: Record<string, number>;
  lockedRankings: Record<string, number>;
  lastResult: LastResult | null;
  adjDeadMoney: number;
  onSeatClick: (id: string) => void;
  /** 좌석별 남은 베팅 칩. forming 진행에 따라 줄어듦. undefined면 invested 그대로 표시 (PR1/PR2 호환) */
  chipsAtSeat?: Record<string, number>;
  /** 데드머니 더미 잔량 — undefined면 adjDeadMoney 사용 */
  chipsAtDeadMoney?: number;
  /** 데드머니 더미 활성(클릭 가능) */
  deadMoneyActive?: boolean;
  /** 데드머니 클릭 핸들러 */
  onDeadMoneyClick?: () => void;
  /** 강조해야 할 좌석 ID 셋 (현재 sub-step 정답 후보 좌석) */
  highlightSeatIds?: string[];
  /** 동률 후보 선택된 좌석 ID 셋 (awarding 다중 선택용) */
  selectedSeatIds?: string[];
  /** 오답 흔들림 트리거 — 변경 시 마지막 클릭한 좌석을 흔들기 */
  shakeTick?: number;
  shakeSeatId?: string | null;
}

export default function PokerTable({
  puzzle,
  phase,
  rankAssignments,
  lockedRankings,
  lastResult,
  adjDeadMoney,
  onSeatClick,
  chipsAtSeat,
  chipsAtDeadMoney,
  deadMoneyActive = false,
  onDeadMoneyClick,
  highlightSeatIds,
  selectedSeatIds,
  shakeTick = 0,
  shakeSeatId = null,
}: PokerTableProps) {
  const playerByPos = Object.fromEntries(puzzle.players.map(p => [p.name, p]));
  const highlightSet = new Set(highlightSeatIds ?? []);
  const selectedSet = new Set(selectedSeatIds ?? []);
  const dmAmount = chipsAtDeadMoney ?? adjDeadMoney;
  // SeatChipTower 정규화 기준 — 모든 좌석 invested의 최대값. forming 진행 중에도 변하지 않음.
  const maxInvested = puzzle.players.reduce((m, p) => Math.max(m, p.invested), 0);

  // 폴드된 BTN/SB/BB 추론: puzzle.players 에 없으면 폴드로 간주.
  //  - BTN: 항상 테이블에 존재하므로 빠짐 = 폴드
  //  - SB/BB: blindInfo 있는데 빠짐 = blind 들고 폴드 → deadMoney 에 흡수됨
  const foldedPositions: FoldablePos[] = [];
  if (!playerByPos['BTN']) foldedPositions.push('BTN');
  if (puzzle.blindInfo && !playerByPos['SB']) foldedPositions.push('SB');
  if (puzzle.blindInfo && !playerByPos['BB']) foldedPositions.push('BB');

  // 활성 + 폴드 좌석을 표준 포지션 순서(BTN→SB→BB→...)로 정렬하고, 그 수에 따라
  // 펠트 외곽에 시계방향 등간격으로 배치. 폴드 좌석도 자리를 차지해 실제 테이블 배치를 보존.
  type Seat =
    | { kind: 'player'; player: Puzzle['players'][number] }
    | { kind: 'folded'; position: FoldablePos };
  const allSeats: Seat[] = [
    ...puzzle.players.map(p => ({ kind: 'player' as const, player: p })),
    ...foldedPositions.map(pos => ({ kind: 'folded' as const, position: pos })),
  ];
  allSeats.sort((a, b) => {
    const an = a.kind === 'player' ? a.player.name : a.position;
    const bn = b.kind === 'player' ? b.player.name : b.position;
    const ai = POSITION_ORDER.indexOf(an as (typeof POSITION_ORDER)[number]);
    const bi = POSITION_ORDER.indexOf(bn as (typeof POSITION_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const seatPositions = computeSeatPositions(allSeats.length);

  return (
    <div className="relative w-full flex-1 min-h-[240px]" style={{ marginTop: 50 }}>
      {/* Outer rim — 인트로 톤(#181A20 card)에 맞춘 dark metal 그라데이션 + 골드 inner highlight */}
      <div
        className="absolute rounded-[50%]"
        style={{
          left: '14%', right: '14%', top: '2%', bottom: '22%',
          background: 'linear-gradient(145deg, #2A2D3A 0%, #181A20 45%, #0F1117 100%)',
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.7), ' +
            'inset 0 1px 0 rgba(245,158,11,0.18), ' +
            'inset 0 -2px 6px rgba(0,0,0,0.5)',
        }}
      />
      {/* Gold piping — 인트로 GOLD 액센트와 통일 */}
      <div
        className="absolute rounded-[50%] pointer-events-none"
        style={{
          left: '16.5%', right: '16.5%', top: '4.5%', bottom: '24.5%',
          border: '1px solid rgba(245,158,11,0.50)',
          boxShadow: '0 0 14px rgba(245,158,11,0.25)',
        }}
      />

      {/* Felt — 인트로 BLUE 키컬러로 통일 (deep navy radial + BLUE spotlight) */}
      <div
        className="absolute rounded-[50%]"
        style={{
          left: '18%', right: '18%', top: '6%', bottom: '26%',
          background:
            'radial-gradient(ellipse at 50% 32%, #1E40AF 0%, #1E3A8A 35%, #172554 65%, #0B1024 100%)',
          boxShadow:
            'inset 0 4px 14px rgba(0,0,0,0.55), ' +
            'inset 0 0 80px rgba(0,0,0,0.30), ' +
            '0 0 0 1px rgba(245,158,11,0.30)',
        }}
      >
        {/* Cross-hatched texture (인트로 미세 white outline 시스템) */}
        <div className="absolute inset-0 rounded-[50%] opacity-[0.06] pointer-events-none" style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent 0, transparent 2px, rgba(255,255,255,0.55) 2px, rgba(255,255,255,0.55) 3px),' +
            'repeating-linear-gradient(-45deg, transparent 0, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 3px)',
        }} />
        {/* Center highlight — BLUE-bright spotlight */}
        <div className="absolute inset-0 rounded-[50%] pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 35%, rgba(96,165,250,0.18) 0%, rgba(96,165,250,0) 55%)',
        }} />

        {/* 보드 영역 — SB/BB/앤티 pill 을 보드 카드 위에 column 으로 배치 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: 6 }}>
          {puzzle.blindInfo && (
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1"
              style={{
                background: 'rgba(10,12,18,0.70)',
                border: '1px solid rgba(245,158,11,0.35)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
              }}
            >
              <span className="text-[12px] tabular-nums font-semibold" style={{ color: 'rgba(250,250,248,0.92)' }}>
                SB <span style={{ color: '#F59E0B' }}>{puzzle.blindInfo.sb}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
              <span className="text-[12px] tabular-nums font-semibold" style={{ color: 'rgba(250,250,248,0.92)' }}>
                BB <span style={{ color: '#F59E0B' }}>{puzzle.blindInfo.bb}</span>
              </span>
              {puzzle.blindInfo.ante > 0 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
                  <span className="text-[12px] tabular-nums font-semibold" style={{ color: 'rgba(250,250,248,0.92)' }}>
                    앤티 <span style={{ color: '#F59E0B' }}>{puzzle.blindInfo.ante}</span>
                  </span>
                </>
              )}
            </div>
          )}
          <div className="flex gap-0.5 justify-center">
            {puzzle.board.map(c => <CardDisplay key={c} card={c} size="sm" />)}
          </div>
        </div>

        {/* Dead money pile — forming 단계에서만 의미. amount가 0이거나 forming 단계 끝났으면 null 반환 */}
        <DeadMoneyPile amount={dmAmount} active={deadMoneyActive} onClick={onDeadMoneyClick} />
      </div>

      {/* 활성 + 폴드 좌석을 시계방향 등간격 배치. 폴드된 BTN/SB/BB는 그 자리에 빈 슬롯(점선)으로 표시. */}
      {allSeats.map((seat, i) => {
        const posStyle = seatPositions[i];
        if (seat.kind === 'folded') {
          return (
            <div
              key={`fold-${seat.position}`}
              style={{
                position: 'absolute',
                left: posStyle.left,
                top: posStyle.top,
                transform: posStyle.tx,
                zIndex: 9,
              }}
            >
              <FoldedSeat position={seat.position} blindInfo={puzzle.blindInfo} />
            </div>
          );
        }
        const player = seat.player;
        const correctRank = lastResult?.answer.correctRanks[player.id];
        const chipsLeft = chipsAtSeat?.[player.id];

        return (
          <div
            key={player.id}
            data-flying-id={`seat-${player.id}`}
            style={{
              position: 'absolute',
              left: posStyle.left,
              top: posStyle.top,
              transform: posStyle.tx,
              zIndex: 10,
            }}
          >
            <PlayerSeat
              player={player}
              assignedRank={
                phase === 'ranking' ? rankAssignments[player.id] :
                phase === 'pot' ? lockedRankings[player.id] :
                undefined
              }
              correctRank={(phase === 'result' || phase === 'wrong') ? correctRank : undefined}
              handDesc={lastResult?.answer.handMap[player.id]?.descriptionKo}
              payout={lastResult?.answer.playerPayouts[player.id] ?? 0}
              phase={phase}
              chipsLeft={chipsLeft}
              maxInvested={maxInvested}
              onSeatClick={onSeatClick}
              highlight={highlightSet.has(player.id)}
              selected={selectedSet.has(player.id)}
              shakeTick={shakeSeatId === player.id ? shakeTick : 0}
              isDealer={player.name === 'BTN'}
            />
          </div>
        );
      })}
    </div>
  );
}
