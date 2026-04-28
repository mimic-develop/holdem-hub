# CLAUDE.md — @hh/api (Express 서버)

## 정체성

모노레포의 단일 Express 서버. dev에서 Hub Vite의 `/api/*` 프록시 대상. 현재는 nut-to-3 게임 생성 라우트만 호스팅.

- **포트**: 기본 `3002` (override: `API_PORT` env 또는 `--port` CLI 플래그)
- **CORS**: `cors()` 전체 허용 (dev 한정 — production 배포 시 origin 제한 필요)
- **JSON body limit**: 1MB

## 진입점

**`src/index.ts`** — 포트 결정 + `createApp()` + `app.listen()`.
**`src/app.ts`** — Express 앱 팩토리 + 라우터 마운트.

```ts
// app.ts
app.use("/api/health", healthRouter);
app.use("/api/nut-to-3", nutTo3Router);
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));
```

## 디렉토리

```
services/api/
├── src/
│   ├── index.ts                    # entry, port resolution
│   ├── app.ts                      # createApp factory
│   ├── routes/
│   │   ├── health.ts               # GET /api/health
│   │   └── nut-to-3.ts             # GET /api/nut-to-3/game/new
│   └── lib/
│       └── poker-engine.ts         # 너트 티어 평가 (pokersolver 기반, Node 전용)
├── package.json
└── tsconfig.json
```

## 라우트 목록

### `GET /api/health`
헬스 체크. `{ status: "ok", service: "@hh/api", timestamp }`.

### `GET /api/nut-to-3/game/new`
nut-to-3 앱이 새 게임 시작 시 호출.

**쿼리 파라미터**:
- `noFlush=true|1` (옵션) — 플러시 보드 제외
- `avoidNutTypes=A,B` (옵션) — 최근 본 너트 타입 제외 (다양성 확보)

**응답**:
```ts
{
  board: string[],          // 5장 (s/h/d/c + rank)
  streets: [
    { name: "플랍", board: string[3], tiers: NutTier[3] },
    { name: "턴",   board: string[4], tiers: NutTier[3] },
    { name: "리버", board: string[5], tiers: NutTier[3] },
  ]
}
```

`NutTier`는 클라이언트 zod schema(`apps/nut-to-3/src/lib/api-schema.ts`)와 일치해야 함.

## 실행

```bash
# 단독 dev
pnpm --filter @hh/api dev

# 단독 dev with custom port
pnpm --filter @hh/api dev --port 3099

# Hub와 동시
pnpm dev:all
```

`tsx watch src/index.ts` 사용 — TypeScript 직접 실행, 자동 재시작.

## 새 라우트 추가

1. `src/routes/<feature>.ts`에 `Router()` 정의:
   ```ts
   import { Router } from "express";
   export const fooRouter = Router();
   fooRouter.get("/", (req, res) => { ... });
   ```
2. `src/app.ts`에서 마운트:
   ```ts
   import { fooRouter } from "./routes/foo.js";
   app.use("/api/foo", fooRouter);
   ```
3. 클라이언트 측 zod schema는 호출 sub-app의 `lib/api-schema.ts`에 정의 (예: `apps/<app>/src/lib/api-schema.ts`).

## 새 도메인 로직 추가

1. **순수 도메인 함수 (React/DOM 무관)** → `@hh/poker-engine` 후보. 단, `@hh/poker-engine`의 기존 평가기와 중복되면 통합 검토.
2. **서버 한정 / Node API 의존** → `services/api/src/lib/<feature>.ts`. 예: `nut-to-3/poker-engine.ts`는 pokersolver 의존도가 깊어 여기 둠.
3. **Express 미들웨어** → `services/api/src/middleware/<name>.ts` (현재 디렉토리 없음, 필요 시 신규).

## 함정

- ❌ pokersolver는 자체 타입 미제공 → import 시 `// @ts-expect-error` + `const { Hand } = pokersolver;` 패턴.
- ❌ Node ESM에서 상대 import는 **`.js` 확장자 명시 필수** (`./routes/health.js`). `.ts`는 안 됨, 빈 확장자도 안 됨. tsx가 .ts → .js 매핑 자동 처리.
- ❌ CORS 설정은 dev 전용 (`cors()` 전체 허용). production 배포 시 origin allowlist 필수.
- ❌ JSON body limit 1MB — 파일 업로드 라우트 추가 시 별도 라우터에서 limit 상향 또는 multer 도입.
- ❌ 에러 핸들러 없음 — 새 라우트에서 throw하면 default Express 핸들러로 500. 명시적 try/catch 권장.
- ❌ 장기적으로 `services/api`는 인증 미들웨어가 추가될 자리 — 현재는 인증 비활성. `apiFetch`의 `authToken` hook은 클라이언트 측에서만 동작.

## 검증

- `pnpm --filter @hh/api typecheck` 통과
- `pnpm --filter @hh/api dev`로 실행 후:
  ```bash
  curl http://localhost:3002/api/health
  # {"status":"ok",...}
  
  curl http://localhost:3002/api/nut-to-3/game/new | jq '.board | length'
  # 5
  ```
- nut-to-3 클라이언트가 `pnpm dev:all` 환경에서 정상 게임 시작

## 의존성

- `express`, `cors`
- `pokersolver` (nut-to-3 너트 평가)
- `@hh/poker-engine` (현재 직접 사용은 거의 없으나 통합 검토 시 활용 가능)
- dev: `tsx`, `@types/express`, `@types/cors`, `@types/node`
