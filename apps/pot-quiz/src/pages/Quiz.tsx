import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, CheckCircle, ChevronRight, Home } from 'lucide-react';
import CardDisplay from '../components/CardDisplay';
import TimerBar from '../components/TimerBar';
import type { PotResult } from "@hh/poker-engine";
import type { Puzzle, Difficulty } from "../types/poker";
import { getPuzzlesByDifficulty, shufflePuzzles, randomizeStacksForPuzzle, randomizeCardsForPuzzle } from '../data/puzzles';
import { evaluateHand } from '@hh/poker-engine';
import { buildPots } from '@hh/poker-engine';
import { resolvePots } from '@hh/poker-engine';
import { PASS_SECONDS, calcTimeScore, calcStreakBonus, STEP1_PTS, STEP2_PTS, STEP3_PTS } from '@hh/poker-engine';

// ── types ─────────────────────────────────────────────────────────────
interface AnswerData {
  potResults: PotResult[];
  playerPayouts: Record<string, number>;
  correctRanks: Record<string, number>;
  handMap: Record<string, { descriptionKo: string; rankValue: number; tiebreakers: number[] }>;
}

// ── game logic helpers ─────────────────────────────────────────────────
function bbaAdjusted(puzzle: Puzzle) {
  const contributions = puzzle.players.map(p => ({ id: p.id, invested: p.invested }));
  const deadMoney = puzzle.blindInfo?.deadMoney ?? 0;
  return { contributions, deadMoney };
}

function computeAnswer(puzzle: Puzzle): AnswerData {
  const rawHandMap: Record<string, ReturnType<typeof evaluateHand>> = {};
  for (const p of puzzle.players) rawHandMap[p.id] = evaluateHand(p.cards, puzzle.board);

  const { contributions, deadMoney } = bbaAdjusted(puzzle);
  const pots = buildPots(contributions, deadMoney);
  const { potResults } = resolvePots(pots, rawHandMap);

  const playerPayouts: Record<string, number> = {};
  for (const pr of potResults) {
    if (pr.pot.eligible.length < 2) continue;
    const total = pr.pot.amount;
    const n = pr.winners.length;
    const per = Math.floor(total / n);
    const rem = total - per * n;
    for (let i = 0; i < n; i++) {
      const amt = per + (i === 0 ? rem : 0);
      playerPayouts[pr.winners[i]] = (playerPayouts[pr.winners[i]] ?? 0) + amt;
    }
  }

  const sortedIds = [...puzzle.players.map(p => p.id)].sort((a, b) => {
    const ha = rawHandMap[a], hb = rawHandMap[b];
    if (hb.rankValue !== ha.rankValue) return hb.rankValue - ha.rankValue;
    for (let i = 0; i < Math.max(ha.tiebreakers.length, hb.tiebreakers.length); i++) {
      const d = (hb.tiebreakers[i] ?? 0) - (ha.tiebreakers[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });

  const correctRanks: Record<string, number> = {};
  let rank = 1;
  for (let i = 0; i < sortedIds.length; i++) {
    if (i === 0) { correctRanks[sortedIds[i]] = 1; }
    else {
      const prev = rawHandMap[sortedIds[i - 1]], curr = rawHandMap[sortedIds[i]];
      const tied = prev.rankValue === curr.rankValue && prev.tiebreakers.every((t, j) => t === curr.tiebreakers[j]);
      if (!tied) rank = i + 1;
      correctRanks[sortedIds[i]] = rank;
    }
  }

  const handMap: Record<string, { descriptionKo: string; rankValue: number; tiebreakers: number[] }> = {};
  for (const [id, ev] of Object.entries(rawHandMap))
    handMap[id] = { descriptionKo: ev.descriptionKo, rankValue: ev.rankValue, tiebreakers: ev.tiebreakers };

  return { potResults, playerPayouts, correctRanks, handMap };
}

function normalizeRanks(rankMap: Record<string, number>): Record<string, number> {
  const unique = Array.from(new Set(Object.values(rankMap))).sort((a, b) => a - b);
  const mapping: Record<number, number> = {};
  unique.forEach((v, i) => { mapping[v] = i + 1; });
  const result: Record<string, number> = {};
  for (const [id, r] of Object.entries(rankMap)) result[id] = mapping[r];
  return result;
}

function rankingsMatch(user: Record<string, number>, correct: Record<string, number>) {
  const nu = normalizeRanks(user), nc = normalizeRanks(correct);
  return Object.keys(nc).every(id => nu[id] === nc[id]);
}

// ── visual helpers ─────────────────────────────────────────────────────
const RANK_COLORS: Record<number, string> = {
  1: 'bg-yellow-500/30 border-yellow-400/70 text-yellow-300',
  2: 'bg-zinc-400/20 border-input/60 text-foreground',
  3: 'bg-orange-700/30 border-orange-600/60 text-orange-300',
};
function rankColor(r: number) { return RANK_COLORS[r] ?? 'bg-secondary/20 border-input text-muted-foreground'; }
const RANK_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
function rankLabel(r: number) { return RANK_EMOJI[r] ?? `${r}위`; }

// ── 9-max seat layout ──────────────────────────────────────────────────
// Clockwise order starting from BTN (bottom-center)
const NINE_MAX_ORDER = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'] as const;

// [left, top, transform] – positioned relative to the table container
const NINE_MAX_POS: Record<string, { left: string; top: string; tx: string }> = {
  BTN:     { left: '50%',  top: '100%', tx: 'translate(-50%, -100%)' }, // 6 o'clock
  SB:      { left: '19%',  top: '97%',  tx: 'translate(-50%, -100%)' }, // 7 o'clock
  BB:      { left: '0%',   top: '67%',  tx: 'translate(0%, -50%)' },    // 8 o'clock
  UTG:     { left: '0%',   top: '27%',  tx: 'translate(0%, -50%)' },    // 10 o'clock
  'UTG+1': { left: '18%',  top: '1%',   tx: 'translate(-50%, 0%)' },    // 11 o'clock
  MP:      { left: '50%',  top: '0%',   tx: 'translate(-50%, 0%)' },    // 12 o'clock
  LJ:      { left: '82%',  top: '1%',   tx: 'translate(-50%, 0%)' },    // 1 o'clock
  HJ:      { left: '100%', top: '27%',  tx: 'translate(-100%, -50%)' }, // 2 o'clock
  CO:      { left: '100%', top: '67%',  tx: 'translate(-100%, -50%)' }, // 4 o'clock
};

// ── Folded seat chip ───────────────────────────────────────────────────
function FoldedSeat({ name, posStyle }: { name: string; posStyle: { left: string; top: string; tx: string } }) {
  return (
    <div
      style={{ position: 'absolute', left: posStyle.left, top: posStyle.top, transform: posStyle.tx, zIndex: 5 }}
      className="flex flex-col items-center gap-px"
    >
      <div className="flex gap-px">
        <div className="w-[18px] h-[26px] rounded-[3px] bg-card border border-border" />
        <div className="w-[18px] h-[26px] rounded-[3px] bg-card border border-border" />
      </div>
      <span className="text-[7px] text-foreground font-medium tracking-tight">{name}</span>
    </div>
  );
}

// ── Ranking summary display (read-only, click assignment is on table seats) ──
interface RankingDisplayProps {
  players: Puzzle['players'];
  rankings: Record<string, number>;
}

function RankingDisplay({ players, rankings }: RankingDisplayProps) {
  const n = players.length;

  const maxSlot = useMemo(
    () => Math.max(0, ...Object.values(rankings)),
    [rankings]
  );
  const numSlots = Math.min(Math.max(maxSlot + 1, n), n);

  const slotGroups: string[][] = useMemo(() => {
    return Array.from({ length: numSlots }, (_, i) =>
      players.filter(p => rankings[p.id] === i + 1).map(p => p.id)
    );
  }, [numSlots, players, rankings]);

  function effectiveRank(slotIdx: number): number {
    let r = 1;
    for (let i = 0; i < slotIdx; i++) r += slotGroups[i].length;
    return r;
  }

  return (
    <div className="mb-2 flex gap-1.5">
      {slotGroups.map((group, slotIdx) => {
        const eff = effectiveRank(slotIdx);
        const hasPlayers = group.length > 0;
        return (
          <div
            key={slotIdx}
            className={[
              'flex-1 flex flex-col items-center gap-0.5 rounded-xl border py-1.5 px-1 min-h-[58px] transition-colors',
              hasPlayers ? rankColor(eff) : 'border-border bg-card/30',
            ].join(' ')}
          >
            <span className="text-sm leading-none select-none">{rankLabel(eff)}</span>
            <div className="flex flex-col items-center gap-0.5 w-full">
              {group.map(id => {
                const player = players.find(p => p.id === id)!;
                return (
                  <div key={id} className="flex flex-col items-center">
                    <div className="flex gap-px">
                      {player.cards.map(c => <CardDisplay key={c} card={c} size="xs" />)}
                    </div>
                    <span className="text-[8px] text-muted-foreground font-medium leading-tight">{player.name}</span>
                  </div>
                );
              })}
              {!hasPlayers && (
                <span className="text-[9px] text-foreground italic mt-0.5">클릭</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── PlayerSeat component ───────────────────────────────────────────────
interface SeatProps {
  player: Puzzle['players'][number];
  correctRank?: number;
  handDesc?: string;
  payout?: number;
  phase: 'ranking' | 'pot' | 'payout' | 'result' | 'wrong';
  assignedRank?: number;
  /** called when user clicks the seat during ranking phase */
  onSeatClick?: (id: string) => void;
}

function PlayerSeat({ player, correctRank: _correctRank, handDesc: _handDesc, payout: _payout, phase, assignedRank, onSeatClick }: SeatProps) {
  const isAssigned = assignedRank !== undefined;
  const clickable = phase === 'ranking';
  // In result/wrong phases the board stays frozen as it looked during the quiz (ranking phase style)
  const isFrozen = phase === 'result' || phase === 'wrong';
  const isLocked = phase === 'pot' || phase === 'payout' || phase === 'wrong';

  return (
    <div
      data-testid={`seat-${player.id}`}
      onClick={clickable ? () => onSeatClick?.(player.id) : undefined}
      className={[
        'flex flex-col items-center rounded-xl border transition-all select-none',
        phase === 'ranking'
          ? isAssigned
            ? `cursor-pointer active:scale-95 bg-muted border-input shadow-md ${rankColor(assignedRank)}`
            : 'cursor-pointer active:scale-95 bg-card/95 border-border hover:border-input'
          : isFrozen
            ? 'bg-card/90 border-border'
            : isLocked
              ? isAssigned
                ? `bg-muted/60 border-input ${rankColor(assignedRank)}`
                : 'bg-card/90 border-border'
              : 'bg-card/90 border-border',
      ].join(' ')}
      style={{ width: 60, padding: '3px 2px', gap: 1 }}
    >
      {/* Rank badge — only during active quiz phases */}
      {(phase === 'ranking' || phase === 'pot' || phase === 'payout') && isAssigned && (
        <span className="text-[11px] leading-none">{rankLabel(assignedRank)}</span>
      )}

      {/* Hole cards */}
      <div className="flex gap-px">
        {player.cards.map(c => <CardDisplay key={c} card={c} size="xs" />)}
      </div>

      {/* Player name */}
      <span className="text-[9px] font-semibold text-foreground leading-tight">{player.name}</span>

      {/* Always show invested amount (frozen in result/wrong too) */}
      <span className="text-[10px] font-bold text-yellow-300/90 leading-tight tracking-tight">
        {player.invested.toLocaleString()}
      </span>
    </div>
  );
}

// ── main Quiz component ────────────────────────────────────────────────
type Phase = 'ranking' | 'pot' | 'payout' | 'result' | 'wrong';

export default function Quiz() {
  const { difficulty } = useParams<{ difficulty: Difficulty }>();
  const [, setLocation] = useLocation();

  const makeBatch = () =>
    shufflePuzzles(getPuzzlesByDifficulty(difficulty))
      .map(p => randomizeCardsForPuzzle(randomizeStacksForPuzzle(p)));

  const [puzzles, setPuzzles] = useState<Puzzle[]>(() => makeBatch());
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ranking');

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [, setCorrectCount] = useState(0);

  const scoreRef = useRef(0);
  const maxStreakRef = useRef(0);
  const correctCountRef = useRef(0);

  const [timerKey, setTimerKey] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const elapsedRef = useRef<number>(0);
  const isSubmittingRef = useRef(false);

  // rankAssignments: playerId → slot number (1-based), editable only in 'ranking' phase
  const [rankAssignments, setRankAssignments] = useState<Record<string, number>>({});
  // lockedRankings: saved when ranking phase passes, used in payout phase display + result
  const [lockedRankings, setLockedRankings] = useState<Record<string, number>>({});

  // potInputs: pot index → amount string (step 2)
  const [potInputs, setPotInputs] = useState<Record<number, string>>({});

  // Payout inputs: playerId → string (step 3)
  const [payoutInputs, setPayoutInputs] = useState<Record<string, string>>({});

  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    rankingCorrect: boolean;
    payoutScore: number;
    points: number;
    answer: AnswerData;
    userPayouts: Record<string, number>;
    userRankings: Record<string, number>;
    userPotInputs?: Record<string, number>;
    elapsed: number;
    passed: boolean;
    wrongStep?: 'ranking' | 'pot' | 'payout';
    brokenStreak?: number;
    timeScore?: number;
  } | null>(null);

  const puzzle = puzzles[index];

  // Reset state when puzzle changes
  useEffect(() => {
    setPhase('ranking');
    setRankAssignments({});
    setLockedRankings({});
    setPotInputs({});
    setPayoutInputs({});
    setTimerRunning(true);
    setTimerKey(k => k + 1);
    elapsedRef.current = 0;
    isSubmittingRef.current = false;
    setLastResult(null);
  }, [index]);

  const handleTimerTick = useCallback((elapsed: number) => {
    elapsedRef.current = elapsed;
  }, []);

  /**
   * Click-based ranking:
   *   • Unranked player  → assign next slot (maxSlot + 1)
   *   • Ranked, slot > 1 → move up one slot (tie with group above)
   *   • Ranked, slot = 1 → unassign (remove from ranking)
   */
  const handleSeatClick = useCallback((id: string) => {
    if (phase !== 'ranking') return;
    setRankAssignments(prev => {
      const currentSlot = prev[id];
      const maxSlot = Math.max(0, ...Object.values(prev));

      if (currentSlot === undefined) {
        // Never ranked → assign after last group
        return { ...prev, [id]: maxSlot + 1 };
      }

      if (currentSlot > 1) {
        // Move up: tie with the group one slot above
        return { ...prev, [id]: currentSlot - 1 };
      }

      // Already in slot 1 → unassign and compact if slot 1 becomes empty
      const next = { ...prev };
      delete next[id];
      const slot1Empty = !Object.values(next).some(s => s === 1);
      if (slot1Empty) {
        // Shift everyone down so there's no gap at the top
        return Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v - 1]));
      }
      return next;
    });
  }, [phase]);

  /** Step 1: validate hand ranking. Correct → advance to payout. Wrong → reset + show error. */
  const handleRankingSubmit = useCallback(() => {
    if (phase !== 'ranking') return;

    const answer = computeAnswer(puzzle);

    // Fill any unranked players (put them last)
    const filledRankings: Record<string, number> = { ...rankAssignments };
    let maxR = Math.max(0, ...Object.values(filledRankings));
    for (const p of puzzle.players) {
      if (filledRankings[p.id] === undefined) { filledRankings[p.id] = maxR + 1; maxR++; }
    }

    const rankingCorrect = rankingsMatch(filledRankings, answer.correctRanks);

    if (rankingCorrect) {
      setLockedRankings(filledRankings);
      setPhase('pot');
    } else {
      setTimerRunning(false);
      const broken = streak;
      setStreak(0);
      setLastResult({
        correct: false,
        rankingCorrect: false,
        payoutScore: 0,
        points: 0,
        answer,
        userPayouts: {},
        userRankings: filledRankings,
        elapsed: elapsedRef.current,
        passed: false,
        wrongStep: 'ranking',
        brokenStreak: broken,
      });
      setPhase('wrong');
    }
  }, [phase, puzzle, rankAssignments]);

  /** Step 2: validate pot amounts (메인팟, 사이드팟). Correct → advance to 'payout'. Wrong → retry. */
  const handlePotSubmit = useCallback(() => {
    if (phase !== 'pot') return;

    const answer = computeAnswer(puzzle);
    // Only contested pots (2+ eligible) need user input; 1-eligible pots auto-return to player
    const contestedPots = answer.potResults.map(pr => pr.pot).filter(p => p.eligible.length >= 2);

    const allCorrect = contestedPots.every((pot, i) => {
      const userAmt = parseInt(String(potInputs[i] ?? '0'), 10) || 0;
      return Math.abs(userAmt - pot.amount) <= 1;
    });

    if (allCorrect) {
      setPhase('payout');
    } else {
      setTimerRunning(false);
      const broken = streak;
      setStreak(0);
      const userPotInputs: Record<string, number> = {};
      contestedPots.forEach((pot, i) => {
        userPotInputs[pot.label] = parseInt(String(potInputs[i] ?? '0'), 10) || 0;
      });
      setLastResult({
        correct: false,
        rankingCorrect: true,
        payoutScore: 0,
        points: 0,
        answer,
        userPayouts: {},
        userRankings: lockedRankings,
        userPotInputs,
        elapsed: elapsedRef.current,
        passed: false,
        wrongStep: 'pot',
        brokenStreak: broken,
      });
      setPhase('wrong');
    }
  }, [phase, puzzle, potInputs, lockedRankings]);

  /** Step 3: validate per-player payouts. Always advances to result. */
  const handlePayoutSubmit = useCallback(() => {
    if (phase !== 'payout') return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setTimerRunning(false);

    const answer = computeAnswer(puzzle);
    const elapsed = elapsedRef.current;
    const passed = elapsed <= PASS_SECONDS;

    // Payout scoring
    const userPayouts: Record<string, number> = {};
    for (const p of puzzle.players) userPayouts[p.id] = parseInt(payoutInputs[p.id] ?? '0', 10) || 0;
    let correctPayouts = 0;
    for (const p of puzzle.players) {
      if (Math.abs((userPayouts[p.id] ?? 0) - (answer.playerPayouts[p.id] ?? 0)) <= 1) correctPayouts++;
    }
    const payoutRatio = puzzle.players.length > 0 ? correctPayouts / puzzle.players.length : 0;
    const payoutFullyCorrect = payoutRatio === 1;

    if (!payoutFullyCorrect) {
      const broken = streak;
      setStreak(0);
      setLastResult({
        correct: false,
        rankingCorrect: true,
        payoutScore: Math.round(100 * payoutRatio),
        points: 0,
        answer,
        userPayouts,
        userRankings: lockedRankings,
        elapsed,
        passed,
        wrongStep: 'payout',
        brokenStreak: broken,
      });
      setPhase('wrong');
      return;
    }

    const timeScore = calcTimeScore(elapsed);
    const streakBns = calcStreakBonus(streak);
    const points = Math.max(0, Math.round(STEP1_PTS + STEP2_PTS + STEP3_PTS + timeScore) + streakBns);

    const newStreak = streak + 1;
    const newMaxStreak = Math.max(maxStreak, newStreak);
    const newScore = score + points;

    scoreRef.current = newScore;
    maxStreakRef.current = newMaxStreak;
    correctCountRef.current = correctCountRef.current + 1;

    setScore(newScore);
    setStreak(newStreak);
    setMaxStreak(newMaxStreak);
    setCorrectCount(correctCountRef.current);
    const bestScoreKey = `pot-quiz:bestScore_${difficulty}`;
    if (newScore > parseInt(localStorage.getItem(bestScoreKey) ?? '0', 10))
      localStorage.setItem(bestScoreKey, String(newScore));

    const bestStreakKey = `pot-quiz:bestStreak_${difficulty}`;
    if (newMaxStreak > parseInt(localStorage.getItem(bestStreakKey) ?? '0', 10))
      localStorage.setItem(bestStreakKey, String(newMaxStreak));

    setLastResult({ correct: true, rankingCorrect: true, payoutScore: 100, points, answer, userPayouts, userRankings: lockedRankings, elapsed, passed, timeScore });
    setPhase('result');
  }, [phase, puzzle, payoutInputs, streak, maxStreak, score, lockedRankings]);

  const handleNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= puzzles.length - 2) {
      setPuzzles(prev => [...prev, ...makeBatch()]);
    }
    setIndex(nextIndex);
  };

  const handleQuit = () => {
    setLocation(`/summary/${difficulty}`, {
      state: {
        score: scoreRef.current,
        streak: maxStreakRef.current,
        correctCount: correctCountRef.current,
        totalAnswered: index + 1,
      },
    });
  };

  if (!puzzle) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">문제가 없습니다.</div>;
  }

  const { contributions: adjContribs, deadMoney: adjDeadMoney } = bbaAdjusted(puzzle);
  const allPotsList = buildPots(adjContribs, adjDeadMoney);
  const contestedPotsTotal = allPotsList.filter(p => p.eligible.length >= 2).reduce((s, p) => s + p.amount, 0);
  const inputSum = Object.values(payoutInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
  const sumMismatch = inputSum !== contestedPotsTotal && Object.values(payoutInputs).some(v => v !== '');
  // Build a lookup of player by position name
  const playerByPos = Object.fromEntries(puzzle.players.map(p => [p.name, p]));


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-lg mx-auto px-4 pb-8">
      {/* ── Top bar ── */}
      <div className="py-4 flex items-center justify-between">
        <button
          onClick={handleQuit}
          data-testid="btn-back"
          className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:border-input transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">점수</span>
          <span className="font-bold text-white" data-testid="score-display">{score}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
            streak >= 1
              ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
              : 'bg-muted border-border text-muted-foreground'
          }`} data-testid="streak-display">
            {streak >= 1 ? '🔥' : ''}{streak}연속
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
          difficulty === 'easy' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          difficulty === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
          'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {difficulty === 'easy' ? '초급' : difficulty === 'medium' ? '중급' : difficulty === 'hard' ? '고급' : '전체'}
        </span>
      </div>

      {/* ── Timer (runs through ranking + pot + payout phases) ── */}
      {(phase === 'ranking' || phase === 'pot' || phase === 'payout') && (
        <div className="mb-2">
          <TimerBar
            key={timerKey}
            passSeconds={PASS_SECONDS}
            onTick={handleTimerTick}
            running={timerRunning}
          />
        </div>
      )}


      {/* ── Puzzle title ── */}
      <p className="text-xs text-muted-foreground font-semibold text-center mb-2 uppercase tracking-wider">
        {puzzle.titleKo}
      </p>

      {/* ══════════════════════════════════════════════
          POKER TABLE – 9-max top view
          Container 300px: felt left/right 22%, top 23%, bottom 16%
          Clockwise from BTN (6 o'clock): SB→BB→UTG→UTG+1→MP→LJ→HJ→CO
          ══════════════════════════════════════════════ */}
      <div className="relative w-full mb-2" style={{ height: 300 }}>

        {/* Wood rim */}
        <div
          className="absolute rounded-[50%]"
          style={{
            left: '18%', right: '18%', top: '19%', bottom: '13%',
            background: 'linear-gradient(145deg, #8B5E3C 0%, #5C3A1E 50%, #4A2E15 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        />

        {/* Green felt oval */}
        <div
          className="absolute rounded-[50%]"
          style={{
            left: '22%', right: '22%', top: '23%', bottom: '17%',
            background: 'radial-gradient(ellipse at 40% 35%, #1f7a35 0%, #145c28 55%, #0e4020 100%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {/* Subtle felt texture lines */}
          <div className="absolute inset-0 rounded-[50%] opacity-[0.06]" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.8) 10px, rgba(255,255,255,0.8) 11px)',
          }} />

          {/* Board cards + blind info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <div className="flex gap-0.5 justify-center">
              {puzzle.board.map(c => <CardDisplay key={c} card={c} size="sm" />)}
            </div>
            {puzzle.blindInfo && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] text-white">SB {puzzle.blindInfo.sb}</span>
                <span className="text-[8px] text-white">/</span>
                <span className="text-[8px] text-white">BB {puzzle.blindInfo.bb}</span>
                <span className="text-[8px] text-white">/</span>
                <span className="text-[8px] text-white">앤티 {puzzle.blindInfo.ante}</span>
                {adjDeadMoney > 0 && (
                  <span className="text-[8px] text-orange-400/90 font-semibold ml-1">
                    데드 {adjDeadMoney}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Dealer button ── on felt, near BTN seat */}
          <div
            className="absolute flex items-center justify-center rounded-full bg-white text-foreground font-black text-[9px] shadow-lg select-none"
            style={{ width: 18, height: 18, bottom: '8%', left: '50%', transform: 'translateX(-50%)' }}
          >
            D
          </div>

          {/* ── SB blind chip ── between SB seat direction and felt center */}
          {puzzle.blindInfo && !playerByPos['SB'] && (
            <div
              className="absolute flex flex-col items-center"
              style={{ bottom: '10%', left: '30%', transform: 'translateX(-50%)' }}
            >
              <div className="w-[22px] h-[22px] rounded-full bg-zinc-100 border-[2.5px] border-input shadow-md flex items-center justify-center">
                <span className="text-[7px] font-black text-foreground leading-none">SB</span>
              </div>
              <span className="text-[6px] text-muted-foreground leading-none mt-px">{puzzle.blindInfo.sb}</span>
            </div>
          )}

          {/* ── BB blind chip ── between BB seat direction and felt center */}
          {puzzle.blindInfo && !playerByPos['BB'] && (
            <div
              className="absolute flex flex-col items-center"
              style={{ top: '60%', left: '10%', transform: 'translateY(-50%)' }}
            >
              <div className="w-[22px] h-[22px] rounded-full bg-primary border-[2.5px] border-blue-300 shadow-md flex items-center justify-center">
                <span className="text-[7px] font-black text-white leading-none">BB</span>
              </div>
              <span className="text-[6px] text-primary leading-none mt-px">{puzzle.blindInfo.bb}</span>
            </div>
          )}
        </div>

        {/* ── 9-max seats (fixed positions) ── */}
        {NINE_MAX_ORDER.map(posName => {
          const posStyle = NINE_MAX_POS[posName];
          const player = playerByPos[posName];

          if (!player) {
            return <FoldedSeat key={posName} name={posName} posStyle={posStyle} />;
          }

          const correctRank = lastResult?.answer.correctRanks[player.id];
          return (
            <div
              key={player.id}
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
                  (phase === 'pot' || phase === 'payout') ? lockedRankings[player.id] :
                  undefined
                }
                correctRank={(phase === 'result' || phase === 'wrong') ? correctRank : undefined}
                handDesc={lastResult?.answer.handMap[player.id]?.descriptionKo}
                payout={lastResult?.answer.playerPayouts[player.id] ?? 0}
                phase={phase}
                onSeatClick={handleSeatClick}
              />
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          QUIZ INPUT SECTION
          ══════════════════════════════════════════════ */}
      {/* ── STEP 1: Ranking input ── */}
      {phase === 'ranking' && (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">1단계 · 핸드 순위</p>
              <p className="text-[10px] text-muted-foreground leading-tight">탭: 순위 지정 · 재탭: 동점 · 1위 재탭: 초기화</p>
            </div>
            <button
              onClick={() => setRankAssignments({})}
              data-testid="btn-reset-ranks"
              disabled={Object.keys(rankAssignments).length === 0}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:border-input disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              초기화
            </button>
          </div>
          <RankingDisplay
            players={puzzle.players}
            rankings={rankAssignments}
          />

          <button
            onClick={handleRankingSubmit}
            data-testid="btn-submit-ranking"
            className="w-full py-3.5 rounded-xl font-bold text-base bg-primary hover:bg-primary text-primary-foreground transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            순위 확인
          </button>
        </>
      )}

      {/* ── STEP 2: Pot amount input ── */}
      {phase === 'pot' && (() => {
        const answer = computeAnswer(puzzle);
        const allPots = answer.potResults.map(pr => pr.pot);
        // Only contested pots (2+ eligible) require user input
        const contestedPots = allPots.filter(p => p.eligible.length >= 2);
        const autoPots = allPots.filter(p => p.eligible.length < 2);
        return (
          <>
            {/* Locked ranking bar */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide shrink-0">순위 ✓</span>
              <div className="flex gap-1 flex-wrap">
                {[...puzzle.players]
                  .sort((a, b) => (lockedRankings[a.id] ?? 99) - (lockedRankings[b.id] ?? 99))
                  .map(p => (
                    <span key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${rankColor(lockedRankings[p.id] ?? 0)}`}>
                      {rankLabel(lockedRankings[p.id] ?? 0)} {p.name}
                    </span>
                  ))}
              </div>
            </div>

            {/* Pot inputs — contested pots only */}
            <div className="bg-card/70 border border-border rounded-xl px-3 py-2 mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">2단계 · 팟 금액</p>
              <div className="space-y-1.5">
                {contestedPots.map((pot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${pot.type === 'main' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-purple-300'}`}>
                      {pot.label}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={potInputs[i] ?? ''}
                      onChange={e => setPotInputs(prev => ({ ...prev, [i]: e.target.value }))}
                      placeholder="0"
                      data-testid={`input-pot-${i}`}
                      className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                ))}
                {autoPots.map((pot, i) => {
                  const winnerId = pot.eligible[0];
                  const winnerName = puzzle.players.find(p => p.id === winnerId)?.name ?? winnerId;
                  return (
                    <div key={`auto-${i}`} className="flex items-center gap-2 opacity-60">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded shrink-0 bg-secondary/50 text-muted-foreground">
                        {pot.label}
                      </span>
                      <span className="flex-1 text-[11px] text-muted-foreground italic">
                        {winnerName} 자동 반환 ({pot.amount.toLocaleString()}칩)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handlePotSubmit}
              data-testid="btn-submit-pot"
              className="w-full py-3.5 rounded-xl font-bold text-base bg-primary hover:bg-primary text-primary-foreground transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              팟 금액 확인
            </button>
          </>
        );
      })()}

      {/* ── STEP 3: Per-player payout input ── */}
      {phase === 'payout' && (
        <>
          {/* Locked ranking + pot summary */}
          <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide shrink-0">순위 ✓ 팟 ✓</span>
            <div className="flex gap-1 flex-wrap">
              {[...puzzle.players]
                .sort((a, b) => (lockedRankings[a.id] ?? 99) - (lockedRankings[b.id] ?? 99))
                .map(p => (
                  <span key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${rankColor(lockedRankings[p.id] ?? 0)}`}>
                    {rankLabel(lockedRankings[p.id] ?? 0)} {p.name}
                  </span>
                ))}
            </div>
          </div>

          {/* Per-player chip inputs — sorted by hand rank */}
          <div className="bg-card/70 border border-border rounded-xl px-3 py-2 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3단계 · 플레이어 수령</p>
              <span className="text-[11px] text-muted-foreground">
                총 <span className="font-bold text-foreground">{contestedPotsTotal.toLocaleString()}</span>
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">수령 없는 플레이어는 미입력(0) 가능</p>
            <div className="space-y-1">
              {[...puzzle.players]
                .sort((a, b) => (lockedRankings[a.id] ?? 99) - (lockedRankings[b.id] ?? 99))
                .map(p => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span className={`w-7 text-[11px] font-bold flex-shrink-0 text-center ${rankColor(lockedRankings[p.id] ?? 0).split(' ').find(c => c.startsWith('text-')) ?? 'text-muted-foreground'}`}>
                    {lockedRankings[p.id] !== undefined ? rankLabel(lockedRankings[p.id]) : '—'}
                  </span>
                  <span className="w-6 text-[10px] text-muted-foreground flex-shrink-0 font-semibold">{p.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={payoutInputs[p.id] ?? ''}
                    onChange={e => setPayoutInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="0"
                    data-testid={`input-payout-${p.id}`}
                    className="flex-1 bg-muted border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ))}
            </div>
            {sumMismatch && (
              <p className="mt-1.5 text-[11px] text-yellow-400 text-center" data-testid="sum-mismatch-warning">
                ⚠️ 합계 {inputSum.toLocaleString()} ≠ 팟 {contestedPotsTotal.toLocaleString()}
              </p>
            )}
            {!sumMismatch && inputSum === contestedPotsTotal && inputSum > 0 && (
              <p className="mt-1.5 text-[11px] text-green-400 text-center">✓ 합계 일치</p>
            )}
          </div>

          <button
            onClick={handlePayoutSubmit}
            data-testid="btn-submit"
            className="w-full py-3.5 rounded-xl font-bold text-base bg-green-600 hover:bg-green-500 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            최종 제출
          </button>
        </>
      )}

      {/* ══════════════════════════════════════════════
          RESULT / WRONG EXPLANATION
          ══════════════════════════════════════════════ */}
      {(phase === 'result' || phase === 'wrong') && lastResult && (
        <>
          {/* ── Wrong banner ── */}
          {phase === 'wrong' && (
            <div className="mb-3 rounded-xl px-4 py-3 flex items-center gap-3 border bg-red-500/10 border-red-500/30">
              <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
                <span className="text-red-400 font-black text-xl">✗</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-red-400">오답</p>
                <p className="text-xs text-red-300/70 mt-0.5">
                  {lastResult.wrongStep === 'ranking' && '1단계 핸드 순위가 틀렸습니다'}
                  {lastResult.wrongStep === 'pot' && '2단계 팟 금액이 틀렸습니다'}
                  {lastResult.wrongStep === 'payout' && '3단계 수령 칩이 틀렸습니다'}
                </p>
                {(lastResult.brokenStreak ?? 0) >= 2 && (
                  <p className="text-xs text-orange-400 mt-1">🔥 {lastResult.brokenStreak}연속 스트릭이 끊겼습니다</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">+0점</span>
            </div>
          )}

          {/* ── Result banner ── */}
          {phase === 'result' && (
            <div className={`mb-3 rounded-xl px-4 py-3 flex items-center gap-3 border ${
              lastResult.correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                lastResult.correct ? 'bg-green-500/20 border border-green-500/40' : 'bg-red-500/20 border border-red-500/40'
              }`}>
                {lastResult.correct
                  ? <CheckCircle className="w-5 h-5 text-green-400" />
                  : <span className="text-red-400 font-bold text-lg">✗</span>}
              </div>
              <div className="flex-1">
                <p className={`font-bold text-sm ${lastResult.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {lastResult.correct ? '완벽 정답!' : lastResult.rankingCorrect ? '순위만 정답' : '오답'}
                </p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${lastResult.rankingCorrect ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    순위 {lastResult.rankingCorrect ? '✓' : '✗'}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${lastResult.payoutScore === 100 ? 'bg-green-500/10 text-green-400' : lastResult.payoutScore > 0 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                    팟 분배 {lastResult.payoutScore}%
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${lastResult.passed ? 'bg-green-500/15 text-green-300' : 'bg-red-500/10 text-red-400'}`}>
                    ⏱ {Math.floor(lastResult.elapsed)}초{lastResult.passed ? ' 합격' : ' 초과'}
                    {lastResult.timeScore != null && (
                      <span className="ml-1">({lastResult.timeScore >= 0 ? '+' : ''}{lastResult.timeScore}pt)</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">+{lastResult.points}점</p>
                <p className="text-lg font-bold text-white">{score}</p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4 mb-4 max-h-[240px] overflow-y-auto">
            <h3 className="text-sm font-bold text-foreground mb-3">해설</h3>

            {/* Correct ranking list */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">정답 순위</p>
              <div className="space-y-1.5">
                {[...puzzle.players]
                  .sort((a, b) => lastResult.answer.correctRanks[a.id] - lastResult.answer.correctRanks[b.id])
                  .map(p => {
                    const cr = lastResult.answer.correctRanks[p.id];
                    const nu = normalizeRanks(lastResult.userRankings);
                    const nc = normalizeRanks(lastResult.answer.correctRanks);
                    const rankOk = nu[p.id] === nc[p.id];
                    return (
                      <div key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${rankColor(cr)}`}>
                        <span className="text-base flex-shrink-0">{RANK_EMOJI[cr] ?? `${cr}위`}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold">{p.name}</span>
                          <span className="text-xs opacity-70 ml-2">{lastResult.answer.handMap[p.id]?.descriptionKo}</span>
                        </div>
                        <span className={`text-xs font-bold ${rankOk ? 'text-green-400' : 'text-red-400'}`}>
                          {rankOk ? '✓' : '✗'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Pot breakdown — with calculation formula */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">팟 계산</p>
              <div className="space-y-2">
                {lastResult.answer.potResults.map((pr, i) => {
                  const isMain = pr.pot.type === 'main';
                  const isAutoReturn = pr.pot.eligible.length < 2;
                  const deadMoney = isMain ? bbaAdjusted(puzzle).deadMoney : 0;
                  // Net player contributions (excluding dead money) for formula display
                  const playerAmount = pr.pot.amount - deadMoney;
                  const perContrib = pr.pot.eligible.length > 0 && playerAmount > 0
                    ? Math.round(playerAmount / pr.pot.eligible.length)
                    : 0;
                  const eligibleNames = pr.pot.eligible.map(id => puzzle.players.find(pp => pp.id === id)?.name ?? id);

                  // 1-eligible side pot: show as auto-return (no formula needed)
                  if (isAutoReturn) {
                    const returnName = eligibleNames[0] ?? '?';
                    return (
                      <div key={i} className="rounded-xl border border-border/40 overflow-hidden opacity-70">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40">
                          <span className="text-xs font-bold text-muted-foreground">{pr.pot.label}</span>
                          <span className="text-sm font-bold text-muted-foreground">{pr.pot.amount.toLocaleString()}칩</span>
                        </div>
                        <div className="px-3 py-1.5 bg-card/40 text-xs text-muted-foreground italic">
                          {returnName}에게 자동 반환 (유효 스택 초과분)
                        </div>
                      </div>
                    );
                  }

                  // For step-2 wrong: look up user's input for this pot
                  const userPotAmt = lastResult.userPotInputs?.[pr.pot.label];
                  const potWrong = lastResult.wrongStep === 'pot' && userPotAmt !== undefined;
                  const potInputCorrect = potWrong && Math.abs(userPotAmt! - pr.pot.amount) <= 1;

                  return (
                    <div key={i} className={`rounded-xl border overflow-hidden ${isMain ? 'border-blue-500/30' : 'border-purple-500/30'}`}>
                      {/* Header */}
                      <div className={`flex items-center justify-between px-3 py-1.5 ${isMain ? 'bg-primary/10' : 'bg-accent/10'}`}>
                        <span className={`text-xs font-bold ${isMain ? 'text-primary' : 'text-purple-400'}`}>
                          {pr.pot.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {potWrong && !potInputCorrect && (
                            <span className="text-xs font-bold text-red-400 line-through opacity-80">
                              {(userPotAmt ?? 0).toLocaleString()}
                            </span>
                          )}
                          {potWrong && potInputCorrect && (
                            <span className="text-xs font-bold text-green-400">
                              {(userPotAmt ?? 0).toLocaleString()}
                            </span>
                          )}
                          <span className={`text-sm font-bold ${potWrong && !potInputCorrect ? 'text-green-400' : 'text-foreground'}`}>
                            {pr.pot.amount.toLocaleString()}칩{potWrong && !potInputCorrect ? ' ✓' : ''}
                          </span>
                        </div>
                      </div>
                      {/* Calculation formula */}
                      <div className="px-3 py-2 bg-card/60 border-b border-border/40">
                        <div className="flex items-center gap-1 flex-wrap text-xs">
                          <span className="text-muted-foreground">참여자:</span>
                          {eligibleNames.map((n, j) => (
                            <span key={j} className="text-foreground font-semibold">{n}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs font-mono flex-wrap">
                          <span className="text-muted-foreground">{pr.pot.eligible.length}명</span>
                          <span className="text-muted-foreground">×</span>
                          <span className="text-yellow-300 font-bold">{perContrib.toLocaleString()}칩</span>
                          {deadMoney > 0 && (
                            <>
                              <span className="text-muted-foreground">+</span>
                              <span className="text-orange-400 font-bold">{deadMoney.toLocaleString()}칩</span>
                              <span className="text-orange-400/60 text-[10px]">(데드머니)</span>
                            </>
                          )}
                          <span className="text-muted-foreground">=</span>
                          <span className="text-white font-bold">{pr.pot.amount.toLocaleString()}칩</span>
                        </div>
                      </div>
                      {/* Winner */}
                      <div className="px-3 py-2 bg-muted/30 flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground text-xs">→ 승리:</span>
                        {pr.winners.map(id => {
                          const p = puzzle.players.find(pp => pp.id === id);
                          return (
                            <span key={id} className="flex items-center gap-1 text-xs">
                              <span className="text-yellow-400 font-bold">{p?.name ?? id}</span>
                              <span className="text-muted-foreground">({lastResult.answer.handMap[id]?.descriptionKo})</span>
                            </span>
                          );
                        })}
                        {pr.winners.length > 1 && <span className="text-muted-foreground text-xs">· 공동 분배</span>}
                        <span className="ml-auto text-green-400 font-bold text-xs">+{pr.perWinner.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payout comparison */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">최종 수령 칩 비교</p>
              <div className="grid grid-cols-2 gap-1.5">
                {puzzle.players.map(p => {
                  const correct = Math.abs((lastResult.userPayouts[p.id] ?? 0) - (lastResult.answer.playerPayouts[p.id] ?? 0)) <= 1;
                  const correctAmt = lastResult.answer.playerPayouts[p.id] ?? 0;
                  const userAmt = lastResult.userPayouts[p.id] ?? 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1.5">
                      <span className="text-xs text-muted-foreground">{p.name}</span>
                      <div className="flex items-center gap-1">
                        {!correct && <span className="text-xs text-red-400">{userAmt.toLocaleString()}→</span>}
                        <span className={`text-xs font-bold ${correctAmt > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                          {correctAmt.toLocaleString()}
                        </span>
                        <span className={`text-xs ${correct ? 'text-green-400' : 'text-red-400'}`}>
                          {correct ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleQuit}
              data-testid="btn-home"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:border-input hover:text-foreground font-semibold transition-all"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              data-testid="btn-next"
              className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
            >
              다음 문제
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

    </div>
  );
}
