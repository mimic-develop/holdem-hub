import type { Rank, Suit } from "@hh/poker-engine";
import type { Puzzle, Difficulty, BlindInfo } from "../types/poker";

export const PUZZLES: Puzzle[] = [
  {
    id: 'p001',
    difficulty: 'easy',
    titleKo: '단순 원페어 대결',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'BTN', cards: ['Ah', 'Kd'], invested: 175 },
      { id: 'B', name: 'SB',  cards: ['Qs', 'Qd'], invested: 175 },
      { id: 'C', name: 'BB',  cards: ['2h', '7c'], invested: 175 },
    ],
    board: ['Ac', '5d', '9h', 'Jc', '3s'],
  },
  {
    id: 'p002',
    difficulty: 'easy',
    titleKo: '공동 승리 (Chop)',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'UTG', cards: ['Ah', 'Kh'], invested: 250 },
      { id: 'B', name: 'BTN', cards: ['Ad', 'Ks'], invested: 250 },
      { id: 'C', name: 'BB',  cards: ['7c', '8d'], invested: 250 },
    ],
    board: ['Ac', 'Kd', 'Jh', 'Tc', '2s'],
  },
  {
    id: 'p003',
    difficulty: 'easy',
    titleKo: '기본 사이드팟',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'BTN', cards: ['Ah', 'Ad'], invested: 125 },
      { id: 'B', name: 'SB',  cards: ['Ks', 'Kd'], invested: 375 },
      { id: 'C', name: 'BB',  cards: ['Qh', 'Qd'], invested: 375 },
    ],
    board: ['As', 'Kh', '2c', '7d', '9s'],
  },
  {
    id: 'p004',
    difficulty: 'easy',
    titleKo: '메인팟·사이드팟 승자가 다른 경우',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'UTG', cards: ['7h', '7d'], invested: 80 },
      { id: 'B', name: 'CO',  cards: ['Ah', 'Kh'], invested: 480 },
      { id: 'C', name: 'BTN', cards: ['2c', '2d'], invested: 480 },
    ],
    board: ['7c', '7s', 'Ac', '2h', '9d'],
  },
  {
    id: 'p013',
    difficulty: 'easy',
    titleKo: '플러시 보드 - 플러시가 트립스를 꺾는다',
    descKo: '4장의 하트 보드에서 플러시와 트립스 중 누가 이길까요?',
    players: [
      { id: 'A', name: 'CO',  cards: ['Ah', 'Td'], invested: 175 },
      { id: 'B', name: 'BTN', cards: ['9h', '5h'], invested: 325 },
      { id: 'C', name: 'BB',  cards: ['Kd', 'Ks'], invested: 325 },
    ],
    board: ['3h', '7h', 'Jh', 'Kh', '2s'],
  },
  {
    id: 'p005',
    difficulty: 'medium',
    titleKo: '보드 플레이 함정',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'SB',  cards: ['2d', '3c'], invested: 400 },
      { id: 'B', name: 'BB',  cards: ['Kh', '8s'], invested: 400 },
      { id: 'C', name: 'BTN', cards: ['Qd', 'Jc'], invested: 400 },
      { id: 'D', name: 'UTG', cards: ['5h', '6d'], invested: 400 },
    ],
    board: ['Ac', 'Kd', 'Qh', 'Jd', 'Ts'],
  },
  {
    id: 'p006',
    difficulty: 'medium',
    titleKo: '플러시 vs 스트레이트',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'CO',  cards: ['9h', '6h'], invested: 350 },
      { id: 'B', name: 'BTN', cards: ['Kd', 'Qs'], invested: 350 },
      { id: 'C', name: 'BB',  cards: ['Ah', '2h'], invested: 350 },
    ],
    board: ['Th', '8h', '7h', 'Jd', '6c'],
  },
  {
    id: 'p007',
    difficulty: 'medium',
    titleKo: '풀하우스 대결',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'SB',  cards: ['Ah', 'As'], invested: 500 },
      { id: 'B', name: 'BB',  cards: ['Kh', 'Ks'], invested: 500 },
      { id: 'C', name: 'UTG', cards: ['Qh', 'Qs'], invested: 500 },
    ],
    board: ['Ac', 'Kd', 'Qc', 'Kc', 'Qd'],
  },
  {
    id: 'p008',
    difficulty: 'medium',
    titleKo: '사이드팟 2개',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'BTN', cards: ['Ah', 'Kd'], invested: 100 },
      { id: 'B', name: 'SB',  cards: ['Qs', 'Qd'], invested: 300 },
      { id: 'C', name: 'BB',  cards: ['Jh', 'Th'], invested: 600 },
    ],
    board: ['Qh', '9h', '2c', '3s', '4d'],
  },
  {
    id: 'p009',
    difficulty: 'medium',
    titleKo: '4인 멀티웨이 올인',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'UTG', cards: ['Ah', 'As'], invested: 50 },
      { id: 'B', name: 'HJ',  cards: ['Kd', 'Ks'], invested: 150 },
      { id: 'C', name: 'CO',  cards: ['Qh', 'Qc'], invested: 300 },
      { id: 'D', name: 'BTN', cards: ['Jd', 'Js'], invested: 300 },
    ],
    board: ['Kh', 'Qd', 'Jc', '2s', '5h'],
  },
  {
    id: 'p014',
    difficulty: 'medium',
    titleKo: '에이스 키커 배틀 - 사이드팟 적용',
    descKo: '같은 두 쌍이지만 키커가 다릅니다. 사이드팟까지 정확히 계산하세요.',
    players: [
      { id: 'A', name: 'HJ',  cards: ['Ah', 'Ks'], invested: 430 },
      { id: 'B', name: 'CO',  cards: ['Ad', 'Qh'], invested: 430 },
      { id: 'C', name: 'BTN', cards: ['Kh', 'Kd'], invested: 215 },
    ],
    board: ['As', '8c', '8h', '3d', '2s'],
  },
  {
    id: 'p010',
    difficulty: 'hard',
    titleKo: '스트레이트 플러시 함정',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'BTN', cards: ['9h', '8h'], invested: 600 },
      { id: 'B', name: 'SB',  cards: ['Jh', 'Th'], invested: 600 },
      { id: 'C', name: 'BB',  cards: ['Ah', 'Kh'], invested: 600 },
      { id: 'D', name: 'UTG', cards: ['Qd', 'Jc'], invested: 600 },
    ],
    board: ['7h', '6h', '5h', '4s', '2d'],
  },
  {
    id: 'p011',
    difficulty: 'hard',
    titleKo: '5인 복잡한 사이드팟',
    descKo: '핸드 순위를 매기고 팟을 분배하세요.',
    players: [
      { id: 'A', name: 'SB',  cards: ['9h', '9d'], invested: 80 },
      { id: 'B', name: 'BB',  cards: ['Ah', 'Kh'], invested: 200 },
      { id: 'C', name: 'UTG', cards: ['Qd', 'Qs'], invested: 400 },
      { id: 'D', name: 'HJ',  cards: ['Jh', 'Jd'], invested: 400 },
      { id: 'E', name: 'BTN', cards: ['Tc', 'Td'], invested: 800 },
    ],
    board: ['9c', '9s', 'Ac', '2d', '7h'],
  },
  {
    id: 'p012',
    difficulty: 'hard',
    titleKo: '공동 승리 포함 사이드팟',
    descKo: '숏스택 플레이어가 메인팟을 이기고, 나머지 둘이 사이드팟을 나눕니다.',
    players: [
      { id: 'A', name: 'CO',  cards: ['Ah', 'Ad'], invested: 100 },
      { id: 'B', name: 'BTN', cards: ['Qh', 'Qd'], invested: 300 },
      { id: 'C', name: 'BB',  cards: ['Qs', 'Qc'], invested: 300 },
    ],
    board: ['2c', '2d', '2h', '2s', 'Kc'],
  },
  {
    id: 'p015',
    difficulty: 'hard',
    titleKo: '브로드웨이 함정 - 에이스의 힘',
    descKo: '보드에 스트레이트가 깔렸지만, 에이스 홀카드가 판도를 바꿉니다.',
    players: [
      { id: 'A', name: 'SB',  cards: ['8s', '7c'], invested: 110 },
      { id: 'B', name: 'BB',  cards: ['Ah', '2d'], invested: 330 },
      { id: 'C', name: 'UTG', cards: ['Kc', 'Jd'], invested: 330 },
    ],
    board: ['9d', 'Th', 'Jh', 'Qs', 'Kd'],
  },
  {
    id: 'p016',
    difficulty: 'hard',
    titleKo: '5인 숏스택 트립스 - 3중 사이드팟',
    descKo: '숏스택이 메인팟을 트립스로 챙기고, 나머지 사이드팟은 다른 승자가 가져갑니다.',
    players: [
      { id: 'A', name: 'SB',  cards: ['Qc', 'Qh'], invested: 50 },
      { id: 'B', name: 'BB',  cards: ['Kd', 'Kc'], invested: 150 },
      { id: 'C', name: 'UTG', cards: ['Ah', 'Ac'], invested: 350 },
      { id: 'D', name: 'HJ',  cards: ['Jd', 'Js'], invested: 350 },
      { id: 'E', name: 'BTN', cards: ['8h', '9h'], invested: 350 },
    ],
    board: ['Qs', 'Jh', '7d', '4c', '2s'],
  },
];

export function getPuzzlesByDifficulty(difficulty: Difficulty = 'all'): Puzzle[] {
  if (difficulty === 'all') return PUZZLES;
  return PUZZLES.filter(p => p.difficulty === difficulty);
}

export function shufflePuzzles(puzzles: Puzzle[]): Puzzle[] {
  const arr = [...puzzles];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Randomize stack sizes with a realistic blind structure.
 *
 * Rules:
 * - BB is a random multiple of 10 in [10..200]
 * - SB = BB × 0.5,  Ante = BB × 1  (ratio fixed at 0.5 / 1 / 1)
 * - Each player gets a unique stack in [20..1500], rounded to nearest 10
 * - Relative ordering of original invested amounts is preserved
 *   (short-stack player keeps the smallest new stack, etc.)
 * - Dead money = unfilled SB + BB if those positions are not at the showdown
 */
export function randomizeStacksForPuzzle(puzzle: Puzzle): Puzzle {
  const n = puzzle.players.length;

  // 1. Blind level ─ BB in multiples of 10 from [10..200]
  const bbLevel = (Math.floor(Math.random() * 20) + 1) * 10; // 10,20,...,200
  const sbLevel = bbLevel / 2;   // 0.5 × BB
  const ante    = bbLevel;       // 1.0 × BB

  // 2. Build pool of unique 10-chip-rounded values in [20..1500]
  //    Pool size = 148 values (20,30,...,1500). Pick N unique ones.
  const POOL_MIN = 2;   // ×10 → 20 chips
  const POOL_MAX = 150; // ×10 → 1500 chips
  const poolSize = POOL_MAX - POOL_MIN + 1; // 149 slots

  // Fisher-Yates partial shuffle to pick n unique items from pool
  const pool = Array.from({ length: poolSize }, (_, i) => (POOL_MIN + i) * 10);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (poolSize - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const pickedSorted = pool.slice(0, n).sort((a, b) => a - b); // ascending

  // 3. Preserve relative ordering of original invested amounts
  //    Rank original players by invested asc → assign smallest new stack to smallest original, etc.
  const orderedByOrig = puzzle.players
    .map((p, i) => ({ i, inv: p.invested }))
    .sort((a, b) => a.inv - b.inv || a.i - b.i); // stable sort by invested

  const newInvestments = new Array<number>(n);
  orderedByOrig.forEach(({ i }, rank) => {
    newInvestments[i] = pickedSorted[rank];
  });

  // 4. Dead money — BBA format: ante is always dead money (posted by BB on behalf of table).
  //    If SB or BB fold, their blind also becomes dead.
  //    BB's displayed invested = post-ante live bet only (random + bbLevel).
  const names = puzzle.players.map(p => p.name);
  const hasSB  = names.includes('SB');
  const hasBB  = names.includes('BB');
  // BBA (Big Blind Ante) format: ante is always dead money regardless of BB showdown status.
  const deadMoney = (!hasSB ? sbLevel : 0) + ante + (!hasBB ? bbLevel : 0);

  const blindInfo: BlindInfo = { sb: sbLevel, bb: bbLevel, ante, deadMoney };

  return {
    ...puzzle,
    players: puzzle.players.map((p, i) => {
      let invested = newInvestments[i];
      if (hasSB && p.name === 'SB') invested += sbLevel;
      if (hasBB && p.name === 'BB') invested += bbLevel;
      return { ...p, invested };
    }),
    blindInfo,
  };
}

const ALL_RANKS: Rank[] = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const ALL_SUITS: Suit[] = ['h','d','c','s'];

/**
 * Randomize hole cards for every player and the board.
 * Deals from a freshly shuffled 52-card deck — no card appears twice.
 */
export function randomizeCardsForPuzzle(puzzle: Puzzle): Puzzle {
  const deck: string[] = [];
  for (const r of ALL_RANKS) for (const s of ALL_SUITS) deck.push(r + s);

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  let idx = 0;
  const newPlayers = puzzle.players.map(p => ({
    ...p,
    cards: [deck[idx++], deck[idx++]],
  }));
  const newBoard = [deck[idx++], deck[idx++], deck[idx++], deck[idx++], deck[idx++]];

  return { ...puzzle, players: newPlayers, board: newBoard };
}
