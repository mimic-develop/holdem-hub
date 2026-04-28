# CLAUDE.md — @hh/heads-up (헤즈업 트레이너)

> 이 앱만 작업할 때는 **이 파일과 여기서 안내하는 파일만** 읽어도 충분하도록 작성됨.
> 다른 sub-app의 src는 읽지 말 것.

## 정체성

- **출처**: 기존 PWA 프로젝트 `mimic_heads_up` 이식. AI / WebRTC P2P 1:1 텍사스 홀덤 + GTO 근접도 분석.
- **테마**: **다크 (neutral-950) + felt-green `#0a6b3a` + gold `#d4af37` + card-back navy `#1a4480`** + Pretendard.
- **라우터**: **`react-router-dom v6`** (다른 sub-app은 wouter). `<BrowserRouter basename="/heads-up">` 으로 격리.
- **데이터**: 클라이언트 전용 (서버 호출 없음). 핸드 평가 / GTO / 봇 모두 로컬.
- **상태**: **Zustand** (다른 sub-app은 useState만 사용). game-store, toast-store.
- **저장소**: **IndexedDB** (`heads-up:headsup-solo` DB, `hands` store) + localStorage (`heads-up:hs-settings`, `heads-up:headsup-solo:milestones-shown`).
- **PWA**: Hub 레벨에서 통합 (이 앱 내부에 SW 등록 코드 없음). `vite-plugin-pwa` 설정은 `apps/hub/vite.config.ts`.
- **WebRTC**: PeerJS. 친구와 P2P 연결 (`방 만들기` / `코드 입력`).

## 진입점

**`src/index.tsx`** — Hub의 `<Route path="/heads-up" nest>`:
```tsx
<div className="app-heads-up">
  <BrowserRouter basename="/heads-up">
    <App />
  </BrowserRouter>
</div>
```

`App.tsx`가 실제 라우팅 정의 (`Routes` + 6개 `Route` + `ErrorBoundary` + `MilestoneToast`).

**`src/main.tsx`는 사용 안 함** — Hub가 root 렌더링 처리. (이식 시 제거됨)

## 파일 맵 (작업별 진입점)

| 작업 종류 | 먼저 읽을 파일 |
|---|---|
| 라우팅 (페이지 추가) | `src/App.tsx` (RR6 `<Routes>`) |
| 메인 화면 / 성장 지표 / AI 시작 | `src/pages/HomePage.tsx` |
| 게임 테이블 / 액션 처리 | `src/pages/TablePage.tsx` |
| 핸드 히스토리 목록 | `src/pages/HistoryPage.tsx` |
| 핸드 분석 (GTO 점수) | `src/pages/AnalysisPage.tsx` |
| 설정 | `src/pages/SettingsPage.tsx` |
| **게임 상태 관리** | `src/store/game-store.ts` (Zustand — 가장 큰 파일) |
| 토스트 큐 | `src/store/toast-store.ts` |
| 핸드 평가 (5장 / 7장) | `src/engine/hand-evaluator.ts` |
| 게임 흐름 (AI 턴, deal, betting) | `src/engine/game-engine.ts` |
| 카드 / 덱 | `src/engine/{card,deck}.ts` |
| AI 봇 로직 | `src/bot/{heuristic-bot,equity,hand-chart,postflop-rules}.ts` |
| GTO 평가 | `src/gto/*.ts` |
| WebRTC | `src/rtc/{peer-connection,protocol,peer-options}.ts` |
| **포커 전용 UI** | `src/components/table/{PokerTable,Card,HoleCards,CommunityBoard,ActionBar,BetSlider,PlayerSeat,PotDisplay}.tsx` |
| 일반 UI (Modal, Confirm 등) | `src/components/common/{Modal,ConfirmModal,SettingsModal,MilestoneToast,CompatBanner,ErrorBoundary}.tsx` (현재 앱 로컬 — 추후 `@hh/ui` shadcn으로 교체 후보) |
| 홈 화면 위젯 | `src/components/home/{GrowthStats,SpotBreakdown,CreateRoomDialog,JoinRoomDialog}.tsx` |
| IndexedDB 저장소 | `src/storage/{history,settings,stats}.ts` |
| 기록 훅 | `src/hooks/{useHandHistory,useSettings,useStats}.ts` |
| 타입 | `src/types/game.ts` |
| 테마 / 스코프 | `src/index.css` |
| 통합 PWA / SW 설정 | (이 앱 아님) `apps/hub/vite.config.ts` `VitePWA(...)` |

## 디렉토리 구조

```
apps/heads-up/
├── src/
│   ├── index.tsx           # 진입점 (BrowserRouter wrap)
│   ├── App.tsx             # RR6 Routes 정의
│   ├── index.css           # .app-heads-up 스코프
│   ├── pages/              # 6개 페이지 (HomePage, TablePage, HistoryPage, AnalysisPage, SettingsPage, AboutPage)
│   ├── components/
│   │   ├── common/         # 일반 UI (Modal 등) — 앱 로컬
│   │   ├── home/           # 홈 화면 위젯
│   │   └── table/          # 포커 전용 UI (앱 로컬)
│   ├── engine/             # hand-evaluator, game-engine, card, deck
│   ├── bot/                # AI 봇
│   ├── gto/                # GTO 평가
│   ├── rtc/                # WebRTC peer
│   ├── store/              # Zustand stores
│   ├── storage/            # IndexedDB 어댑터
│   ├── hooks/
│   ├── types/game.ts
│   ├── utils/
│   └── test-setup.ts       # fake-indexeddb/auto
├── package.json
├── tsconfig.json
└── vitest.config.ts        # setupFiles 지정
```

## 테마 변수 (`src/index.css`)

```css
.app-heads-up {
  background-color: oklch(0.145 0 0);  /* neutral-950 */
  color: oklch(0.961 0 0);             /* neutral-100 */
  font-family: "Pretendard", -apple-system, ...;
  min-height: 100vh;
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

**색상 토큰** (`felt-green/felt-dark/gold/card-back`)은 `@hh/tailwind-config/base.css`의 `@theme`
블록에 등록되어 있어 자동으로 `bg-felt-green`, `text-gold` 등 utility 생성. **여기서는 색상 변수 정의 안 함.**

`.app-heads-up`은 **dark variant 클래스 사용 안 함** — 원본도 `dark:` variant 미사용 (다크 팔레트 직접 사용).

## 관행 / 컨벤션

- **라우터 import**: **반드시 `react-router-dom`** (`Link`, `useNavigate`, `useParams`). wouter import 금지.
- **포커 전용 컴포넌트는 앱 로컬**: `PokerTable`, `Card`, `HoleCards`, `CommunityBoard`, `ActionBar`, `BetSlider`, `PlayerSeat`, `PotDisplay` — 깊이 커스터마이즈됨. `@hh/ui`로 옮기지 말 것.
- **일반 UI는 추후 shadcn 교체 후보**: `Modal`, `ConfirmModal`, `SettingsModal`, `MilestoneToast`, `CompatBanner`. 현재는 앱 로컬 (디자인 보존 우선). 교체 시 디자인 회귀 확인 필수.
- **카드 데이터 형식**: 자체 형식 (`{ rank: number, suit: string }`). `engine/card.ts` 참조. `@hh/poker-engine` Card 타입과 호환되는 변환 유틸 필요 시 추가.
- **`@hh/poker-engine` 사용**: 현재는 거의 사용 안 함 — 자체 hand-evaluator 보유. 추후 통합 검토 가능.
- **저장소 prefix**:
  - IndexedDB DB: `heads-up:headsup-solo`
  - localStorage: `heads-up:hs-settings`, `heads-up:headsup-solo:milestones-shown`
- **테스트 DB 이름**: 테스트 파일에서 `indexedDB.deleteDatabase('heads-up:headsup-solo')` (원본 `'headsup-solo'`에서 변경됨).

## 함정

- ❌ wouter `Link`/`useLocation` 사용 — 이 앱은 RR6. 다른 sub-app 코드 복붙 시 주의.
- ❌ Hub의 `apps/hub/src/index.css` `@source` 디렉티브에 `apps/heads-up/src/**` 누락 시 felt-green 등 utility 미생성.
- ❌ `import.meta.env`에 옵셔널 체이닝 사용 — Vite 주입 깨짐.
- ❌ `framer-motion` `motion.div`의 `onClick={(e) => ...}` 파라미터에 명시 타입 없으면 TS strict에서 implicit any. `(e: React.MouseEvent) => ...` 사용.
- ❌ React 중복 인스턴스 — Hub `vite.config.ts`의 `resolve.dedupe: ["react", "react-dom"]`로 해결. 새 sub-app 추가 시에도 동일 처리.
- ❌ PWA SW 등록을 이 앱 안에서 호출 — Hub 레벨 통합이라 금지. `apps/hub/vite.config.ts`의 `VitePWA` 설정만 사용.
- ❌ DB 이름 변경 시 `src/store/__tests__/*.test.ts`, `src/storage/__tests__/*.test.ts`에서 하드코딩된 `deleteDatabase` 인자도 함께 갱신 필요.

## 테스트

```bash
pnpm --filter @hh/heads-up test          # vitest run (313 tests, ~9s)
pnpm --filter @hh/heads-up test:watch    # 개발 중
```

`vitest.config.ts`의 `setupFiles: ["./src/test-setup.ts"]` → `fake-indexeddb/auto` 자동 로드.

## 검증 (Definition of Done)

- `pnpm --filter @hh/heads-up typecheck` 통과
- `pnpm --filter @hh/heads-up test` 313 tests 통과
- `/heads-up`에서:
  - 홈: 다크 + 골드 타이틀 + 펠트-그린 "AI와 연습" 버튼 표시
  - AI 시작 → 난이도 선택 → 게임 테이블 (펠트-그린, 골드 보더, 홀카드 정면, 봇 카드 뒷면 navy)
  - 액션 (콜 / 폴드 / 레이즈) → 봇 응답 → 핸드 진행
  - `/heads-up/history` 진입 시 IndexedDB에서 핸드 로드
  - 콘솔 에러 0건
- WebRTC: 두 브라우저 탭에서 `방 만들기` ↔ `코드 입력` 연결 (별도 검증)

## 원본 대비 변경 사항 (이식 기록)

- 110개 파일 일괄 이식 (engine/bot/gto/rtc/store/storage/pages/components/hooks/types/utils 모두)
- `main.tsx` 제거 + `index.tsx` 신규 (BrowserRouter wrap)
- 원본 `vite.config.ts`의 `VitePWA` 설정 → Hub로 이동. `registerSW` 호출도 제거
- `vitest.config.ts` 신규 (원본은 vite.config 안에 통합되어 있던 vitest 설정 분리)
- IndexedDB DB 이름: `headsup-solo` → `heads-up:headsup-solo`
- localStorage: `hs-settings` → `heads-up:hs-settings`, `headsup-solo:milestones-shown` → `heads-up:headsup-solo:milestones-shown`
- 테스트 파일의 `indexedDB.deleteDatabase()` 인자도 동일 prefix 적용
- Tailwind v3 `extend.colors.{felt-green, felt-dark, gold, card-back}` → v4 `@theme` (in `@hh/tailwind-config/base.css`)
- `<html class="dark">` 제거 (실제 dark variant 미사용)
- framer-motion `onClick` 파라미터 명시 타입 (Modal, ConfirmModal, SettingsModal, JoinRoomDialog 4건)
- `peerjs` 생성자 시그니처 우회 캐스팅 (`PeerCtor` 별칭)
- `package.json`: `vite-plugin-pwa`, `workbox-window`, `eslint*` 등 Hub로 이전된 deps 제거
- 원본 `vercel.json` 폐기 (Hub 배포 설정에 흡수 예정)
