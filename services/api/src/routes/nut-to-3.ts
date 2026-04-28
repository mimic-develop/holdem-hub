/**
 * @hh/api — Nut-to-3 라우터 (`/api/nut-to-3`)
 *
 * 원본 Nut-to-3/server/routes.ts를 prefix 변경(`/api/game/new` → `/api/nut-to-3/game/new`)만
 * 적용해 이식. 보드 생성 + 3 스트릿(플랍/턴/리버) 별 상위 3 너트 티어 계산.
 */
import { Router } from "express";
import { extractNutTiers, type NutTier } from "../lib/poker-engine.js";

export const nutTo3Router = Router();

const FULL_DECK: string[] = [];
for (const suit of ["s", "h", "d", "c"]) {
  for (const rank of ["2","3","4","5","6","7","8","9","T","J","Q","K","A"]) {
    FULL_DECK.push(rank + suit);
  }
}

function generateRandomBoard(): string[] {
  const shuffled = [...FULL_DECK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

const PLAIN_FLUSH = "플러시";
const PLAIN_QUADS = "포카드";

/**
 * Extract enough tiers, apply special skip rules, return top 3.
 *
 * Skip rules:
 *  1. 플러시 — 첫 플러시만 보존, 이후 플러시 티어는 모두 스킵.
 *  2. 원핸드 포카드 — 1장의 홀카드만으로 포카드가 가능한 티어가 등장하면, 그 이후 모든 포카드 티어 스킵.
 *
 * 50개까지 깊게 보는 이유: 플러시-heavy 보드는 45개 이상의 플러시 티어를 가질 수 있음.
 */
function getStreetTiers(board: string[]): NutTier[] {
  const raw = extractNutTiers(board, 50);
  let seenFlush = false;
  let seenOneHandQuads = false;
  const filtered = raw.filter(t => {
    if (t.koreanDescr === PLAIN_FLUSH) {
      if (seenFlush) return false;
      seenFlush = true;
      return true;
    }
    if (t.koreanDescr === PLAIN_QUADS) {
      if (seenOneHandQuads) return false;
      if (t.validSingleCards.length > 0) seenOneHandQuads = true;
      return true;
    }
    return true;
  });
  return filtered.slice(0, 3);
}

nutTo3Router.get("/game/new", (req, res) => {
  try {
    const noFlush = req.query.noFlush === "true" || req.query.noFlush === "1";
    const avoidNutTypesRaw = typeof req.query.avoidNutTypes === "string" ? req.query.avoidNutTypes : "";
    const avoidNutTypes = avoidNutTypesRaw
      ? avoidNutTypesRaw.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    let board: string[] = [];
    let flopTiers: NutTier[] = [];
    let turnTiers: NutTier[] = [];
    let riverTiers: NutTier[] = [];

    const MAX_ATTEMPTS = 50;

    const tryGenerate = (useAvoid: boolean) => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        board = generateRandomBoard();

        riverTiers = getStreetTiers(board);
        if (riverTiers.length < 3) continue;

        // Skip boards whose river Nut type was recently seen
        if (useAvoid && avoidNutTypes.length > 0 && avoidNutTypes.includes(riverTiers[0].koreanDescr)) continue;

        flopTiers = getStreetTiers(board.slice(0, 3));
        turnTiers = getStreetTiers(board.slice(0, 4));

        if (flopTiers.length < 3 || turnTiers.length < 3) continue;

        if (noFlush) {
          const rawFlop  = extractNutTiers(board.slice(0, 3), 4);
          const rawTurn  = extractNutTiers(board.slice(0, 4), 4);
          const rawRiver = extractNutTiers(board, 4);
          const isFlush  = (t: NutTier) => t.koreanDescr === PLAIN_FLUSH;
          if (rawFlop.some(isFlush) || rawTurn.some(isFlush) || rawRiver.some(isFlush)) continue;
        }

        return true;
      }
      return false;
    };

    // Try with avoidNutTypes first; fall back without if no valid board found
    if (!tryGenerate(true)) {
      tryGenerate(false);
    }

    if (riverTiers.length < 3) {
      return res.status(500).json({ error: "보드에서 3가지 서로 다른 족보를 찾을 수 없습니다." });
    }

    return res.json({
      board,
      streets: [
        { name: "플랍", board: board.slice(0, 3), tiers: flopTiers },
        { name: "턴",   board: board.slice(0, 4), tiers: turnTiers },
        { name: "리버", board,                    tiers: riverTiers },
      ],
    });
  } catch (error) {
    console.error("Error generating nut-to-3 game:", error);
    return res.status(500).json({ error: "게임 생성 중 오류가 발생했습니다." });
  }
});
