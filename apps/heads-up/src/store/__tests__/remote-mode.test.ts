import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeerConnection, ConnectionStatus } from '../../rtc/peer-connection';
import type { ProtocolMessage } from '../../rtc/protocol';
import { useGameStore } from '../game-store';
import { _resetDBForTests } from '../../storage/history';

/**
 * A MockPeer captures outgoing `send()` calls and lets tests inject incoming
 * messages via `fireMessage()`. No real network, no PeerJS broker.
 */
class MockPeer implements Partial<PeerConnection> {
  sent: ProtocolMessage[] = [];
  private messageHandler: ((msg: ProtocolMessage) => void) | null = null;
  private statusHandler: ((s: ConnectionStatus) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private reconnectHandler: (() => void) | null = null;
  private status: ConnectionStatus = 'CONNECTED';

  constructor(public peerId: string) {}

  getMyPeerId(): string {
    return this.peerId;
  }
  getStatus(): ConnectionStatus {
    return this.status;
  }
  send(msg: ProtocolMessage): void {
    this.sent.push(msg);
  }
  onMessage(h: (m: ProtocolMessage) => void): void {
    this.messageHandler = h;
  }
  onStatusChange(h: (s: ConnectionStatus) => void): void {
    this.statusHandler = h;
  }
  onDisconnect(h: () => void): void {
    this.disconnectHandler = h;
  }
  onReconnect(h: () => void): void {
    this.reconnectHandler = h;
  }
  close(): void {
    this.status = 'DISCONNECTED';
    this.statusHandler?.('DISCONNECTED');
  }

  // Test utilities
  fireMessage(msg: ProtocolMessage): void {
    this.messageHandler?.(msg);
  }
  fireDisconnect(): void {
    this.disconnectHandler?.();
  }
  fireReconnect(): void {
    this.reconnectHandler?.();
  }
}

async function resetDB() {
  await _resetDBForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('heads-up:headsup-solo');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await resetDB();
});

afterEach(async () => {
  useGameStore.getState().resetGame();
  await resetDB();
  vi.useRealTimers();
});

describe('game-store — REMOTE host flow', () => {
  it('attach + receive HELLO → host immediately deals hand 1 and broadcasts HAND_START', () => {
    const peer = new MockPeer('hs-host-id');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host-id',
    });

    expect(useGameStore.getState().mode).toBe('REMOTE');
    expect(useGameStore.getState().isHost).toBe(true);
    expect(useGameStore.getState().myPlayerId).toBe('hs-host-id');
    // HELLO was sent on attach.
    const hello = peer.sent.find((m) => m.type === 'HELLO');
    expect(hello).toBeDefined();

    // Simulate guest's HELLO arrival.
    peer.fireMessage({ type: 'HELLO', name: 'Guest', peerId: 'hs-guest-id' });
    const s = useGameStore.getState();
    expect(s.opponentPlayerId).toBe('hs-guest-id');
    expect(s.opponentName).toBe('Guest');
    expect(s.gameState).not.toBeNull();
    expect(s.handNumber).toBe(1);

    // HAND_START should have been sent with host's cards stripped.
    const handStart = peer.sent.find((m) => m.type === 'HAND_START');
    expect(handStart).toBeDefined();
    if (handStart?.type === 'HAND_START') {
      const hostPlayer = handStart.state.players.find((p) => p.id === 'hs-host-id');
      const guestPlayer = handStart.state.players.find((p) => p.id === 'hs-guest-id');
      expect(hostPlayer?.holeCards).toBeNull(); // stripped
      expect(guestPlayer?.holeCards).toHaveLength(2); // visible
      expect(handStart.deckSeed).toBeGreaterThanOrEqual(0);
    }
  });

  it('host applies incoming ACTION and broadcasts STATE_UPDATE', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    // Host is SB, acts first preflop. But we want guest to act; guest is BB.
    // So preflop: host (SB) acts first. Host has the turn. Guest can't ACTION yet.
    // Let's have HOST act first via applyMyAction (call).
    const s1 = useGameStore.getState();
    expect(s1.gameState!.toActId).toBe('hs-host');
    useGameStore.getState().applyMyAction('call', 1);
    const s2 = useGameStore.getState();
    // Turn should now be guest's.
    expect(s2.gameState!.toActId).toBe('hs-guest');
    // STATE_UPDATE should have been sent (host's cards stripped).
    const updates = peer.sent.filter((m) => m.type === 'STATE_UPDATE');
    expect(updates.length).toBeGreaterThan(0);

    // Now simulate guest's ACTION (check).
    peer.fireMessage({
      type: 'ACTION',
      playerId: 'hs-guest',
      action: 'check',
      timestamp: Date.now(),
    });
    const s3 = useGameStore.getState();
    // preflop check-check → flop dealt.
    expect(s3.gameState!.street).toBe('flop');
  });

  it('host sends HAND_END with deckSnapshot when hand resolves', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    // Host (SB) folds immediately.
    useGameStore.getState().applyMyAction('fold');
    const handEnd = peer.sent.find((m) => m.type === 'HAND_END');
    expect(handEnd).toBeDefined();
    if (handEnd?.type === 'HAND_END') {
      expect(handEnd.deckSnapshot).toHaveLength(52);
      expect(handEnd.winners).toEqual(['hs-guest']);
      expect(handEnd.endedBy).toBe('fold');
    }
  });

  it('HAND_END on fold strips host hole cards (no card leak)', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    useGameStore.getState().applyMyAction('fold');
    const handEnd = peer.sent.find((m) => m.type === 'HAND_END');
    expect(handEnd?.type).toBe('HAND_END');
    if (handEnd?.type === 'HAND_END') {
      const hostPlayer = handEnd.state.players.find((p) => p.id === 'hs-host');
      expect(hostPlayer?.holeCards).toBeNull(); // stripped on fold
      const guestPlayer = handEnd.state.players.find((p) => p.id === 'hs-guest');
      expect(guestPlayer?.holeCards).toHaveLength(2); // guest's own cards OK
    }
  });

  it('onReconnect sends HELLO so host announces itself after guest connects', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    const sentBefore = peer.sent.length;
    // Simulate the DataConnection opening now that the guest has connected.
    peer.fireReconnect();
    const newSent = peer.sent.slice(sentBefore);
    const hello = newSent.find((m) => m.type === 'HELLO');
    expect(hello).toBeDefined();
    if (hello?.type === 'HELLO') {
      expect(hello.name).toBe('Host');
      expect(hello.peerId).toBe('hs-host');
    }
  });

  it('double startNextHand triggers do not skip hand numbers (race guard)', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    // Finish hand 1 via host fold.
    useGameStore.getState().applyMyAction('fold');
    expect(useGameStore.getState().isHandOver).toBe(true);
    // Host clicks "다음 핸드" locally.
    useGameStore.getState().startNextHand();
    expect(useGameStore.getState().handNumber).toBe(2);
    expect(useGameStore.getState().isHandOver).toBe(false);
    // Now guest's NEXT_HAND arrives late — host must NOT create hand 3.
    peer.fireMessage({ type: 'NEXT_HAND' });
    expect(useGameStore.getState().handNumber).toBe(2);
  });
});

describe('game-store — REMOTE guest flow', () => {
  it('guest receives HAND_START and updates gameState', () => {
    const peer = new MockPeer('hs-guest');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: false,
      myName: 'Guest',
      roomCode: 'hs-host',
      opponentPeerId: 'hs-host',
    });

    expect(useGameStore.getState().gameState).toBeNull();

    peer.fireMessage({ type: 'HELLO', name: 'Host', peerId: 'hs-host' });
    // Simulate host sending HAND_START.
    peer.fireMessage({
      type: 'HAND_START',
      deckSeed: 42,
      handNumber: 1,
      state: {
        players: [
          {
            id: 'hs-host',
            stack: 199,
            holeCards: null, // stripped by host
            position: 'SB',
            hasFolded: false,
            currentBet: 1,
          },
          {
            id: 'hs-guest',
            stack: 198,
            holeCards: [
              { suit: 's', rank: 14 },
              { suit: 'h', rank: 14 },
            ],
            position: 'BB',
            hasFolded: false,
            currentBet: 2,
          },
        ],
        board: [],
        pot: 3,
        street: 'preflop',
        currentBet: 2,
        minRaise: 2,
        toActId: 'hs-host',
        bigBlind: 2,
        smallBlind: 1,
        history: [],
      },
    });
    const s = useGameStore.getState();
    expect(s.gameState).not.toBeNull();
    expect(s.gameState!.pot).toBe(3);
    expect(s.handNumber).toBe(1);
    const me = s.gameState!.players.find((p) => p.id === 'hs-guest');
    expect(me!.holeCards).toHaveLength(2);
  });

  it('guest applyMyAction sends ACTION and sets isSendingAction', () => {
    const peer = new MockPeer('hs-guest');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: false,
      myName: 'Guest',
      roomCode: 'hs-host',
      opponentPeerId: 'hs-host',
    });
    // Set minimal guest state so applyMyAction doesn't bail early.
    peer.fireMessage({
      type: 'HAND_START',
      deckSeed: 1,
      handNumber: 1,
      state: {
        players: [
          {
            id: 'hs-host',
            stack: 199,
            holeCards: null,
            position: 'SB',
            hasFolded: false,
            currentBet: 1,
          },
          {
            id: 'hs-guest',
            stack: 198,
            holeCards: [
              { suit: 's', rank: 14 },
              { suit: 'h', rank: 14 },
            ],
            position: 'BB',
            hasFolded: false,
            currentBet: 2,
          },
        ],
        board: [],
        pot: 3,
        street: 'preflop',
        currentBet: 2,
        minRaise: 2,
        toActId: 'hs-guest', // guest's turn
        bigBlind: 2,
        smallBlind: 1,
        history: [],
      },
    });
    // Capture pre-existing sent messages (HELLO).
    const sentBefore = peer.sent.length;
    useGameStore.getState().applyMyAction('call', 1);
    const newMsgs = peer.sent.slice(sentBefore);
    const action = newMsgs.find((m) => m.type === 'ACTION');
    expect(action).toBeDefined();
    if (action?.type === 'ACTION') {
      expect(action.playerId).toBe('hs-guest');
      expect(action.action).toBe('call');
    }
    expect(useGameStore.getState().isSendingAction).toBe(true);
  });

  it('guest records opponentName when HELLO arrives', () => {
    const peer = new MockPeer('hs-guest');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: false,
      myName: 'Guest',
      roomCode: 'hs-host',
      opponentPeerId: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'TheHost', peerId: 'hs-host' });
    expect(useGameStore.getState().opponentName).toBe('TheHost');
  });

  it('guest computes evaluations locally on showdown HAND_END', async () => {
    const peer = new MockPeer('hs-guest');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: false,
      myName: 'Guest',
      roomCode: 'hs-host',
      opponentPeerId: 'hs-host',
    });
    peer.fireMessage({
      type: 'HAND_START',
      deckSeed: 1,
      handNumber: 1,
      state: {
        players: [
          { id: 'hs-host', stack: 100, holeCards: null, position: 'SB', hasFolded: false, currentBet: 1 },
          { id: 'hs-guest', stack: 100, holeCards: [
            { suit: 'c', rank: 9 }, { suit: 'd', rank: 9 },
          ], position: 'BB', hasFolded: false, currentBet: 2 },
        ],
        board: [],
        pot: 3,
        street: 'preflop',
        currentBet: 2,
        minRaise: 2,
        toActId: 'hs-host',
        bigBlind: 2,
        smallBlind: 1,
        history: [],
      },
    });
    // Simulate a showdown HAND_END with all 5 board cards + both hole cards visible.
    peer.fireMessage({
      type: 'HAND_END',
      state: {
        players: [
          { id: 'hs-host', stack: 0, holeCards: [
            { suit: 's', rank: 14 }, { suit: 'h', rank: 14 },
          ], position: 'SB', hasFolded: false, currentBet: 100 },
          { id: 'hs-guest', stack: 0, holeCards: [
            { suit: 'c', rank: 9 }, { suit: 'd', rank: 9 },
          ], position: 'BB', hasFolded: false, currentBet: 100 },
        ],
        board: [
          { suit: 'h', rank: 7 },
          { suit: 'd', rank: 2 },
          { suit: 's', rank: 3 },
          { suit: 'c', rank: 4 },
          { suit: 'h', rank: 5 },
        ],
        pot: 200,
        street: 'river',
        currentBet: 100,
        minRaise: 2,
        toActId: 'hs-host',
        bigBlind: 2,
        smallBlind: 1,
        history: [],
      },
      winners: ['hs-host'],
      endedBy: 'showdown',
      deckSnapshot: Array.from({ length: 52 }, () => ({ suit: 's' as const, rank: 2 as const })),
      deckSeed: 1,
      potAwarded: 200,
    });
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.isHandOver).toBe(true);
    // fakeResolution should now carry evaluations so HandResultOverlay can
    // display the hand rank.
    expect(s.lastResolution?.evaluations).toBeDefined();
    expect(s.lastResolution?.evaluations?.['hs-host']).toBeDefined();
    expect(s.lastResolution?.evaluations?.['hs-guest']).toBeDefined();
  });

  it('guest sets opponentLeft on LEAVE', () => {
    const peer = new MockPeer('hs-guest');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: false,
      myName: 'Guest',
      roomCode: 'hs-host',
      opponentPeerId: 'hs-host',
    });
    peer.fireMessage({ type: 'LEAVE' });
    expect(useGameStore.getState().opponentLeft).toBe(true);
  });

  it('guest flags deck verification failure on bad snapshot', async () => {
    const peer = new MockPeer('hs-guest');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: false,
      myName: 'Guest',
      roomCode: 'hs-host',
      opponentPeerId: 'hs-host',
    });
    // Minimal state required for buildCompletedHand.
    peer.fireMessage({
      type: 'HAND_START',
      deckSeed: 42,
      handNumber: 1,
      state: {
        players: [
          {
            id: 'hs-host',
            stack: 199,
            holeCards: null,
            position: 'SB',
            hasFolded: false,
            currentBet: 1,
          },
          {
            id: 'hs-guest',
            stack: 198,
            holeCards: [
              { suit: 's', rank: 14 },
              { suit: 'h', rank: 14 },
            ],
            position: 'BB',
            hasFolded: false,
            currentBet: 2,
          },
        ],
        board: [],
        pot: 3,
        street: 'preflop',
        currentBet: 2,
        minRaise: 2,
        toActId: 'hs-host',
        bigBlind: 2,
        smallBlind: 1,
        history: [],
      },
    });
    // Send HAND_END with a blatantly-wrong deckSnapshot.
    peer.fireMessage({
      type: 'HAND_END',
      state: {
        players: [
          {
            id: 'hs-host',
            stack: 201,
            holeCards: null,
            position: 'SB',
            hasFolded: false,
            currentBet: 1,
          },
          {
            id: 'hs-guest',
            stack: 198,
            holeCards: [
              { suit: 's', rank: 14 },
              { suit: 'h', rank: 14 },
            ],
            position: 'BB',
            hasFolded: true,
            currentBet: 2,
          },
        ],
        board: [],
        pot: 0,
        street: 'preflop',
        currentBet: 2,
        minRaise: 2,
        toActId: 'hs-host',
        bigBlind: 2,
        smallBlind: 1,
        history: [
          { playerId: 'hs-guest', action: 'fold', amount: 0, street: 'preflop' },
        ],
      },
      winners: ['hs-host'],
      endedBy: 'fold',
      deckSnapshot: Array.from({ length: 52 }, () => ({ suit: 's' as const, rank: 2 as const })),
      deckSeed: 42,
      potAwarded: 3,
    });
    // Let save promise settle.
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.deckVerificationFailed).toBe(true);
    expect(s.isHandOver).toBe(true);
  });
});

describe('game-store — REMOTE chat + ping', () => {
  it('incoming CHAT with oversized text is clipped to 200 chars', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    const huge = 'x'.repeat(10_000);
    peer.fireMessage({ type: 'CHAT', message: huge, fromName: 'G' });
    const msgs = useGameStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text.length).toBe(200);
  });

  it('incoming CHAT with empty message is ignored', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    peer.fireMessage({ type: 'CHAT', message: '   ', fromName: 'G' });
    expect(useGameStore.getState().chatMessages).toHaveLength(0);
  });

  it('incoming CHAT is appended to chatMessages', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    peer.fireMessage({ type: 'CHAT', message: 'hello', fromName: 'Guest' });
    expect(useGameStore.getState().chatMessages).toHaveLength(1);
    expect(useGameStore.getState().chatMessages[0].text).toBe('hello');
  });

  it('sendChat appends locally and sends over wire', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'HELLO', name: 'G', peerId: 'hs-guest' });
    const sentBefore = peer.sent.length;
    useGameStore.getState().sendChat('gg');
    const newSent = peer.sent.slice(sentBefore);
    expect(newSent.find((m) => m.type === 'CHAT')).toBeDefined();
    expect(useGameStore.getState().chatMessages.some((c) => c.text === 'gg')).toBe(true);
  });

  it('host replies to PING with PONG; pingMs updates on PONG', () => {
    const peer = new MockPeer('hs-host');
    useGameStore.getState().attachRemoteConnection({
      peer: peer as unknown as PeerConnection,
      isHost: true,
      myName: 'Host',
      roomCode: 'hs-host',
    });
    peer.fireMessage({ type: 'PING', timestamp: 1000 });
    const pong = peer.sent.find((m) => m.type === 'PONG');
    expect(pong).toBeDefined();
    if (pong?.type === 'PONG') expect(pong.timestamp).toBe(1000);

    peer.fireMessage({ type: 'PONG', timestamp: Date.now() - 123 });
    expect(useGameStore.getState().pingMs).toBeGreaterThan(0);
  });
});
