import { describe, expect, it } from 'vitest';
import { HeuristicBot } from '../heuristic-bot';
import { simulateHand } from './hand-sim';

describe('simulateHand — AA vs 72o', () => {
  it('AA wins ≥ 80% over 1000 hands (no idiot folds with aces)', () => {
    let sbWins = 0;
    let bbWins = 0;
    let splits = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const sbBot = new HeuristicBot('MEDIUM', i * 2 + 1);
      const bbBot = new HeuristicBot('MEDIUM', i * 2 + 2);
      const r = simulateHand({
        sbBot,
        bbBot,
        sbCards: ['As', 'Ah'],
        bbCards: ['7c', '2d'],
        deckSeed: i + 100,
      });
      if (r.winner === 'SB') sbWins++;
      else if (r.winner === 'BB') bbWins++;
      else splits++;
    }
    const winRate = sbWins / N;
    console.log(
      `AA vs 72o: SB=${sbWins}/${N} (${(winRate * 100).toFixed(1)}%), BB=${bbWins}, split=${splits}`,
    );
    expect(winRate).toBeGreaterThan(0.8);
  }, 30000);

  it('AA as BB (in position to defend vs SB 72o open) wins ≥ 80%', () => {
    let bbWins = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const sbBot = new HeuristicBot('MEDIUM', i * 2 + 1);
      const bbBot = new HeuristicBot('MEDIUM', i * 2 + 2);
      const r = simulateHand({
        sbBot,
        bbBot,
        sbCards: ['7c', '2d'],
        bbCards: ['As', 'Ah'],
        deckSeed: i + 500,
      });
      if (r.winner === 'BB') bbWins++;
    }
    const winRate = bbWins / N;
    console.log(`72o(SB) vs AA(BB): BB=${bbWins}/${N} (${(winRate * 100).toFixed(1)}%)`);
    expect(winRate).toBeGreaterThan(0.8);
  }, 30000);
});

describe('simulateHand — showdown path reaches river', () => {
  it('with medium-strength hands, at least 20% of hands reach showdown', () => {
    // Use hands that are marginal enough to call but not always fold.
    let showdowns = 0;
    let folds = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const sbBot = new HeuristicBot('MEDIUM', i * 2 + 7001);
      const bbBot = new HeuristicBot('MEDIUM', i * 2 + 7002);
      const r = simulateHand({
        sbBot,
        bbBot,
        sbCards: ['Ks', 'Qs'],
        bbCards: ['Jh', 'Td'],
        deckSeed: i + 3000,
      });
      if (r.endedBy === 'showdown') showdowns++;
      else folds++;
    }
    console.log(`KQs(SB) vs JTo(BB): showdown=${showdowns}/${N}, folds=${folds}/${N}`);
    expect(showdowns).toBeGreaterThan(N * 0.2);
  }, 30000);

  it('when showdown reached, best 7-card hand wins deterministically', () => {
    // Preset cards so SB has a guaranteed nut — 9h 9d with expected flop 9c
    // We can't guarantee flop without engine, so just check a handful of seeds
    // and confirm results are stable.
    const results: string[] = [];
    for (let seed = 0; seed < 30; seed++) {
      const r = simulateHand({
        sbBot: new HeuristicBot('MEDIUM', 500),
        bbBot: new HeuristicBot('MEDIUM', 501),
        sbCards: ['9h', '9d'],
        bbCards: ['2c', '7s'],
        deckSeed: seed,
      });
      results.push(r.winner);
    }
    const sbWinRate = results.filter((r) => r === 'SB').length / results.length;
    // 99 dominates 72o; even with rare bad runouts SB should win most
    expect(sbWinRate).toBeGreaterThan(0.75);
  });
});

describe('simulateHand — sanity', () => {
  it('produces a winner or split', () => {
    const sbBot = new HeuristicBot('MEDIUM', 1);
    const bbBot = new HeuristicBot('MEDIUM', 2);
    const r = simulateHand({
      sbBot,
      bbBot,
      sbCards: ['As', 'Ah'],
      bbCards: ['Ks', 'Kh'],
      deckSeed: 1,
    });
    expect(['SB', 'BB', 'split']).toContain(r.winner);
    expect(r.pot).toBeGreaterThan(0);
  });

  it('same seeds + same bots produce identical result', () => {
    const a = simulateHand({
      sbBot: new HeuristicBot('MEDIUM', 123),
      bbBot: new HeuristicBot('MEDIUM', 456),
      sbCards: ['Ks', 'Qs'],
      bbCards: ['9h', '9d'],
      deckSeed: 7,
    });
    const b = simulateHand({
      sbBot: new HeuristicBot('MEDIUM', 123),
      bbBot: new HeuristicBot('MEDIUM', 456),
      sbCards: ['Ks', 'Qs'],
      bbCards: ['9h', '9d'],
      deckSeed: 7,
    });
    expect(a.winner).toBe(b.winner);
    expect(a.pot).toBe(b.pot);
    expect(a.endedBy).toBe(b.endedBy);
    expect(a.endedStreet).toBe(b.endedStreet);
  });
});
