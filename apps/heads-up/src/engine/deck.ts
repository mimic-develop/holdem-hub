import { ALL_RANKS, ALL_SUITS, type Card } from './card';

function makeFreshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

export class Deck {
  private cards: Card[];
  private readonly rng: (() => number) | null;

  constructor(seed?: number) {
    this.cards = makeFreshDeck();
    this.rng = seed !== undefined ? mulberry32(seed) : null;
  }

  shuffle(): void {
    const n = this.cards.length;
    if (n <= 1) return;
    const rand = new Uint32Array(n);
    if (this.rng) {
      for (let i = 0; i < n; i++) rand[i] = this.rng();
    } else {
      crypto.getRandomValues(rand);
    }
    for (let i = n - 1; i > 0; i--) {
      const j = rand[i] % (i + 1);
      const tmp = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = tmp;
    }
  }

  deal(): Card {
    const card = this.cards.pop();
    if (!card) throw new Error('Deck is empty');
    return card;
  }

  remaining(): number {
    return this.cards.length;
  }

  snapshot(): Card[] {
    return this.cards.slice();
  }
}
