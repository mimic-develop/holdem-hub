# CLAUDE.md — 미믹 플레이랩 모노레포 작업 가이드

이 문서는 Claude(또는 협업자)가 이 저장소에서 일관된 변경을 만들 수 있도록 돕는 작업 지침이다.

## ★★★ 모든 turn에서 반드시 따를 것 — 작업 시작 프로토콜

**사용자 발화에 아래 표의 키워드가 하나라도 있으면, 다른 어떤 도구를 호출하기 전에 먼저
해당 `CLAUDE.md`를 `Read` 도구로 직접 로드한다.** 자동 hook(`.claude/hooks/inject-app-context.cjs`)이
이미 컨텍스트에 주입했더라도, agent는 그 내용이 보이는지 한 번 더 확인하고 없으면 읽는다.

이 단계를 건너뛰면 sub-app별 함정(테마 스코프, 저장소 prefix, 라우터 종류 등)을 모르고
잘못된 변경을 하기 쉽다. 절대 생략하지 말 것.

| 사용자 발화 키워드                           | 먼저 읽을 파일                       |
| -------------------------------------------- | ------------------------------------ |
| 팟 퀴즈 / pot-quiz                           | `apps/pot-quiz/CLAUDE.md`            |
| 너트 게임 / nut-to-3 / nut to 3              | `apps/nut-to-3/CLAUDE.md`            |
| 개념 퀴즈 / concept-quiz                     | `apps/concept-quiz/CLAUDE.md`        |
| 헤즈업 / heads-up / 헤즈업 트레이너          | `apps/heads-up/CLAUDE.md`            |
| Hub navbar / Hub 라우팅 / Hub 홈             | `apps/hub/CLAUDE.md`                 |
| 카드 컴포넌트 / 공통 UI / PlayingCard        | `packages/ui/CLAUDE.md`              |
| poker-engine / hand 평가 / pot 계산          | `packages/poker-engine/CLAUDE.md`    |
| auth / queryClient / useAuthState / apiFetch | `packages/shared/CLAUDE.md`          |
| API / Express 서버 / `/api/*`                | `services/api/CLAUDE.md`             |
| Tailwind 토큰 / `@theme` / `@source`         | `packages/tailwind-config/CLAUDE.md` |

**원칙: 한 앱 작업 시 다른 앱의 `src/`는 절대 읽지 않는다.** 해당 앱 `CLAUDE.md`의 "파일 맵" 표에
적힌 파일들만 추가로 읽으면 충분하도록 작성되어 있다. 공유 코드는 `packages/*` / `services/*`에
있고 각자 가이드가 있다.

각 `CLAUDE.md`에 담긴 정보:

- 정체성 (테마, 라우터, 상태 패턴, 데이터 출처)
- 파일 맵 ("X 작업 시 Y 파일 먼저 읽어라")
- 그 앱 한정 함정/규칙
- 검증 (Definition of Done)

### 자동 컨텍스트 주입 (UserPromptSubmit hook)

이 저장소는 사용자 발화를 stdin으로 받아 키워드를 매칭한 뒤 해당 CLAUDE.md를 자동으로
prompt 컨텍스트에 첨부하는 hook을 사용한다.

- **위치**: `.claude/hooks/inject-app-context.cjs` (Node 스크립트, 외부 의존성 0)
- **키워드 매핑**: `.claude/hooks/keyword-map.json`
- **등록**: `.claude/settings.json`의 `hooks.UserPromptSubmit`
- **디버그**: `HH_HOOK_DEBUG=1` 환경변수 — stderr에 매칭 로그
- **새 sub-app 추가 시**: `keyword-map.json`의 `mappings` 배열에 항목 추가하면 자동 동작

hook이 실패하거나 키워드가 안 맞아도 prompt는 통과 (exit 0). 안전망일 뿐 의존하지는 말 것.

## 개요

- pnpm workspace 모노레포 (Node 20+, pnpm 10+)
- 빌드 도구: 각 앱 Vite 6, API는 tsx
- 라우팅: Hub와 3개 앱은 wouter, heads-up만 react-router-dom v6
- 스타일: Tailwind v4 + shadcn/ui (@hh/ui)
- TypeScript strict 모드
- 패키지 scope: 모두 `@hh/*`

## 워크스페이스 책임

| 워크스페이스          | 역할                                    | 의존 가능                          |
| --------------------- | --------------------------------------- | ---------------------------------- |
| `@hh/hub`             | 통합 entry, navbar, 라우팅, PWA 호스트  | shared, ui, poker-engine, sub-apps |
| `@hh/pot-quiz`        | 팟 분배 퀴즈 (서브앱 컴포넌트)          | shared, ui, poker-engine           |
| `@hh/nut-to-3`        | 너트 핸드 게임                          | shared, ui, poker-engine           |
| `@hh/concept-quiz`    | 개념 퀴즈 (Firebase)                    | shared, ui, poker-engine           |
| `@hh/heads-up`        | 헤즈업 트레이너 (RR6, Zustand)          | shared, ui, poker-engine           |
| `@hh/ui`              | 공통 컴포넌트, shadcn/ui, PlayingCard   | shared, poker-engine               |
| `@hh/poker-engine`    | Card 타입, hand 평가, pot 계산          | (없음 - 도메인 코어)               |
| `@hh/shared`          | cn, queryClient, hooks, auth 인터페이스 | (없음)                             |
| `@hh/tailwind-config` | Tailwind v4 공통 @theme                 | (없음)                             |
| `@hh/tsconfig`        | 공통 TS 설정                            | (없음)                             |
| `@hh/api`             | Express, `/api/*` 라우트                | poker-engine                       |

**금지된 의존 방향:**

- `packages/*`는 `apps/*`나 `services/*`를 절대 import 금지
- `@hh/poker-engine`은 React/DOM 의존 금지 (모바일 재사용 대비)

## 새 앱 추가하기

1. `apps/<new-app>/` 디렉토리 생성
2. `package.json` 작성 (`@hh/<new-app>`, `main: "./src/index.tsx"`)
3. `tsconfig.json` 은 `@hh/tsconfig/react-app.json` extends. `noUnusedLocals: false`, `noUnusedParameters: false` 추가 (Hub typecheck가 sub-app 소스를 따라 들어오므로 strict 적용 시 경고 폭주)
4. `src/index.tsx`에 default export 컴포넌트 (Hub가 sub-route로 마운트)
5. `src/index.css`에 `.app-<name>` 스코프로 테마 변수 정의
6. Hub의 `apps/hub/src/App.tsx` `<Switch>` 안에 새 `<Route ... nest>` 추가
7. Hub의 `apps/hub/src/components/Navbar.tsx` `NAV_ITEMS`에 추가
8. Hub의 `apps/hub/src/pages/Home.tsx` `APPS` 배열에 카드 추가
9. **새 앱이 `apps/hub/src/index.css`의 `@source` 디렉티브에 포함되는지 확인** — 없으면 Tailwind v4가 클래스를 못 찾아 빈 utility로 컴파일됨
10. `apps/<new-app>/CLAUDE.md` 작성 (다른 앱 가이드 참조)
11. `pnpm install` 실행 (pnpm-workspace.yaml은 글롭 매칭이라 별도 등록 불필요)

## 새 공통 컴포넌트 추가 (`@hh/ui`)

여러 앱이 동일 컴포넌트를 가질 때만 옮긴다. 한 앱만 쓴다면 앱 로컬 유지가 원칙.

1. `packages/ui/src/components/<Name>/index.tsx` 작성
2. `packages/ui/src/index.ts`에서 re-export
3. 사용 앱들에서 `import { Name } from "@hh/ui"` 또는 `"@hh/ui/components/Name"` 로 변경
4. 기존 앱 로컬 컴포넌트는 삭제

## 새 게임 로직 추가 (`@hh/poker-engine`)

순수 함수 형태로만 추가. UI/리액트 의존 금지.

1. `packages/poker-engine/src/<feature>.ts` 작성
2. `packages/poker-engine/src/index.ts`에서 export
3. 가능하면 `__tests__/<feature>.test.ts` 추가 (Vitest)

## 코딩 컨벤션

- TS strict — `any` 최소화. 외부 라이브러리(pokersolver 등)는 인터페이스로 래핑
- Import 순서: (1) 외부 라이브러리 → (2) `@hh/*` 워크스페이스 → (3) 로컬 (`@/`) → (4) 상대경로 (`./`, `../`)
- **`@/*` paths는 sub-app TS-config에 매핑되어 있지만, 소스 코드에선 상대 경로 권장.** Hub의 typecheck가 sub-app 소스를 따라 들어올 때 `@/` 해석이 깨지는 사례 있음. 새 코드는 상대 경로로 작성.
- 컴포넌트 위치: 해당 앱 한정이면 `src/components/`, 공유면 `@hh/ui`
- 네이밍: 컴포넌트 PascalCase, 훅 `use*`, 유틸 함수 camelCase, 상수 UPPER_SNAKE_CASE

## CSS / 테마 격리 규칙

각 sub-app은 자체 CSS scope를 가진다. **테마 변수는 반드시 그 scope 안에서만 정의.**

```tsx
// apps/<app>/src/index.tsx 의 최상위 div
<div className="app-pot-quiz dark bg-background text-foreground">…</div>
```

```css
/* apps/<app>/src/index.css */
.app-pot-quiz {
  --background: 0 0% 8%; /* HSL trio (no hsl() wrapper) */
  --foreground: 0 0% 98%;
  --primary: 210 100% 50%;
  /* ... */
}
```

`@hh/tailwind-config/base.css`는 모든 색상 토큰을 `hsl(var(--xxx, fallback))` 형태로 등록한다.
즉 컴파일 시점엔 토큰 이름만 등록되고, 실제 값은 런타임에 sub-app 스코프 변수로 결정된다.

이렇게 하지 않으면 다른 앱의 변수와 충돌한다.

## localStorage / IndexedDB 충돌 방지

- localStorage 키는 반드시 `<app>:` prefix:
  ```ts
  import { storageKey } from "@hh/shared";
  const KEY = storageKey("pot-quiz", "bestScore_easy"); // → "pot-quiz:bestScore_easy"
  ```
- IndexedDB DB 이름도 `<app>:` prefix (heads-up은 `heads-up:headsup-solo`)
- IndexedDB-기반 테스트는 `fake-indexeddb/auto`를 setupFile에서 import + DB 이름이 prefix 적용된 값과 일치해야 함

## Vite + 모노레포 함정 (실제 디버깅에서 학습)

### 1. `import.meta.env`는 optional chaining 금지

```ts
// ❌ Vite static 감지 실패 → 런타임에 undefined
const env = (import.meta as any)?.env;

// ✅ 직접 접근
const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
```

Vite는 소스에서 `import.meta.env` 패턴을 텍스트로 detect해 모듈 상단에 env 객체 주입 코드를 prepend한다. 옵셔널 체이닝이 들어가면 패턴이 깨진다.

### 2. React 중복 인스턴스 (sub-app deps)

sub-app이 react/react-dom을 자체 의존성으로 가지면 Vite가 lazy-load 시 두 번째 React 인스턴스를 캐시할 수 있다 (특히 zustand 등 상태 라이브러리 함께 로드 시). 증상: `Cannot read properties of null (reading 'useCallback')`.

해결: Hub `vite.config.ts`에 이미 `resolve.dedupe: ["react", "react-dom"]` 설정. 새 sub-app 추가 시 자동 적용됨.

### 3. Tailwind v4 `@source`

v4는 Vite root 외 워크스페이스 패키지를 자동 스캔하지 않는다. `apps/hub/src/index.css` 또는 `@hh/tailwind-config/base.css`의 `@source` 디렉티브에 새 워크스페이스 src 경로를 추가해야 utility가 생성됨.

### 4. Sub-app TS strict 완화

sub-app `tsconfig.json`에 `noUnusedLocals: false`, `noUnusedParameters: false` 권장. Hub의 typecheck가 sub-app 소스 파일을 따라가면서 strict-only 경고가 발생하는데, sub-app별로 끄지 않으면 빌드 폭주.

## 흔한 실수

- ❌ `apps/<app>/`에서 다른 앱 import — 이중 번들 위험. `packages/`로 옮길 것
- ❌ Tailwind 클래스로 `bg-opacity-*` 사용 — v4에서 deprecated. `bg-zinc-900/50` 형식 사용
- ❌ `:root` 에 직접 CSS 변수 정의 — 다른 앱과 충돌. 항상 `.app-<name>` scope에
- ❌ localStorage 키 prefix 누락 — 다른 앱 데이터 덮어쓸 수 있음
- ❌ `@hh/poker-engine`에 React/DOM API 사용 — 모바일 재사용 깨짐
- ❌ heads-up 안에서 wouter `Link`/`useLocation` 사용 — RR6 기반이므로 `react-router-dom`의 그것을 사용
- ❌ `@/` 절대 경로 import (sub-app 소스 내) — Hub typecheck 통과 위해 상대 경로 권장
- ❌ `import.meta?.env` 옵셔널 체이닝 — Vite env 주입이 동작 안함

## 실행 명령

루트에서:

```bash
pnpm dev          # Hub + API 동시 기동 (NUT TO 3 포함 모든 앱 정상 동작)
pnpm dev:hub      # Hub만 (API 불필요한 앱 전용 — 빠른 시작용)
pnpm dev:api      # API만
pnpm build        # 모든 워크스페이스 빌드
pnpm typecheck    # 모든 워크스페이스 타입 체크
pnpm test         # Vitest (현재는 heads-up만 정의됨)
```

> ⚠️ **NUT TO 3는 API 서버 필수**: 게임 시작 시 `/api/nut-to-3/game/new`를 호출한다. `pnpm dev`는 이제 API를 자동으로 같이 띄운다. Hub만 단독으로 기동하면 게임 시작 즉시 ECONNREFUSED 에러 발생.

특정 워크스페이스에서:

```bash
pnpm --filter @hh/hub dev
pnpm --filter @hh/pot-quiz typecheck
pnpm --filter @hh/heads-up test
```

기본 포트: **Hub `5175`**, **API `3002`**. Hub의 `/api/*` 요청은 dev 환경에서 자동으로 API 서버로 프록시.
