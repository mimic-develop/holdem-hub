import { describe, it, expect } from 'vitest';
import { deriveFlow, type FlowStep } from '../derive-flow';
import type { Puzzle } from '../../types/poker';

/**
 * Test fixtures use real cards so `@hh/poker-engine` `evaluateHand` (called inside
 * `computeAnswer` for awarding winners) returns valid hand evaluations. Board/hole
 * cards do not overlap.
 */

function makePuzzle(players: { id: string; invested: number; cards: [string, string] }[], opts: { deadMoney?: number } = {}): Puzzle {
  return {
    id: 'test',
    difficulty: 'easy',
    titleKo: 'test',
    descKo: 'test',
    board: ['As', 'Kh', 'Qd', 'Jc', 'Th'],
    players: players.map(p => ({ id: p.id, name: p.id, cards: p.cards, invested: p.invested })),
    blindInfo: opts.deadMoney !== undefined
      ? { sb: 0, bb: 0, ante: 0, deadMoney: opts.deadMoney }
      : undefined,
  };
}

// Filter helpers
const formingSteps = (steps: FlowStep[]) => steps.filter(s => s.kind === 'shortStack');
const awardingSteps = (steps: FlowStep[]) => steps.filter(s => s.kind === 'awarding');
const autoReturnSteps = (steps: FlowStep[]) => steps.filter(s => s.kind === 'autoReturn');
const deadMoneySteps = (steps: FlowStep[]) => steps.filter(s => s.kind === 'deadMoney');

describe('deriveFlow', () => {
  it('equal stacks: one main pot, one forming step, one awarding step, no autoReturn, no deadMoney step', () => {
    const puzzle = makePuzzle([
      { id: 'A', invested: 100, cards: ['2c', '3c'] },
      { id: 'B', invested: 100, cards: ['4d', '5d'] },
      { id: 'C', invested: 100, cards: ['6s', '7s'] },
    ]);

    const { steps, pots, deadMoney } = deriveFlow(puzzle);

    expect(pots).toHaveLength(1);
    expect(deadMoney).toBe(0);
    expect(formingSteps(steps)).toHaveLength(1);
    expect(awardingSteps(steps)).toHaveLength(1);
    expect(autoReturnSteps(steps)).toHaveLength(0);
    expect(deadMoneySteps(steps)).toHaveLength(0);

    const forming = formingSteps(steps)[0];
    expect(forming.kind === 'shortStack' && forming.pot.amount).toBe(300);
    expect(forming.kind === 'shortStack' && forming.perSeatAmount).toBe(100);
    expect(forming.kind === 'shortStack' && new Set(forming.correctSeatIds))
      .toEqual(new Set(['A', 'B', 'C']));
  });

  it('three stack levels: main + side1 (contested) + side2 (autoReturn)', () => {
    const puzzle = makePuzzle([
      { id: 'A', invested: 100, cards: ['2c', '3c'] },
      { id: 'B', invested: 200, cards: ['4d', '5d'] },
      { id: 'C', invested: 300, cards: ['6s', '7s'] },
    ]);

    const { steps, pots } = deriveFlow(puzzle);

    expect(pots).toHaveLength(3);
    expect(pots[0].eligible.sort()).toEqual(['A', 'B', 'C']);
    expect(pots[1].eligible.sort()).toEqual(['B', 'C']);
    expect(pots[2].eligible).toEqual(['C']);

    const forming = formingSteps(steps);
    expect(forming).toHaveLength(2); // main + side1 only (side2 is auto-return)

    // Main pot: 3 × 100
    expect(forming[0].kind === 'shortStack' && forming[0].perSeatAmount).toBe(100);
    expect(forming[0].kind === 'shortStack' && forming[0].correctSeatIds).toEqual(['A']);

    // Side1: 2 × 100
    expect(forming[1].kind === 'shortStack' && forming[1].pot.amount).toBe(200);
    expect(forming[1].kind === 'shortStack' && forming[1].perSeatAmount).toBe(100);
    expect(forming[1].kind === 'shortStack' && forming[1].correctSeatIds).toEqual(['B']);

    // Side2: autoReturn to C
    const autos = autoReturnSteps(steps);
    expect(autos).toHaveLength(1);
    expect(autos[0].kind === 'autoReturn' && autos[0].receiverId).toBe('C');
    expect(autos[0].kind === 'autoReturn' && autos[0].pot.amount).toBe(100);

    // Awarding: 2 (one per contested pot — side2 auto-return has no awarding)
    expect(awardingSteps(steps)).toHaveLength(2);
  });

  it('tied short stacks: correctSeatIds includes all seats at minimum invested', () => {
    const puzzle = makePuzzle([
      { id: 'A', invested: 100, cards: ['2c', '3c'] },
      { id: 'B', invested: 100, cards: ['4d', '5d'] },
      { id: 'C', invested: 300, cards: ['6s', '7s'] },
    ]);

    const { steps, pots } = deriveFlow(puzzle);

    expect(pots).toHaveLength(2);
    const forming = formingSteps(steps);
    expect(forming).toHaveLength(1); // main only (side1 = 1-eligible auto-return)

    // Main pot eligible: all three; tied short stacks = A & B
    expect(forming[0].kind === 'shortStack' && new Set(forming[0].correctSeatIds))
      .toEqual(new Set(['A', 'B']));
    expect(forming[0].kind === 'shortStack' && forming[0].perSeatAmount).toBe(100);
    expect(forming[0].kind === 'shortStack' && forming[0].pot.amount).toBe(300);

    // C's excess auto-returned
    const autos = autoReturnSteps(steps);
    expect(autos).toHaveLength(1);
    expect(autos[0].kind === 'autoReturn' && autos[0].receiverId).toBe('C');
    expect(autos[0].kind === 'autoReturn' && autos[0].pot.amount).toBe(200);
  });

  it('dead money: a deadMoney step is inserted right after main pot forming, perSeatAmount excludes dead money', () => {
    const puzzle = makePuzzle(
      [
        { id: 'A', invested: 100, cards: ['2c', '3c'] },
        { id: 'B', invested: 100, cards: ['4d', '5d'] },
        { id: 'C', invested: 100, cards: ['6s', '7s'] },
      ],
      { deadMoney: 50 },
    );

    const { steps, deadMoney } = deriveFlow(puzzle);
    expect(deadMoney).toBe(50);

    const formingFirst = steps.findIndex(s => s.kind === 'shortStack');
    const dmIdx = steps.findIndex(s => s.kind === 'deadMoney');
    expect(formingFirst).toBeGreaterThanOrEqual(0);
    expect(dmIdx).toBe(formingFirst + 1);

    // perSeatAmount of main pot reflects player contribution only, not dead money
    const mainForming = steps[formingFirst];
    expect(mainForming.kind === 'shortStack' && mainForming.perSeatAmount).toBe(100);
    expect(mainForming.kind === 'shortStack' && mainForming.pot.amount).toBe(350); // 3*100 + 50 dm

    const dm = steps[dmIdx];
    expect(dm.kind === 'deadMoney' && dm.amount).toBe(50);
  });

  it('step order: all forming first, then autoReturns, then awarding', () => {
    const puzzle = makePuzzle(
      [
        { id: 'A', invested: 100, cards: ['2c', '3c'] },
        { id: 'B', invested: 200, cards: ['4d', '5d'] },
        { id: 'C', invested: 300, cards: ['6s', '7s'] },
      ],
      { deadMoney: 10 },
    );

    const { steps } = deriveFlow(puzzle);
    const kinds = steps.map(s => s.kind);

    // shortStack(main), deadMoney, shortStack(side1), autoReturn(side2), awarding x2
    expect(kinds).toEqual([
      'shortStack',
      'deadMoney',
      'shortStack',
      'autoReturn',
      'awarding',
      'awarding',
    ]);
  });

  it('awarding step.correctWinners is populated from resolvePots (board-wired winner)', () => {
    // Board: As Kh Qd Jc Th → broadway straight on board → tie unless someone makes flush/etc.
    // A has 2c 3c (no flush), B has 4d 5d (no flush) → both play board straight → tie.
    const puzzle = makePuzzle([
      { id: 'A', invested: 100, cards: ['2c', '3c'] },
      { id: 'B', invested: 100, cards: ['4d', '5d'] },
    ]);
    const { steps } = deriveFlow(puzzle);
    const aw = awardingSteps(steps);
    expect(aw).toHaveLength(1);
    expect(aw[0].kind === 'awarding' && new Set(aw[0].correctWinners))
      .toEqual(new Set(['A', 'B']));
  });

  it('empty puzzle (no players) returns empty flow', () => {
    const puzzle = makePuzzle([]);
    const { steps, pots } = deriveFlow(puzzle);
    expect(pots).toHaveLength(0);
    expect(steps).toHaveLength(0);
  });
});
