# Heads-Up AI 플레이 로직 레퍼런스

> 마스터 스펙 v2 §10.7–10.8 기반. 소스: `src/bot/`

---

## 1. 시스템 개요

```
페르소나 (어떤 스타일로 플레이하는가)
    × 난이도 (그 스타일을 얼마나 일관되게 실행하는가)
    = 최종 봇 행동
```

**결정 파이프라인**

```
결정 요청
  └─ 프리플랍?
       ├─ Yes → 핸드 차트 조회 → 페르소나 바이어스 적용 → 사이징 계산
       └─ No  → 에퀴티 계산(Monte Carlo) → 핸드 강도 분류 → 에퀴티 구간 판단
                                              └─ 블러프/세미블러프 여부
  └─ 난이도 노이즈 적용 → 최종 액션 반환
```

---

## 2. AI 페르소나 5종

> 모든 바이어스는 STANDARD(= 1.0) 기준 **곱셈 가중치**.  
> 소스: `src/bot/personas.ts`

### 바이어스 수치 비교표

| 바이어스 | STANDARD | NIT | LAG | CALLING | MANIAC |
|---|:---:|:---:|:---:|:---:|:---:|
| **vpipBias** (팟 참여 빈도) | 1.00 | 0.72 | 1.25 | 1.15 | 1.35 |
| **pfrBias** (프리플랍 레이즈) | 1.00 | 0.78 | 1.22 | 0.82 | 1.40 |
| **threeBetBias** (3벳 빈도) | 1.00 | 0.75 | 1.18 | 0.70 | 1.35 |
| **cbetBias** (플랍 컨티뉴에이션벳) | 1.00 | 0.92 | 1.12 | 0.90 | 1.25 |
| **barrelBias** (턴·리버 배럴) | 1.00 | 0.88 | 1.15 | 0.82 | 1.30 |
| **bluffBias** (블러프 빈도) | 1.00 | 0.55 | 1.20 | 0.58 | 1.45 |
| **callDownBias** (콜다운 의지) | 1.00 | 0.75 | 0.95 | 1.32 | 1.05 |
| **trapBias** (슬로우플레이) | 1.00 | 1.05 | 0.70 | 0.95 | 0.45 |
| **riskTolerance** (사이즈 공격성) | 1.00 | 0.65 | 1.20 | 0.98 | 1.45 |
| **showdownCuriosity** (쇼다운 유도) | 1.00 | 0.70 | 0.95 | 1.30 | 1.05 |

---

### STANDARD — 스탠다드
> "가장 기본적인 균형형 상대"

모든 바이어스가 1.0인 기준 페르소나. 프리플랍 레인지와 포스트플랍 판단 모두 중간값을 따른다.
다른 페르소나의 행동을 이해하는 기준점으로 사용.

**실전 특징**
- 팟 참여 빈도: 보통
- 블러프: 보통 (약 15% 기본 블러프율)
- 콜다운: 보통
- 슬로우플레이: 보통

---

### NIT — 니트
> "잘 안 붙다가 강할 때 세게 옴"

**실전 특징**
- 팟 참여 빈도 낮음 (vpipBias 0.72): 약한 핸드는 대부분 폴드
- 블러프 매우 적음 (bluffBias 0.55): 베팅 = 강한 핸드 신호
- 콜다운 낮음 (callDownBias 0.75): 애매하면 빠른 폴드
- 슬로우플레이 약간 높음 (trapBias 1.05): 너트 핸드에서 가끔 체크
- 사이즈 보수적 (riskTolerance 0.65): 레이즈해도 사이즈 작음
- **상대 전략**: 베팅을 존중하되 블러프에 쉽게 폴드하므로 압박 압력으로 많은 팟 스틸 가능

---

### LAG — 루즈 어그로
> "계속 불편하게 압박하는 상대"

**실전 특징**
- 팟 참여 빈도 높음 (vpipBias 1.25): 넓은 레인지로 참여
- 3벳 자주 (threeBetBias 1.18): 레이즈에 재레이즈로 응수
- 컨티뉴에이션벳·배럴 높음 (cbetBias 1.12, barrelBias 1.15): 매 스트릿 압박
- 블러프 많음 (bluffBias 1.20): 약한 핸드에서도 베팅 시도
- 슬로우플레이 적음 (trapBias 0.70): 강하면 빠르게 베팅
- **상대 전략**: 좋은 핸드로 트랩 설정 / 약한 핸드에서 콜다운은 에퀴티 확인 후 결정

---

### CALLING — 콜링 스테이션
> "잘 죽지 않고 콜이 많은 상대"

**실전 특징**
- 팟 참여 빈도 높음 (vpipBias 1.15): 많이 들어옴
- 레이즈 적음 (pfrBias 0.82): 주로 콜 위주
- 3벳 거의 없음 (threeBetBias 0.70): 레이즈에 콜로 응수
- 콜다운 매우 높음 (callDownBias 1.32): 리버까지 잘 폴드 안 함
- 쇼다운 관심 높음 (showdownCuriosity 1.30): 팟오즈 불리해도 콜
- 블러프 적음 (bluffBias 0.58): 베팅 = 실제 핸드
- **상대 전략**: 블러프 효과 낮음. 가치벳 자주, 약한 핸드 블러프 자제. 강한 핸드로 크게 베팅

---

### MANIAC — 매니악
> "과잉 공격과 높은 블러프의 상대"

**실전 특징**
- 팟 참여 빈도 최고 (vpipBias 1.35): 거의 모든 핸드 참여
- 레이즈·3벳 극단적 (pfrBias 1.40, threeBetBias 1.35)
- 배럴 극단적 (barrelBias 1.30): 미스드 드로에도 끝까지 압박
- 블러프 매우 높음 (bluffBias 1.45): 빈번한 허위 베팅
- 슬로우플레이 거의 없음 (trapBias 0.45): 강하면 즉시 올인 시도
- 사이즈 최대 (riskTolerance 1.45): 오버벳 빈번
- **상대 전략**: 폴드 에퀴티 낮음. 중간 핸드로도 콜다운 가능. 리레이즈는 실제 강한 핸드에서만

---

## 3. 난이도 3단계

> 난이도 = GTO 정확도가 아니라 **성향 일관성**.  
> 소스: `src/bot/levels.ts`

| 레벨 | 한국어 | 결정 노이즈 | 사이징 정확도 | 적응력 | 딜레이 | 에퀴티 반복수 |
|---|---|:---:|:---:|:---:|---|:---:|
| **EASY** | 쉬움 | 22% | 72% | 60% | 900–2200ms | ≈ 804회 |
| **MEDIUM** | 보통 | 12% | 84% | 80% | 700–1800ms | ≈ 888회 |
| **HARD** | 어려움 | 6% | 93% | 100% | 600–1400ms | ≈ 951회 |

**에퀴티 반복수 계산**: `300 + sizingAccuracy × 700`

**결정 노이즈 규칙** (`applyLevelNoise`)

| 원래 액션 | noise 발생 시 변환 |
|---|---|
| `raise` | → `call` (또는 `check`) — 압박을 머뭇거림 |
| `bet` | → `check` — 자발적 베팅 망설임 |
| `call` | → `call` 유지 (commitment 방향은 뒤집지 않음) |
| `check` | → `bet` (raise 가능 시) — 소극적 체크에서 급 베팅 |
| `fold` | → `fold` 유지 (noise로 갑자기 콜 금지) |

---

## 4. 프리플랍 의사결정

> 소스: `src/bot/heuristic-bot.ts` → `preflopDecide()`  
> 핸드 차트: `src/bot/hand-chart.ts`

### 결정 흐름

```
1. handKey(hole) → 차트 조회
     - SB (미레이즈): HU_SB_OPEN_CHART
     - BB (vs 오픈): HU_BB_VS_OPEN_CHART
     - 차트 미등재 핸드 → { raise:0, call:0, fold:1 } (폴드)

2. applyPersonaPreflop(base, persona, facingRaise)
     - foldFactor = clamp(1 / vpipBias, 0.3, 2.5)
     - fold = base.fold × foldFactor
     - raiseScale = facingRaise ? threeBetBias : pfrBias
     - raise = (1 - fold) × baseRaiseShare × raiseScale
     - call = (1 - fold) - raise

3. samplePreflop(adjusted) → 'raise' | 'call' | 'fold'

4. 벳 사이징
     오픈 레이즈: BB × (2.3 + rng×0.6) × aggression(riskTolerance)
     3벳:        (pot + toCall) × (2.0 + rng×0.8) × aggression

5. applyLevelNoise(raw, decisionNoise, ...)
```

### SB 오픈 레인지 (`HU_SB_OPEN_CHART`) 주요 예시

| 핸드 | raise | call | fold |
|---|:---:|:---:|:---:|
| AA–TT | 100% | 0% | 0% |
| 99–22 | 100% | 0% | 0% |
| AKs–A2s | 100% | 0% | 0% |
| AKo–A3o | 100% | 0% | 0% |
| A2o | 90% | 5% | 5% |
| K2o | 40% | 10% | 50% |
| 모든 스큐티드 | 100% | 0% | 0% |

### BB vs 오픈 (`HU_BB_VS_OPEN_CHART`) 주요 예시

| 핸드 | 3벳 | 콜 | 폴드 |
|---|:---:|:---:|:---:|
| TT+ | 85% | 15% | 0% |
| 77–99 | 30% | 70% | 0% |
| 22–66 | 5% | 85% | 10% |
| AKs | 65% | 35% | 0% |
| AQo | 50% | 50% | 0% |

---

## 5. 포스트플랍 의사결정

> 소스: `src/bot/postflop-rules.ts` → `decidePostflop()`  
> 에퀴티: `src/bot/equity.ts` → `calculateEquity()` (Monte Carlo)

### 에퀴티 구간별 액션

| 에퀴티 | canCheck=true | canCheck=false (베팅 직면) |
|---|---|---|
| **≥ 75%** (강한 핸드) | `bet` 팟의 66–100% × aggression | 85%로 `raise` (팟+콜의 1.5–2.3배), 15%로 `call` |
| **55–75%** (괜찮은 핸드) | 60%로 `bet` 팟의 40–65%, 40%로 `check` | `call` |
| **35–55%** (마지널) | 드로 있으면 bluffRate×2로 세미블러프 `bet`, 아니면 `check` | 에퀴티 ≥ 팟오즈면 `call`, 아니면 `fold` |
| **< 35%** (약한 핸드) | bluffRate(드로시 ×2.5)로 `bet`, 아니면 `check` | 드로시 팟오즈×0.85 이상이면 `call`, 아니면 `fold` |

### 스트릿별 공격성 보정 (`streetAggressionMultiplier`)

| 스트릿 | 적용 바이어스 |
|---|---|
| 플랍 | `cbetBias` |
| 턴·리버 | `barrelBias` |
| 프리플랍 | 1.0 (미적용) |

최종 공격성 = `persona.riskTolerance × streetAggressionMultiplier`

### 핸드 강도 분류 (`classifyHand`)

`src/bot/postflop-rules.ts` → `HandStrength` 인터페이스

| 플래그 | 설명 |
|---|---|
| `madeHand` | HIGH_CARD ~ ROYAL_FLUSH 열거값 |
| `isPocketPair` | 홀카드 두 장이 같은 랭크 |
| `isOverpair` | 포켓페어가 보드 최고 카드보다 높음 |
| `isTopPair` | 홀카드 하나가 보드 최고 랭크와 페어 |
| `isPair` / `isTwoPair` | 원페어 / 투페어 |
| `isSet` | 포켓페어 + 보드 매칭 (세트) |
| `isStraight` / `isFlush` / `isFullHouse` | 메이드 핸드 |
| `isFlushDraw` | 동일 무늬 4장 (플러시 드로) |
| `isOESD` | 오픈엔드 스트레이트 드로 (~8 아웃) |
| `isGutshot` | 인사이드 스트레이트 드로 (~4 아웃) |
| `hasDraw` | 위 드로 중 하나라도 있으면 true |

---

## 6. BotProfile 환산 공식

> `deriveProfile(persona, level)` — `src/bot/heuristic-bot.ts`

```
bluffRate        = min(0.6, 0.15 × persona.bluffBias)
aggression       = persona.riskTolerance
equityIterations = round(300 + level.sizingAccuracy × 700)
thinkingMinMs    = level.delayRangeMs[0]
thinkingMaxMs    = level.delayRangeMs[1]
```

**STANDARD × MEDIUM 기준값**

| 파라미터 | 값 |
|---|---|
| bluffRate | 0.15 (15%) |
| aggression | 1.0 |
| equityIterations | 888회 |
| 딜레이 | 700–1800ms |

---

## 7. 생성자 & RNG

```ts
// 페르소나 × 난이도
new HeuristicBot('LAG', 'HARD')

// 레거시 (STANDARD 페르소나 고정)
new HeuristicBot('MEDIUM')

// 결정론적 시드 (테스트/리플레이용)
new HeuristicBot('LAG', 'HARD', 12345)
```

| RNG 종류 | 함수 | 용도 |
|---|---|---|
| 시드 기반 | `mulberry32(seed)` | 테스트, 리플레이 재현 |
| 암호학적 | `defaultCryptoRng()` | 실제 게임 |

---

## 8. 핵심 파일 맵

| 역할 | 파일 |
|---|---|
| 페르소나 정의 + 바이어스 수치 | `src/bot/personas.ts` |
| 난이도 정의 | `src/bot/levels.ts` |
| 메인 결정 엔진 (`HeuristicBot` 클래스) | `src/bot/heuristic-bot.ts` |
| 프리플랍 핸드 차트 | `src/bot/hand-chart.ts` |
| 포스트플랍 규칙 + 핸드 분류 | `src/bot/postflop-rules.ts` |
| 에퀴티 계산 (Monte Carlo) | `src/bot/equity.ts` |
| 타입 정의 (`AiPersonaId`, `AiLevel` 등) | `src/types/ai.ts` |
| 게임 스토어 봇 통합 | `src/store/game-store.ts` |
