# CLAUDE.md — @hh/concept-quiz (홀덤 개념 퀴즈)

> 이 앱만 작업할 때는 **이 파일과 여기서 안내하는 파일만** 읽어도 충분하도록 작성됨.
> 다른 sub-app의 src는 읽지 말 것.

## 정체성

- **출처**: 기존 Replit 프로젝트 `Poker-Quiz-Master` 이식. 룰부터 수학·실전 응용까지 카테고리별 문제 풀이.
- **테마**: **라이트 + MIMIC red `#BA0C19` (HSL: 354 88% 39%)** + Pretendard 폰트. (모든 앱 통일)
- **라우터**: wouter. 내부 경로 `/`, `/login`, `/quiz/:category`.
- **데이터**: 문제 데이터는 클라이언트에 정적 (`src/lib/questions/*`). 진행률은 Firestore 동기화.
- **인증**: **Firebase Auth (Google)**. 환경변수 미설정 시 UI는 정상 로드, 로그인만 실패.
- **상태**: useState + Context (auth, progress).
- **저장소**: localStorage `concept-quiz:pokeriq_cleared_cards` (게스트), `concept-quiz:pokeriq_cleared_cards:<uid>` (로그인 시) + Firestore 진행률.
- **UX 특징**: 로그인 페이지에 비디오 배경 (`bg_sdr.mp4`). 카드 컴포넌트로 GlossaryText (용어 hover 정의 popup).

## 진입점

**`src/index.tsx`** — Hub의 `<Route path="/concept-quiz" nest>`:
```tsx
<div className="app-concept-quiz bg-background text-foreground">
  <AuthContext.Provider value={authValue}>
    <TooltipProvider>
      <Toaster />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" >
          <AuthGuard><Home /></AuthGuard>
        </Route>
        <Route path="/quiz/:category" >
          <AuthGuard><Quiz /></AuthGuard>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </TooltipProvider>
  </AuthContext.Provider>
</div>
```

`AuthGuard`는 `useAuth()`가 user 없을 때 `/login`으로 redirect.

## 파일 맵 (작업별 진입점)

| 작업 종류 | 먼저 읽을 파일 |
|---|---|
| 메인 화면 / 카테고리 그리드 | `src/pages/home.tsx` (대형) |
| 로그인 페이지 | `src/pages/login.tsx` |
| 퀴즈 진행 | `src/pages/quiz.tsx` |
| 인증 (signIn/onAuthChange) | `src/hooks/useAuth.ts` + `src/lib/firebase.ts` |
| 진행률 동기화 | `src/hooks/useProgress.ts` |
| 문제 데이터 | `src/lib/questions/{basic,math,practical}.ts` |
| 카테고리 메타 | `src/lib/categories.ts` |
| 용어 정의 (glossary) | `src/lib/glossary.ts` + `src/components/GlossaryText.tsx` |
| 카드 표시 | `src/components/PlayingCard.tsx` (앱 로컬 — 자체 스타일) |
| 포커 테이블 시뮬 | `src/components/PokerTable.tsx` |
| 테마 / 색상 / 폰트 | `src/index.css` |
| shadcn UI | `src/components/ui/*` (47개) |

## 디렉토리 구조

```
apps/concept-quiz/
├── src/
│   ├── index.tsx
│   ├── index.css           # .app-concept-quiz 스코프
│   ├── assets.d.ts
│   ├── pages/{home,login,quiz,not-found}.tsx
│   ├── components/
│   │   ├── PlayingCard.tsx   # 앱 로컬 (객체 형식 카드)
│   │   ├── PokerTable.tsx
│   │   ├── GlossaryText.tsx
│   │   ├── PokerHandSelector.tsx
│   │   └── ui/
│   ├── hooks/{useAuth,useProgress,use-toast}.ts
│   ├── lib/
│   │   ├── firebase.ts          # initializeApp 가드 포함
│   │   ├── concepts.ts
│   │   ├── categories.ts
│   │   ├── quizData.ts
│   │   ├── glossary.ts
│   │   ├── questions/{basic,math,practical}.ts
│   │   └── utils.ts
│   └── assets/
│       ├── bg_sdr.mp4         # 로그인 배경 비디오
│       └── mimic-logo.png
├── package.json
└── tsconfig.json
```

## Firebase 설정

**환경변수** (`apps/concept-quiz/.env.local` 또는 `apps/hub/.env.local`):
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

**가드 패턴** (`src/lib/firebase.ts`):
```ts
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);
// initializeApp 호출 전에 반드시 isFirebaseConfigured 확인
```

`useAuth.ts`의 `signInWithPopup`도 `isFirebaseConfigured` 체크. 미설정 시 한글 에러 throw.

`useProgress.ts`도 `loadFromFirestore` / `saveToFirestore` 가드 처리.

## 테마 변수 (`src/index.css`)

```css
.app-concept-quiz {
  color-scheme: light only;
  --background: 0 0% 100%;
  --foreground: 220 25% 12%;
  --primary: 354 88% 39%;     /* #BA0C19 — 모든 앱 통일 */
  --primary-foreground: 0 0% 100%;
  --radius: 0.75rem;          /* 다른 sub-app보다 둥근 */
  font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Inter", sans-serif;
  /* ... */
}
```

원본 `hover-elevate` / `toggle-elevate` 시스템 보존. 모두 `.app-concept-quiz` 스코프 안.

## 관행 / 컨벤션

- **카드 데이터 형식**: 객체 (`{ rank, suit }`). 다른 sub-app과 다름.
- **`PlayingCard`**: 앱 로컬 컴포넌트 (객체 형식). `@hh/ui` 버전 사용 안 함 — 추후 객체 어댑터 추가하면 통합 가능.
- **카테고리 추가**: `lib/categories.ts` + `lib/questions/<category>.ts` 만들고 `lib/quizData.ts`에서 import. 라우트는 자동 (`/quiz/:category`).
- **GlossaryText**: 용어 hover 시 정의 popup. 사용 시 `<GlossaryText>...텍스트 [용어](...)...</GlossaryText>` 형태.
- **`@/` 절대경로 import 금지** — 53개 파일이 상대 경로로 변환됨.
- **Vite env 접근**: `(import.meta as unknown as { env: ViteEnv }).env` 형식 (옵셔널 체이닝 금지).
- **assets**: `*.png/jpg/svg/mp4/webp` 모듈 선언은 `src/assets.d.ts`에 있음.

## 함정

- ❌ Firebase 키 없으면 signIn 호출 시 throw — UI에서 try/catch로 처리해야 함 (`useAuth.ts` 이미 처리).
- ❌ `chart.tsx` / `input-otp.tsx`는 `// @ts-nocheck` 필요.
- ❌ `bg_sdr.mp4`는 큰 파일 (수 MB) — 새 미디어 추가 시 빌드 사이즈 주의.
- ❌ 진행률 키 prefix 누락 시 (`concept-quiz:` 빠지면) 다른 앱과 충돌 가능.

## 검증 (Definition of Done)

- `pnpm --filter @hh/concept-quiz typecheck` 통과
- `/concept-quiz` (Firebase 미설정 시) → 자동 redirect `/login` → 로그인 페이지 비디오 배경 + 빨간 로그인 버튼 표시
- Firebase 설정 시 Google 로그인 → 홈 → 카테고리 → 퀴즈 풀이 → 진행률 Firestore 저장 (DevTools Network에서 firestore 호출 확인)
- localStorage에 `concept-quiz:` prefix 키만 생성

## 원본 대비 변경 사항 (이식 기록)

- Replit 의존성 모두 제거
- Poker-Quiz-Master `server/` 폐기 (Firestore 직접 사용)
- Firebase 초기화에 `isFirebaseConfigured` 가드 추가 (원본은 키 없으면 즉시 throw)
- `:root` HSL → `.app-concept-quiz` 스코프
- 53개 파일의 `@/foo` import → 상대 경로
- `@assets/bg_sdr.mp4`, `@assets/mimic-logo.png` → `../assets/*` 로 변경 + `assets.d.ts` 생성
- localStorage 키에 `concept-quiz:` prefix
- Tailwind v3 → v4
