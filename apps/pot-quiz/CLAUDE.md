# CLAUDE.md — @hh/pot-quiz (팟 분배 퀴즈)

> 이 앱만 작업할 때는 **이 파일과 여기서 안내하는 파일만** 읽어도 충분하도록 작성됨.
> 다른 sub-app(`apps/concept-quiz`, `apps/nut-to-3`, `apps/heads-up`)의 src는 읽지 말 것.

## 정체성

- **출처**: 기존 Replit 프로젝트 `MIMIC-Assets` 이식. 텍사스 홀덤 쇼다운 시 팟이 어떻게 나뉘는지 맞추는 트레이너.
- **테마**: **다크 (zinc-950 베이스)**. 원본 `dark` variant 그대로. MIMIC red 미사용 (Hub navbar 영역만 white + #BA0C19).
- **라우터**: wouter (Hub와 동일). 내부 경로 `/`, `/quiz/:difficulty`, `/summary/:difficulty`.
- **데이터**: 클라이언트 전용 — 서버 호출 없음. 핸드 평가는 `@hh/poker-engine` 사용.
- **상태**: useState만 사용. 전역 store 없음.
- **저장소**: localStorage `pot-quiz:bestScore_*`, `pot-quiz:bestStreak_*`.

## 진입점

**`src/index.tsx`** — Hub의 `<Route path="/pot-quiz" nest>` 안에서 마운트되는 default export.
```tsx
<div className="app-pot-quiz dark bg-background text-foreground">
  <TooltipProvider>
    <Toaster />
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/quiz/:difficulty" component={Quiz} />
      <Route path="/summary/:difficulty" component={Summary} />
      <Route component={NotFound} />
    </Switch>
  </TooltipProvider>
</div>
```

`.app-pot-quiz`와 `dark` 클래스 둘 다 있어야 한다. dark variant 유틸리티(`dark:bg-zinc-900` 등)도 동작.

## 파일 맵 (작업별 진입점)

| 작업 종류 | 먼저 읽을 파일 |
|---|---|
| 게임 흐름 / 라우팅 변경 | `src/index.tsx` |
| 메인 화면 | `src/pages/Home.tsx` |
| 퀴즈 진행 | `src/pages/Quiz.tsx` |
| 결과 요약 | `src/pages/Summary.tsx` |
| 플레이어 표시 | `src/components/PlayerArea.tsx` |
| 타이머 | `src/components/TimerBar.tsx` |
| 카드 표시 | `@hh/ui` `PlayingCard` (앱 로컬 컴포넌트 아님) |
| 핸드 평가 / 팟 계산 | `@hh/poker-engine` (이 앱 src에 없음) |
| 점수 / 베스트 스코어 | localStorage 키 `pot-quiz:bestScore_<difficulty>`, `pot-quiz:bestStreak_<difficulty>` |
| 테마 / 색상 | `src/index.css` |
| 토스트 / 모달 등 shadcn UI | `src/components/ui/*` (47개, 앱 로컬 카피) |
| 훅 | `src/hooks/use-toast.ts` (앱 로컬) |

## 디렉토리 구조

```
apps/pot-quiz/
├── src/
│   ├── index.tsx        # 진입점 + 라우팅
│   ├── index.css        # .app-pot-quiz 스코프 테마 변수
│   ├── pages/           # Home, Quiz, Summary, NotFound
│   ├── components/
│   │   ├── PlayerArea.tsx
│   │   ├── TimerBar.tsx
│   │   └── ui/          # shadcn 47개 (앱 로컬)
│   ├── hooks/use-toast.ts
│   └── lib/utils.ts     # cn은 @hh/shared로 위임
├── package.json
└── tsconfig.json
```

## 테마 변수 (`src/index.css`)

`.app-pot-quiz` 스코프 안에 HSL trio로 정의된다 (원본 `MIMIC-Assets`의 `.dark` 그대로):
```css
.app-pot-quiz {
  --background: 0 0% 8%;        /* zinc-950 톤 */
  --foreground: 0 0% 98%;
  --primary: 210 100% 50%;      /* 파란색 — pot-quiz는 빨강 미사용 */
  --primary-foreground: 210 100% 98%;
  /* ... */
}
```

색상 토큰 자체(`bg-primary`, `text-foreground` 등)는 `@hh/tailwind-config/base.css`의 `@theme`
블록에서 `hsl(var(--xxx, fallback))`로 등록되어 있다. **이 파일에선 색상 변수만 정의하고
유틸리티는 직접 만들지 않는다.**

원본의 `hover-elevate` / `active-elevate` / `toggle-elevate` 시스템도 `.app-pot-quiz` 스코프
안에서 보존되어 있음. 변경 시 동일 스코프 유지.

## 관행 / 컨벤션

- **Import**: 모두 상대 경로 사용 (`./`, `../`). `@/` 절대 경로 사용 금지 — Hub typecheck가
  sub-app 소스를 따라 들어올 때 `@/` 해석이 깨진다.
- **shadcn UI**: 앱 로컬 카피 사용 (다른 sub-app도 동일 카피 보유). 통합 안 함 — sub-app별 테마 변수가 다르고
  유틸리티 동작도 살짝 다르기 때문.
- **카드 컴포넌트**: `import { PlayingCard } from "@hh/ui"`. 앱 로컬 PlayingCard 두지 말 것.
- **차트(`chart.tsx`) / OTP(`input-otp.tsx`)**: 파일 상단에 `// @ts-nocheck` — recharts/input-otp 타입과 shadcn 사이의 알려진 mismatch. 런타임은 정상.

## 함정

- ❌ `dark` 클래스 빠뜨림 → 원본 다크 variant 동작 안함. 최상위 div에 `app-pot-quiz dark` 둘 다 필수.
- ❌ Hub `apps/hub/src/index.css`의 `@source` 디렉티브에 `apps/pot-quiz/src/**` 누락 시 Tailwind v4가 클래스 못 찾음. (이미 등록됨, 추가 작업 시 확인만)
- ❌ pot-quiz는 서버 의존 없음 — `@hh/api` 호출 추가 금지 (필요해지면 nut-to-3 패턴 참조).

## 검증 (Definition of Done)

- `pnpm --filter @hh/pot-quiz typecheck` 통과
- Hub `pnpm dev` 후 `http://localhost:5175/pot-quiz` 진입 시 다크 화면 + 게임 플레이 정상
- 어려움 난이도 퀴즈 풀고 결과 → 요약 → 베스트 스코어 갱신 체크
- localStorage에 `pot-quiz:` prefix 키만 생성되는지 DevTools에서 확인

## 원본 대비 변경 사항 (이식 기록)

- Replit 의존성 (`@replit/*`, `replit-dev-banner`) 모두 제거
- MIMIC-Assets 서버(`server/`) 폐기 — 이 앱은 서버 불필요
- `client/src/logic/*`(handEvaluator, potBuilder, potResolver, scoring, cardUtils) → `@hh/poker-engine`로 이동
- `CardDisplay` (string 기반) → `@hh/ui` `PlayingCard` (정규화 카드 객체) 교체
- `:root` HSL → `.app-pot-quiz` 스코프로 이동
- `bestScore_*` localStorage 키에 `pot-quiz:` prefix 추가
- Tailwind v3 → v4 마이그레이션 (`@theme inline {}`, `@tailwindcss/vite`)
