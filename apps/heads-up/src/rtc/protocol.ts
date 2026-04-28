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

export interface AckMessage {
  type: 'ACK';
  messageId: string;
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

/** Guest → Host: guest's local state seems off; please retransmit. */
export interface ResyncRequestMessage {
  type: 'RESYNC_REQUEST';
}

/** Host → Guest: reply with the canonical state. */
export interface ResyncResponseMessage {
  type: 'RESYNC_RESPONSE';
  state: GameState;
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
  | AckMessage
  | ChatMessage
  | PingMessage
  | PongMessage
  | ResyncRequestMessage
  | ResyncResponseMessage
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
    'ACK',
    'CHAT',
    'PING',
    'PONG',
    'RESYNC_REQUEST',
    'RESYNC_RESPONSE',
    'LEAVE',
  ];
  return validTypes.includes(obj.type);
}

/* Room code: "hs-NNNN-XXYY" — short, memorable, prefixed to avoid accidental
 * collision with other PeerJS-using apps on the public broker.
 *
 * IMPORTANT: PeerJS public broker validates peer IDs against an ASCII-only
 * regex (roughly /^[A-Za-z0-9_-]+$/). Korean characters are rejected — every
 * `createRoom` attempt fails with "ID is invalid". So we use romanized Korean
 * syllables (ga, na, da, …) to preserve the Korean feel while staying ASCII.
 *
 * Combinations: 14 × 14 = 196 syllable pairs × 10000 numeric = ~2M codes.
 * Plenty for a small practice app on a free broker.
 */

const KR_SYLLABLES = [
  'ga',
  'na',
  'da',
  'ra',
  'ma',
  'ba',
  'sa',
  'ya',
  'ja',
  'cha',
  'ka',
  'ta',
  'pa',
  'ha',
] as const;

// Match the actual code shape: hs-NNNN-{2..6 lowercase ascii letters}
// (cha + cha = 6 chars max). PeerJS-broker safe.
const ROOM_CODE_REGEX = /^hs-\d{4}-[a-z]{2,6}$/;

export function generateRoomCode(): string {
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const c1 = KR_SYLLABLES[Math.floor(Math.random() * KR_SYLLABLES.length)];
  const c2 = KR_SYLLABLES[Math.floor(Math.random() * KR_SYLLABLES.length)];
  return `hs-${digits}-${c1}${c2}`;
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code.trim().toLowerCase());
}

export function normalizeRoomCode(input: string): string {
  // Lowercase too — users may type "HS-1234-DATA" but the broker is
  // case-sensitive and we generate lowercase.
  return input.trim().toLowerCase();
}
