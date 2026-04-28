/**
 * pot-quiz 앱 전용 게임 타입.
 * 도메인 코어 타입(Card, HandRank, HandEvaluation, Pot 등)은 `@hh/poker-engine`에서 import.
 */

// 호환을 위해 도메인 타입도 여기서 re-export (pages들이 `from '../types/poker'` 같은 옛 경로를 쓸 수 있어서)
export type {
  Rank,
  Suit,
  Card,
  HandRank,
  HandEvaluation,
  Pot,
  PotResult,
} from "@hh/poker-engine";

export interface PlayerPuzzleData {
  id: string;
  name: string;
  cards: string[];
  invested: number;
}

export type PuzzleDifficulty = "easy" | "medium" | "hard";
export type Difficulty = PuzzleDifficulty | "all";

export interface BlindInfo {
  sb: number;
  bb: number;
  ante: number;
  deadMoney: number;
}

export interface Puzzle {
  id: string;
  difficulty: PuzzleDifficulty;
  titleKo: string;
  descKo: string;
  players: PlayerPuzzleData[];
  board: string[];
  blindInfo?: BlindInfo;
}

export interface GameState {
  difficulty: Difficulty;
  puzzles: Puzzle[];
  currentIndex: number;
  score: number;
  streak: number;
  maxStreak: number;
  correctCount: number;
  totalAnswered: number;
}

export interface SessionResult {
  puzzleId: string;
  correct: boolean;
  timeLeft: number;
  pointsEarned: number;
}
