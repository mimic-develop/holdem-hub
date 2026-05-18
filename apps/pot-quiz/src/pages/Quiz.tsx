import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { SubAppHeader } from '@hh/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { calcStreakBonus, STEP1_PTS, STEP2_PTS, STEP3_PTS } from '@hh/poker-engine';
import { POT_QUIZ_PASS_SECONDS as PASS_SECONDS, calcTimeScore } from '../lib/timing';
import TimerBar from '../components/TimerBar';
import PokerTable from '../components/PokerTable';
import RankingPhase from '../components/RankingPhase';
import FormingPhase from '../components/FormingPhase';
import AwardingPhase from '../components/AwardingPhase';
import PotArea from '../components/PotArea';
import NarrationToast from '../components/NarrationToast';
import ResultPanel from '../components/ResultPanel';
import FlyingChipsLayer, { type Flight } from '../components/FlyingChipsLayer';
import DropAmountModal from '../components/DropAmountModal';
import { bbaAdjusted, computeAnswer, rankingsMatch, type LastResult, type Phase } from '../lib/game-logic';
import { usePotFlow } from '../hooks/usePotFlow';
import { playChipMove, playDeadMerge, playError, playWin, isMuted, toggleMuted } from '../lib/sound';
import type { FlowStep } from '../lib/derive-flow';
import type { Puzzle, Difficulty } from '../types/poker';
import { getPuzzlesByDifficulty, shufflePuzzles, randomizeStacksForPuzzle, randomizeCardsForPuzzle } from '../data/puzzles';

function rectCenter(el: Element | null): { x: number; y: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function buildFlightsForStep(
  step: FlowStep,
  awardedPots: Record<number, { winners: string[]; amount: number }>,
  nextId: () => number,
): Flight[] {
  const out: Flight[] = [];
  if (step.kind === 'shortStack') {
    const to = rectCenter(document.querySelector(`[data-flying-id="pot-${step.potIndex}"]`));
    if (!to) return out;
    step.eligible.forEach((seatId, i) => {
      const from = rectCenter(document.querySelector(`[data-flying-id="seat-${seatId}"]`));
      if (!from) return;
      out.push({
        id: nextId(),
        fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
        amount: step.perSeatAmount,
        tone: 'seat-to-pot',
        delay: i * 55,
      });
    });
  } else if (step.kind === 'deadMoney') {
    const from = rectCenter(document.querySelector('[data-flying-id="dead-money"]'));
    const to = rectCenter(document.querySelector('[data-flying-id="pot-0"]'));
    if (!from || !to) return out;
    out.push({
      id: nextId(),
      fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
      amount: step.amount,
      tone: 'dead-to-pot',
    });
  } else if (step.kind === 'awarding') {
    const from = rectCenter(document.querySelector(`[data-flying-id="pot-${step.potIndex}"]`));
    if (!from) return out;
    const award = awardedPots[step.potIndex];
    const winners = award?.winners ?? step.correctWinners;
    const total = award?.amount ?? step.pot.amount;
    const per = Math.floor(total / winners.length);
    winners.forEach((winnerId, i) => {
      const to = rectCenter(document.querySelector(`[data-flying-id="seat-${winnerId}"]`));
      if (!to) return;
      out.push({
        id: nextId(),
        fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
        amount: per,
        tone: 'pot-to-seat',
        delay: i * 80,
      });
    });
  }
  // autoReturn은 비행 없음 — 잉여 칩은 receiver 좌석에 처음부터 남아 있던 베팅 분량이라
  // 어디서도 옮겨오지 않는다. (좌석 강조는 NarrationToast / PracticeGuide 설명으로 처리)
  return out;
}

export interface QuizProps {
  /**
   * 'game' (기본) — 점수/타이머/저장 모두 활성, 챌린지 모드.
   * 'practice' — 점수/타이머/저장 비활성, 자유 연습 (PR7c에서 'why' 카드 + 힌트 노출).
   */
  mode?: 'game' | 'practice';
}

export default function Quiz({ mode = 'game' }: QuizProps = {}) {
  const { difficulty } = useParams<{ difficulty: Difficulty }>();
  const [, setLocation] = useLocation();
  const isPractice = mode === 'practice';

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

  const [rankAssignments, setRankAssignments] = useState<Record<string, number>>({});
  const [lockedRankings, setLockedRankings] = useState<Record<string, number>>({});

  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [hintActive, setHintActive] = useState(false);

  // 게임 모드 도파민 — sub-step 빠른 정답 보너스 + 콤보
  const [combo, setCombo] = useState(0);
  const [floatingBonus, setFloatingBonus] = useState<{ amount: number; combo: number; ts: number } | null>(null);
  const subStepStartTimeRef = useRef<number>(performance.now());

  // Narration 토스트 — 정답 직후 1.8초간 명시적 설명 표시 (학습 보조)
  const [narrationVisible, setNarrationVisible] = useState(false);

  // Flying chips — 좌석/팟/데드머니 간 칩 이동 시각화
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightIdRef = useRef(0);
  const [muted, setMutedState] = useState(isMuted());

  // 클릭→클릭 워크플로우 state
  //  - forming.shortStack: 좌석 선택 → 팟 선택 → 액수 입력 모달
  //  - awarding: 팟 선택 → 좌석 선택 (다중은 토글 + 확정)
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [selectedPot, setSelectedPot] = useState<number | null>(null);
  const [dropModal, setDropModal] = useState<{
    seatId: string;
    potDropId: string;
    seatName: string;
    potLabel: string;
  } | null>(null);

  const lastClickedSeatRef = useRef<string | null>(null);

  const puzzle = puzzles[index];

  const flow = usePotFlow(puzzle);

  useEffect(() => {
    setPhase('ranking');
    setRankAssignments({});
    setLockedRankings({});
    setTimerRunning(true);
    setTimerKey(k => k + 1);
    elapsedRef.current = 0;
    isSubmittingRef.current = false;
    setLastResult(null);
    setHintActive(false);
    setCombo(0);
    setFloatingBonus(null);
    setNarrationVisible(false);
    flow.reset();
    lastClickedSeatRef.current = null;
    subStepStartTimeRef.current = performance.now();
    setSelectedSeat(null);
    setSelectedPot(null);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // stepIndex가 변할 때마다 selectedPot 자동 reset.
  // (이전: kind !== 'awarding' 일 때만 reset 했는데, awarding → awarding 전환 시 잔존해서 사이드팟 진행 막힘)
  useEffect(() => {
    setSelectedPot(null);
  }, [flow.state.stepIndex]);

  // autoReturn step 도달 시 0.8초 후 자동 진행
  useEffect(() => {
    if (phase !== 'pot') return;
    if (flow.step?.kind !== 'autoReturn') return;
    const id = setTimeout(() => flow.advanceAutoReturn(), 800);
    return () => clearTimeout(id);
  }, [phase, flow.step, flow.advanceAutoReturn]);

  /**
   * 게임 모드 sub-step 도파민:
   * 사용자 액션으로 stepIndex가 증가했을 때 (lastSuccessAt 변화) 진입 시간 대비 elapsed 계산 →
   * 빠르면 보너스 점수 + 콤보 증가. 화면에 floating "+XX"으로 표시.
   * Practice 모드에서는 floating 효과만 표시(점수 0).
   */
  useEffect(() => {
    if (phase !== 'pot') return;
    if (flow.state.lastSuccessAt === 0) return;
    const now = performance.now();
    const elapsed = (now - subStepStartTimeRef.current) / 1000;
    subStepStartTimeRef.current = now;

    if (isPractice) {
      setCombo(c => c + 1);
      return;
    }

    const base = Math.max(0, Math.round(20 - elapsed * 2));
    const newCombo = combo + 1;
    const mult = newCombo >= 5 ? 2 : newCombo >= 3 ? 1.5 : 1;
    const bonus = Math.round(base * mult);
    if (bonus > 0) {
      setScore(s => s + bonus);
      setFloatingBonus({ amount: bonus, combo: newCombo, ts: now });
    }
    setCombo(newCombo);
  }, [flow.state.lastSuccessAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // 오답 시 콤보 리셋 + 오답 사운드
  useEffect(() => {
    if (flow.state.errorTick === 0) return;
    setCombo(0);
    playError();
  }, [flow.state.errorTick]);

  // floating 토스트 1.5초 후 자동 제거
  useEffect(() => {
    if (!floatingBonus) return;
    const id = setTimeout(() => setFloatingBonus(null), 1500);
    return () => clearTimeout(id);
  }, [floatingBonus]);

  // Narration: stepIndex 증가(=정답으로 step 넘어감)마다 1.8초 표시
  useEffect(() => {
    if (phase !== 'pot') return;
    if (flow.state.stepIndex === 0) return;
    setNarrationVisible(true);
    const id = setTimeout(() => setNarrationVisible(false), 1800);
    return () => clearTimeout(id);
  }, [phase, flow.state.stepIndex]);

  // stepIndex 증가 → 직전 정답 step에 맞춰 칩 비행 + 사운드 발사
  useEffect(() => {
    if (phase !== 'pot') return;
    const step = flow.state.lastSuccessStep as FlowStep | null;
    if (!step) return;
    // DOM rect 측정은 다음 paint 후가 안전 (좌석/팟 위치 안정화)
    const raf = requestAnimationFrame(() => {
      const newFlights = buildFlightsForStep(step, flow.state.awardedPots, () => ++flightIdRef.current);
      if (newFlights.length > 0) setFlights(prev => [...prev, ...newFlights]);
      if (step.kind === 'deadMoney') playDeadMerge();
      else playChipMove();
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, flow.state.stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFlightComplete = useCallback((id: number) => {
    setFlights(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleMuteToggle = useCallback(() => {
    const m = toggleMuted();
    setMutedState(m);
  }, []);

  // 모든 forming + awarding 완료 시 자동으로 결과 산출
  const finalizeResult = useCallback(() => {
    if (!puzzle) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setTimerRunning(false);

    const answer = computeAnswer(puzzle);
    const elapsed = elapsedRef.current;
    const passed = elapsed <= PASS_SECONDS;
    const hadError = flow.state.hadAnyError;

    // chipsAtSeat 에는 awarding 으로 인해 받은 칩이 적립되어 있음. 그러나 베팅 칩 환불 분량도 있음.
    // 정답으로 끝났으면 awardedPots[i] 의 winners[]에 분배된 액수가 곧 userPayouts.
    const userPayouts: Record<string, number> = {};
    for (const p of puzzle.players) userPayouts[p.id] = 0;
    for (const award of Object.values(flow.state.awardedPots)) {
      const per = Math.floor(award.amount / award.winners.length);
      const rem = award.amount - per * award.winners.length;
      award.winners.forEach((id, i) => {
        userPayouts[id] = (userPayouts[id] ?? 0) + per + (i === 0 ? rem : 0);
      });
    }

    if (hadError) {
      const broken = streak;
      if (!isPractice) setStreak(0);
      setLastResult({
        correct: false,
        rankingCorrect: true,
        payoutScore: 0,
        points: 0,
        answer,
        userPayouts,
        userRankings: lockedRankings,
        elapsed,
        passed,
        wrongStep: flow.state.firstErrorKind ?? 'awarding',
        brokenStreak: broken,
      });
      setPhase('wrong');
      return;
    }

    if (isPractice) {
      // Practice 모드: 점수/스트릭/저장 없음. 정답 결과만 표시.
      setLastResult({
        correct: true,
        rankingCorrect: true,
        payoutScore: 100,
        points: 0,
        answer,
        userPayouts,
        userRankings: lockedRankings,
        elapsed,
        passed: true,
      });
      setPhase('result');
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

    setLastResult({
      correct: true,
      rankingCorrect: true,
      payoutScore: 100,
      points,
      answer,
      userPayouts,
      userRankings: lockedRankings,
      elapsed,
      passed,
      timeScore,
    });
    setPhase('result');
    playWin();
  }, [puzzle, flow.state.hadAnyError, flow.state.awardedPots, flow.state.firstErrorKind, streak, maxStreak, score, lockedRankings, difficulty, isPractice]);

  // 시퀀스 완료 시 결과 산출
  useEffect(() => {
    if (phase !== 'pot') return;
    if (flow.isComplete) finalizeResult();
  }, [phase, flow.isComplete, finalizeResult]);

  const handleTimerTick = useCallback((elapsed: number) => {
    elapsedRef.current = elapsed;
  }, []);

  // 팟 클릭 핸들러 — forming.shortStack 과 awarding 둘 다 사용
  const handlePotClick = useCallback((potDropId: string) => {
    if (phase !== 'pot') return;
    const potIdx = Number(potDropId.slice(4));

    // forming.shortStack: 좌석 먼저 선택 후 팟 클릭 → 액수 입력 모달
    if (flow.step?.kind === 'shortStack') {
      if (!selectedSeat) return;
      const seatName = puzzle?.players.find(p => p.id === selectedSeat)?.name ?? selectedSeat;
      const pot = flow.flow?.pots[potIdx];
      setDropModal({
        seatId: selectedSeat,
        potDropId,
        seatName,
        potLabel: pot?.label ?? potDropId,
      });
      return;
    }

    // awarding: 활성 팟(step.potIndex)만 클릭 효력 — 다른 팟은 무시
    if (flow.step?.kind === 'awarding') {
      if (potIdx === flow.step.potIndex) setSelectedPot(potIdx);
      return;
    }
  }, [phase, flow.step, flow.flow, selectedSeat, puzzle]);

  // 모달 액수 확정
  const handleDropConfirm = useCallback((amount: number) => {
    if (!dropModal) return;
    flow.submitDragShortStack(dropModal.seatId, dropModal.potDropId, amount);
    setDropModal(null);
    setSelectedSeat(null);
  }, [dropModal, flow]);

  const handleDropCancel = useCallback(() => {
    setDropModal(null);
  }, []);

  const handleSeatClick = useCallback((id: string) => {
    if (phase === 'ranking') {
      setRankAssignments(prev => {
        const currentSlot = prev[id];
        const maxSlot = Math.max(0, ...Object.values(prev));

        if (currentSlot === undefined) {
          return { ...prev, [id]: maxSlot + 1 };
        }

        if (currentSlot > 1) {
          return { ...prev, [id]: currentSlot - 1 };
        }

        const next = { ...prev };
        delete next[id];
        const slot1Empty = !Object.values(next).some(s => s === 1);
        if (slot1Empty) {
          return Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v - 1]));
        }
        return next;
      });
      return;
    }

    if (phase === 'pot') {
      lastClickedSeatRef.current = id;
      // forming.shortStack: 좌석 클릭으로 선택 (다음에 팟 클릭으로 액수 모달 오픈)
      if (flow.step?.kind === 'shortStack') {
        setSelectedSeat(prev => (prev === id ? null : id));
        return;
      }
      // awarding: selectedPot이 step.potIndex와 일치해야 좌석 클릭이 효력 (팟 먼저 클릭 후 좌석)
      if (flow.step?.kind === 'awarding') {
        if (selectedPot === flow.step.potIndex) {
          flow.clickSeat(id);
        }
        return;
      }
      flow.clickSeat(id);
    }
  }, [phase, flow, selectedPot]);

  const handleDeadMoneyClick = useCallback(() => {
    if (phase !== 'pot') return;
    flow.clickDeadMoney();
  }, [phase, flow]);

  const handleConfirmAwarding = useCallback(() => {
    if (phase !== 'pot') return;
    flow.confirmAwarding();
  }, [phase, flow]);

  const handleRankingSubmit = useCallback(() => {
    if (phase !== 'ranking') return;

    const answer = computeAnswer(puzzle);

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
      if (!isPractice) setStreak(0);
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
  }, [phase, puzzle, rankAssignments, streak]);

  const handleNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= puzzles.length - 2) {
      setPuzzles(prev => [...prev, ...makeBatch()]);
    }
    setIndex(nextIndex);
  };

  const handleQuit = () => {
    if (isPractice) {
      setLocation('/');
      return;
    }
    setLocation(`/summary/${difficulty}`, {
      state: {
        score: scoreRef.current,
        streak: maxStreakRef.current,
        correctCount: correctCountRef.current,
        totalAnswered: index + 1,
      },
    });
  };

  // PokerTable highlight / 활성 영역 계산
  // 게임 모드: 정답 미리 노출 X (학습 부담은 SeatChipTower 시각 비교로 해결).
  // 학습 모드: 'hintActive' 토글 시에만 정답 좌석 강조.
  const activeStep = phase === 'pot' ? flow.step : null;
  const highlightSeatIds = useMemo(() => {
    if (!activeStep || !isPractice || !hintActive) return [];
    if (activeStep.kind === 'shortStack') return activeStep.correctSeatIds;
    if (activeStep.kind === 'awarding') return activeStep.correctWinners;
    return [];
  }, [activeStep, isPractice, hintActive]);

  const activePotIndex = activeStep
    ? activeStep.kind === 'shortStack' || activeStep.kind === 'awarding' || activeStep.kind === 'autoReturn'
      ? activeStep.potIndex
      : -1
    : -1;
  const deadMoneyActive = activeStep?.kind === 'deadMoney';

  if (!puzzle) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">문제가 없습니다.</div>;
  }

  const { deadMoney: adjDeadMoney } = bbaAdjusted(puzzle);

  // forming/awarding 단계에서 좌석에 표시할 chipsAtSeat
  const chipsAtSeatForTable = phase === 'pot' ? flow.state.chipsAtSeat : undefined;
  const chipsAtDeadMoneyForTable = phase === 'pot' ? flow.state.chipsAtDeadMoney : undefined;
  const selectedSeatIds = activeStep?.kind === 'awarding'
    ? flow.state.awardingSelection
    : activeStep?.kind === 'shortStack' && selectedSeat
      ? [selectedSeat]
      : [];

  return (
    <div
      className="pot-quiz-ingame overflow-hidden bg-background text-foreground flex flex-col"
      style={{
        height: 'calc(100dvh - 52px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <SubAppHeader
        title="Pot Split"
        belowHubNavbar={false}
        className="!bg-[rgba(10,10,10,0.96)] !border-b-[rgba(168,0,20,0.2)] [&_h1]:!text-[#FAFAF8]"
        left={
          <button
            onClick={handleQuit}
            data-testid="btn-back"
            aria-label="뒤로"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: '#FAFAF8' }} />
          </button>
        }
        right={
          <div className="flex items-center gap-2">
            {!isPractice && (
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: '#FAFAF8' }}
                data-testid="score-display"
              >
                {score}
              </span>
            )}
            {isPractice && (
              <span className="text-[10px] font-semibold text-blue-300">📘</span>
            )}
            <button
              onClick={handleMuteToggle}
              data-testid="btn-mute"
              aria-label={muted ? '음소거 해제' : '음소거'}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              {muted
                ? <VolumeX className="w-4 h-4" style={{ color: '#FAFAF8' }} />
                : <Volume2 className="w-4 h-4" style={{ color: '#FAFAF8' }} />}
            </button>
          </div>
        }
      />

      <div
        className="flex flex-col mx-auto px-4 max-w-[430px] flex-1 min-h-0 w-full"
        style={{ gap: 'clamp(8px, 1.5vh, 16px)', paddingTop: 'clamp(8px, 1.5vh, 16px)' }}
      >
      {/* ── STATUS row: TimerBar만 (게임 모드 + ranking/pot phase일 때) ── flex-none, 얇은 한 줄 */}
      {!isPractice && (phase === 'ranking' || phase === 'pot') && (
        <div className="flex-none relative">
          <TimerBar
            key={timerKey}
            passSeconds={PASS_SECONDS}
            onTick={handleTimerTick}
            running={timerRunning}
          />
          {/* Floating bonus toast — sub-step 빠른 정답 보너스 (게임 모드) */}
          <AnimatePresence>
            {floatingBonus && (
              <motion.div
                key={floatingBonus.ts}
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: -14, scale: 1 }}
                exit={{ opacity: 0, y: -22 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute -top-1 right-0 text-xs font-extrabold text-yellow-300 pointer-events-none drop-shadow"
                data-testid="floating-bonus"
              >
                +{floatingBonus.amount}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── BOARD: 테이블 + 팟 + 나레이션 ── flex-1 가변, 단 하단이 viewport 70% 를 넘지 않도록 cap.
          124px = Hub Navbar(52) + SubAppHeader(52) + status row(~20).
          paddingTop 32px → 좌석 ellipse 가 PokerTable 위로 ~5% 튀어나가는 분량 흡수, 헤더 침범 방지. */}
      <div
        className="flex-1 min-h-0 flex flex-col relative"
        style={{ maxHeight: 'calc(70dvh - 124px)', paddingTop: 32 }}
      >
      <PokerTable
        puzzle={puzzle}
        phase={phase}
        rankAssignments={rankAssignments}
        lockedRankings={lockedRankings}
        lastResult={lastResult}
        adjDeadMoney={adjDeadMoney}
        onSeatClick={handleSeatClick}
        chipsAtSeat={chipsAtSeatForTable}
        chipsAtDeadMoney={chipsAtDeadMoneyForTable}
        deadMoneyActive={deadMoneyActive}
        onDeadMoneyClick={handleDeadMoneyClick}
        highlightSeatIds={highlightSeatIds}
        selectedSeatIds={selectedSeatIds}
        shakeTick={flow.state.errorTick}
        shakeSeatId={lastClickedSeatRef.current}
      />

      {phase === 'pot' && flow.flow && narrationVisible && (
        <NarrationToast
          step={flow.state.lastSuccessStep}
          tick={flow.state.stepIndex}
          puzzle={puzzle}
        />
      )}
      </div>
      {/* ── /BOARD ── */}

      {/* ── CONTROLS: PotArea 는 외부 wrapper (overflow visible) 에서 marginTop:-10 으로 위로 띄움.
          phase panel 만 내부 wrapper 에서 max-h + scroll 적용. mt-auto 로 inner 하단 고정. */}
      <div className="flex-none mt-auto pb-5">
      {phase === 'pot' && flow.flow && (
        <div style={{ marginTop: -10, marginBottom: 15 }}>
          <PotArea
            pots={flow.flow.pots}
            formedAmounts={flow.state.formedPots}
            activePotIndex={activePotIndex}
            selectedPotIndex={selectedPot}
            onPotClick={
              (flow.step?.kind === 'shortStack' && selectedSeat) ||
              (flow.step?.kind === 'awarding' && selectedPot === null)
                ? handlePotClick
                : undefined
            }
          />
        </div>
      )}
      <div className="max-h-[40dvh] overflow-y-auto">

      {phase === 'ranking' && (
        <RankingPhase
          puzzle={puzzle}
          rankAssignments={rankAssignments}
          onReset={() => setRankAssignments({})}
          onSubmit={handleRankingSubmit}
        />
      )}

      {phase === 'pot' && activeStep?.kind !== 'awarding' && (
        <FormingPhase
          puzzle={puzzle}
          lockedRankings={lockedRankings}
          step={flow.step}
          errorTick={flow.state.errorTick}
          errorReason={flow.state.errorReason}
          isPractice={isPractice}
          hintActive={hintActive}
          onToggleHint={() => setHintActive(v => !v)}
        />
      )}

      {phase === 'pot' && activeStep?.kind === 'awarding' && (
        <AwardingPhase
          puzzle={puzzle}
          lockedRankings={lockedRankings}
          step={flow.step}
          awardingSelection={flow.state.awardingSelection}
          onConfirm={handleConfirmAwarding}
          errorTick={flow.state.errorTick}
          errorReason={flow.state.errorReason}
          isPractice={isPractice}
          hintActive={hintActive}
          onToggleHint={() => setHintActive(v => !v)}
          potSelected={selectedPot !== null && activeStep.kind === 'awarding' && selectedPot === activeStep.potIndex}
        />
      )}

      {(phase === 'result' || phase === 'wrong') && lastResult && (
        <ResultPanel
          phase={phase}
          lastResult={lastResult}
          puzzle={puzzle}
          score={score}
          onQuit={handleQuit}
          onNext={handleNext}
        />
      )}
      </div>
      </div>
      {/* ── /CONTROLS ── */}

      {/* 좌석/팟/데드머니 사이 칩 비행 시각화 — viewport 전체 절대 레이어 */}
      <FlyingChipsLayer flights={flights} onComplete={handleFlightComplete} />

      {/* 좌석→팟 클릭 후 액수 입력 모달 */}
      <DropAmountModal
        open={!!dropModal}
        fromSeatName={dropModal?.seatName ?? ''}
        toPotLabel={dropModal?.potLabel ?? ''}
        onConfirm={handleDropConfirm}
        onCancel={handleDropCancel}
      />
      </div>
    </div>
  );
}
