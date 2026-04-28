import { describe, expect, it } from 'vitest';
import {
  generateRoomCode,
  isProtocolMessage,
  isValidRoomCode,
  normalizeRoomCode,
  type ProtocolMessage,
} from '../protocol';

describe('protocol — room code', () => {
  it('generateRoomCode produces the expected ASCII shape', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      // PeerJS broker requires alphanumerics + - / _ — no unicode.
      expect(code).toMatch(/^hs-\d{4}-[a-z]{2,6}$/);
      // Defensive: must NOT contain any non-ASCII char (Korean would crash broker).
      // eslint-disable-next-line no-control-regex
      expect(code).toMatch(/^[\x00-\x7F]+$/);
    }
  });

  it('isValidRoomCode accepts well-formed codes (romanized syllables)', () => {
    expect(isValidRoomCode('hs-1234-gana')).toBe(true);
    expect(isValidRoomCode('hs-0001-haha')).toBe(true);
    expect(isValidRoomCode('hs-9055-data')).toBe(true);
    expect(isValidRoomCode('hs-7777-chacha')).toBe(true); // 6 chars (cha+cha)
    expect(isValidRoomCode(' hs-1234-gana ')).toBe(true); // trims
    expect(isValidRoomCode('HS-1234-GANA')).toBe(true); // case-insensitive on input
  });

  it('isValidRoomCode rejects malformed codes', () => {
    expect(isValidRoomCode('1234')).toBe(false);
    expect(isValidRoomCode('hs-1234')).toBe(false);
    expect(isValidRoomCode('hs-1234-가나')).toBe(false); // unicode rejected
    expect(isValidRoomCode('hs-1234-a')).toBe(false); // too short
    expect(isValidRoomCode('hs-1234-abcdefg')).toBe(false); // too long (max 6)
    expect(isValidRoomCode('hs-12345-gana')).toBe(false); // too many digits
    expect(isValidRoomCode('hs-1234-da_ta')).toBe(false); // underscore not allowed
    expect(isValidRoomCode('')).toBe(false);
  });

  it('normalizeRoomCode trims whitespace and lowercases', () => {
    expect(normalizeRoomCode('  hs-1234-gana\n')).toBe('hs-1234-gana');
    expect(normalizeRoomCode('HS-1234-GANA')).toBe('hs-1234-gana');
  });
});

describe('protocol — message validation', () => {
  const valid: ProtocolMessage[] = [
    { type: 'HELLO', name: 'Alice', peerId: 'hs-1234-gana' },
    {
      type: 'HAND_START',
      state: {} as never,
      deckSeed: 42,
      handNumber: 1,
    },
    {
      type: 'STATE_UPDATE',
      state: {} as never,
    },
    {
      type: 'HAND_END',
      state: {} as never,
      winners: ['a'],
      endedBy: 'fold',
      deckSnapshot: [],
      deckSeed: 1,
      potAwarded: 10,
    },
    { type: 'ACTION', playerId: 'a', action: 'fold', timestamp: 1 },
    { type: 'NEXT_HAND' },
    { type: 'ACK', messageId: 'm1' },
    { type: 'CHAT', message: 'hi', fromName: 'Alice' },
    { type: 'PING', timestamp: 1 },
    { type: 'PONG', timestamp: 1 },
    { type: 'RESYNC_REQUEST' },
    { type: 'RESYNC_RESPONSE', state: {} as never },
    { type: 'LEAVE' },
  ];

  it('isProtocolMessage accepts all defined message types', () => {
    for (const msg of valid) {
      expect(isProtocolMessage(msg)).toBe(true);
    }
  });

  it('isProtocolMessage rejects malformed objects', () => {
    expect(isProtocolMessage(null)).toBe(false);
    expect(isProtocolMessage(undefined)).toBe(false);
    expect(isProtocolMessage(42)).toBe(false);
    expect(isProtocolMessage('hello')).toBe(false);
    expect(isProtocolMessage({})).toBe(false);
    expect(isProtocolMessage({ type: 'UNKNOWN' })).toBe(false);
    expect(isProtocolMessage({ type: 42 })).toBe(false);
  });
});
