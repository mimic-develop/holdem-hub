import { describe, expect, it } from 'vitest';
import {
  generateRoomCode,
  isProtocolMessage,
  isValidRoomCode,
  normalizeRoomCode,
  peerIdForRoom,
  type ProtocolMessage,
} from '../protocol';

describe('protocol — room code', () => {
  it('generateRoomCode produces a 4-digit numeric code', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^\d{4}$/);
    }
  });

  it('isValidRoomCode accepts 4-digit codes', () => {
    expect(isValidRoomCode('1234')).toBe(true);
    expect(isValidRoomCode('0001')).toBe(true);
    expect(isValidRoomCode('0000')).toBe(true);
    expect(isValidRoomCode('9999')).toBe(true);
    expect(isValidRoomCode(' 7392 ')).toBe(true); // trims
  });

  it('isValidRoomCode rejects malformed codes', () => {
    expect(isValidRoomCode('123')).toBe(false); // too short
    expect(isValidRoomCode('12345')).toBe(false); // too long
    expect(isValidRoomCode('12a4')).toBe(false); // non-digit
    expect(isValidRoomCode('hs-1234')).toBe(false); // prefix is internal only
    expect(isValidRoomCode('가나다라')).toBe(false); // unicode
    expect(isValidRoomCode('')).toBe(false);
  });

  it('normalizeRoomCode keeps digits only, capped at 4', () => {
    expect(normalizeRoomCode('  7392\n')).toBe('7392');
    expect(normalizeRoomCode('73-92')).toBe('7392'); // strips dashes
    expect(normalizeRoomCode('7392x')).toBe('7392'); // strips letters
    expect(normalizeRoomCode('123456')).toBe('1234'); // caps at 4
  });

  it('peerIdForRoom prefixes the code for broker namespacing', () => {
    expect(peerIdForRoom('7392')).toBe('hs-7392');
    expect(peerIdForRoom('0001')).toBe('hs-0001');
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
    { type: 'CHAT', message: 'hi', fromName: 'Alice' },
    { type: 'PING', timestamp: 1 },
    { type: 'PONG', timestamp: 1 },
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
