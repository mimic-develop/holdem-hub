# CLAUDE.md — @hh/nut-to-3 (너트 핸드 맞추기)

> 이 앱만 작업할 때는 **이 파일과 여기서 안내하는 파일만** 읽어도 충분하도록 작성됨.
> 다른 sub-app의 src는 읽지 말 것.

## 정체성

- **출처**: 기존 Replit 프로젝트 `Nut-to-3` 이식. 보드 3~5장이 주어졌을 때 가능한 너트 핸드 3개를 빠르게 맞추는 게임.
- **테마**: **라이트 + MIMIC red `0 84% 45%`**. DM Sans / Outfit 폰트. 그라디언트 배경.
- **라우터**: wouter. 내부 경로는 단일 `/` 만 사용 (게임 phase는 React state로 관리: intro → playing → results).
- **데이터**: **서버 의존**. `@hh/api`(`/api/nut-to-3/game/new`)에서 보드 + 3 스트릿 너트 티어 받음.
- **상태**: useState + `@tanstack/react-query` (sub-app 내부에서 자체 QueryClient 관리, 다른 sub-app과 캐시 공유 안 함).
- **저장소**: 현재 localStorage 사용 없음 (필요 시 `nut-to-3:` prefix 사용).
- **UX 특징**: Pretendard 미사용, 대신 DM Sans + Outfit (display). framer-motion 애니메이션 다수, canvas-confetti.

## 진입점

**`src/index.tsx`** — Hub의 `<Route path="/nut-to-3" nest>` 안에서 마운트:
```tsx
<div className="app-nut-to-3 bg-background text-foreground">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </TooltipProvider>
  </QueryClientProvider>
</div>
```

## 파일 맵 (작업별 진입점)

| 작업 종류 | 먼저 읽을 파일 |
|---|---|
| 게임 흐름 / phase 전환 / UI 전체 | `src/pages/Home.tsx` (대형 파일 — phase 분기는 `appPhase` state) |
| 카드 표시 (앞면) | `src/components/PlayingCard.tsx` (앱 로컬 — Nut-to-3 전용 스타일 유지, **`@hh/ui` PlayingCard 사용 안 함**) |
| 서버 통신 | `src/hooks/use-game.ts` + `src/lib/api-schema.ts` |
| API 스키마 / 응답 타입 | `src/lib/api-schema.ts` (zod schemas + `api.game.new.path`) |
| 카드 파싱 | `src/lib/poker.ts` (이 앱 한정 — `@hh/poker-engine` 사용 안 함) |
| 테마 / 색상 / 폰트 | `src/index.css` |
| 카드 뒷면 이미지 | `src/assets/card-back.jpg` |
| MIMIC 로고 | `src/assets/mimic-logo.png` |
| shadcn UI | `src/components/ui/*` (47개, 앱 로컬 카피) |
| 토스트 훅 | `src/hooks/use-toast.ts` |

## 디렉토리 구조

```
apps/nut-to-3/
├── src/
│   ├── index.tsx          # 진입점 + 라우팅 + QueryClientProvider
│   ├── index.css          # .app-nut-to-3 스코프 (라이트, MIMIC red, DM Sans/Outfit)
│   ├── assets.d.ts        # *.png/jpg/svg 모듈 선언
│   ├── pages/
│   │   ├── Home.tsx       # 모든 phase (intro/playing/results) 단일 컴포넌트
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── PlayingCard.tsx  # 앱 로컬 — card-back.jpg 사용
│   │   └── ui/              # shadcn 47개
│   ├── hooks/
│   │   ├── use-game.ts      # react-query 기반
│   │   ├── use-toast.ts
│   │   └── use-mobile.tsx
│   ├── lib/
│   │   ├── api-schema.ts    # zod + API path
│   │   ├── poker.ts         # parseCard (앱 한정)
│   │   ├── queryClient.ts   # 이 앱 자체 QueryClient
│   │   └── utils.ts         # cn은 @hh/shared 위임
│   └── assets/
│       ├── card-back.jpg
│       └── mimic-logo.png
├── package.json
└── tsconfig.json
```

## 서버 통신

**API 엔드포인트**: `GET /api/nut-to-3/game/new?avoidNutTypes=...&noFlush=...`
- 서버 위치: `services/api/src/routes/nut-to-3.ts`
- 서버 로직: `services/api/src/lib/poker-engine.ts` (pokersolver 기반 너트 티어 추출 — Node 전용)
- 응답 스키마: `streets[]` (플랍/턴/리버) 각각에 `tiers[]` (Nut/2nd/3rd) + `validCombos`, `validSingleCards`, `exampleCards`

dev 환경에서 Hub의 `/api/*` proxy가 자동으로 API(:3002)로 라우팅. 별도 설정 불필요.

서버 측 변경 시 **`services/api/CLAUDE.md`** 참조.

## 테마 변수 (`src/index.css`)

```css
.app-nut-to-3 {
  color-scheme: light only;
  --font-sans: "DM Sans", sans-serif;
  --font-display: "Outfit", sans-serif;
  --background: 0 0% 97%;
  --foreground: 222 47% 11%;
  --primary: 0 84% 45%;          /* MIMIC red */
  --primary-foreground: 0 0% 100%;
  /* ... */
  background-image: radial-gradient(...);  /* 원본 body 배경 */
}
```

**커스텀 유틸리티** (원본 보존, 스코프 안에 정의):
- `.playing-card-shadow` — 카드 그림자
- `.playing-card-red` / `.playing-card-black` — 무늬별 색상
- `.font-display` — Outfit 폰트
- `.hand-overlap` / `.board-overlap` — 카드 겹침 레이아웃

## 관행 / 컨벤션

- **카드 컴포넌트는 앱 로컬**: 다른 sub-app과 달리 nut-to-3는 `@hh/ui` PlayingCard 안 씀. card-back.jpg 이미지와 framer-motion 애니메이션이 깊이 박혀 있어서 통합 안 함.
- **카드 데이터 형식**: 단순 string (`"As"`, `"Kh"` 등). `@hh/poker-engine`의 정규화된 `Card` 객체 사용 안 함.
- **`STREET_TIMERS`** 같은 상수는 `as const`로 narrow하지 말 것 — useState 첫 인덱스 리터럴(18)로 좁혀져 후속 setState 타입 깨짐. `readonly number[]` 사용 (이미 적용됨).
- **`@/` 절대경로 import 금지** — 모두 상대 경로 사용.

## 함정

- ❌ `apps/hub/src/index.css`의 `@source` 누락 시 Tailwind utility 미생성 (이미 등록됨)
- ❌ `chart.tsx` / `input-otp.tsx`는 파일 최상단에 `// @ts-nocheck` 필요 (recharts/input-otp 타입 mismatch)
- ❌ canvas-confetti는 `@types/canvas-confetti`가 devDep에 있어야 typecheck 통과
- ❌ API 호출 시 `/api/game/new` (원본 경로) 사용 금지 — prefix 적용된 `/api/nut-to-3/game/new` 사용. `lib/api-schema.ts`의 `api.game.new.path` 상수 활용.
- ❌ `__tests__/` 디렉토리 만들 때 vitest 설정 필요. 현재는 단위 테스트 없음 (서버 측에 있음).

## 검증 (Definition of Done)

- `pnpm --filter @hh/nut-to-3 typecheck` 통과
- `pnpm dev:all` 후 `/nut-to-3`에서:
  - 인트로 화면 (MIMIC 로고, 게임 방법 4카드, 게임 스타트 버튼)
  - 게임 스타트 → 보드 + 52-카드 picker + Nut/2nd/3rd 슬롯 표시
  - 시간 초과 또는 제출 → 결과 phase
  - 정답 시 confetti 발사
  - 다음 스트릿 / 다시하기 동작
- 콘솔 에러 0건
- API 호출 200 OK (DevTools Network)

## 원본 대비 변경 사항 (이식 기록)

- Replit 의존성 모두 제거
- 서버를 `services/api`로 분리 — `Nut-to-3/server/poker-engine.ts` → `services/api/src/lib/poker-engine.ts`. 라우트 prefix `/api/nut-to-3/` 적용
- `Nut-to-3/shared/{schema,routes}.ts` → `apps/nut-to-3/src/lib/api-schema.ts` (단일 파일로 통합)
- `client/src/assets/card-back.jpg` 그대로
- `attached_assets/IMG_7060_*.png` (MIMIC 로고) → `src/assets/mimic-logo.png`로 rename
- `:root` HSL → `.app-nut-to-3` 스코프
- `@assets/...` import → `../assets/...` 상대 경로
- `@shared/{schema,routes}` import → `../lib/api-schema` 상대 경로
- 49개 파일의 `@/foo` import → 상대 경로 변환
- Tailwind v3 → v4
