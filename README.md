# 미믹 플레이랩 (holdem-hub)

홀덤 학습/연습 앱들을 한 곳에 모은 모노레포.

## 포함된 앱

| 앱               | 경로            | 설명                                         |
| ---------------- | --------------- | -------------------------------------------- |
| 팟 분배 퀴즈     | `/pot-quiz`     | 텍사스 홀덤 쇼다운 시 팟 분배 트레이너       |
| 너트 핸드 맞추기 | `/nut-to-3`     | 보드의 너트 핸드 3개를 빠르게 찾는 게임      |
| 홀덤 개념 퀴즈   | `/concept-quiz` | 룰부터 수학·실전까지. Firebase 진행률 동기화 |
| 헤즈업 트레이너  | `/heads-up`     | AI/P2P 1:1 대전, GTO 점수 분석 (PWA)         |

## 빠른 시작

```bash
# 의존성 설치 (pnpm 10+, Node 20+)
pnpm install

# 모든 앱 + API 동시 실행
pnpm dev:all

# Hub만 실행 (API 불필요한 앱 작업 시)
pnpm dev

# API만 실행
pnpm dev:api

# 빌드
pnpm build

# 타입 체크 / 린트 / 테스트
pnpm typecheck
pnpm lint
pnpm test
```

기본 포트:

- Hub: http://localhost:5175
- API: http://localhost:3002

Hub의 `/api/*` 요청은 dev 환경에서 자동으로 API 서버로 프록시된다.

## 디렉토리 구조

```
holdem-hub/
├── apps/
│   ├── hub/             # 통합 entry — navbar, 라우팅, PWA
│   ├── pot-quiz/        # 팟 분배 퀴즈 (서브앱 컴포넌트)
│   ├── nut-to-3/        # 너트 핸드 게임
│   ├── concept-quiz/    # 개념 퀴즈
│   └── heads-up/        # 헤즈업 트레이너 (RR6, Zustand)
├── packages/
│   ├── ui/              # @hh/ui — 공통 컴포넌트, shadcn/ui
│   ├── poker-engine/    # @hh/poker-engine — Card, hand 평가, pot 계산
│   ├── shared/          # @hh/shared — cn, queryClient, hooks, auth
│   ├── tailwind-config/ # @hh/tailwind-config — Tailwind v4 베이스
│   └── tsconfig/        # @hh/tsconfig — 공통 TS 설정
└── services/
    └── api/             # @hh/api — Express, /api/nut-to-3/*
```

## 환경 변수

`.env.example`을 `.env.local`로 복사하여 필요한 값을 채운다.

- Firebase 키는 `apps/concept-quiz/.env.local` 에만 있어도 무방.

## 개발 워크플로

자세한 가이드는 [CLAUDE.md](./CLAUDE.md) 참조.

- 새 앱 추가: `apps/` 하위 폴더 + `pnpm-workspace.yaml`은 글롭이라 자동 감지
- 새 공통 컴포넌트: `packages/ui/src/components/` 에 추가
- 새 게임 로직: `packages/poker-engine/src/`
