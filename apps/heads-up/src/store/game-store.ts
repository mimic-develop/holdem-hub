import { create } from 'zustand';
import type { Card } from '../engine/card';
import { Deck } from '../engine/deck';
import { evaluate, type HandValue } from '../engine/hand-evaluator';
import {
  applyAction,
  cloneState,
  getLegalActions,
  getMeta,
  resolveImmediate,
  startNewHand,
  type HandResolution,
  type LegalActions,
} from '../engine/game-engine';
import { HeuristicBot, type Difficulty } from '../bot/heuristic-bot';
import { AI_PERSONAS } from '../bot/personas';
import type { AiLevel, AiPersonaId } from '../types/ai';
import { evaluateHand } from '../insight/hand-evaluator-main';
import { DEFAULT_STACK_BB } from '../storage/settings';
import { useSettingsStore } from './settings-store';
import { getHand, saveHand } from '../storage/history';
import { inferEventsFromHand, inferStreakEvents } from '../bot/preflop-25bb/eventInference';
import { detectMilestones } from '../storage/stats';
import { useToastStore } from './toast-store';
import type { PeerConnection, ConnectionStatus } from '../rtc/peer-connection';
import type { ProtocolMessage } from '../rtc/protocol';
import type {
  ActionLogEntry,
  BotDecision,
  CompletedHand,
  GameMode,
  GameState,
  HandResult,
  PlayerAction,
} from '../types/game';

const DEFAULT_STARTING_STACK = 500;
const DEFAULT_SMALL_BLIND = 10;
const DEFAULT_BIG_BLIND = 20;

const MY_ID_AI = 'me';
const BOT_ID = 'bot';

/** Chat line rendered as a transient toast. */
export interface ChatEntry {
  from: string;
  text: string;
  at: number;
}

function randomHandId(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomSessionId(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `s_${c.randomUUID()}`;
  return `s_${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomSeed(): number {
  // 31-bit seed — Deck (mulberry32) truncates to 32-bit anyway.
  return Math.floor(Math.random() * 0x7fffffff);
}

interface GameStoreState {
  gameState: GameState | null;
  mode: GameMode | null;
  aiDifficulty: Difficulty;
  /** AI persona — 마스터 스펙 v2 §10. 기본은 STANDARD. */
  aiPersona: AiPersonaId;
  myPlayerId: string;
  /** Opponent player id — 'bot' in AI mode, peer id in REMOTE. */
  opponentPlayerId: string;
  myName: string;
  opponentName: string;
  isWaitingForBot: boolean;
  isHandOver: boolean;
  /** True from `startAiGame` until the matchmaking intro animation completes. */
  isIntroPlaying: boolean;
  /** Match format — 마스터 스펙 v2 §8.3. 0이면 매치 비활성(legacy 무한 모드). */
  matchTotalHands: number;
  /** 1-indexed within the current match. */
  currentHandInMatch: number;
  /** True after the final hand of the match completes. */
  isMatchOver: boolean;
  /** Starting stack in big blinds for this match (e.g. 25). 마스터 스펙 v2 §4. */
  startingStackBB: number;
  /** How many 10-second timebanks the human player has left this match. Starts at 2. */
  myTimebanksLeft: number;
  lastResolution: HandResolution | null;
  handHistory: CompletedHand[];
  handNumber: number;
  /** Stable id for the current continuous game/session. Issued on startAiGame /
   *  attachRemoteConnection. Stamped onto every CompletedHand saved during this
   *  session so HistoryPage can group hands by game. null when no game active. */
  sessionId: string | null;
  showOpponentCards: boolean;
  stacks: Record<string, number>;
  sbPlayerId: string;

  /** REMOTE-only state. */
  isHost: boolean;
  roomCode: string | null;
  connectionStatus: ConnectionStatus;
  pingMs: number | null;
  chatMessages: ChatEntry[];
  /** Set true when guest detects a seed/deck mismatch in a HAND_END message. */
  deckVerificationFailed: boolean;
  /** Guest-side: true while awaiting host confirmation of our action. */
  isSendingAction: boolean;
  /** True once the remote opponent has left the session. */
  opponentLeft: boolean;

  _bot: HeuristicBot | null;
  _pendingBotTimer: ReturnType<typeof setTimeout> | null;
  _peer: PeerConnection | null;
  _pingTimer: ReturnType<typeof setInterval> | null;
  /** Host-only: seed of the currently-dealt hand, for HAND_END verification. */
  _currentSeed: number | null;
}

interface GameStoreActions {
  /**
   * 두 가지 시그니처 지원:
   *  - `startAiGame('MEDIUM')`             ← legacy: persona = STANDARD
   *  - `startAiGame('LAG', 'HARD')`         ← persona × level
   */
  startAiGame: (
    personaOrLevel: AiPersonaId | AiLevel,
    level?: AiLevel,
  ) => Promise<void>;
  /** 같은 persona/level로 매치를 다시 시작 (카운터 리셋). */
  startRematch: () => void;
  setIntroComplete: () => void;
  /** 타임뱅크 1회 차감. useDecisionTimer에서 호출. */
  useMyTimebank: () => void;
  applyMyAction: (action: PlayerAction, amount?: number) => void;
  applyBotAction: () => Promise<void>;
  startNextHand: () => void;
  resetGame: () => void;
  getLegalActionsForMe: () => LegalActions | null;

  // REMOTE
  attachRemoteConnection: (opts: {
    peer: PeerConnection;
    isHost: boolean;
    myName: string;
    roomCode: string;
    opponentPeerId?: string;
  }) => void;
  handleIncomingMessage: (msg: ProtocolMessage) => void;
  sendChat: (text: string) => void;
  leaveRemoteGame: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

function labelForPlayer(
  playerId: string,
  myId: string,
  mode: GameMode | null,
  difficulty: Difficulty,
  opponentName: string,
): string {
  if (playerId === myId) return '나';
  if (mode === 'AI') return `AI 봇 (${difficulty})`;
  return opponentName || '상대';
}

function stripPlayerCards(state: GameState, hidePlayerId: string): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === hidePlayerId ? { ...p, holeCards: null } : { ...p },
    ),
    board: state.board.slice(),
    history: state.history.slice(),
  };
}

/** Re-shuffle with the same seed and compare the resulting deck to the one the
 *  host claimed. Detects tampering under the "friends don't cheat" MVP model. */
function verifyDeck(seed: number, claimed: Card[]): boolean {
  if (claimed.length !== 52) return false;
  const deck = new Deck(seed);
  deck.shuffle();
  const expected = deck.snapshot().slice().reverse();
  for (let i = 0; i < 52; i++) {
    const e = expected[i];
    const c = claimed[i];
    if (!c || e.rank !== c.rank || e.suit !== c.suit) return false;
  }
  return true;
}

function buildCompletedHand(
  resolution: HandResolution,
  s: GameStoreState,
  override?: {
    myCards?: [Card, Card];
    oppCards?: [Card, Card];
    deckSnapshot?: Card[];
    seed?: number;
  },
): CompletedHand {
  const state = resolution.state;
  const meta = getMeta(state);
  const myId = s.myPlayerId;
  const oppId = s.opponentPlayerId;
  const sbId = s.sbPlayerId;
  const myPlayer = state.players.find((p) => p.id === myId);
  const oppPlayer = state.players.find((p) => p.id === oppId);
  if (!myPlayer || !oppPlayer) {
    throw new Error('buildCompletedHand: player missing in resolution state');
  }

  const myPosition = myPlayer.position;
  const initialMyStack = s.stacks[myId];
  const initialOppStack = s.stacks[oppId];
  const finalMyStack = myPlayer.stack;
  const finalOppStack = oppPlayer.stack;
  const myWinLoss = finalMyStack - initialMyStack;

  let result: HandResult;
  if (resolution.winners.length > 1) result = 'SPLIT';
  else if (resolution.winners[0] === myId) result = 'WIN';
  else result = 'LOSS';

  const actionLog: ActionLogEntry[] = [];
  const preflopStartPot = state.smallBlind + state.bigBlind;
  let runningPot = preflopStartPot;
  let currentStreet: string = 'preflop';
  const bbPlayer = state.players.find((p) => p.position === 'BB');
  const currentBets: Record<string, number> = {
    [sbId]: state.smallBlind,
    ...(bbPlayer ? { [bbPlayer.id]: state.bigBlind } : {}),
  };
  for (const rec of state.history) {
    if (rec.street !== currentStreet) {
      currentStreet = rec.street;
      for (const pid of Object.keys(currentBets)) currentBets[pid] = 0;
    }
    if (rec.action === 'fold' || rec.action === 'check') {
      // no pot change
    } else if (rec.action === 'call') {
      runningPot += rec.amount;
      currentBets[rec.playerId] = (currentBets[rec.playerId] ?? 0) + rec.amount;
    } else if (rec.action === 'bet' || rec.action === 'raise') {
      const prior = currentBets[rec.playerId] ?? 0;
      const delta = rec.amount - prior;
      runningPot += Math.max(0, delta);
      currentBets[rec.playerId] = rec.amount;
    }
    actionLog.push({
      street: rec.street,
      playerId: rec.playerId,
      playerLabel: labelForPlayer(
        rec.playerId,
        myId,
        s.mode,
        s.aiDifficulty,
        s.opponentName,
      ),
      action: rec.action,
      amount: rec.amount,
      potAfter: runningPot,
    });
  }

  // Card resolution: try override, then meta, then player.holeCards.
  const myCards: [Card, Card] =
    override?.myCards ??
    (meta
      ? myId === sbId
        ? [meta.sbHole[0], meta.sbHole[1]]
        : [meta.bbHole[0], meta.bbHole[1]]
      : (myPlayer.holeCards as [Card, Card]));

  const oppCards: [Card, Card] | undefined =
    override?.oppCards ??
    (resolution.endedBy === 'showdown'
      ? meta
        ? myId === sbId
          ? [meta.bbHole[0], meta.bbHole[1]]
          : [meta.sbHole[0], meta.sbHole[1]]
        : (oppPlayer.holeCards as [Card, Card] | undefined)
      : undefined);

  const winningHand =
    resolution.endedBy === 'showdown' &&
    resolution.evaluations &&
    resolution.winners.length > 0
      ? resolution.evaluations[resolution.winners[0]]
      : undefined;

  return {
    handId: randomHandId(),
    sessionId: s.sessionId ?? undefined,
    playedAt: Date.now(),
    handNumber: s.handNumber,
    mode: s.mode ?? 'AI',
    aiDifficulty: s.mode === 'AI' ? s.aiDifficulty : undefined,
    opponentName: labelForPlayer(
      oppId,
      myId,
      s.mode,
      s.aiDifficulty,
      s.opponentName,
    ),
    myPosition,
    initialStacks: [initialMyStack, initialOppStack],
    finalStacks: [finalMyStack, finalOppStack],
    result,
    myWinLoss,
    board: resolution.revealedBoard.slice(),
    myCards,
    opponentCards: oppCards,
    wentToShowdown: resolution.endedBy === 'showdown',
    winningHand,
    actionLog,
    deckSnapshot: override?.deckSnapshot ?? (meta ? meta.initialDeck.slice() : []),
    seed: override?.seed ?? meta?.deckSeed,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  mode: null,
  aiDifficulty: 'MEDIUM',
  aiPersona: 'STANDARD',
  myPlayerId: MY_ID_AI,
  opponentPlayerId: BOT_ID,
  myName: '나',
  opponentName: '',
  isWaitingForBot: false,
  isHandOver: false,
  isIntroPlaying: false,
  matchTotalHands: 0,
  currentHandInMatch: 0,
  isMatchOver: false,
  startingStackBB: 25,
  myTimebanksLeft: 2,
  lastResolution: null,
  handHistory: [],
  handNumber: 0,
  sessionId: null,
  showOpponentCards: false,
  stacks: { [MY_ID_AI]: DEFAULT_STARTING_STACK, [BOT_ID]: DEFAULT_STARTING_STACK },
  sbPlayerId: MY_ID_AI,

  isHost: false,
  roomCode: null,
  connectionStatus: 'DISCONNECTED',
  pingMs: null,
  chatMessages: [],
  deckVerificationFailed: false,
  isSendingAction: false,
  opponentLeft: false,

  _bot: null,
  _pendingBotTimer: null,
  _peer: null,
  _pingTimer: null,
  _currentSeed: null,

  startAiGame: async (personaOrLevel, level) => {
    const s = get();
    cleanupTimers(s);

    // Persona × Level 정규화 (legacy single-arg 호환).
    const knownPersonas: AiPersonaId[] = ['STANDARD', 'NIT', 'LAG', 'CALLING', 'MANIAC'];
    let personaId: AiPersonaId;
    let resolvedLevel: AiLevel;
    if (knownPersonas.includes(personaOrLevel as AiPersonaId)) {
      personaId = personaOrLevel as AiPersonaId;
      resolvedLevel = level ?? 'MEDIUM';
    } else {
      // legacy: 첫 인자가 'EASY' | 'MEDIUM' | 'HARD'
      personaId = 'STANDARD';
      resolvedLevel = personaOrLevel as AiLevel;
    }

    const settings = useSettingsStore.getState().settings;
    const stackBB = DEFAULT_STACK_BB; // 25BB 고정
    const stackChips = stackBB * DEFAULT_BIG_BLIND;
    const stacks = {
      [MY_ID_AI]: stackChips,
      [BOT_ID]: stackChips,
    };
    const sbId = MY_ID_AI;
    const bbId = BOT_ID;
    const state = startNewHand({
      sbPlayerId: sbId,
      bbPlayerId: bbId,
      sbStack: stacks[sbId],
      bbStack: stacks[bbId],
      smallBlind: DEFAULT_SMALL_BLIND,
      bigBlind: DEFAULT_BIG_BLIND,
    });
    const bot = new HeuristicBot(personaId, resolvedLevel);
    const personaName = AI_PERSONAS[personaId].displayName;
    const matchLength = settings.matchLength;
    set({
      gameState: state,
      mode: 'AI',
      aiDifficulty: resolvedLevel,
      aiPersona: personaId,
      myPlayerId: MY_ID_AI,
      opponentPlayerId: BOT_ID,
      myName: '나',
      // opponentName을 persona displayName으로 자동 설정 — TablePage/MatchmakingIntro에서 활용.
      opponentName: personaName,
      isWaitingForBot: false,
      isHandOver: false,
      isIntroPlaying: true,
      matchTotalHands: matchLength,
      currentHandInMatch: 1,
      isMatchOver: false,
      startingStackBB: stackBB,
      myTimebanksLeft: 2,
      lastResolution: null,
      handHistory: [],
      handNumber: 1,
      sessionId: randomSessionId(),
      showOpponentCards: false,
      stacks,
      sbPlayerId: sbId,
      isHost: false,
      roomCode: null,
      connectionStatus: 'DISCONNECTED',
      pingMs: null,
      chatMessages: [],
      deckVerificationFailed: false,
      isSendingAction: false,
      opponentLeft: false,
      _bot: bot,
      _pendingBotTimer: null,
      _peer: null,
      _pingTimer: null,
      _currentSeed: null,
    });
    if (state.toActId === BOT_ID) {
      void get().applyBotAction();
    }
  },

  setIntroComplete: () => set({ isIntroPlaying: false }),

  useMyTimebank: () =>
    set((s) => ({ myTimebanksLeft: Math.max(0, s.myTimebanksLeft - 1) })),

  startRematch: () => {
    const s = get();
    // 같은 persona/level로 새 매치 시작 — 매치 카운터 리셋.
    get().startAiGame(s.aiPersona, s.aiDifficulty);
  },

  getLegalActionsForMe: () => {
    const s = get();
    if (!s.gameState) return null;
    if (s.gameState.toActId !== s.myPlayerId) return null;
    if (s.isSendingAction) return null;
    return getLegalActions(s.gameState, s.myPlayerId);
  },

  applyMyAction: (action, amount = 0) => {
    const s = get();
    if (!s.gameState || s.isHandOver) return;
    if (s.gameState.toActId !== s.myPlayerId) return;

    if (s.mode === 'REMOTE') {
      if (s.isHost) {
        // Host: act locally, then broadcast.
        const result = applyAction(s.gameState, s.myPlayerId, action, amount);
        hostBroadcastAfterAction(set, get, result);
        return;
      }
      // Guest: send ACTION message; host is source of truth.
      if (!s._peer) return;
      set({ isSendingAction: true });
      s._peer.send({
        type: 'ACTION',
        playerId: s.myPlayerId,
        action,
        amount,
        timestamp: Date.now(),
      });
      return;
    }

    // AI mode (unchanged)
    const result = applyAction(s.gameState, s.myPlayerId, action, amount);
    if (result.resolution) {
      finalizeHand(set, get, result.resolution);
      return;
    }
    const newState = cloneState(result.state);
    set({ gameState: newState });
    if (newState.toActId === s.opponentPlayerId) {
      void get().applyBotAction();
    }
  },

  applyBotAction: async () => {
    const s = get();
    if (s.mode !== 'AI') return;
    if (!s.gameState || s.isHandOver) return;
    if (s.gameState.toActId !== s.opponentPlayerId) return;
    if (!s._bot) return;
    if (s.isWaitingForBot) return;
    set({ isWaitingForBot: true });

    let decision: BotDecision;
    try {
      decision = s._bot.decide(s.gameState, s.opponentPlayerId);
    } catch (err) {
      console.error('[applyBotAction] decide() threw — using safe fallback:', err);
      // decide()가 실패해도 게임이 멈추지 않도록 안전한 폴백 결정 사용.
      // fold 대신 check/call을 우선해 상대에게 공짜 핸드를 주지 않음.
      const fallbackLegal = getLegalActions(s.gameState, s.opponentPlayerId);
      decision = {
        action: fallbackLegal.canCheck
          ? 'check'
          : fallbackLegal.canCall
            ? 'call'
            : 'fold',
        amount: fallbackLegal.canCall ? fallbackLegal.callAmount : 0,
        thinkingTimeMs: 300,
      };
    }
    const delayMs = Math.max(200, decision.thinkingTimeMs);

    const timer = setTimeout(() => {
      try {
        const cur = get();
        if (
          !cur.gameState ||
          cur.isHandOver ||
          cur.gameState.toActId !== cur.opponentPlayerId
        ) {
          set({ isWaitingForBot: false, _pendingBotTimer: null });
          return;
        }
        const result = applyAction(
          cur.gameState,
          cur.opponentPlayerId,
          decision.action,
          decision.amount,
        );
        if (result.resolution) {
          set({ isWaitingForBot: false, _pendingBotTimer: null });
          finalizeHand(set, get, result.resolution);
          return;
        }
        const newState = cloneState(result.state);
        set({
          gameState: newState,
          isWaitingForBot: false,
          _pendingBotTimer: null,
        });
        if (newState.toActId === cur.opponentPlayerId) {
          void get().applyBotAction();
        }
      } catch (err) {
        console.error('[applyBotAction] timer callback threw — retrying with safe fallback:', err);
        // applyAction 실패 시 안전한 폴백(check/call)으로 재시도.
        const cur2 = get();
        set({ isWaitingForBot: false, _pendingBotTimer: null });
        if (cur2.gameState && !cur2.isHandOver && cur2.gameState.toActId === cur2.opponentPlayerId) {
          try {
            const fallbackLegal = getLegalActions(cur2.gameState, cur2.opponentPlayerId);
            const fallbackAction: PlayerAction = fallbackLegal.canCheck
              ? 'check'
              : fallbackLegal.canCall
                ? 'call'
                : 'fold';
            const fallbackAmount = fallbackLegal.canCall ? fallbackLegal.callAmount : 0;
            const fallbackResult = applyAction(
              cur2.gameState, cur2.opponentPlayerId, fallbackAction, fallbackAmount,
            );
            if (fallbackResult.resolution) {
              finalizeHand(set, get, fallbackResult.resolution);
            } else {
              const newState = cloneState(fallbackResult.state);
              set({ gameState: newState });
              if (newState.toActId === cur2.opponentPlayerId) {
                void get().applyBotAction();
              }
            }
          } catch (fallbackErr) {
            console.error('[applyBotAction] fallback also failed:', fallbackErr);
          }
        }
      }
    }, delayMs);
    set({ _pendingBotTimer: timer });
  },

  startNextHand: () => {
    const s = get();
    if (!s.mode) return;
    // Only advance when the current hand has ended — guards against a race
    // where host's local "다음 핸드" click AND an incoming NEXT_HAND message
    // both land on the host (would skip a hand number otherwise).
    if (s.handNumber > 0 && !s.isHandOver) return;
    if (s._pendingBotTimer) clearTimeout(s._pendingBotTimer);

    // 매치 모드: 마지막 핸드를 끝냈으면 다음 핸드 대신 MatchEndOverlay 띄움.
    // matchTotalHands === 0 이면 legacy 무한 모드 (REMOTE 등).
    if (
      s.matchTotalHands > 0 &&
      s.currentHandInMatch >= s.matchTotalHands
    ) {
      set({ isMatchOver: true });
      return;
    }

    if (s.mode === 'REMOTE' && !s.isHost) {
      // Guest requests; host will send HAND_START.
      s._peer?.send({ type: 'NEXT_HAND' });
      return;
    }

    const prevSb = s.sbPlayerId;
    const nextSb = prevSb === s.myPlayerId ? s.opponentPlayerId : s.myPlayerId;
    const nextBb =
      nextSb === s.myPlayerId ? s.opponentPlayerId : s.myPlayerId;

    let stacks = { ...s.stacks };
    // 칩이 바닥나거나 음수(엔진 버그 방어)이면 핸드 수와 무관하게 매치 종료.
    if ((stacks[s.myPlayerId] ?? 0) <= 0 || (stacks[s.opponentPlayerId] ?? 0) <= 0) {
      set({ isMatchOver: true });
      return;
    }

    const seed = s.mode === 'REMOTE' ? randomSeed() : undefined;
    const state = startNewHand({
      sbPlayerId: nextSb,
      bbPlayerId: nextBb,
      sbStack: stacks[nextSb],
      bbStack: stacks[nextBb],
      smallBlind: DEFAULT_SMALL_BLIND,
      bigBlind: DEFAULT_BIG_BLIND,
      deckSeed: seed,
    });

    const nextHandNumber = s.handNumber + 1;
    const nextHandInMatch =
      s.matchTotalHands > 0 ? s.currentHandInMatch + 1 : s.currentHandInMatch;

    // 블라인드 포스팅만으로 올인이 된 경우(short-stack) — 즉시 쇼다운 처리.
    const immediateResolution = resolveImmediate(state);
    if (immediateResolution) {
      // 스토어 상태를 먼저 이번 핸드 기준으로 설정한 뒤 finalizeHand 호출.
      set({
        gameState: state,
        isHandOver: false,
        lastResolution: null,
        showOpponentCards: false,
        isWaitingForBot: false,
        isSendingAction: false,
        stacks,
        sbPlayerId: nextSb,
        handNumber: nextHandNumber,
        currentHandInMatch: nextHandInMatch,
        _pendingBotTimer: null,
        _currentSeed: seed ?? null,
      });
      finalizeHand(set, get, immediateResolution);
      return;
    }

    set({
      gameState: state,
      isHandOver: false,
      lastResolution: null,
      showOpponentCards: false,
      isWaitingForBot: false,
      isSendingAction: false,
      stacks,
      sbPlayerId: nextSb,
      handNumber: nextHandNumber,
      currentHandInMatch: nextHandInMatch,
      _pendingBotTimer: null,
      _currentSeed: seed ?? null,
    });

    if (s.mode === 'REMOTE' && s.isHost && seed !== undefined) {
      // Broadcast HAND_START (strip my own cards from peer's view).
      const forPeer = stripPlayerCards(state, s.myPlayerId);
      s._peer?.send({
        type: 'HAND_START',
        state: forPeer,
        deckSeed: seed,
        handNumber: nextHandNumber,
      });
    }

    if (s.mode === 'AI' && state.toActId === s.opponentPlayerId) {
      void get().applyBotAction();
    }
  },

  resetGame: () => {
    const s = get();
    cleanupTimers(s);
    try {
      s._peer?.close();
    } catch {
      // ignore
    }
    set({
      gameState: null,
      mode: null,
      myPlayerId: MY_ID_AI,
      opponentPlayerId: BOT_ID,
      myName: '나',
      opponentName: '',
      isWaitingForBot: false,
      isHandOver: false,
      isIntroPlaying: false,
      matchTotalHands: 0,
      currentHandInMatch: 0,
      isMatchOver: false,
      startingStackBB: 25,
      myTimebanksLeft: 2,
      lastResolution: null,
      handHistory: [],
      handNumber: 0,
      sessionId: null,
      showOpponentCards: false,
      stacks: { [MY_ID_AI]: DEFAULT_STARTING_STACK, [BOT_ID]: DEFAULT_STARTING_STACK },
      sbPlayerId: MY_ID_AI,
      isHost: false,
      roomCode: null,
      connectionStatus: 'DISCONNECTED',
      pingMs: null,
      chatMessages: [],
      deckVerificationFailed: false,
      isSendingAction: false,
      opponentLeft: false,
      _bot: null,
      _pendingBotTimer: null,
      _peer: null,
      _pingTimer: null,
      _currentSeed: null,
    });
  },

  attachRemoteConnection: ({ peer, isHost, myName, roomCode, opponentPeerId }) => {
    const s = get();
    cleanupTimers(s);
    try {
      s._peer?.close();
    } catch {
      // ignore
    }
    const myPeerId = peer.getMyPeerId();
    // Opponent peer id: guest learns it from handshake / connection; host receives from HELLO.
    const oppId = opponentPeerId ?? 'pending';
    set({
      mode: 'REMOTE',
      isHost,
      roomCode,
      myPlayerId: myPeerId,
      opponentPlayerId: oppId,
      myName,
      opponentName: '',
      connectionStatus: peer.getStatus(),
      handHistory: [],
      handNumber: 0,
      sessionId: randomSessionId(),
      chatMessages: [],
      pingMs: null,
      deckVerificationFailed: false,
      isSendingAction: false,
      opponentLeft: false,
      stacks: {
        [myPeerId]: DEFAULT_STARTING_STACK,
        ...(oppId !== 'pending' ? { [oppId]: DEFAULT_STARTING_STACK } : {}),
      },
      sbPlayerId: isHost ? myPeerId : oppId, // host is SB on hand 1
      gameState: null,
      isHandOver: false,
      lastResolution: null,
      _peer: peer,
    });
    peer.onMessage((msg) => get().handleIncomingMessage(msg));
    peer.onStatusChange((status) => {
      set({ connectionStatus: status });
    });
    peer.onDisconnect(() => {
      set({ connectionStatus: 'DISCONNECTED' });
    });
    // Host's DataConnection is still null when attachRemoteConnection runs —
    // peer.send at attach time would be a no-op. We (re)send HELLO from here
    // so that once the DataConnection opens (guest connected / reconnected),
    // our identity is announced.
    peer.onReconnect(() => {
      set({ connectionStatus: 'CONNECTED' });
      peer.send({ type: 'HELLO', name: myName, peerId: myPeerId });
    });

    // Try an immediate send too — works for the guest side where joinRoom
    // already resolved with the DataConnection open before handlers were
    // attached (so onReconnect wouldn't fire again on initial connect).
    peer.send({ type: 'HELLO', name: myName, peerId: myPeerId });

    // Periodic ping for latency display.
    const pingTimer = setInterval(() => {
      const cur = get();
      if (!cur._peer) return;
      cur._peer.send({ type: 'PING', timestamp: Date.now() });
    }, 3000);
    set({ _pingTimer: pingTimer });
  },

  handleIncomingMessage: (msg) => {
    const s = get();
    if (s.mode !== 'REMOTE') return;

    switch (msg.type) {
      case 'HELLO': {
        // Learn opponent's name + peer id (guest may not have had the id until now).
        const oppId = msg.peerId;
        const nextSbId = s.isHost ? s.myPlayerId : oppId;
        set({
          opponentPlayerId: oppId,
          opponentName: msg.name || '상대',
          sbPlayerId: nextSbId,
          stacks: {
            ...s.stacks,
            [oppId]: s.stacks[oppId] ?? DEFAULT_STARTING_STACK,
          },
        });
        // Host: once we know the guest, immediately start hand 1.
        if (s.isHost && !s.gameState) {
          // Kick off the first hand — pushes HAND_START to the guest.
          const nextState = get();
          const seed = randomSeed();
          const sbId = nextState.myPlayerId;
          const bbId = oppId;
          const gameState = startNewHand({
            sbPlayerId: sbId,
            bbPlayerId: bbId,
            sbStack: nextState.stacks[sbId] ?? DEFAULT_STARTING_STACK,
            bbStack: nextState.stacks[bbId] ?? DEFAULT_STARTING_STACK,
            smallBlind: DEFAULT_SMALL_BLIND,
            bigBlind: DEFAULT_BIG_BLIND,
            deckSeed: seed,
          });
          set({
            gameState,
            handNumber: 1,
            isHandOver: false,
            showOpponentCards: false,
            _currentSeed: seed,
          });
          nextState._peer?.send({
            type: 'HAND_START',
            state: stripPlayerCards(gameState, nextState.myPlayerId),
            deckSeed: seed,
            handNumber: 1,
          });
        }
        break;
      }
      case 'HAND_START': {
        // Guest receives a fresh hand state.
        const state = msg.state;
        const meId = s.myPlayerId;
        const opp = state.players.find((p) => p.id !== meId);
        const initialStacks: Record<string, number> = {};
        for (const p of state.players) {
          // stacks here are *post-blind*; we store pre-blind for initial snapshot
          initialStacks[p.id] = p.stack + p.currentBet;
        }
        set({
          gameState: state,
          handNumber: msg.handNumber,
          isHandOver: false,
          showOpponentCards: false,
          lastResolution: null,
          isSendingAction: false,
          sbPlayerId: state.players.find((p) => p.position === 'SB')?.id ?? s.sbPlayerId,
          stacks: initialStacks,
          _currentSeed: msg.deckSeed,
          opponentPlayerId: opp?.id ?? s.opponentPlayerId,
        });
        break;
      }
      case 'STATE_UPDATE': {
        set({ gameState: msg.state, isSendingAction: false });
        break;
      }
      case 'HAND_END': {
        // Guest finalizes locally.
        const verified = verifyDeck(msg.deckSeed, msg.deckSnapshot);
        // At showdown, locally re-evaluate both hole card combos against the
        // board so HandResultOverlay can show "내 핸드: X / 상대: Y" on the
        // guest side too. (Host carries evaluations in local state but the
        // HAND_END protocol message doesn't ship them.)
        let evaluations: Record<string, HandValue> | undefined;
        if (msg.endedBy === 'showdown') {
          const myP = msg.state.players.find((p) => p.id === s.myPlayerId);
          const oppP = msg.state.players.find(
            (p) => p.id === s.opponentPlayerId,
          );
          const haveBoard = msg.state.board.length === 5;
          const myHole = myP?.holeCards;
          const oppHole = oppP?.holeCards;
          if (haveBoard && myHole?.length === 2 && oppHole?.length === 2) {
            evaluations = {
              [s.myPlayerId]: evaluate([
                myHole[0],
                myHole[1],
                ...msg.state.board,
              ]),
              [s.opponentPlayerId]: evaluate([
                oppHole[0],
                oppHole[1],
                ...msg.state.board,
              ]),
            };
          }
        }
        const fakeResolution: HandResolution = {
          state: msg.state,
          winners: msg.winners,
          revealedBoard: msg.state.board.slice(),
          endedBy: msg.endedBy,
          endedStreet: msg.state.street,
          potAwarded: msg.potAwarded,
          evaluations,
        };
        const myPlayer = msg.state.players.find((p) => p.id === s.myPlayerId);
        const oppPlayer = msg.state.players.find((p) => p.id === s.opponentPlayerId);
        const myCards =
          myPlayer?.holeCards && myPlayer.holeCards.length === 2
            ? ([myPlayer.holeCards[0], myPlayer.holeCards[1]] as [Card, Card])
            : undefined;
        const oppCards =
          msg.endedBy === 'showdown' &&
          oppPlayer?.holeCards &&
          oppPlayer.holeCards.length === 2
            ? ([oppPlayer.holeCards[0], oppPlayer.holeCards[1]] as [Card, Card])
            : undefined;
        const completed = buildCompletedHand(fakeResolution, s, {
          myCards,
          oppCards,
          deckSnapshot: msg.deckSnapshot,
          seed: msg.deckSeed,
        });
        const stacksAfter: Record<string, number> = {};
        for (const p of msg.state.players) stacksAfter[p.id] = p.stack;
        set({
          gameState: msg.state,
          isHandOver: true,
          lastResolution: fakeResolution,
          showOpponentCards: msg.endedBy === 'showdown',
          handHistory: [...s.handHistory, completed],
          stacks: stacksAfter,
          isSendingAction: false,
          deckVerificationFailed: !verified,
        });
        void saveHand(completed).catch((err) => {
          console.error('[game-store] saveHand failed', err);
        });
        void analyzeAndPersist(set, get, completed);
        break;
      }
      case 'ACTION': {
        // Only host acts on incoming actions.
        if (!s.isHost || !s.gameState) break;
        if (s.gameState.toActId !== msg.playerId) break;
        const result = applyAction(
          s.gameState,
          msg.playerId,
          msg.action,
          msg.amount ?? 0,
        );
        hostBroadcastAfterAction(set, get, result);
        break;
      }
      case 'NEXT_HAND': {
        if (!s.isHost) break;
        // Host rotates blinds and broadcasts.
        get().startNextHand();
        break;
      }
      case 'CHAT': {
        // Defensive: cap incoming text + sender name so a malicious/buggy peer
        // can't flood the UI with huge strings. Matches the client-side limit.
        const rawText = typeof msg.message === 'string' ? msg.message : '';
        const text = rawText.slice(0, 200);
        if (!text.trim()) break;
        const rawFrom =
          typeof msg.fromName === 'string' && msg.fromName.trim().length > 0
            ? msg.fromName.slice(0, 20)
            : s.opponentName || '상대';
        appendChat(set, get, rawFrom, text);
        break;
      }
      case 'PING': {
        s._peer?.send({ type: 'PONG', timestamp: msg.timestamp });
        break;
      }
      case 'PONG': {
        const rtt = Date.now() - msg.timestamp;
        set({ pingMs: rtt });
        break;
      }
      case 'RESYNC_REQUEST': {
        if (s.isHost && s.gameState) {
          s._peer?.send({
            type: 'RESYNC_RESPONSE',
            state: stripPlayerCards(s.gameState, s.myPlayerId),
          });
        }
        break;
      }
      case 'RESYNC_RESPONSE': {
        set({ gameState: msg.state });
        break;
      }
      case 'LEAVE': {
        set({ opponentLeft: true, connectionStatus: 'DISCONNECTED' });
        break;
      }
      default:
        break;
    }
  },

  sendChat: (text) => {
    const s = get();
    const trimmed = text.trim().slice(0, 200);
    if (!trimmed || s.mode !== 'REMOTE' || !s._peer) return;
    s._peer.send({ type: 'CHAT', message: trimmed, fromName: s.myName });
    appendChat(set, get, s.myName, trimmed);
  },

  leaveRemoteGame: () => {
    const s = get();
    try {
      s._peer?.send({ type: 'LEAVE' });
    } catch {
      // ignore
    }
    get().resetGame();
  },
}));

function cleanupTimers(s: GameStoreState): void {
  if (s._pendingBotTimer) clearTimeout(s._pendingBotTimer);
  if (s._pingTimer) clearInterval(s._pingTimer);
}

function appendChat(
  set: (partial: Partial<GameStoreState>) => void,
  get: () => GameStore,
  from: string,
  text: string,
): void {
  const s = get();
  const entry: ChatEntry = { from, text, at: Date.now() };
  // Keep only the last 20 chat entries (toast history).
  const nextChat = [...s.chatMessages, entry].slice(-20);
  set({ chatMessages: nextChat });
}

/**
 * Host-only: after engine.applyAction, update local state and broadcast to guest.
 * If the hand ended, send HAND_END with deckSnapshot for verification.
 */
function hostBroadcastAfterAction(
  set: (partial: Partial<GameStoreState>) => void,
  get: () => GameStore,
  result: { state: GameState; resolution?: HandResolution },
): void {
  const s = get();
  const newState = cloneState(result.state);
  if (result.resolution) {
    // Finalize locally + send HAND_END.
    finalizeHand(set, get, result.resolution);
    const meta = getMeta(result.state);
    const deckSnapshot = meta ? meta.initialDeck.slice() : [];
    const seed = s._currentSeed ?? 0;
    // At showdown both hole cards are legitimately revealed; on fold, the
    // host's cards must stay hidden from the guest (the folder doesn't reveal).
    const stateForPeer =
      result.resolution.endedBy === 'showdown'
        ? result.state
        : stripPlayerCards(result.state, s.myPlayerId);
    s._peer?.send({
      type: 'HAND_END',
      state: stateForPeer,
      winners: result.resolution.winners,
      endedBy: result.resolution.endedBy,
      deckSnapshot,
      deckSeed: seed,
      potAwarded: result.resolution.potAwarded,
    });
    return;
  }
  set({ gameState: newState });
  // Broadcast mid-hand state update to peer (strip my own cards).
  s._peer?.send({
    type: 'STATE_UPDATE',
    state: stripPlayerCards(newState, s.myPlayerId),
  });
}

function finalizeHand(
  set: (partial: Partial<GameStoreState>) => void,
  get: () => GameStore,
  resolution: HandResolution,
): void {
  const s = get();
  if (!s.gameState) return;
  const completed = buildCompletedHand(resolution, s);
  const stacksAfter: Record<string, number> = {};
  for (const p of resolution.state.players) stacksAfter[p.id] = p.stack;

  const newState = cloneState(resolution.state);
  newState.board = resolution.revealedBoard.slice();
  set({
    gameState: newState,
    isHandOver: true,
    lastResolution: resolution,
    showOpponentCards: resolution.endedBy === 'showdown',
    handHistory: [...s.handHistory, completed],
    stacks: stacksAfter,
    isWaitingForBot: false,
    isSendingAction: false,
  });
  void saveHand(completed).catch((err) => {
    console.error('[game-store] saveHand failed', err);
  });
  void analyzeAndPersist(set, get, completed);

  // Feed the persona-state layer with single-hand + streak-window events.
  // AI mode only — REMOTE has no local bot instance.
  if (s.mode === 'AI' && s._bot) {
    try {
      const single = inferEventsFromHand(completed, s.opponentPlayerId);
      const streak = inferStreakEvents([...s.handHistory, completed], s.opponentPlayerId);
      const all = [...single, ...streak];
      if (all.length > 0) s._bot.recordEvents(all);
    } catch (err) {
      console.error('[game-store] persona-state event update failed', err);
    }
  }
}

/** Tracks handIds whose analysis is in-flight, so callers can dedupe re-entry
 *  (e.g., REMOTE duplicate HAND_END or any future code path that fires twice). */
const analysisInFlight = new Set<string>();

/**
 * Run GTO evaluation off the critical render path. We've already shown the
 * "you won/lost" overlay synchronously; this fills in the score asynchronously
 * (typically 200-800ms) and re-renders to reveal the breakdown. Both the
 * in-memory handHistory and the IDB record are updated so refreshing the
 * AnalysisPage shows the final scores.
 *
 * Errors here must NOT crash the game — the user already saw the result.
 *
 * Idempotency: short-circuits if the same handId is already being analyzed
 * OR if it's already enriched in handHistory. This protects against:
 *   1. Duplicate REMOTE HAND_END messages
 *   2. Future code paths that accidentally call us twice
 *   3. Re-entry during the synchronous evaluate window (extremely unlikely
 *      but cheap to guard against)
 */
async function analyzeAndPersist(
  set: (partial: Partial<GameStoreState>) => void,
  get: () => GameStore,
  completed: CompletedHand,
): Promise<void> {
  if (analysisInFlight.has(completed.handId)) return;
  const existing = get().handHistory.find((h) => h.handId === completed.handId);
  if (existing?.postHandInsight) return;
  analysisInFlight.add(completed.handId);

  try {
    // Yield via setTimeout(0) — microtasks drain BEFORE React's commit phase,
    // so queueMicrotask wouldn't actually let the result overlay paint. A
    // macro-task boundary releases the main thread for at least one paint
    // before evaluateHand burns 200-800ms.
    await new Promise<void>((r) => setTimeout(r, 0));

    let analysis;
    try {
      analysis = evaluateHand(completed);
    } catch (err) {
      console.error('[game-store] evaluateHand failed', err);
      return;
    }
    const enriched: CompletedHand = { ...completed, postHandInsight: analysis };

    // Update in-memory list (replace the matching entry by handId).
    // We re-read state *after* the async wait — the user may have started
    // another hand or reset the game. We still want to persist to IDB
    // unconditionally (the hand's saved record is the source of truth for
    // AnalysisPage), but only update in-memory if the hand is still present.
    const cur = get();
    const haveInMemory = cur.handHistory.some((h) => h.handId === enriched.handId);
    if (haveInMemory) {
      const nextHistory = cur.handHistory.map((h) =>
        h.handId === enriched.handId ? enriched : h,
      );
      set({ handHistory: nextHistory });

      // Milestone detection — compare history *before* this hand was appended
      // vs. after. We only do this when the hand is still in-memory; otherwise
      // the user has reset and milestone toasts would be confusing.
      try {
        const before = cur.handHistory
          .filter((h) => h.handId !== enriched.handId)
          .slice();
        const after = nextHistory.slice();
        const milestones = detectMilestones(before, after, enriched);
        if (milestones.length > 0) {
          useToastStore.getState().push(milestones);
        }
      } catch (err) {
        console.error('[game-store] milestone detection failed', err);
      }
    }

    // Re-persist to IDB so the analysis page can pick it up later. Skip if
    // the hand has been removed from IDB (user cleared history, test reset
    // the DB) — otherwise we'd resurrect a "phantom" record.
    try {
      const stillStored = await getHand(enriched.handId);
      if (stillStored) await saveHand(enriched);
    } catch (err) {
      // InvalidStateError fires in tests when the DB is closed between the
      // setTimeout(0) yield and the saveHand call. In production this can't
      // happen (we never close the DB mid-session). Suppress the noise.
      const name = (err as { name?: string } | null)?.name;
      if (name !== 'InvalidStateError') {
        console.error('[game-store] saveHand (analysis) failed', err);
      }
    }
  } finally {
    analysisInFlight.delete(completed.handId);
  }
}
