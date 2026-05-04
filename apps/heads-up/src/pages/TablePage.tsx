import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ActionBar } from '../components/table/ActionBar';
import { ActionToast } from '../components/table/ActionToast';
import { BetChip } from '../components/table/BetChip';
import { CommunityBoard } from '../components/table/CommunityBoard';
import { DecisionTimer } from '../components/table/DecisionTimer';
import { DealerButton } from '../components/table/DealerButton';
import { PotAwardAnimation } from '../components/table/PotAwardAnimation';
import { PlayerSeat } from '../components/table/PlayerSeat';
import { PokerTable } from '../components/table/PokerTable';
import { PotDisplay } from '../components/table/PotDisplay';
import { ConnectionStatusBanner } from '../components/table/ConnectionStatusBanner';
import { ChatToast } from '../components/table/ChatToast';
import { MatchmakingIntro } from '../components/table/MatchmakingIntro';
import { MatchEndOverlay } from '../components/table/MatchEndOverlay';
import { TurnBanner } from '../components/table/TurnBanner';
import { useDecisionTimer } from '../hooks/useDecisionTimer';
import { InGameSettingsModal } from '../components/common/InGameSettingsModal';
import { useGameStore } from '../store/game-store';
import { useSettings } from '../hooks/useSettings';
import {
  playYourTurnSound,
  playDealSound,
  playChipSound,
  playCheckSound,
  playFoldSound,
  playWinSound,
  playTickSound,
} from '../utils/audio';
import type { ActionRecord } from '../types/game';
import { AI_PERSONAS } from '../bot/personas';

export default function TablePage() {
  const navigate = useNavigate();
  const gameState = useGameStore((s) => s.gameState);
  const mode = useGameStore((s) => s.mode);
  const aiDifficulty = useGameStore((s) => s.aiDifficulty);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const opponentPlayerId = useGameStore((s) => s.opponentPlayerId);
  const opponentName = useGameStore((s) => s.opponentName);
  const isWaitingForBot = useGameStore((s) => s.isWaitingForBot);
  const isHandOver = useGameStore((s) => s.isHandOver);
  const lastResolution = useGameStore((s) => s.lastResolution);
  const handHistory = useGameStore((s) => s.handHistory);
  const handNumber = useGameStore((s) => s.handNumber);
  const showOpponentCards = useGameStore((s) => s.showOpponentCards);
  const getLegalActionsForMe = useGameStore((s) => s.getLegalActionsForMe);
  const applyMyAction = useGameStore((s) => s.applyMyAction);
  const startNextHand = useGameStore((s) => s.startNextHand);
  const resetGame = useGameStore((s) => s.resetGame);
  const leaveRemoteGame = useGameStore((s) => s.leaveRemoteGame);

  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const pingMs = useGameStore((s) => s.pingMs);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const deckVerificationFailed = useGameStore((s) => s.deckVerificationFailed);
  const opponentLeft = useGameStore((s) => s.opponentLeft);
  const isSendingAction = useGameStore((s) => s.isSendingAction);
  const sendChat = useGameStore((s) => s.sendChat);
  const isIntroPlaying = useGameStore((s) => s.isIntroPlaying);
  const setIntroComplete = useGameStore((s) => s.setIntroComplete);
  const matchTotalHands = useGameStore((s) => s.matchTotalHands);
  const currentHandInMatch = useGameStore((s) => s.currentHandInMatch);
  const isMatchOver = useGameStore((s) => s.isMatchOver);
  const startingStackBB = useGameStore((s) => s.startingStackBB);
  const myTimebanksLeft = useGameStore((s) => s.myTimebanksLeft);
  const useMyTimebank = useGameStore((s) => s.useMyTimebank);
  const aiPersona = useGameStore((s) => s.aiPersona);
  const startRematch = useGameStore((s) => s.startRematch);

  const opponentAvatarSrc = mode === 'AI' ? AI_PERSONAS[aiPersona]?.avatarSrc : undefined;

  const { settings } = useSettings();
  const soundEnabled = settings.soundEnabled;
  const displayUnit = settings.displayUnit;

  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [turnBannerShow, setTurnBannerShow] = useState(false);

  // Track most-recent action per player for ActionToast — auto-clears after 1.4s.
  const [lastActionByPlayer, setLastActionByPlayer] = useState<Record<string, (ActionRecord & { isAllIn?: boolean; tick: number }) | undefined>>({});
  const seenHistoryLenRef = useRef(0);
  const handNumberRef = useRef(handNumber);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!gameState) return;

    // Reset on new hand.
    if (handNumberRef.current !== handNumber) {
      handNumberRef.current = handNumber;
      seenHistoryLenRef.current = 0;
      setLastActionByPlayer({});
    }

    const hist = gameState.history;
    if (hist.length <= seenHistoryLenRef.current) {
      seenHistoryLenRef.current = hist.length;
      return;
    }

    // Process newly added actions (could be multiple in one tick, e.g. forced moves).
    const newOnes = hist.slice(seenHistoryLenRef.current);
    seenHistoryLenRef.current = hist.length;

    setLastActionByPlayer((prev) => {
      const next = { ...prev };
      for (const rec of newOnes) {
        const actor = gameState.players.find((p) => p.id === rec.playerId);
        const isAllIn = !!actor && actor.stack === 0 && (rec.action === 'bet' || rec.action === 'raise' || rec.action === 'call');
        tickRef.current += 1;
        next[rec.playerId] = { ...rec, isAllIn, tick: tickRef.current };
      }
      return next;
    });

    // Play sound for the most recent voluntary (non-blind) action.
    const last = newOnes[newOnes.length - 1];
    if (last) {
      switch (last.action) {
        case 'fold':
          playFoldSound(soundEnabled);
          break;
        case 'check':
          playCheckSound(soundEnabled);
          break;
        case 'call':
        case 'bet':
        case 'raise':
          playChipSound(soundEnabled);
          break;
        // 'sb' / 'bb' blinds: silent (would fire every hand start).
      }
    }
  }, [gameState, handNumber, soundEnabled]);

  // "내 차례" 배너 + 사운드 — isMyTurn 상승 엣지에 한 번씩.
  const isMyTurnLive =
    !!gameState && gameState.toActId === myPlayerId && !isHandOver && !isSendingAction;
  const prevMyTurnRef = useRef(false);
  useEffect(() => {
    if (isMyTurnLive && !prevMyTurnRef.current && !isIntroPlaying) {
      setTurnBannerShow(true);
      playYourTurnSound(soundEnabled);
      const t = window.setTimeout(() => setTurnBannerShow(false), 1500);
      prevMyTurnRef.current = true;
      return () => window.clearTimeout(t);
    }
    prevMyTurnRef.current = isMyTurnLive;
  }, [isMyTurnLive, isIntroPlaying, soundEnabled]);

  // Card dealing whoosh — every street advance (and once when intro completes).
  const prevStreetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState || isIntroPlaying) return;
    const street = gameState.street;
    if (prevStreetRef.current !== street) {
      // Skip the first observation right after intro to avoid double-trigger with handNumber init.
      if (prevStreetRef.current !== null) {
        playDealSound(soundEnabled);
      } else {
        // First mount post-intro: short whoosh for hole cards.
        playDealSound(soundEnabled);
      }
      prevStreetRef.current = street;
    }
  }, [gameState, isIntroPlaying, soundEnabled]);

  // Win/loss chime on hand resolution.
  const prevHandOverRef = useRef(false);
  useEffect(() => {
    if (isHandOver && !prevHandOverRef.current) {
      playWinSound(soundEnabled);
    }
    prevHandOverRef.current = isHandOver;
  }, [isHandOver, soundEnabled]);

  // Decision timer — only active in AI mode on my turn.
  const isTimerActive = mode === 'AI' && isMyTurnLive && !isHandOver && !isIntroPlaying;
  const { remaining: timerRemaining, maxTime: timerMaxTime } = useDecisionTimer({
    isActive: isTimerActive,
    timebanksLeft: myTimebanksLeft,
    onUsedTimebank: useMyTimebank,
    onExpire: () => {
      // Auto-check if possible, otherwise auto-fold.
      const legalNow = getLegalActionsForMe();
      if (legalNow?.canCheck) {
        applyMyAction('check');
      } else {
        applyMyAction('fold');
      }
    },
  });

  // Timer tick sound — once per whole second during the last 5 seconds.
  const prevTimerCeilRef = useRef<number>(0);
  useEffect(() => {
    if (!isTimerActive) {
      prevTimerCeilRef.current = 0;
      return;
    }
    const ceil = Math.ceil(timerRemaining);
    if (ceil !== prevTimerCeilRef.current && ceil <= 5 && ceil > 0) {
      playTickSound(soundEnabled);
    }
    prevTimerCeilRef.current = ceil;
  }, [timerRemaining, isTimerActive, soundEnabled]);

  // Auto-clear toasts after 1.4s.
  useEffect(() => {
    const timers: number[] = [];
    Object.entries(lastActionByPlayer).forEach(([pid, rec]) => {
      if (!rec) return;
      const t = window.setTimeout(() => {
        setLastActionByPlayer((prev) => {
          // Only clear if it's still the same tick (avoid clobbering a newer action).
          if (prev[pid]?.tick !== rec.tick) return prev;
          return { ...prev, [pid]: undefined };
        });
      }, 1400);
      timers.push(t);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [lastActionByPlayer]);

  useEffect(() => {
    if (!gameState || !mode) {
      navigate('/', { replace: true });
    }
  }, [gameState, mode, navigate]);

  if (!gameState) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8" style={{ background: '#0a0a0a', color: '#e5e5e5' }}>
        <p>게임이 시작되지 않았습니다.</p>
      </main>
    );
  }

  const me = gameState.players.find((p) => p.id === myPlayerId);
  const opp = gameState.players.find((p) => p.id === opponentPlayerId);
  if (!me || !opp) return null;

  const isMyTurn = gameState.toActId === myPlayerId && !isHandOver && !isSendingAction;
  const legal = isMyTurn ? getLegalActionsForMe() : null;

  const handleExit = () => {
    if (mode === 'REMOTE') {
      leaveRemoteGame();
    } else {
      resetGame();
    }
    navigate('/', { replace: true });
  };

  const onReturnHome = () => {
    if (mode === 'REMOTE') {
      leaveRemoteGame();
    } else {
      resetGame();
    }
    navigate('/', { replace: true });
  };

  // AI 모드에서는 persona displayName이 opponentName에 자동 설정되어 있음.
  // "스탠다드 · MEDIUM" 형식으로 노출하여 성향 + 난이도를 한눈에.
  const opponentLabel =
    mode === 'AI'
      ? `${opponentName || 'AI'} · ${aiDifficulty}`
      : opponentName
        ? `${opponentName}${pingMs !== null ? ` · ${pingMs}ms` : ''}`
        : '상대';

  // Dealer button is on SB in heads-up
  const dealerIsMe = me.position === 'SB';

  return (
    <main
      className="flex h-screen flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% 30%, #1a1a1a 0%, #0a0a0a 60%, #050505 100%)',
        color: '#e5e5e5',
      }}
    >
      {mode === 'REMOTE' && (
        <ConnectionStatusBanner
          status={connectionStatus}
          opponentLeft={opponentLeft}
          onReturnHome={onReturnHome}
        />
      )}

      {deckVerificationFailed && (
        <div className="bg-amber-900/70 px-4 py-1 text-center text-xs text-amber-200">
          ⚠ 덱 검증 실패 — 방장의 카드 생성과 실제 결과가 일치하지 않습니다.
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 text-sm">
        <button
          type="button"
          onClick={handleExit}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur hover:bg-white/10"
        >
          나가기
        </button>
        <div
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span className="text-white/60">Hand </span>
          {matchTotalHands > 0 ? (
            <span className="font-bold text-white">
              {currentHandInMatch}/{matchTotalHands}
            </span>
          ) : (
            <span className="font-bold text-white">#{handNumber}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="인게임 설정"
          className="flex h-7 w-[60px] items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs text-white/80 backdrop-blur hover:bg-white/10"
        >
          ⚙ 설정
        </button>
      </div>

      {/* Game area — 3-section flex column */}
      <div className="flex flex-1 flex-col min-h-0">

        {/* ── Opponent section ── */}
        <div
          className="relative flex justify-center px-2"
          style={{ zIndex: 20, minHeight: '124px', alignItems: 'flex-end' }}
        >
          <div className="relative flex flex-col items-center" style={{ marginBottom: '-32px' }}>
            {/* ActionToast above opponent */}
            <div className="h-7 flex items-end justify-center mb-0.5">
              <AnimatePresence>
                {lastActionByPlayer[opp.id] && (
                  <ActionToast
                    key={`opp-${lastActionByPlayer[opp.id]!.tick}`}
                    action={lastActionByPlayer[opp.id]!.action}
                    amount={lastActionByPlayer[opp.id]!.amount}
                    isAllIn={lastActionByPlayer[opp.id]!.isAllIn}
                    unit={displayUnit}
                  />
                )}
              </AnimatePresence>
            </div>
            <div className="relative">
              {/* Dealer button — right of opponent seat */}
              {!dealerIsMe && (
                <div className="absolute z-30" style={{ right: '-34px', bottom: '4px' }}>
                  <DealerButton />
                </div>
              )}
              <PlayerSeat
                player={opp}
                isMe={false}
                isToAct={gameState.toActId === opp.id && !isHandOver}
                isBotThinking={
                  (mode === 'AI' && isWaitingForBot && gameState.toActId === opp.id) ||
                  (mode === 'REMOTE' && gameState.toActId === opp.id && !isHandOver)
                }
                revealCards={showOpponentCards}
                label={opponentLabel}
                layout="avatar-top"
                cardBaseDelay={0}
                avatarSrc={opponentAvatarSrc}
              />
            </div>
          </div>
        </div>

        {/* ── Table section — flex-1 fills remaining height ── */}
        <div className="flex flex-1 items-center justify-center px-2" style={{ zIndex: 10 }}>
          <div className="relative w-full max-w-2xl">
            <PokerTable
              oppBet={opp.currentBet > 0 ? <BetChip amount={opp.currentBet} /> : undefined}
              myBet={me.currentBet > 0 ? <BetChip amount={me.currentBet} /> : undefined}
            >
              {/* 팟 표시 + 커뮤니티 카드를 하나의 단위로 중앙 배치 */}
              <div className="flex flex-col items-center gap-1.5">
                <PotDisplay pot={gameState.pot} street={gameState.street} />
                <CommunityBoard board={gameState.board} />
              </div>
            </PokerTable>

            {/* Pot award animation — fires when a hand ends, auto-advances to next hand */}
            <AnimatePresence>
              {isHandOver && lastResolution && (
                <PotAwardAnimation
                  iWon={lastResolution.winners.includes(myPlayerId)}
                  isSplit={lastResolution.winners.length > 1}
                  myWinLoss={handHistory[handHistory.length - 1]?.myWinLoss ?? 0}
                  onComplete={startNextHand}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Player section ── */}
        <div
          className="relative flex justify-center px-2"
          style={{ zIndex: 20, minHeight: '128px', alignItems: 'flex-start' }}
        >
          <div className="relative flex flex-col items-center" style={{ marginTop: '-32px' }}>
            <div className="relative">
              {/* Dealer button — right of player seat */}
              {dealerIsMe && (
                <div className="absolute z-30" style={{ right: '-34px', bottom: '4px' }}>
                  <DealerButton />
                </div>
              )}
              <PlayerSeat
                player={me}
                isMe={true}
                isToAct={isMyTurn}
                revealCards={true}
                label="나"
                layout="cards-top"
                cardBaseDelay={120}
              />
            </div>
            {/* ActionToast below player */}
            <div className="h-7 flex items-start justify-center mt-0.5">
              <AnimatePresence>
                {lastActionByPlayer[me.id] && (
                  <ActionToast
                    key={`me-${lastActionByPlayer[me.id]!.tick}`}
                    action={lastActionByPlayer[me.id]!.action}
                    amount={lastActionByPlayer[me.id]!.amount}
                    isAllIn={lastActionByPlayer[me.id]!.isAllIn}
                    unit={displayUnit}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom area — ActionBar + optional chat (normal flow).
           z-30: player-section(z-20)/table-section(z-10)보다 위에 렌더링 보장. */}
      <div className="relative z-30 flex w-full items-end">
        {mode === 'REMOTE' && (
          <>
            <ChatToast entries={chatMessages} />
            <div className="flex-shrink-0 flex items-center gap-2 px-3 pb-3 self-end">
              {chatOpen ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chatInput.trim()) {
                      sendChat(chatInput);
                      setChatInput('');
                    }
                  }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    autoFocus
                    maxLength={200}
                    placeholder="메시지 입력..."
                    className="w-36 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-xs text-white backdrop-blur focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded bg-amber-500 px-2 py-1 text-xs font-bold text-black hover:bg-amber-400"
                  >
                    전송
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatOpen(false);
                      setChatInput('');
                    }}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    닫기
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur hover:bg-black/80 hover:text-white"
                >
                  💬 채팅
                </button>
              )}
            </div>
          </>
        )}
        <div className="flex-1 flex justify-end">
          <ActionBar
            legal={legal}
            disabled={!isMyTurn}
            potSize={gameState.pot}
            currentBet={gameState.currentBet}
            onAction={(action, amount) => applyMyAction(action, amount)}
          />
        </div>
      </div>

      {/* "내 차례" 플로팅 배너 */}
      <TurnBanner show={turnBannerShow} />

      {/* Decision countdown timer — AI mode only, shown during my turn */}
      {mode === 'AI' && (
        <DecisionTimer
          remaining={timerRemaining}
          maxTime={timerMaxTime}
          timebanksLeft={myTimebanksLeft}
          show={isTimerActive}
        />
      )}

      {/* 매치메이킹 VS 인트로 (게임 시작 시 한 번) */}
      <AnimatePresence>
        {isIntroPlaying && (
          <MatchmakingIntro
            myLabel="나"
            oppLabel={opponentLabel}
            oppAvatarSrc={opponentAvatarSrc}
            subtitle={
              mode === 'AI'
                ? `시작 스택 ${startingStackBB}BB · ${matchTotalHands}핸드 매치`
                : '1:1 노리밋 홀덤'
            }
            onComplete={setIntroComplete}
          />
        )}
      </AnimatePresence>

      {/* 매치 종료 오버레이 — Hand N/N 도달 후 startNextHand 시 자동 표시 */}
      <AnimatePresence>
        {isMatchOver && mode === 'AI' && me && (
          <MatchEndOverlay
            netBB={Math.round((me.stack - startingStackBB * 2) / 2)}
            totalHands={matchTotalHands}
            personaId={aiPersona}
            handHistory={handHistory}
            onRematch={startRematch}
            onFindNew={onReturnHome}
          />
        )}
      </AnimatePresence>

      {/* 인게임 설정 모달 */}
      <InGameSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
