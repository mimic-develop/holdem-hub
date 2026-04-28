import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ActionBar } from '../components/table/ActionBar';
import { CommunityBoard } from '../components/table/CommunityBoard';
import { HandResultOverlay } from '../components/table/HandResultOverlay';
import { PlayerSeat } from '../components/table/PlayerSeat';
import { PokerTable } from '../components/table/PokerTable';
import { PotDisplay } from '../components/table/PotDisplay';
import { ConnectionStatusBanner } from '../components/table/ConnectionStatusBanner';
import { ChatToast } from '../components/table/ChatToast';
import { useGameStore } from '../store/game-store';

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

  const isHost = useGameStore((s) => s.isHost);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const pingMs = useGameStore((s) => s.pingMs);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const deckVerificationFailed = useGameStore((s) => s.deckVerificationFailed);
  const opponentLeft = useGameStore((s) => s.opponentLeft);
  const isSendingAction = useGameStore((s) => s.isSendingAction);
  const sendChat = useGameStore((s) => s.sendChat);

  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!gameState || !mode) {
      navigate('/', { replace: true });
    }
  }, [gameState, mode, navigate]);

  if (!gameState) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-foreground">
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

  const nextHandLabel =
    mode === 'REMOTE' && !isHost ? '다음 핸드 요청' : '다음 핸드 →';

  const opponentLabel =
    mode === 'AI'
      ? `AI 봇 · ${aiDifficulty}`
      : opponentName
        ? `${opponentName}${pingMs !== null ? ` · ${pingMs}ms` : ''}`
        : '상대';

  return (
    <main className="relative flex min-h-screen flex-col bg-background">
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
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <button
          type="button"
          onClick={handleExit}
          className="rounded border border-border px-2 py-1 text-foreground hover:bg-muted"
        >
          나가기
        </button>
        <div className="text-xs text-muted-foreground">핸드 #{handNumber}</div>
        <div className="text-xs text-primary font-semibold">POT {gameState.pot}</div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col items-center justify-start gap-2 px-2 py-2">
        <PokerTable>
          <div className="flex justify-center">
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
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <PotDisplay pot={gameState.pot} street={gameState.street} />
            <CommunityBoard board={gameState.board} />
          </div>

          <div className="flex justify-center">
            <PlayerSeat
              player={me}
              isMe={true}
              isToAct={isMyTurn}
              revealCards={true}
              label="나"
            />
          </div>
        </PokerTable>
      </div>

      {mode === 'REMOTE' && (
        <>
          <ChatToast entries={chatMessages} />
          {/* Chat input toggle */}
          <div className="flex items-center justify-center gap-2 px-3 py-1">
            {chatOpen ? (
              <form
                className="flex flex-1 max-w-md items-center gap-2"
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
                  className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  전송
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatOpen(false);
                    setChatInput('');
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  닫기
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                💬 채팅
              </button>
            )}
          </div>
        </>
      )}

      {/* Action bar */}
      <ActionBar
        legal={legal}
        disabled={!isMyTurn}
        potSize={gameState.pot}
        currentBet={gameState.currentBet}
        onAction={(action, amount) => applyMyAction(action, amount)}
      />

      <AnimatePresence>
        {isHandOver && lastResolution && (
          <HandResultOverlay
            resolution={lastResolution}
            myPlayerId={myPlayerId}
            onNext={startNextHand}
            nextLabel={nextHandLabel}
            completedHand={handHistory[handHistory.length - 1]}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
