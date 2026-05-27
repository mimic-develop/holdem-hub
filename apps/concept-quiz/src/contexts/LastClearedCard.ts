import { createContext } from "react";

export interface LastClearedCardValue {
  category: string;
  difficulty: string;
}

export const LastClearedCardContext = createContext<LastClearedCardValue | null>(null);
