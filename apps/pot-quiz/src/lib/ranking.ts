/**
 * 인게임(다크) 테마용 rank 색상. 라이트 페이지에서는 사용되지 않음.
 * 어두운 배경에 대비되는 채도 높은 톤 + 옅은 배경.
 */
export const RANK_COLORS: Record<number, string> = {
  1: 'bg-yellow-500/15 border-yellow-500/45 text-yellow-300',
  2: 'bg-zinc-400/15 border-zinc-400/40 text-zinc-300',
  3: 'bg-orange-500/15 border-orange-500/45 text-orange-300',
};

export const RANK_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function rankColor(r: number) {
  return RANK_COLORS[r] ?? 'bg-secondary border-input text-muted-foreground';
}

export function rankLabel(r: number) {
  return RANK_EMOJI[r] ?? `${r}위`;
}
