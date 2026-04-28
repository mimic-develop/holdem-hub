import { buildPots } from '../potBuilder';

function assertPot(
  label: string,
  players: { id: string; invested: number }[],
  deadMoney: number,
  expected: { amount: number; eligible: number }[]
) {
  const pots = buildPots(players, deadMoney);
  const actual = pots.map(p => ({ amount: p.amount, eligible: p.eligible.length }));
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    console.error(`FAIL: ${label}`);
    console.error('  expected:', JSON.stringify(expected));
    console.error('  actual:  ', JSON.stringify(actual));
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

assertPot(
  'Regression #9: SB=110, BB=790, UTG=1000, dead=100 → Main=430, Side=1360',
  [
    { id: 'SB', invested: 110 },
    { id: 'BB', invested: 790 },
    { id: 'UTG', invested: 1000 },
  ],
  100,
  [
    { amount: 430, eligible: 3 },
    { amount: 1360, eligible: 2 },
    { amount: 210, eligible: 1 },
  ]
);

assertPot(
  'BB blind must be included: BB_base=690+bbLevel=100 → BB=790',
  [
    { id: 'SB', invested: 110 },
    { id: 'BB', invested: 690 },
    { id: 'UTG', invested: 1000 },
  ],
  100,
  [
    { amount: 430, eligible: 3 },
    { amount: 1160, eligible: 2 },
    { amount: 310, eligible: 1 },
  ]
);

assertPot(
  'Equal stacks: no side pots',
  [
    { id: 'A', invested: 500 },
    { id: 'B', invested: 500 },
    { id: 'C', invested: 500 },
  ],
  0,
  [{ amount: 1500, eligible: 3 }]
);

assertPot(
  '5-player multi-side: SB=50, BB=150, UTG=350, HJ=350, BTN=350, dead=100',
  [
    { id: 'SB', invested: 50 },
    { id: 'BB', invested: 150 },
    { id: 'UTG', invested: 350 },
    { id: 'HJ', invested: 350 },
    { id: 'BTN', invested: 350 },
  ],
  100,
  [
    { amount: 350, eligible: 5 },
    { amount: 400, eligible: 4 },
    { amount: 600, eligible: 3 },
  ]
);

assertPot(
  'Dead money with no SB: SB folded, dead includes sbLevel',
  [
    { id: 'BB', invested: 1320 },
    { id: 'CO', invested: 900 },
    { id: 'BTN', invested: 1120 },
  ],
  210,
  [
    { amount: 2910, eligible: 3 },
    { amount: 440, eligible: 2 },
    { amount: 200, eligible: 1 },
  ]
);

console.log('\nAll pot calculation tests passed!');
