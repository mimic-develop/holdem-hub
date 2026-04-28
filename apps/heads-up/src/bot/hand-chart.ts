import type { Card } from '../engine/card';

export interface PreflopAction {
  raise: number;
  call: number;
  fold: number;
}

type HandKind = 'pair' | 'suited' | 'offsuit';

const RANK_CHARS = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function rankChar(r: number): string {
  return RANK_CHARS[r];
}

export function handKey(a: Card, b: Card): string {
  if (a.rank === b.rank) return rankChar(a.rank) + rankChar(a.rank);
  const hi = a.rank > b.rank ? a : b;
  const lo = a.rank > b.rank ? b : a;
  return rankChar(hi.rank) + rankChar(lo.rank) + (a.suit === b.suit ? 's' : 'o');
}

// Heads-up SB open range ≈ 80% of combos. All pairs / all suited raise;
// offsuit sliding scale by rank strength + gap.
function sbOpen(hi: number, lo: number, kind: HandKind): PreflopAction {
  if (kind === 'pair') return { raise: 1, call: 0, fold: 0 };
  if (kind === 'suited') return { raise: 1, call: 0, fold: 0 };

  // Offsuit — table below tuned so total weighted raise freq ≈ 0.78-0.82
  if (hi === 14) {
    if (lo >= 3) return { raise: 1, call: 0, fold: 0 };
    return { raise: 0.9, call: 0, fold: 0.1 }; // A2o
  }
  if (hi === 13) {
    if (lo >= 5) return { raise: 1, call: 0, fold: 0 };
    if (lo === 4) return { raise: 0.7, call: 0, fold: 0.3 };
    if (lo === 3) return { raise: 0.5, call: 0, fold: 0.5 };
    return { raise: 0.4, call: 0, fold: 0.6 };
  }
  if (hi === 12) {
    if (lo >= 6) return { raise: 1, call: 0, fold: 0 };
    if (lo === 5) return { raise: 0.7, call: 0, fold: 0.3 };
    if (lo === 4) return { raise: 0.5, call: 0, fold: 0.5 };
    return { raise: 0.35, call: 0, fold: 0.65 };
  }
  if (hi === 11) {
    if (lo >= 7) return { raise: 1, call: 0, fold: 0 };
    if (lo === 6) return { raise: 0.6, call: 0, fold: 0.4 };
    if (lo === 5) return { raise: 0.35, call: 0, fold: 0.65 };
    if (lo === 4) return { raise: 0.25, call: 0, fold: 0.75 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 10) {
    if (lo >= 6) return { raise: 1, call: 0, fold: 0 };
    if (lo === 5) return { raise: 0.5, call: 0, fold: 0.5 };
    if (lo === 4) return { raise: 0.25, call: 0, fold: 0.75 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 9) {
    if (lo >= 6) return { raise: 1, call: 0, fold: 0 };
    if (lo === 5) return { raise: 0.4, call: 0, fold: 0.6 };
    if (lo === 4) return { raise: 0.25, call: 0, fold: 0.75 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 8) {
    if (lo >= 5) return { raise: 0.85, call: 0, fold: 0.15 };
    if (lo === 4) return { raise: 0.35, call: 0, fold: 0.65 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 7) {
    if (lo >= 5) return { raise: 0.7, call: 0, fold: 0.3 };
    if (lo === 4) return { raise: 0.3, call: 0, fold: 0.7 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 6) {
    if (lo === 5) return { raise: 0.65, call: 0, fold: 0.35 };
    if (lo === 4) return { raise: 0.3, call: 0, fold: 0.7 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 5) {
    if (lo === 4) return { raise: 0.5, call: 0, fold: 0.5 };
    if (lo === 3) return { raise: 0.25, call: 0, fold: 0.75 };
    return { raise: 0.15, call: 0, fold: 0.85 };
  }
  if (hi === 4) {
    if (lo === 3) return { raise: 0.3, call: 0, fold: 0.7 };
    return { raise: 0.1, call: 0, fold: 0.9 };
  }
  return { raise: 0.15, call: 0, fold: 0.85 }; // 32o
}

// BB facing SB open-raise: 3bet / call / fold.
function bbVsOpen(hi: number, lo: number, kind: HandKind): PreflopAction {
  if (kind === 'pair') {
    if (hi >= 10) return { raise: 0.85, call: 0.15, fold: 0 }; // TT+
    if (hi >= 7) return { raise: 0.3, call: 0.7, fold: 0 };
    return { raise: 0.05, call: 0.85, fold: 0.1 };
  }

  if (kind === 'suited') {
    if (hi === 14) {
      if (lo >= 11) return { raise: 0.6, call: 0.4, fold: 0 };
      if (lo === 10) return { raise: 0.4, call: 0.6, fold: 0 };
      return { raise: 0.15, call: 0.85, fold: 0 };
    }
    if (hi === 13) {
      if (lo >= 11) return { raise: 0.45, call: 0.55, fold: 0 };
      if (lo >= 8) return { raise: 0.1, call: 0.85, fold: 0.05 };
      return { raise: 0, call: 0.7, fold: 0.3 };
    }
    if (hi === 12) {
      if (lo >= 10) return { raise: 0.3, call: 0.7, fold: 0 };
      if (lo >= 8) return { raise: 0.05, call: 0.85, fold: 0.1 };
      return { raise: 0, call: 0.5, fold: 0.5 };
    }
    if (hi === 11) {
      if (lo >= 9) return { raise: 0.15, call: 0.85, fold: 0 };
      return { raise: 0, call: 0.6, fold: 0.4 };
    }
    if (hi === 10) {
      if (lo >= 8) return { raise: 0.1, call: 0.85, fold: 0.05 };
      return { raise: 0, call: 0.5, fold: 0.5 };
    }
    if (hi === 9 && lo >= 6) return { raise: 0, call: 0.7, fold: 0.3 };
    if (hi === 8 && lo >= 5) return { raise: 0, call: 0.6, fold: 0.4 };
    if (hi === 7 && lo >= 5) return { raise: 0, call: 0.5, fold: 0.5 };
    if (hi === 6 && lo >= 4) return { raise: 0, call: 0.4, fold: 0.6 };
    if (hi === 5 && lo >= 3) return { raise: 0, call: 0.4, fold: 0.6 };
    if (hi - lo === 1) return { raise: 0, call: 0.3, fold: 0.7 };
    return { raise: 0, call: 0.2, fold: 0.8 };
  }

  // offsuit
  if (hi === 14) {
    if (lo >= 11) return { raise: 0.5, call: 0.5, fold: 0 };
    if (lo === 10) return { raise: 0.2, call: 0.75, fold: 0.05 };
    if (lo >= 7) return { raise: 0.05, call: 0.75, fold: 0.2 };
    return { raise: 0, call: 0.5, fold: 0.5 };
  }
  if (hi === 13) {
    if (lo >= 11) return { raise: 0.2, call: 0.75, fold: 0.05 };
    if (lo >= 9) return { raise: 0, call: 0.7, fold: 0.3 };
    if (lo >= 7) return { raise: 0, call: 0.4, fold: 0.6 };
    return { raise: 0, call: 0.15, fold: 0.85 };
  }
  if (hi === 12) {
    if (lo >= 10) return { raise: 0.1, call: 0.8, fold: 0.1 };
    if (lo >= 8) return { raise: 0, call: 0.5, fold: 0.5 };
    return { raise: 0, call: 0.15, fold: 0.85 };
  }
  if (hi === 11) {
    if (lo >= 9) return { raise: 0, call: 0.6, fold: 0.4 };
    if (lo >= 7) return { raise: 0, call: 0.3, fold: 0.7 };
    return { raise: 0, call: 0.1, fold: 0.9 };
  }
  if (hi === 10) {
    if (lo >= 8) return { raise: 0, call: 0.5, fold: 0.5 };
    if (lo >= 6) return { raise: 0, call: 0.2, fold: 0.8 };
    return { raise: 0, call: 0.05, fold: 0.95 };
  }
  if (hi === 9 && lo >= 7) return { raise: 0, call: 0.3, fold: 0.7 };
  if (hi === 8 && lo >= 6) return { raise: 0, call: 0.2, fold: 0.8 };
  if (hi === 7 && lo === 6) return { raise: 0, call: 0.2, fold: 0.8 };
  if (hi === 6 && lo === 5) return { raise: 0, call: 0.15, fold: 0.85 };
  if (hi - lo === 1) return { raise: 0, call: 0.1, fold: 0.9 };
  return { raise: 0, call: 0, fold: 1 };
}

function buildChart(
  fn: (hi: number, lo: number, kind: HandKind) => PreflopAction,
): Record<string, PreflopAction> {
  const chart: Record<string, PreflopAction> = {};
  for (let hi = 14; hi >= 2; hi--) {
    for (let lo = 2; lo <= hi; lo++) {
      if (hi === lo) {
        chart[rankChar(hi) + rankChar(hi)] = fn(hi, lo, 'pair');
      } else {
        chart[rankChar(hi) + rankChar(lo) + 's'] = fn(hi, lo, 'suited');
        chart[rankChar(hi) + rankChar(lo) + 'o'] = fn(hi, lo, 'offsuit');
      }
    }
  }
  return chart;
}

export const HU_SB_OPEN_CHART: Readonly<Record<string, PreflopAction>> = buildChart(sbOpen);

export const HU_BB_VS_OPEN_CHART: Readonly<Record<string, PreflopAction>> = buildChart(bbVsOpen);

export function combosForKey(key: string): number {
  if (key.length === 2) return 6;
  if (key.endsWith('s')) return 4;
  return 12;
}

export function getAllHandKeys(): string[] {
  return Object.keys(HU_SB_OPEN_CHART);
}
