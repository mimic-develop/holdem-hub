# CLAUDE.md — @hh/tailwind-config (Tailwind v4 공통 베이스)

## 정체성

모든 sub-app이 공유하는 Tailwind v4 베이스 CSS. `@theme` 토큰 + `@source` 디렉티브 + 베이스 layer 정의.

**모든 sub-app의 색상 토큰은 여기서 정의된다.** sub-app은 자기 `.app-<name>` 스코프 안에 HSL 변수만 setting.

## 사용

각 sub-app(또는 Hub)의 `index.css`에서:
```css
@import "@hh/tailwind-config/base.css";
```

## 디렉토리

```
packages/tailwind-config/
├── base.css           # 본체
└── package.json       # tailwindcss + tw-animate-css 의존성
```

## `base.css` 구조

```css
@import "tailwindcss";
@import "tw-animate-css";          /* shadcn animate-in/out 등 v4 호환 */

/* 모노레포 다른 워크스페이스 src 명시 스캔 — Tailwind v4가 Vite root만 자동 스캔하므로 필수 */
@source "../ui/src/**/*.{ts,tsx}";
@source "../shared/src/**/*.{ts,tsx}";
@source "../../apps/pot-quiz/src/**/*.{ts,tsx}";
@source "../../apps/nut-to-3/src/**/*.{ts,tsx}";
@source "../../apps/concept-quiz/src/**/*.{ts,tsx}";
@source "../../apps/heads-up/src/**/*.{ts,tsx}";

/* 폰트 / 레이아웃 토큰 (모든 앱 공통) */
@theme {
  --font-sans: "Pretendard", "Pretendard Variable", ...;
  --font-mono: ui-monospace, SFMono-Regular, ...;
  --radius-sm: 0.375rem;
  --radius: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

/* MIMIC 브랜드 컬러 (불변) */
@theme {
  --color-mimic-red: #ba0c19;
  --color-mimic-red-dark: #8e0810;
  --color-mimic-red-light: #d92e3a;
  --color-mimic-red-50: #fef2f3;
  --color-mimic-red-100: #fde2e4;
}

/* heads-up 전용 felt-green/gold/card-back */
@theme {
  --color-felt-green: #0a6b3a;
  --color-felt-dark: #074a29;
  --color-gold: #d4af37;
  --color-card-back: #1a4480;
}

/* 테마 스코프용 동적 색상 토큰 — 모두 hsl(var(--xxx, fallback)) */
@theme {
  --color-background: hsl(var(--background, 0 0% 100%));
  --color-foreground: hsl(var(--foreground, 0 0% 9%));
  --color-primary: hsl(var(--primary, 354 88% 39%));
  /* ...30+ 토큰... */
}

/* 베이스 layer */
@layer base {
  html { -webkit-font-smoothing: antialiased; ... }
  body { font-family: var(--font-sans); }
}
```

## 동작 원리

- 컴파일 시점: 토큰 이름(`--color-background` 등)만 등록 → `bg-background`, `text-foreground` 같은 utility class가 생성됨.
- 런타임: 실제 색상 값은 sub-app의 `.app-<name>` 스코프에 정의된 HSL trio(예: `--background: 0 0% 8%;`)로 결정됨.
- fallback: sub-app 스코프 외에서도 동작하도록 `hsl(var(--background, 0 0% 100%))` 형태로 흰 배경 fallback 제공.

→ 같은 `bg-background` utility가 sub-app마다 다른 색으로 렌더링됨. 각 sub-app은 다른 sub-app을 침범하지 않음.

## 새 sub-app 추가 시 작업

1. `base.css`의 `@source` 디렉티브에 새 sub-app src 경로 추가:
   ```css
   @source "../../apps/<new-app>/src/**/*.{ts,tsx}";
   ```
2. 새 sub-app의 `index.css`에 `.app-<new-app>` 스코프로 HSL 변수 정의

**`@source` 누락 시**: Tailwind v4가 새 sub-app에서 사용된 utility class를 발견하지 못해 빈 utility로 컴파일됨. CSS만 누락되니 콘솔 에러 없이 디자인이 깨짐 — 발견 어려운 함정.

## 새 색상 토큰 추가

**브랜드 색상 (모든 앱이 절대값으로 쓰는 것)** → 별도 `@theme` 블록의 `--color-<name>: #hex`. 예: MIMIC red.

**스코프 변수 (sub-app마다 다른 값)** → `--color-<name>: hsl(var(--<name>, fallback))` 형태로 등록 + sub-app `index.css`에서 `--<name>: <h s l>` HSL trio로 정의.

## 의존성

- `tailwindcss@^4.0.0`
- `tw-animate-css@^1.2.5` — shadcn animation utility를 v4에서 사용 가능하게 (`animate-in fade-in-50` 등)

## 함정

- ❌ `@source` 빠뜨림 → utility 미생성 (위 참조)
- ❌ `@theme` 안에 `hsl()` 함수를 그대로 쓰지 말 것 (예: `--color-x: hsl(0 0% 0%)`). `hsl(var(--x, ...))` 패턴이라야 sub-app 스코프 변수 활용 가능.
- ❌ sub-app `index.css`에서 토큰 자체(`--color-background`)를 다시 정의하면 `@hh/tailwind-config`의 토큰을 덮어씀. sub-app은 **HSL 변수(`--background`)만** 정의해야 함.
- ❌ Tailwind v3 잔재 (예: `@apply`, `@tailwind base;`) 사용 금지 — v4 기준은 `@import "tailwindcss"`.

## 검증

- `pnpm dev` 후 모든 sub-app에서 utility 정상 적용
- 4개 sub-app 각각의 테마 (다크/라이트, 빨강/파랑) 유지 확인
- `bg-felt-green`, `text-gold`, `bg-mimic-red` 모두 의도한 색으로 렌더링
