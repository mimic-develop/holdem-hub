import type { TableInfo, TablePosition, TablePlayer } from "../lib/quizData";

const ALL_POSITIONS: TablePosition[] = ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

const POSITION_LABELS: Record<TablePosition, string> = {
  UTG: "UTG",
  UTG1: "UTG1",
  LJ: "LJ",
  HJ: "HJ",
  CO: "CO",
  BTN: "BTN",
  SB: "SB",
  BB: "BB",
};

const ACTION_LABELS: Record<string, string> = {
  fold: "폴드",
  call: "콜",
  raise: "레이즈",
  check: "체크",
  bet: "베팅",
  allin: "올인",
};

const POSITION_ANGLES: Record<TablePosition, number> = {
  SB: 180,
  BB: 225,
  UTG: 270,
  UTG1: 315,
  LJ: 0,
  HJ: 25,
  CO: 65,
  BTN: 130,
};

interface PokerTableProps {
  tableInfo: TableInfo;
}

export function PokerTable({ tableInfo }: PokerTableProps) {
  const { players, potSize, heroPosition, dealerPosition, streetLabel, sbAmount, bbAmount } = tableInfo;

  const playerMap = new Map<TablePosition, TablePlayer>();
  players.forEach(p => playerMap.set(p.position, p));

  const tableW = 420;
  const tableH = 320;
  const cx = tableW / 2;
  const cy = tableH / 2;
  const rx = 120;
  const ry = 72;

  function getNodePos(position: TablePosition) {
    const angleDeg = POSITION_ANGLES[position];
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + (rx + 52) * Math.cos(rad),
      y: cy + (ry + 52) * Math.sin(rad),
    };
  }

  return (
    <div className="w-full" data-testid="poker-table">
      <svg viewBox={`0 0 ${tableW} ${tableH}`} className="w-full max-w-[420px] mx-auto" style={{ height: "auto" }}>
        <defs>
          <radialGradient id="felt-grad" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#1e7a3a" />
            <stop offset="100%" stopColor="#145a28" />
          </radialGradient>
          <filter id="table-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.25" />
          </filter>
        </defs>

        <ellipse cx={cx} cy={cy} rx={rx + 8} ry={ry + 8} fill="#5c3a1e" filter="url(#table-shadow)" />
        <ellipse cx={cx} cy={cy} rx={rx + 4} ry={ry + 4} fill="#7a4f2e" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#felt-grad)" stroke="#2d8a4e" strokeWidth="1.5" />

        {potSize && (
          <g>
            <rect x={cx - 42} y={cy - 16} width={84} height={32} rx={10} fill="rgba(0,0,0,0.35)" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fbbf24" fontSize="14" fontWeight="700" fontFamily="monospace">
              {potSize}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontWeight="500">
              팟
            </text>
          </g>
        )}

        {streetLabel && (
          <text x={cx} y={cy - 26} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.7)" fontSize="9" fontWeight="500">
            {streetLabel}
          </text>
        )}

        {(sbAmount || bbAmount) && (
          <g>
            <text x={cx} y={cy + (potSize ? 28 : 10)} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="500">
              블라인드: {sbAmount ?? "?"}/{bbAmount ?? "?"}
            </text>
          </g>
        )}

        {ALL_POSITIONS.map((position) => {
          const player = playerMap.get(position);
          const pos = getNodePos(position);
          const isHero = position === heroPosition;
          const isDealer = position === dealerPosition;
          const isActivePlayer = player?.isActive === true;
          const isFolded = player?.action === "fold";
          const isBlind = position === "SB" || position === "BB";
          const hasData = !!player;

          let nodeFill = "#374151";
          let nodeStroke = "#6b7280";
          let nodeStrokeWidth = 1.5;
          let textFill = "#ffffff";
          let opacity = 1;

          if (isHero) {
            nodeFill = "#2563eb";
            nodeStroke = "#60a5fa";
            nodeStrokeWidth = 2.5;
          } else if (isActivePlayer && !isFolded) {
            nodeFill = "#065f46";
            nodeStroke = "#34d399";
            nodeStrokeWidth = 2;
          }

          if (isFolded) {
            nodeFill = "#1f2937";
            nodeStroke = "#4b5563";
            textFill = "#9ca3af";
            opacity = 0.45;
          }

          if (!hasData && !isHero) {
            opacity = 0.3;
            nodeFill = "#1f2937";
            nodeStroke = "#4b5563";
            textFill = "#9ca3af";
          }

          return (
            <g key={position} opacity={opacity}>
              <circle cx={pos.x} cy={pos.y} r={20} fill={nodeFill} stroke={nodeStroke} strokeWidth={nodeStrokeWidth} />

              <text x={pos.x} y={pos.y - 2} textAnchor="middle" dominantBaseline="middle" fill={textFill} fontSize="10" fontWeight="700">
                {POSITION_LABELS[position]}
              </text>

              {player?.action && (
                <text x={pos.x} y={pos.y + 10} textAnchor="middle" dominantBaseline="middle" fill={isFolded ? "#9ca3af" : "#fbbf24"} fontSize="7.5" fontWeight="600">
                  {ACTION_LABELS[player.action] ?? player.action}
                </text>
              )}

              {player?.betAmount && !isFolded && (
                <text x={pos.x} y={pos.y + 28} textAnchor="middle" dominantBaseline="middle" fill="#fbbf24" fontSize="8" fontWeight="700" fontFamily="monospace">
                  {player.betAmount}
                </text>
              )}

              {player?.stackSize && !isFolded && (
                <text x={pos.x} y={pos.y + (player.betAmount ? 38 : 28)} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.5)" fontSize="7" fontWeight="500" fontFamily="monospace">
                  {player.stackSize}
                </text>
              )}

              {isDealer && (
                <g>
                  <circle cx={pos.x + 16} cy={pos.y - 16} r={7} fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
                  <text x={pos.x + 16} y={pos.y - 16} textAnchor="middle" dominantBaseline="central" fill="#1f2937" fontSize="7" fontWeight="800">
                    D
                  </text>
                </g>
              )}

              {isBlind && hasData && !isFolded && (
                <g>
                  <circle cx={pos.x - 17} cy={pos.y - 15} r={6} fill={position === "SB" ? "#94a3b8" : "#f59e0b"} stroke="#ffffff" strokeWidth="0.8" />
                  <text x={pos.x - 17} y={pos.y - 15} textAnchor="middle" dominantBaseline="central" fill="#1f2937" fontSize="6" fontWeight="800">
                    {position === "SB" ? "S" : "B"}
                  </text>
                </g>
              )}

              {isHero && (
                <text x={pos.x} y={pos.y - 26} textAnchor="middle" dominantBaseline="middle" fill="#60a5fa" fontSize="8" fontWeight="700">
                  나
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
