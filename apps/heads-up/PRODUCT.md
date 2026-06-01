# 헤즈업 홀덤 트레이너 — 기획서

> 외부 LLM(예: GPT)에게 이 앱의 맥락을 한 번에 전달하기 위한 문서.
> "무엇을 만들었는가"보다 "**왜 그렇게 만들었는가**"에 무게를 둔다.

---

## 0. 한 줄 요약

> **혼자서도 1:1 텍사스 홀덤을 GTO 관점에서 빠르게 반복 훈련**하고, 친구와는 P2P 1:1 매치까지 즐기는 클라이언트 전용 트레이너.

---

## 1. 제품 정체성

| 항목            | 내용                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------- |
| **이름**        | 헤즈업 홀덤 연습장 (`@hh/heads-up`, Hub의 `/heads-up` 라우트)                                       |
| **장르**        | Texas Hold'em No-Limit, **헤즈업(1:1) 전용**                                                        |
| **위치**        | "미믹 플레이랩" 모노레포의 sub-app 중 하나. 게임 로직이 가장 무겁고 상태가 큰 앱.                   |
| **타깃 사용자** | 풀링/풀테이블 GTO를 따로 공부 중인 입문~중급 플레이어. 친구와 빠르게 한 판 하고 싶은 캐주얼 사용자. |
| **차별점**      | (1) 쇼다운 후 GTO 점수표 제공 (2) WebRTC P2P로 서버 없이 친구와 매치 (3) AI 봇 3난이도              |
| **플랫폼**      | 웹 (PWA, Hub 레벨에서 통합). 모바일 우선 + 데스크탑.                                                |

### 1.1 디자인 톤

- **다크 + 골드** (felt-green `#0a6b3a`, gold `#d4af37`, card-back navy `#1a4480`)
- Pretendard 한글
- 카드/펠트는 **GTO Wizard / Poker Now** 류의 정돈된 카지노 톤 (장식 과잉 X)

---

## 2. 핵심 의도 (Why)

### 2.1 "헤즈업"만 다루는 이유

- 풀테이블 트레이너는 이미 시장에 많음
- 헤즈업은 **레인지/에쿼티 결정이 가장 압축**되어 학습 ROI가 높음
- 1:1이라 봇/네트워크 동기화가 단순 → 클라이언트 전용 구현 가능

### 2.2 "서버 없음" 결정

- Hand evaluation, equity, GTO 평가 전부 로컬
- WebRTC P2P (PeerJS) — 시그널링 외 영구 서버 의존 0
- 데이터(핸드 히스토리, 통계, 설정)는 **IndexedDB + localStorage**
- → 호스팅 비용 0, 오프라인 지원 가능, 사용자 데이터 자기 보유

### 2.3 "GTO 근접도" 채점이 핵심 학습 루프

- 액션 후 즉시 정/오답을 알려주는 게 아니라 **핸드 종료 후** street별 점수
- 0–100 점수 + 별 5개 + summary 텍스트
- 기준: 자체 preflop chart + postflop rules → 이상적 액션 vs 실제 액션 거리
- 의도: 한 판 한 판이 "복기" 자료가 되도록

### 2.4 미니멀한 친구 매치 (REMOTE 모드)

- 방장 코드 6자 → 친구가 입력 → P2P 연결
- **호스트가 source of truth**: 게스트는 액션 메시지를 보내고, 호스트가 적용·결과 브로드캐스트
- 덱 시드를 호스트가 노출(매판 종료 시) → 게스트가 검증 → 치팅 방지의 MVP("친구는 안 속인다" 가정)

---

## 3. 화면 구성 (Pages)

라우터: **react-router-dom v6** (단, Hub 통합 시 `<BrowserRouter basename="/heads-up">`).

| 경로                               | 역할                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `/` (HomePage)                     | AI 시작 / 친구 방 만들기 / 코드 입력 / 성장 지표(GrowthStats) / spot 분석(SpotBreakdown) |
| `/table` (TablePage)               | **인게임 화면** — 펠트, 시트, 액션바, 사이드 메뉴                                        |
| `/history` (HistoryPage)           | IndexedDB의 완료 핸드 목록                                                               |
| `/analysis/:handId` (AnalysisPage) | 한 핸드의 GTO 점수 + street별 평가 + 액션 타임라인                                       |
| `/settings` (SettingsPage)         | 닉네임, 효과음/햅틱 토글, **베팅 사이즈 프리셋**, 데이터 삭제                            |
| `/about` (AboutPage)               | 소개                                                                                     |

---

## 4. 게임 플로우

```
HomePage
  ├─ "AI와 연습" 클릭 → 난이도 선택(EASY/MEDIUM/HARD)
  │     → game-store.startAiGame(difficulty)
  │     → /table로 navigate
  │     → MatchmakingIntro 1.8초 (VS 화면, 매치업 사운드)
  │     → onComplete → 카드 딜링 (spring 애니메이션 + whoosh)
  │     → 봇 SB 또는 BB 자동 액션
  │     → 사용자 차례: TurnBanner "🎯 내 차례입니다" + 차임 + amber 글로우
  │     → 액션바(Q/W/E 단축키): Fold / Check or Call / Raise(슬라이더)
  │     → 매 액션마다 칩/체크/폴드 사운드 + ActionToast
  │     → 핸드 종료 → HandResultOverlay (승패 + 칩 변동 + GTO 점수)
  │     → "다음 핸드" → game-store.startNextHand() → 블라인드 회전
  │
  └─ "방 만들기" / "코드 입력" → CreateRoomDialog / JoinRoomDialog
         → PeerJS 연결 → game-store.attachRemoteConnection()
         → /table (호스트 vs 게스트 분기 처리, ConnectionStatusBanner 표시)
```

---

## 5. 인게임 화면(TablePage) 레이아웃

### 5.1 구조 — 3구역 flex column

이전엔 absolute 시트가 테이블 위에 떠 있어 커뮤니티 보드와 겹치는 버그가 있었다. 이를 해결하기 위해 다음 구조로 정리:

```
<main flex h-screen flex-col overflow-hidden>
  ┌─────────────────────────────────────────┐
  │ Top bar: [나가기] [Hand #N] [⚙ 설정]      │
  ├─────────────────────────────────────────┤
  │ Opponent area (minHeight 90px)          │ ← 시트가 시각적으로 펠트 윗가장자리에 살짝 걸침
  │   ActionToast → DealerButton+PlayerSeat │
  ├─────────────────────────────────────────┤
  │ Table area                              │
  │   PokerTable(타원 펠트)                  │
  │     PotDisplay                          │
  │     CommunityBoard (5장)                │
  │   BetChip(opp, top:14%)                 │
  │   BetChip(me,  bottom:14%)              │
  ├─────────────────────────────────────────┤
  │ Player area (minHeight 110px)           │
  │   DealerButton+PlayerSeat → ActionToast │
  ├─────────────────────────────────────────┤
  │ ChatInput | ActionBar (Fold/Call/Raise) │ normal flow, absolute 아님
  └─────────────────────────────────────────┘
  + MatchmakingIntro overlay (z-40, 시작 시 1.8초)
  + TurnBanner (z-30, 내 차례 진입 시 1.5초)
  + HandResultOverlay (z-50, 핸드 종료 시)
  + InGameSettingsModal (z-50, ⚙ 클릭)
```

### 5.2 칩(BetChip) 디자인 의도

- **3단 디스크 스택 + 가장자리 dash 4개** → 실제 포커칩처럼 즉시 식별
- **금액 티어로 색상 자동 결정** (white < 5BB, red < 25, green < 100, blue < 500, black ≥ 500)
- 라벨이 칩 우측 inline → "이 칩이 누구의 베팅인지" 명확
- 위치: top/bottom 14% — 커뮤니티 보드와 겹치지 않도록 플레이어 쪽에 가깝게

### 5.3 시트(PlayerSeat) — 차례 강조

- `isToAct=true` 시 amber 펄스 글로우 + scale 애니메이션 + ring
- **`isMe`이면 추가로 강한 글로우** (불투명도 0.85, 거리 16px, ring-3px) — 사람 입장에서 자신의 차례를 확실히 인지

### 5.4 액션바(ActionBar)

- 우하단 normal flow, sm:max-w-md
- 3컬러 코딩: **Fold(빨강) · Call/Check(녹색) · Raise(주황)**
- 키보드 단축키 **Q/W/E**
- Raise 클릭 시 BetSlider 펼침 — 사용자 정의 프리셋 + 숫자 입력 + 슬라이더

---

## 6. 설정 (Settings)

`localStorage` 키: `heads-up:hs-settings`

| 필드            | 의미                                    | 기본값             |
| --------------- | --------------------------------------- | ------------------ |
| `nickname`      | 친구 모드에서 상대에게 표시 (최대 20자) | `'익명'`           |
| `soundEnabled`  | 효과음 on/off                           | `true`             |
| `hapticEnabled` | 모바일 진동 on/off (실제 적용은 미구현) | `true`             |
| `betPresets`    | 팟 대비 비율 프리셋 배열 (1–5개)        | `[0.5, 0.67, 1.0]` |

### 6.1 베팅 프리셋 의도

- 플레이어마다 자주 쓰는 사이즈가 다름 (e.g. 1/3 cbet, 75% turn jam)
- 한 곳(Settings)뿐 아니라 **인게임 ⚙ 모달**에서도 변경 가능 → 흐름 끊지 않고 즉시 BetSlider에 반영
- ALL-IN은 항상 마지막에 자동 추가되므로 프리셋엔 포함 X
- 라벨은 분수에 따라 자동 ("0.5 → 1/2", "1.0 → Pot", "1.5 → 1.5x", 그 외 "75%")

---

## 7. 사운드 디자인

`utils/audio.ts` — Web Audio API **합성** (자산 파일 없음).

| 트리거                  | 음향                                 | 의도                              |
| ----------------------- | ------------------------------------ | --------------------------------- |
| 매치업 (게임 시작)      | A2 + E3 + A3 디튠 코드 + 저역 whoosh | 시네마틱 시작감                   |
| 카드 딜링 (street 변화) | 로우패스 필터링된 핑크 노이즈        | 천/펠트 마찰 같은 부드러운 whoosh |
| 베팅/레이즈/콜          | G4 + G5 옥타브 플럭                  | 또렷하지만 부담 없는 픽업         |
| 체크                    | D5 단일 톤                           | 가볍고 짧음                       |
| 폴드                    | A4 → E4 하강                         | 완료의 신호                       |
| 내 차례                 | E5 → A5 상승 차임                    | 주의 환기, 거슬리지 않음          |
| 핸드 종료 (승/쇼다운)   | C5–E5–G5 메이저 triad + C6 sparkle   | 만족감                            |

### 7.1 톤 디자인 원칙

- **사인파만 사용** (square/sawtooth 금지) — 거친 상위 배음 제거
- 어택 15–40ms, 릴리스 110–500ms — 클릭/팝 노이즈 0
- 마스터 게인 0.7, 피크 게인 0.04–0.09 — 청각 부담 감소
- **just intonation** (음악적 음정만) — 불협화음 없음
- jsdom/SSR 안전 (lazy AudioContext + try/catch)

---

## 8. AI 봇 (`bot/heuristic-bot.ts`)

3단계 난이도 → 각각 다른 프로필:

| 난이도 | 블러프율 | 어그로 | Equity Iter |
| ------ | -------- | ------ | ----------- |
| EASY   | 5%       | 0.75   | 300         |
| MEDIUM | 15%      | 1.0    | 500         |
| HARD   | 25%      | 1.25   | 1000+       |

### 의사결정 로직

1. **Preflop**: `hand-chart.ts`의 SB-open / BB-vs-open 차트 lookup → fold/call/raise 결정
2. **Postflop**: `postflop-rules.ts`의 hand classification (top pair, draw, air…) + `equity.ts`의 Monte-Carlo equity → action
3. **블러프**: 프로필 비율로 약한 핸드라도 raise 강행
4. **사고 시간**: 800–2500ms 랜덤 → 사람처럼 보이게

GTO 채점에 쓰는 평가기는 같은 chart/rules를 사용하지만 더 엄격한 임계값 — 봇은 "그럴듯한 인간", 채점기는 "이상적 GTO 근사".

---

## 9. GTO 채점 (`gto/*.ts`)

핸드 종료 시 비동기 평가 → CompletedHand에 `gtoAnalysis` 첨부.

| 필드           | 설명                                                           |
| -------------- | -------------------------------------------------------------- |
| `overallScore` | 0–100 (전체)                                                   |
| `streetScores` | preflop/flop/turn/river별 0–100                                |
| `summary`      | 자연어 한줄 요약 ("프리플랍 콜은 적절했지만 턴에서 over-fold") |

UI:

- HandResultOverlay에서 별 5개 + 점수 + summary
- AnalysisPage에서 액션별 상세 (이상적 액션 vs 실제, 그 차이)

### 의도

- 즉각 채점이 아니라 **핸드 단위 회고**가 학습 효과 더 큼
- street별 점수로 "어디서 무너졌는지" 시각화

---

## 10. WebRTC 친구 모드 (`rtc/*`)

### 10.1 연결 흐름

1. 호스트가 `방 만들기` 클릭 → 6자 코드 생성
2. 게스트가 `코드 입력` 클릭 → 코드 입력 → PeerJS로 연결 시도
3. 연결 완료 → 양쪽 `/table` 진입
4. PingTimer가 5초마다 ping → `pingMs` 표시

### 10.2 권위 모델 (host-authoritative)

- **호스트**: 모든 액션을 자기 game-state에 적용 → `STATE_UPDATE`/`HAND_END` 메시지 브로드캐스트
- **게스트**: `applyMyAction` 호출 시 액션 메시지만 송신 → 호스트의 STATE_UPDATE를 기다림 (`isSendingAction: true`)
- **덱 시드 검증**: HAND_END에 시드+덱 스냅샷 포함 → 게스트가 같은 시드로 셔플 후 일치 검증 → 불일치 시 `deckVerificationFailed` 배너

### 10.3 메시지 타입

`ACTION` / `STATE_UPDATE` / `HAND_END` / `CHAT` / `PING` / `PONG` / `LEAVE`

---

## 11. 데이터 모델

### 11.1 IndexedDB

DB: `heads-up:headsup-solo`, store: `hands`

```ts
interface CompletedHand {
  handId: string;
  timestamp: number;
  myCards: [Card, Card];
  oppCards: [Card, Card];
  board: Card[];
  actions: ActionRecord[]; // street별 액션 시퀀스
  resolution: HandResolution;
  myWinLoss: number; // BB
  gtoAnalysis?: GtoAnalysis; // 비동기로 채워짐
  deckSnapshot: Card[];
  seed?: number;
}
```

### 11.2 통계 (`storage/stats.ts`)

- 핸드 종료 시마다 IndexedDB 집계 — `today` / `7d` / `all` 윈도우
- AggregateStats: `totalHands`, `winRate`, `winStreak`, `bestStreak`, `vpip`, `pfr` 등
- HomePage의 GrowthStats가 이걸 표시

### 11.3 마일스톤

별도 `localStorage` 키 `heads-up:headsup-solo:milestones-shown` — 한 번 표시한 마일스톤은 재표시 안 함.

---

## 12. 기술 스택

| 영역      | 선택                                                        |
| --------- | ----------------------------------------------------------- |
| 빌드      | Vite 6                                                      |
| 언어      | TypeScript strict                                           |
| UI        | React 18, Tailwind v4, framer-motion                        |
| 상태      | **Zustand** (다른 sub-app은 useState만 — 이 앱이 가장 복잡) |
| 라우터    | react-router-dom v6                                         |
| P2P       | PeerJS (WebRTC)                                             |
| 저장소    | IndexedDB (`idb`-style 직접 wrapping), localStorage         |
| 사운드    | Web Audio API 합성 (자산 0)                                 |
| 테스트    | Vitest + fake-indexeddb                                     |
| 핸드 평가 | 자체 구현 (`engine/hand-evaluator.ts`)                      |

---

## 13. 디렉토리 맵

```
apps/heads-up/src/
├── pages/        # HomePage, TablePage, HistoryPage, AnalysisPage, SettingsPage, AboutPage
├── components/
│   ├── table/    # PokerTable, Card, HoleCards, CommunityBoard, ActionBar, BetSlider,
│   │             # PlayerSeat, PotDisplay, BetChip, DealerButton, ActionToast,
│   │             # ChatToast, ConnectionStatusBanner, HandResultOverlay,
│   │             # MatchmakingIntro, TurnBanner
│   ├── home/     # GrowthStats, SpotBreakdown, CreateRoomDialog, JoinRoomDialog
│   └── common/   # Modal, ConfirmModal, SettingsModal, InGameSettingsModal,
│                  # MilestoneToast, CompatBanner, ErrorBoundary, BetPresetsEditor
├── engine/       # card, deck, hand-evaluator, game-engine
├── bot/          # heuristic-bot, equity, hand-chart, postflop-rules
├── gto/          # preflop-evaluator, postflop-evaluator, equity-calculator, hand-evaluator-main
├── rtc/          # peer-connection, protocol, peer-options
├── store/        # game-store(Zustand), toast-store
├── storage/      # history, settings, stats (IndexedDB/localStorage)
├── hooks/        # useHandHistory, useSettings, useStats
├── types/game.ts
├── utils/        # audio, browser-compat, cn, version
└── index.css     # .app-heads-up 스코프
```

---

## 14. 최근(이번 세션) UX 강화

| 변경                                                          | 의도                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **TablePage 레이아웃 재구성** (absolute 시트 → 3구역 flex)    | 시트가 커뮤니티 보드를 가리던 버그, 슬라이더 펼칠 때 ActionBar 겹침 해결              |
| **베팅 프리셋 설정 추가**                                     | 사용자별 사이즈 선호 반영. SettingsPage + 인게임 ⚙ 모달 양쪽에서 변경                 |
| **MatchmakingIntro VS 화면**                                  | 시작 임팩트 + 어떤 상대와 매치되는지 명확히 인지                                      |
| **TurnBanner + 강화 글로우 + 차임**                           | "내 차례인지" 인지 비용 감소 (특히 멀티태스킹 중)                                     |
| **사운드 인프라 (Web Audio 합성)**                            | 자산 파일 없이 즉각 피드백. 사인파+로우패스 필터+just intonation으로 청각 부담 최소화 |
| **BetChip 재설계** (스택 + 티어 컬러 + inline 라벨, 14% 위치) | 칩이 무엇·누구·얼마인지 한눈에. 보드/팟과 시각 충돌 제거                              |

---

## 15. 의도적으로 안 한 것

- **풀테이블(2~9인)** — 헤즈업에 집중. 풀테이블은 별도 앱 가능성.
- **실시간 매칭 큐** — 친구 매치만 (서버 비용 0 유지)
- **레인지 차트 시각화** — 별도 트레이너 앱(`pot-quiz`, `nut-to-3`, `concept-quiz`) 영역
- **현금/포인트 시스템** — 학습 도구 포지션 유지, 도박 회피
- **하이엔드 사운드 자산** — 라이선스/번들 부담 회피
- **서버측 핸드 검증** — 친구 모드는 "신뢰 + 시드 검증" MVP

---

## 16. 향후 개선 후보 (백로그)

- 햅틱 실제 적용 (`navigator.vibrate`)
- 핸드 리플레이어 (히스토리에서 액션 step-through)
- 봇 페르소나 (LAG/TAG/Maniac 등 명시적 스타일)
- 친구 매치 토너먼트 모드 (블라인드 인상)
- 공개 룸/관전
- 모바일 PWA 설치 가이드 (현재 Hub 레벨 통합)

---

## 17. 외부 LLM에게 가장 중요한 3가지

1. **클라이언트 전용**이라 서버 API 호출이 없다. 모든 로직(evaluation, GTO, bot, RTC)이 브라우저에서 실행된다.
2. **상태는 Zustand 단일 store(`game-store`)에 집중**되어 있고, REMOTE 모드는 호스트 권위 모델이다. 게스트는 "보내고 기다림".
3. **GTO 채점은 학습 루프의 핵심**이며, 즉답이 아니라 핸드 종료 후 회고 형태로 제공된다. 이게 봇 승패보다 중요한 가치 제안이다.
