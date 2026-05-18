import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../engine/card';
import { classifyHand, handKey } from '../handClassifier';

function card(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

describe('handKey', () => {
  it('returns pair key for pocket pair', () => {
    expect(handKey(card(14, 's'), card(14, 'h'))).toBe('AA');
    expect(handKey(card(7, 's'), card(7, 'h'))).toBe('77');
  });

  it('higher rank first for unpaired', () => {
    expect(handKey(card(13, 's'), card(14, 's'))).toBe('AKs');
    expect(handKey(card(14, 's'), card(13, 'h'))).toBe('AKo');
  });
});

describe('classifyHand', () => {
  it('classifies premium', () => {
    expect(classifyHand(card(14, 's'), card(14, 'h'))).toBe('premium');
    expect(classifyHand(card(14, 's'), card(13, 's'))).toBe('premium');
    expect(classifyHand(card(14, 's'), card(13, 'h'))).toBe('premium');
  });

  it('classifies strong', () => {
    expect(classifyHand(card(9, 's'), card(9, 'h'))).toBe('strong');
    expect(classifyHand(card(14, 's'), card(11, 's'))).toBe('strong'); // AJs
  });

  it('classifies trash', () => {
    expect(classifyHand(card(7, 's'), card(2, 'h'))).toBe('trash');  // 72o
    expect(classifyHand(card(8, 's'), card(3, 'c'))).toBe('trash');  // 83o
  });

  it('classifies playable as fallback', () => {
    expect(classifyHand(card(10, 's'), card(9, 's'))).toBe('playable');  // T9s
    expect(classifyHand(card(11, 's'), card(10, 'h'))).toBe('playable'); // JTo
  });
});
