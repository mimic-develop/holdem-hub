# CLAUDE.md — @hh/shared (비-도메인 공통 유틸)

## 정체성

도메인(포커)과 무관한 횡단 관심사 모음:
- `cn` (className merge), `storageKey` (localStorage prefix helper)
- React Query 기본 클라이언트 팩토리
- React 훅 (`useIsMobile`, 등)
- Auth 추상화 (provider 인터페이스 + stub)
- API fetch 래퍼

## 공개 API

```ts
// 모두 @hh/shared에서 import
import {
  cn,
  storageKey,
  createQueryClient,
  useIsMobile,
  apiFetch, apiUrl, ApiError,
  // auth
  type AuthUser, type AuthProvider, type AuthProviderName,
  type AuthState,
  createMimicAuthStub,
  createNoneAuthStub,
  getActiveAuthProvider,
  _resetAuthProviderForTests,
  useAuthState,
} from "@hh/shared";
```

## 디렉토리

```
packages/shared/
├── src/
│   ├── index.ts             # 전체 re-export
│   ├── queryClient.ts       # createQueryClient()
│   ├── lib/
│   │   ├── index.ts
│   │   ├── utils.ts         # cn (clsx + tailwind-merge)
│   │   └── storage.ts       # storageKey(app, key) → "<app>:<key>"
│   ├── hooks/
│   │   ├── index.ts
│   │   └── use-mobile.ts    # useIsMobile()
│   ├── auth/
│   │   ├── index.ts
│   │   ├── types.ts         # AuthUser, AuthProvider, AuthProviderName
│   │   ├── mimic.ts         # createMimicAuthStub (throw)
│   │   ├── none.ts          # createNoneAuthStub (throw)
│   │   ├── resolver.ts      # getActiveAuthProvider — VITE_AUTH_PROVIDER 기반
│   │   └── useAuthState.ts  # React 훅
│   └── api/
│       ├── index.ts
│       └── client.ts        # apiFetch, apiUrl, ApiError
├── package.json
└── tsconfig.json
```

## 핵심 컴포넌트

### `cn`
```ts
cn("base", condition && "active", { "selected": isSelected }) → string
```
clsx + tailwind-merge. 모든 sub-app의 `lib/utils.ts`가 이걸 re-export.

### `storageKey`
```ts
storageKey("pot-quiz", "bestScore_easy") → "pot-quiz:bestScore_easy"
```
모든 localStorage 키는 이걸 통해야 함. **prefix 빠뜨리면 sub-app 간 데이터 충돌.**

### `createQueryClient`
React Query 기본 옵션 (`refetchOnWindowFocus: false`, `staleTime: Infinity`, `retry: false` 등).
Hub가 이걸 사용. nut-to-3는 자체 `queryClient.ts`로 별도 인스턴스 (sub-app 캐시 격리 의도).

### `apiFetch`
```ts
const data = await apiFetch<MyType>("/api/foo", { method: "POST", authToken: "..." });
```
- `VITE_API_BASE_URL` 자동 prefix
- JSON 자동 parse
- `Authorization: Bearer <token>` 주입 hook
- `ApiError`로 에러 정규화

### Auth 추상화

**`AuthProvider` 인터페이스** (`auth/types.ts`):
```ts
interface AuthProvider {
  readonly name: AuthProviderName;  // "firebase" | "mimic" | "none"
  signIn(): Promise<AuthUser>;
  signOut(): Promise<void>;
  getCurrentUser(): AuthUser | null;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
}
```

**`getActiveAuthProvider()`** — `VITE_AUTH_PROVIDER` env 기반 lazy singleton:
- `mimic` → `createMimicAuthStub()` (throw "아직 구현되지 않았습니다")
- 기타 → `createNoneAuthStub()` (throw "VITE_AUTH_PROVIDER 미설정")
- Firebase는 현재 stub 없음 — concept-quiz가 자체 내부에서 Firebase Auth 사용. Hub 레벨 통합은 Mimic 도입 시 함께 작업 예정.

**`useAuthState()`** — React 훅, Hub navbar에서 사용.
- 반환: `{ user, busy, error, signIn, signOut, providerName }`

## ★ Vite + import.meta.env 함정

**`auth/resolver.ts`와 `api/client.ts`에서 `import.meta.env` 직접 접근. 옵셔널 체이닝 절대 금지:**
```ts
// ❌ Vite static 감지 실패 → 런타임 undefined
const env = (import.meta as any)?.env;

// ✅
const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
```
Vite는 소스 텍스트에서 `import.meta.env` 패턴을 detect해 모듈 상단에 env 객체 주입 코드를 prepend한다.
옵셔널 체이닝(`import.meta?.env`)이 들어가면 패턴 매칭이 깨진다.

이 패키지에 `import.meta.env`를 새로 추가할 일이 있다면 **반드시 직접 접근 형태로** 작성.

## 새 유틸 추가하기

1. 도메인(포커) 의존이 있다면 → `@hh/poker-engine` (이쪽 아님)
2. UI 컴포넌트라면 → `@hh/ui`
3. **횡단(앱-무관) 유틸 / 훅이라면** → 여기
4. 추가 위치:
   - 단순 유틸 → `src/lib/<name>.ts` + `src/lib/index.ts`에서 export
   - React 훅 → `src/hooks/<name>.ts` + `src/hooks/index.ts`에서 export
   - auth 관련 → `src/auth/`
   - API 관련 → `src/api/`
5. `src/index.ts`에서 re-export

## 함정

- ❌ React/DOM 의존을 `lib/`에 두지 말 것 — `lib/`는 환경 무관 유틸. React는 `hooks/`로.
- ❌ 특정 sub-app 한정 로직을 여기 두지 말 것 — 그건 sub-app 로컬.
- ❌ Firebase 관련 직접 import — concept-quiz 한정이라 거기만 있어야 함. 단 `peerDependencies.firebase` (optional)는 historical reason으로 남아있음 (현재 미사용).

## 검증

- `pnpm --filter @hh/shared typecheck` 통과
- Hub navbar 로그인 버튼 클릭 시 토스트 정상 (resolver 동작 확인)
- nut-to-3 / heads-up / pot-quiz 모두 `cn` import 정상 (재export 확인)

## 의존성

- `@tanstack/react-query`, `clsx`, `tailwind-merge`
- peer: `react` (필수), `firebase` (optional, 현재 미사용)
