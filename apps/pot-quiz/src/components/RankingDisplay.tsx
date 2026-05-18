import { useMemo } from 'react';
import CardDisplay from './CardDisplay';
import { rankColor, rankLabel } from '../lib/ranking';
import type { Puzzle } from '../types/poker';

interface RankingDisplayProps {
  players: Puzzle['players'];
  rankings: Record<string, number>;
}

export default function RankingDisplay({ players, rankings }: RankingDisplayProps) {
  const n = players.length;

  const maxSlot = useMemo(
    () => Math.max(0, ...Object.values(rankings)),
    [rankings],
  );
  const numSlots = Math.min(Math.max(maxSlot + 1, n), n);

  const slotGroups: string[][] = useMemo(() => {
    return Array.from({ length: numSlots }, (_, i) =>
      players.filter(p => rankings[p.id] === i + 1).map(p => p.id),
    );
  }, [numSlots, players, rankings]);

  function effectiveRank(slotIdx: number): number {
    let r = 1;
    for (let i = 0; i < slotIdx; i++) r += slotGroups[i].length;
    return r;
  }

  return (
    <div className="mb-2 flex gap-2">
      {slotGroups.map((group, slotIdx) => {
        const eff = effectiveRank(slotIdx);
        const hasPlayers = group.length > 0;
        return (
          <div
            key={slotIdx}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-1 min-h-[72px] active:scale-95 transition-all cursor-pointer',
              hasPlayers ? rankColor(eff) : 'border-input/60 bg-card/50 hover:border-input',
            ].join(' ')}
          >
            <span className="text-[20px] leading-none select-none">{rankLabel(eff)}</span>
            <div className="flex flex-col items-center gap-0.5 w-full">
              {group.map(id => {
                const player = players.find(p => p.id === id)!;
                return (
                  <div key={id} className="flex flex-col items-center">
                    <div className="flex gap-px">
                      {player.cards.map(c => <CardDisplay key={c} card={c} size="xs" />)}
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium leading-tight">{player.name}</span>
                  </div>
                );
              })}
              {!hasPlayers && (
                <span
                  className="text-[11px] font-semibold leading-tight"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  클릭
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
