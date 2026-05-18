export const POSITION_ORDER = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'] as const;

export interface SeatPosStyle {
  left: string;
  top: string;
  tx: string;
}

/**
 * 활성 플레이어를 펠트 외곽에 시계방향 등간격으로 분산.
 *
 *  - i=0(BTN) 은 6시(아래 가운데)에 배치
 *  - 시계방향(BTN → SB → BB → UTG → ...)으로 화면상 시계 시침 방향 진행
 *  - 화면 좌표(y가 아래로 증가)에서 시계방향 = angle 증가
 *    6시(90°) → 7시(120°) → 8시(150°) → 9시(180°) → ... → 5시(60°) → 6시(90°)
 *  - 좌석은 펠트 가장자리 외곽에 위치 (seatRx/Ry 약간 키워 보드 카드와 시각적으로 분리)
 */
export function computeSeatPositions(count: number): SeatPosStyle[] {
  if (count <= 0) return [];

  // 펠트 ellipse 중심·반지름 (PokerTable 컨테이너 0~1 기준).
  // 펠트 inset: left/right 18%, top 6%, bottom 26% — 펠트 중심을 컨테이너 0.40(상단 약 2/5)로 끌어올림.
  // (PokerTable과 동기화).
  const feltLeft = 0.18, feltRight = 0.82, feltTop = 0.06, feltBottom = 0.74;
  const cx = (feltLeft + feltRight) / 2;            // 0.5
  const cy = (feltTop + feltBottom) / 2;            // 0.53
  const rx = (feltRight - feltLeft) / 2;            // 0.32
  const ry = (feltBottom - feltTop) / 2;            // 0.34

  // 좌석이 펠트 외곽에 위치 (펠트 가장자리에서 살짝 바깥).
  // 좌석 수가 많을수록 인접 좌석 거리가 좁아지므로 더 멀리(crowdMargin).
  const crowdMargin = count >= 6 ? 0.04 : count >= 5 ? 0.02 : 0;
  const seatRx = rx + 0.06 + crowdMargin;
  const seatRy = ry + 0.07 + crowdMargin;

  const positions: SeatPosStyle[] = [];
  for (let i = 0; i < count; i++) {
    const deg = 90 + (i * 360) / count;
    const rad = (deg * Math.PI) / 180;
    const x = cx + Math.cos(rad) * seatRx;
    const y = cy + Math.sin(rad) * seatRy;
    positions.push({
      left: `${(x * 100).toFixed(2)}%`,
      top: `${(y * 100).toFixed(2)}%`,
      tx: 'translate(-50%, -50%)',
    });
  }
  return positions;
}

export function sortByPosition<T extends { name: string }>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.name as (typeof POSITION_ORDER)[number]);
    const bi = POSITION_ORDER.indexOf(b.name as (typeof POSITION_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
