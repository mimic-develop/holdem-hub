# CLAUDE.md — @hh/tsconfig (공통 TypeScript 설정)

## 정체성

모든 워크스페이스가 extends하는 base TS 설정. `base.json`(Node-friendly)과 `react-app.json`(Vite + JSX) 두 가지.

## 파일

- **`base.json`** — Node + ESM strict 기본값. `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `noUnusedLocals/Parameters: true`, `isolatedModules: true`, `verbatimModuleSyntax: false`.
- **`react-app.json`** — `base.json` extends + `lib: [ES2022, DOM, DOM.Iterable]`, `jsx: "react-jsx"`, `useDefineForClassFields: true`, `noEmit: true`.

## 사용

각 워크스페이스 `tsconfig.json`:
```json
{
  "extends": "@hh/tsconfig/react-app.json",  // 또는 "@hh/tsconfig/base.json" (Node)
  "compilerOptions": {
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "noUnusedLocals": false,        // ← sub-app에서 자주 끔 (Hub typecheck 침투 회피)
    "noUnusedParameters": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 함정

- ❌ Sub-app에서 `noUnusedLocals: true` 유지 시 Hub의 `pnpm typecheck`가 sub-app 소스를 따라 들어가며 cascade 에러 발생. sub-app은 `false`로 끄고, 깨끗한 코드는 별도 lint로 강제.
- ❌ `verbatimModuleSyntax: true` 켜면 `import type {}` 강제 — 기존 코드 다수가 `import { type Foo }` 혼용이라 일괄 마이그레이션 필요. 현재 OFF.
- ❌ `paths.@/*` 매핑은 sub-app tsconfig에만 정의되고 Hub tsconfig는 자기 src만 매핑. 즉 sub-app 소스 안에서 `@/foo` 사용해도 Hub 빌드 시 `@`가 sub-app 디렉터리를 가리키지 않음 → 모든 sub-app은 상대 경로 사용 권장.
- ❌ `react-app.json`은 DOM lib를 포함 — Node 워크스페이스(@hh/api 등)는 `base.json`을 extends해야 함.

## 의존성

(없음 — JSON 설정만)
