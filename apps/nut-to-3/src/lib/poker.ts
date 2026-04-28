// Helper functions for parsing and displaying poker cards

export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface ParsedCard {
  rank: Rank;
  suit: Suit;
  displayRank: string;
  suitSymbol: string;
  colorClass: string;
}

export function parseCard(cardString: string): ParsedCard {
  if (!cardString || cardString.length !== 2) {
    throw new Error(`Invalid card string: ${cardString}`);
  }

  const rank = cardString.charAt(0) as Rank;
  const suit = cardString.charAt(1).toLowerCase() as Suit;

  const displayRank = rank === 'T' ? '10' : rank;
  
  let suitSymbol = '';
  let colorClass = '';

  switch (suit) {
    case 'h':
      suitSymbol = '♥';
      colorClass = 'playing-card-red';
      break;
    case 'd':
      suitSymbol = '♦';
      colorClass = 'playing-card-red';
      break;
    case 'c':
      suitSymbol = '♣';
      colorClass = 'playing-card-black';
      break;
    case 's':
      suitSymbol = '♠';
      colorClass = 'playing-card-black';
      break;
  }

  return { rank, suit, displayRank, suitSymbol, colorClass };
}
