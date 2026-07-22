# CLAUDE.md — @hh/hub (통합 entry)

> Hub 전용 작업 가이드. sub-app 자체에 손대는 게 아니라면 sub-app `src/`는 읽지 말 것.

# 스테이징 배포

pnpm run deploy:stage

# → mode=staging 빌드 → mimic-stage.r-e.kr API URL 주입

# → play-lab-stage 레포 gh-pages 브랜치

# 운영 배포

pnpm run deploy:prod

# → mode=production 빌드 → mimic.im API URL 주입

# → holdem-hub 레포 gh-pages 브랜치

## 정체성

- **역할**: 모노레포의 단일 Vite 번들 진입점. navbar + sub-app 라우팅 + PWA 호스트 + 통합 인증 진입점.
- **테마**: **화이트 + MIMIC red `#BA0C19`** (HSL `354 88% 39%`). MIMIC 브랜드 표준.
- **라우터**: wouter. Hub 자체 `/`, `/dev/cards` + sub-app `/<name>` (nested).
- **상태**: useState + `@hh/shared` `useAuthState`. 가벼운 React Query (sub-app으로 전파 안 됨).
- **PWA**: `vite-plugin-pwa`로 통합 — manifest "미믹 플레이랩", autoUpdate, navigateFallbackDenylist `/api/*`.

## 진입점

**`src/main.tsx`** — React root 렌더링.
**`src/App.tsx`** — `<QueryClientProvider>` + `.app-hub` div + Navbar + `<Switch>` 라우팅. sub-app은 lazy 로드:

```tsx
const PotQuizApp = lazy(() => import("@hh/pot-quiz"));
const NutTo3App = lazy(() => import("@hh/nut-to-3"));
const ConceptQuizApp = lazy(() => import("@hh/concept-quiz"));
const HeadsUpApp = lazy(() => import("@hh/heads-up"));
```

## 파일 맵

| 작업 종류                              | 먼저 읽을 파일                                                  |
| -------------------------------------- | --------------------------------------------------------------- |
| sub-app 추가 / 라우팅                  | `src/App.tsx` (`<Route ... nest>` 추가)                         |
| navbar 메뉴 추가 / 로그인 버튼         | `src/components/Navbar.tsx` (`NAV_ITEMS` + auth 토스트)         |
| 홈 카드 추가                           | `src/pages/Home.tsx` (`APPS` 배열)                              |
| 404                                    | `src/pages/NotFound.tsx`                                        |
| 카드 데모 (개발자용)                   | `src/pages/DevCards.tsx`                                        |
| 색상 / 베이스 테마                     | `src/index.css` (`.app-hub` 스코프 — 흰 배경 + #BA0C19 primary) |
| Vite 설정 / 프록시 / PWA 설정 / dedupe | `vite.config.ts`                                                |
| 빌드 / 포트                            | 루트 `package.json` 스크립트 + `apps/hub/.env.local`            |
| HTML / 메타 / 폰트                     | `index.html`                                                    |
| 환경 변수 예시                         | 루트 `.env.example`                                             |

## 디렉토리 구조

```
apps/hub/
├── public/                # favicon, icon-192.svg, icon-512.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css          # .app-hub 스코프 (white + #BA0C19)
│   ├── components/
│   │   └── Navbar.tsx     # 로그인 버튼 + 메뉴
│   └── pages/
│       ├── Home.tsx       # APPS 배열 → 카드 그리드
│       ├── NotFound.tsx
│       └── DevCards.tsx   # /dev/cards (dev 전용)
├── index.html
├── vite.config.ts         # PWA + proxy + dedupe
├── tsconfig.json
├── package.json
└── .env.local             # gitignored, 포트/auth provider override
```

## 라우팅 패턴

**Hub 자체 페이지** (가로 제한 + padding):

```tsx
<Route path="/">
  <div className="mx-auto max-w-6xl px-4 py-8">
    <Home />
  </div>
</Route>
```

**Sub-app** (풀폭, 자체 레이아웃):

```tsx
<Route path="/pot-quiz" nest>
  <PotQuizApp />
</Route>
```

`nest` 옵션이 핵심 — sub-app 내부 wouter `Router`가 `/pot-quiz` 이후 부분만 매칭.

heads-up 만 `react-router-dom` v6 사용하지만, Hub `<Route nest>` 안에서 `<BrowserRouter basename="/heads-up">`로 mount되어 같은 history를 공유. Hub의 wouter와 RR6은 독립적으로 매칭하므로 충돌 없음.

## Navbar / Auth

**`src/components/Navbar.tsx`**:

- `NAV_ITEMS` 배열 = (label, path) 쌍.
- 로그인 버튼은 `useAuthState()` (from `@hh/shared`) 호출 → `signIn`/`signOut` 토글.
- 미설정 / 미구현 provider 시 우측 아래 4초 토스트로 에러 표시.
- 에러 토스트 재호출은 `error` state 변경에 의존 (같은 메시지 재시도해도 reflow).

**Auth 동작**:

- `VITE_AUTH_PROVIDER` env 값에 따라 `mimic` / `none` provider stub.
- **로그인은 통합 로그인 페이지(code 플로우)로 위임**: `Login.tsx`가 `VITE_UNIFIED_LOGIN_URL`로 `client_id=mimic-web` + `redirect_uri=/oauth/callback` + `state`와 함께 리다이렉트 → 통합 로그인 페이지가 인증 후 1회용 `code`를 `/oauth/callback`으로 되돌림 → `OAuthCallback.tsx`가 `state` 검증 후 `@hh/api`의 `POST /api/auth/token`에 code를 전달 (브라우저는 `client_secret`을 절대 다루지 않음, server-to-server 교환은 `@hh/api`가 수행) → 받은 토큰을 `setTokens()`로 쿠키 저장.
- 실제 Firebase 로그인은 `concept-quiz` 내부에서 자체 처리 — Hub navbar는 아직 통합되지 않음.

## 테마 (`src/index.css`)

```css
.app-hub {
  --background: 0 0% 100%;
  --foreground: 0 0% 9%;
  --primary: 354 88% 39%; /* #BA0C19 — MIMIC red */
  --primary-foreground: 0 0% 100%;
  /* ... */
}
```

**MIMIC red는 `var(--color-mimic-red)` (Tailwind v4 토큰)으로 직접 접근 가능** — 로고 박스에 사용.
HSL 변수와 별도. 토큰 정의는 `@hh/tailwind-config/base.css`.

## Vite 설정 핵심

**`vite.config.ts`**:

- **`server.port`**: `Number(env.HUB_PORT) || 5175`
- **`proxy /api`**: `http://localhost:${env.API_PORT || 3002}` (dev 모드 한정)
- **`resolve.dedupe: ["react", "react-dom"]`** — sub-app react 중복 인스턴스 방지 (필수)
- **`VitePWA(...)`**: 통합 manifest "미믹 플레이랩", `theme_color: "#ffffff"`, dev mode SW 비활성

**`src/index.css` `@import`**:

```css
@import "@hh/tailwind-config/base.css"; /* Tailwind 본체 + 모든 sub-app @source 등록 */
```

`@source` 디렉티브로 모노레포 다른 워크스페이스 src를 명시 스캔 (`@hh/tailwind-config/base.css` 참조). Tailwind v4가 Vite root만 자동 스캔하므로 이게 없으면 sub-app 클래스가 빈 utility로 컴파일됨.

## 환경 변수

**`apps/hub/.env.local`** (gitignored):

- `HUB_PORT`, `API_PORT` — 포트 override (기본값 5175/3002와 동일하면 생략 가능)
- `VITE_AUTH_PROVIDER` — `mimic` / `firebase` / 기본 `none`
- `VITE_UNIFIED_LOGIN_URL` — 통합 로그인 페이지 URL (로컬 테스트: `http://localhost:3000`). `client_secret`은 여기서 다루지 않음 — `services/api`의 `MIMIC_CLIENT_SECRET` 참고.

기본값들은 vite.config.ts에 하드코딩되어 있어 `.env.local` 없이도 dev 정상 동작.

## 함정

- ❌ Hub `src/` 안에서 sub-app으로 직접 import 금지 — `lazy(() => import("@hh/<name>"))` 패턴만 사용
- ❌ `apps/hub/src/index.css`의 `@source` 디렉티브에 새 sub-app 추가 누락 → utility 미생성. 새 앱 추가 시 반드시 확인.
- ❌ `<Route nest>` 빠뜨리면 sub-app 내부 라우터가 prefix 없이 매칭 → 모든 sub-app 화면 깨짐
- ❌ `vite.config.ts`에 sub-app 추가용 별도 작업 없음 — 자동으로 동작 (Vite는 import-driven)
- ❌ heads-up 의 RR6은 base path가 `/heads-up`이라 Hub navbar에서 wouter `<Link href="/heads-up">` 만 사용해야 함. wouter가 `/heads-up/...` prefix를 자동으로 안 붙이기 때문.

## 검증 (Definition of Done)

- `pnpm --filter @hh/hub typecheck` 통과
- `pnpm dev` 후:
  - `/` 진입 시 흰 배경 + 빨간 로고 + 4개 sub-app 카드 + 로그인 버튼 보임
  - 각 sub-app 메뉴 클릭 시 정상 마운트 (sub-app별 테마 적용)
  - 뒤로가기로 Hub 홈 복귀 정상
- PWA 설치 가능 여부 (manifest 200 OK, sw.js 등록 — production 빌드에서만 동작)

## 원본 대비 / 통합 결정 사항

- **단일 번들 + sub-app 컴포넌트 export 패턴**: 각 sub-app은 `src/index.tsx`에서 default export, Hub가 `lazy()`로 코드 분할.
- **wouter ↔ RR6 공존**: heads-up만 RR6, 나머지 wouter. 같은 history 공유, 독립 매칭.
- **PWA 통합**: 원본 mimic_heads_up의 PWA 설정을 Hub로 흡수. 매니페스트 이름/아이콘은 "미믹 플레이랩" 통합 브랜드.
