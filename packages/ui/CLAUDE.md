# CLAUDE.md — @hh/ui (공통 UI 컴포넌트)

## 정체성

여러 sub-app이 공유하는 UI 컴포넌트. 현재는 **`PlayingCard` 단일 컴포넌트**만 통합되어 있고,
shadcn 47개는 각 sub-app이 자체 카피를 가지고 있다 (테마 변수가 sub-app별로 달라 통합 시 회귀 위험).

## 공개 API

```ts
import {
  cn,                  // re-export from @hh/shared
  PlayingCard,
  CardBackPattern,
  type PlayingCardProps,
  type PlayingCardSize,
} from "@hh/ui";
```

CSS 한 번 import 필요 (Hub의 `main.tsx`에서 처리됨):
```ts
import "@hh/ui/components/PlayingCard/styles.css";
```

## 디렉토리

```
packages/ui/
├── src/
│   ├── index.ts                          # re-export
│   └── components/
│       └── PlayingCard/
│           ├── index.ts
│           ├── PlayingCard.tsx           # 메인 컴포넌트
│           ├── CardBackPattern.tsx       # SVG 카드 뒷면 (MIMIC navy + 다이아몬드 + "MIMIC" 텍스트)
│           └── styles.css                # .hh-playing-card + data-suit-color 등
├── package.json
└── tsconfig.json
```

## PlayingCard

**Props**:
- `card: Card | string` — `@hh/poker-engine`의 정규화 Card 객체 또는 string `"As"` 등
- `size?: "xs" | "sm" | "md" | "lg"` (기본 md)
- `faceDown?: boolean` (기본 false)
- `backImage?: string` — faceDown 시 사용할 커스텀 이미지 URL. 없으면 `CardBackPattern` SVG 표시
- `highlight?: boolean` — 녹색 글로우 효과 (winning hand 강조)
- `dimmed?: boolean` — 그레이스케일 (탈락한 카드)
- `animate?: boolean` (기본 true) — framer-motion entry 애니메이션. false면 plain div

**스타일링**:
- `.hh-playing-card` 베이스 스타일 (box-shadow, border, padding)
- `data-suit-color="red"|"black"`로 무늬 색상 분기
- `data-highlight`/`data-dimmed` attribute로 효과 토글

**구현 노트**:
- `CardContainer` 내부 헬퍼가 `animate` prop에 따라 `motion.div` vs plain `div` 분기. `display: contents`로 인한 transform 깨짐 회피.
- Nut-to-3 이식 시 알게 된 패턴: 코너 rank + 센터 suit 글자가 표준. 다른 변형 (UI-style 코너 rank+suit, 양쪽 코너만 등)은 `size`별로 다르게 처리.

## 사용처

| Sub-app | PlayingCard 사용 여부 | 비고 |
|---|---|---|
| pot-quiz | ✅ | 다크 테마, mostly default |
| concept-quiz | ❌ | 자체 PlayingCard (객체 형식 어댑터 필요해서 미사용) |
| nut-to-3 | ❌ | 자체 PlayingCard (card-back.jpg 이미지 + framer 애니 깊이 박혀 있음) |
| heads-up | ❌ | 자체 `Card.tsx` (포커 전용, 깊이 커스터마이즈) |

→ 현재는 사실상 **pot-quiz 전용**. 다른 sub-app으로 넓히려면 카드 데이터 어댑터 + 테마 변수 호환 작업 필요.

## 새 공통 컴포넌트 추가

**기준**: 2개 이상 sub-app이 동일하게 사용 + 디자인 회귀 위험 낮음일 때만.

1. `packages/ui/src/components/<Name>/index.tsx` 생성 (또는 `<Name>.tsx`)
2. 필요한 외부 deps는 `package.json` `dependencies` (peer 아님 — 라이브러리니까)
3. `src/index.ts`에서 re-export
4. CSS 있으면 `@hh/ui/components/<Name>/styles.css` 별도 import 안내
5. 사용 sub-app들에서 앱 로컬 카피 제거하고 `@hh/ui` import로 변경

## 함정

- ❌ React/DOM 의존 OK (이건 UI 패키지). **단, `@hh/poker-engine`은 React 의존 금지.**
- ❌ sub-app 한정 변형(예: 카드 뒷면 이미지가 sub-app마다 다름)을 강제로 통합하지 말 것 — `backImage` prop처럼 customization point 마련.
- ❌ shadcn 47개 통합은 **현재 시점에서 비추천**. 각 sub-app별 테마 변수 / 유틸리티 동작이 미세히 달라 회귀 발생. 안정화 후 일괄 마이그레이션 검토.
- ❌ Tailwind utility 사용 시 sub-app `.app-<name>` 스코프 안에서만 동작하는 변수(`bg-background` 등) 의존 → 컴포넌트가 어떤 sub-app이든 잘 보이려면 fallback 명시 필요. PlayingCard는 흰 배경 hard-coded라 안전.

## 검증

- `pnpm --filter @hh/ui typecheck` 통과
- Hub의 `/dev/cards`에서 모든 size + state(faceDown/highlight/dimmed/animate) 시각 확인
- pot-quiz 게임 진행 시 카드 표시 정상

## 의존성

- `@hh/poker-engine` (Card 타입)
- `@hh/shared` (cn)
- `class-variance-authority`, `clsx`, `framer-motion`, `lucide-react`, `tailwind-merge`
- peer: `react`, `react-dom`
