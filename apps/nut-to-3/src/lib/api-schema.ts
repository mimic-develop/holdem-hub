/**
 * Nut-to-3 API contract — 클라이언트 측 zod 스키마.
 *
 * 원본 `Nut-to-3/shared/{schema,routes}.ts`를 합치고
 * 경로를 monorepo 규칙에 맞게 prefix(`/api/nut-to-3`) 적용.
 */
import { z } from "zod";

export const nutTierSchema = z.object({
  koreanDescr: z.string(),
  descr: z.string(),
  validCombos: z.array(z.array(z.string())),
  validSingleCards: z.array(z.string()),
  isBoardPlay: z.boolean(),
  exampleCards: z.array(z.string()),
  exampleDescr: z.string(),
});

export const streetSchema = z.object({
  name: z.string(),
  board: z.array(z.string()),
  tiers: z.array(nutTierSchema),
});

export const gameStateSchema = z.object({
  board: z.array(z.string()),
  streets: z.array(streetSchema),
});

export type NutTier = z.infer<typeof nutTierSchema>;
export type Street = z.infer<typeof streetSchema>;
export type GameState = z.infer<typeof gameStateSchema>;

export const api = {
  game: {
    new: {
      method: "GET" as const,
      path: "/api/nut-to-3/game/new" as const,
      responses: {
        200: gameStateSchema,
      },
    },
  },
};
