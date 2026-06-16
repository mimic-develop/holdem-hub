import type { Card } from '../engine/card';
import type { GameState, PlayerAction } from '../types/game';

/** Initial handshake — name exchange. */
export interface HelloMessage {
  type: 'HELLO';
  name: string;
  peerId: string;
}

/** Host → Guest: a new hand starts. Includes hand-start state & the deck seed
 *  so the guest can verify the hand after it ends. */
export interface HandStartMessage {
  type: 'HAND_START';
  state: GameState;
  deckSeed: number;
  handNumber: number;
}

/**
 * Host → Guest: state has changed (after an action was applied or the street
 * advanced). Not in the original spec, but required for host→guest state
 * synchronization — the spec's ACTION message carries the client intent only.
 */
export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  state: GameState;
}

/**
 * Host → Guest: the hand ended. Carries full resolution context including the
 * deck snapshot for guest-side verification. Sent exactly once per hand.
 */
export interface HandEndMessage {
  type: 'HAND_END';
  state: GameState;
  winners: string[];
  endedBy: 'fold' | 'showdown';
  /** Full 52-card deck in deal-order — guest replays the shuffle to audit. */
  deckSnapshot: Card[];
  deckSeed: number;
  potAwarded: number;
}

/** Guest → Host: client action intent. Host applies it to the canonical state. */
export interface ActionMessage {
  type: 'ACTION';
  playerId: string;
  action: PlayerAction;
  amount?: number;
  timestamp: number;
}

/** Guest → Host: request to advance to the next hand (Guest clicked '다음 핸드'). */
export interface NextHandMessage {
  type: 'NEXT_HAND';
}

export interface ChatMessage {
  type: 'CHAT';
  message: string;
  fromName: string;
}

export interface PingMessage {
  type: 'PING';
  timestamp: number;
}

export interface PongMessage {
  type: 'PONG';
  /** Copied from the corresponding PING's timestamp. */
  timestamp: number;
}

/** Either side: explicit bye. */
export interface LeaveMessage {
  type: 'LEAVE';
}

export type ProtocolMessage =
  | HelloMessage
  | HandStartMessage
  | StateUpdateMessage
  | HandEndMessage
  | ActionMessage
  | NextHandMessage
  | ChatMessage
  | PingMessage
  | PongMessage
  | LeaveMessage;

export function isProtocolMessage(x: unknown): x is ProtocolMessage {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as { type?: unknown };
  if (typeof obj.type !== 'string') return false;
  const validTypes = [
    'HELLO',
    'HAND_START',
    'STATE_UPDATE',
    'HAND_END',
    'ACTION',
    'NEXT_HAND',
    'CHAT',
    'PING',
    'PONG',
    'LEAVE',
  ];
  return validTypes.includes(obj.type);
}

/* Room code: a simple 4-digit number ("7392") — easy to read out loud / type.
 *
 * The code the user sees and types is just the 4 digits. The actual PeerJS
 * peer id is the code with an `hs-` prefix (→ "hs-7392"): the public broker
 * (`0.peerjs.com`) is shared globally, so a bare "7392" would collide with
 * other PeerJS apps' ids. The prefix namespaces us. Use `peerIdForRoom()`
 * whenever you need the broker-facing id; keep the bare code for display.
 *
 * Space: 10000 codes — plenty for a small practice app (createRoom retries on
 * the rare "id taken" collision).
 */

const ROOM_ID_PREFIX = 'hs-';
const ROOM_CODE_REGEX = /^\d{4}$/;

export function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code.trim());
}

export function normalizeRoomCode(input: string): string {
  // Keep digits only — tolerate stray spaces/dashes a user might paste.
  return input.replace(/\D/g, '').slice(0, 4);
}

/** Map a user-facing room code ("7392") to its broker-safe peer id ("hs-7392"). */
export function peerIdForRoom(code: string): string {
  return `${ROOM_ID_PREFIX}${code}`;
}
