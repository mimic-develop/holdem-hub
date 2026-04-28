# CLAUDE.md — @hh/poker-engine (포커 도메인 코어)

## 정체성

순수 포커 도메인 로직: 카드 타입, 손패 평가, 팟 분배, 카드 유틸. **React/DOM 의존 절대 금지** —
모바일 / Node / 웹 워커 어디서든 재사용 가능해야 함.

`pokersolver` 라이브러리를 hand 평가에 활용 (단, 인터페이스로 래핑).

## 공개 API

```ts
import {
  // 카드 타입 / 파싱
  type Card, type Rank, type Suit,
  parseCard, parseCards,         // 관대한 (lenient) 파서
  parseCardStrict,                // 엄격한 (throws)
  formatCard, asCard, fromFullSuit, toFullSuit,
  cardsEqual, tryParseCard,
  SUIT_SYMBOL, isRedSuit, isRedSuitTyped,
  getRankValue, getRankLabel, getSuitSymbol,
  combinations,

  // 손패 평가 / 비교
  type HandRank, type HandEvaluation,
  evaluateHand, compareHands,

  // 팟 빌드 / 분배
  type Pot, type PotResult,
  buildPots, totalPot, resolvePots,

  // 점수 (pot-quiz 전용 스코어)
  PASS_SECONDS, STEP1_PTS, STEP2_PTS, STEP3_PTS,
  calcTimeScore, calcStreakBonus, scoreRanking, scorePayout,
} from "@hh/poker-engine";
```

## 디렉토리

```
packages/poker-engine/
├── src/
│   ├── index.ts             # re-export (with aliasing — 아래 참조)
│   ├── card.ts              # Card 타입 + 파싱/포맷 (엄격 + 관대)
│   └── logic/
│       ├── types.ts         # HandRank, HandEvaluation, Pot, PotResult
│       ├── cardUtils.ts     # parseCard (관대), getRankValue, combinations 등
│       ├── handEvaluator.ts
│       ├── potBuilder.ts
│       ├── potResolver.ts
│       ├── scoring.ts
│       └── __tests__/       # Vitest (현재는 미사용 — vitest config 필요 시 추가)
├── package.json
└── tsconfig.json
```

## 핵심 타입

### `Card`
```ts
type Rank = "2" | "3" | ... | "T" | "J" | "Q" | "K" | "A";
type Suit = "s" | "h" | "d" | "c";
interface Card { rank: Rank; suit: Suit; }
```

### `HandEvaluation`
```ts
type HandRank = "HIGH_CARD" | "ONE_PAIR" | "TWO_PAIR" | "THREE_OF_KIND"
              | "STRAIGHT" | "FLUSH" | "FULL_HOUSE" | "FOUR_OF_KIND" | "STRAIGHT_FLUSH";
interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  tiebreakers: number[];
  bestFive: Card[];
  description: string;
  descriptionKo: string;
}
```

### `Pot`
```ts
interface Pot {
  type: "main" | "side";
  label: string;
  amount: number;
  eligible: string[];  // playerId[]
}
```

## 카드 파서 — 두 종류

`index.ts`에서 alias로 둘 다 export:
- **`parseCard`** (관대) — `card.ts`의 lenient parser. 잘못된 입력엔 `null` 반환.
- **`parseCardStrict`** — `card.ts`의 엄격 parser, 잘못된 입력엔 throw.
- 내부적으로 `logic/cardUtils.ts`에는 또 다른 `parseCard`가 있음 (기존 MIMIC-Assets 호환). `index.ts`에서 적절히 alias 처리.

새 코드는 **`parseCardStrict` 또는 `tryParseCard`** 사용 권장 (명확한 에러 처리).

## 함정

- ❌ **React/DOM 의존 절대 금지.** `useState`, `document.*`, framer-motion 등 import 금지. 모바일 / Node / Web Worker 재사용 보장 위해.
- ❌ pokersolver는 자체 타입 미제공. 직접 import 시 `// @ts-expect-error`로 우회 + 인터페이스 래핑 필수.
- ❌ Card 타입 변경(예: `rank`을 number로 바꾸기)은 모든 sub-app에 파급 효과. 변경 시 사용처 grep 후 일괄 수정.
- ❌ Korean 디스크립션 (`descriptionKo`) 추가 시 핸드 카테고리별로 일관 표기 유지 (`로열 플러시`, `스트레이트 플러시`, `포카드`, `풀하우스`, ...). 이미 사용처가 매칭하므로 변경 시 mismatch 위험.
- ❌ heads-up 앱은 자체 `engine/hand-evaluator.ts` 보유 — 통합 검토 시 정확성 비교 후 우월한 쪽 채택. 현재는 두 평가기 병존.

## 새 함수 추가

1. 카드 형식 변환이라면 → `card.ts`
2. 손패 평가 / 비교 / 분류 → `logic/handEvaluator.ts` 또는 새 `logic/<feature>.ts`
3. 팟 / 베팅 → `logic/potBuilder.ts` 또는 `potResolver.ts`
4. 게임-무관 유틸 (combinations 등) → `logic/cardUtils.ts`
5. `index.ts`에서 re-export
6. `__tests__/<feature>.test.ts` 추가 권장 (정확성이 critical)

## 사용처

| 워크스페이스 | 사용 정도 |
|---|---|
| `@hh/api` | 직접 import (lib/poker-engine.ts에서 자체 너트 평가 — pokersolver 직접 사용. 통합 가능성 있음.) |
| `@hh/pot-quiz` | hand 평가 / 팟 분배 / 스코어 |
| `@hh/ui` PlayingCard | Card 타입만 |
| `@hh/nut-to-3` | 사용 안 함 (자체 `lib/poker.ts`) — string 카드 형식이라 변환 부담 |
| `@hh/concept-quiz` | 사용 안 함 (자체 형식 카드) |
| `@hh/heads-up` | 사용 안 함 (자체 engine/) — 통합 검토 후보 |

## 검증

- `pnpm --filter @hh/poker-engine typecheck` 통과
- pot-quiz 게임 전체 플레이 (핸드 평가 + 팟 분배 + 점수 계산) 정상

## 의존성

- `pokersolver`
- (어떤 React/DOM 의존도 추가하지 말 것)
