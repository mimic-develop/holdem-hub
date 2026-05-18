# Heads-Up AI 작동 방식 (베타)

> **이 엔진은 정확한 GTO 솔버가 아닙니다.**
>
> 25bb HU preflop은 GTO Wizard 스크린샷에서 수동 추출한 **노드별 aggregate action frequency** 를 baseline 으로 하고, **persona modifier** (압박 / 콜링 / 타이트 / 매니악 등) 와 **hand-class correction layer** (premium / strong / playable / trash) 를 곱해 분포를 기울인 뒤 weighted sample 로 액션을 고른다.
>
> 콤보 단위 GTO 정확도 보다 **노드 단위 전략 체감** 을 우선한 베타 골격이다. 정확한 콤보별 액션 차이는 미반영이며, AKs 와 KQo 가 동일 노드에서 동일 baseline 을 공유한 뒤 hand-class correction 만으로 분기된다. 향후 콤보 단위 range 로 확장 가능하도록 구조는 가볍게 유지한다.
>
> postflop 및 25bb 이외 스택은 레거시 `features → baseScores → personaModifier → difficultyModifier → chooseAction` 6-단계 휴리스틱이 그대로 동작한다.

> 진입점: [src/store/game-store.ts](src/store/game-store.ts) `applyBotAction()` → [src/bot/heuristic-bot.ts](src/bot/heuristic-bot.ts) `decide(state, botId)`

---

## 1. 의사결정 파이프라인 개요

```
applyBotAction()
└─ bot.decide(state, botId)
   │
   ├─ rawThinkingMs = random(persona×level delayRange)
   │
   ├─ ① 25bb HU Preflop 엔진 (베타)  ──────────────────
   │   decide25bbPreflop(state, botId, persona, rng)
   │   ├─ preflop 가드 + 22~30bb 효과적 스택 가드
   │   ├─ adaptHistory → tokens: ["SB_LIMP", "BB_RAISE_3", ...]
   │   ├─ getPreflopNodeId(positionToAct, tokens) → 12 노드 중 하나 or null
   │   ├─ baseline = NODES[nodeId].actions   ← preflopBaseline25bbHU.json
   │   ├─ specPersona = resolveSpecPersona(persona)
   │   │   STANDARD→balanced_pro / MANIAC→pressure_maniac /
   │   │   CALLING→sticky_caller / NIT→trap_master / LAG→emotional_swinger
   │   ├─ applyPersonaModifier(baseline, globalModifiers, nodeSpecificModifiers?)
   │   ├─ handClass = classifyHand(holeCards)            ← premium / strong / playable / trash
   │   ├─ applyHandClassCorrection(corrected, handClass)
   │   ├─ normalizeFrequencies → sum 100
   │   ├─ sampleWeightedAction(rng) → SpecAction
   │   └─ convertSpecAction → { action: PlayerAction, amount: chips }  ← raise_3 = raise to 3*bb
   │
   │   ↳ 매칭 실패(4bet+, 비표준 raise size, non-25bb 등) → null → 아래 ②로 fallback
   │
   ├─ ② 레거시 6-단계 파이프라인  ─────────────────────
   │   ❶ evaluateDecisionFeatures(state) → DecisionFeatures
   │       handStrengthBucket, drawStrength, showdownValue,
   │       boardTexture, position(IP/OOP), initiative,
   │       potOdds, spr, facingBetSize, previousAggressor, equity,
   │       canCheck, canCall, canRaise
   │   ❷ getBasePreflopScores() | getBaseActionScores() → ActionScore
   │       8키: fold / check / call / betSmall / betMedium / betLarge / raise / allIn
   │   ❸ applyPersonaModifiers(scores, features, persona)   ← 페르소나 정체성 부여
   │   ❹ applyDifficultyModifiers(scores, features, level, rng)   ← EASY/MEDIUM/HARD 노이즈
   │   ❺ chooseAction(scores, features, temperature, rng) → softmax-weighted action
   │   ❻ computeAmount(sizeRatio × pot)  → chips
   │
   └─ thinkingTimeMs = (fast action이면 ×0.45 with min 250ms) → 봇 응답 지연
```

**핵심 결합점**: `decide()` 시작점에 25bb HU preflop 엔진이 끼어들고, 매칭 실패 시 기존 파이프라인으로 자연스럽게 fallback. postflop은 모두 ②번 파이프라인.

---

## 2. 25bb HU Preflop 엔진 (베타)

### 12 명명 노드 (`preflopBaseline25bbHU.json`)

| 노드 | 액션 차례 | 직전 시퀀스 | 주요 분포 |
|---|---|---|---|
| `SB_FIRST_IN_25BB` | SB | (없음) | limp 52.1 / raise_2 42.1 / fold 5.7 |
| `BB_VS_SB_LIMP_25BB` | BB | SB_LIMP | check 61.9 / raise_3 20.1 / raise_7 10.4 / all_in 7.6 |
| `BB_VS_SB_OPEN_2BB_25BB` | BB | SB_RAISE_2 | call 55.7 / fold 18.9 / all_in 9.0 / raise_8 7.9 / raise_5 8.5 |
| `SB_VS_BB_JAM_AFTER_OPEN_2BB` | SB | SB_RAISE_2 → BB jam | call 24.7 / fold 75.3 |
| `SB_VS_BB_3BET_5_AFTER_OPEN_2BB` | SB | … BB_RAISE_5 | call 49.3 / fold 39.1 / all_in 11.6 |
| `SB_VS_BB_3BET_7_AFTER_OPEN_2BB` | SB | … BB_RAISE_7 | fold 75.1 / call 15.7 / all_in 9.2 |
| `SB_VS_BB_3BET_8_AFTER_OPEN_2BB` | SB | … BB_RAISE_8 | fold 61.3 / call 22.3 / all_in 16.4 |
| `SB_VS_BB_ISO_3_AFTER_LIMP` | SB | SB_LIMP → BB_RAISE_3 | call 46.7 / fold 45.1 / all_in 7.0 / raise_7_5 1.1 |
| `SB_VS_BB_ISO_7_5_AFTER_LIMP` | SB | … BB_RAISE_7_5 | call 43.6 / fold 39.2 / all_in 17.2 |
| `SB_VS_BB_JAM_AFTER_LIMP` | SB | … BB jam | fold 86.1 / call 13.9 |
| `BB_VS_SB_LIMP_JAM_AFTER_ISO_3` | BB | LIMP → BB_RAISE_3 → SB jam | fold 71.0 / call 29.0 |
| `BB_VS_SB_LIMP_JAM_AFTER_ISO_7` | BB | LIMP → BB_RAISE_7 → SB jam | call 75.6 / fold 24.4 |

매칭 실패 케이스 — 4bet, raise_2 외 SB 오프닝, 25bb 이탈 — 는 `null` 반환 → 기존 파이프라인.

### 액션 토큰 인코딩 (`historyAdapter.ts`)

`GameState.history`를 토큰 시퀀스로 변환:

- fold/check → `SB_FOLD`, `BB_CHECK`
- SB 첫 call(0.5bb→1bb 완료) → `SB_LIMP` (이후 SB call은 일반 `SB_CALL`)
- raise/bet → BB 단위로 round → 가장 가까운 spec 버킷({2, 3, 5, 7, 7.5, 8})에 snap → `SB_RAISE_3`
- amount ≥ ~23bb(`bb × 23`) → `..._ALL_IN_25`

### 핸드 클래스 보정 (`handClassRules.ts`)

baseline 분포에 페르소나 modifier 적용 후 **정규화 직전**에 hand-class 보정 (순서: boost → reduce → preventActions hard-zero → trash 절대 cap):

| 클래스 | 대표 | preventActions | boostActions | reduceActions |
|---|---|---|---|---|
| **premium** | AA, KK, QQ, JJ, TT, AKs, AKo, AQs | **`fold` hard 0** (마지막에 덮어씀 — 어떤 persona/normalize 도 fold 를 살리지 못함) | raise_2 ×1.5, raise_3/5/7/8 ×1.4, all_in_25 ×1.6, call ×1.15 | **limp ×0.25, check ×0.85** (raise-dominant 강제). `trap_master` persona 에서는 limp/check reduce 미적용 (트랩 정체성 유지) |
| strong | 99, 88, 77, AQo, AJs, ATs, KQs, KJs, QJs | — | call ×1.1, raise_2 ×1.15, raise_3 ×1.1, all_in_25 ×1.15 | — |
| playable | 그 외 mid pair/suited broadway 등 (fallback) | — | call ×1.1, limp ×1.1, check ×1.05 | — |
| **trash** | 72o, 82o, 83o, 32o, 42o, 52o, 62o, 73o, 74o, 84o, 93o, 94o, 95o, 43o, 53o, 54o, 63o, 64o | — | fold ×1.4, check ×1.1 | all_in_25 ×0.15, raise_7_5 ×0.25, raise_7/8 ×0.30, raise_5 ×0.45, raise_3 ×0.60, raise_2 ×0.80. **추가로 절대 cap: 모든 aggressive 액션 합 ≤ 4%** (post-normalize) |

> **constraint**:
> - baseline 0% 인 액션은 0% 유지 (persona/handClass 가 새 액션을 발명하지 않음)
> - premium `preventActions: ['fold']` 는 모든 reduce/boost 다음에 적용 → 어떤 persona modifier 가 fold 를 5배 boost 해도 결과 0% 유지
> - trash absolute aggression cap: 4% 를 초과하면 passive mass 기준으로 scale 적용 (`new_agg = passive × cap / (100 − cap)`), normalize 후에도 합산 aggression ≈ 4%
> - hand-class correction 의 `persona` 파라미터: 현재 `trap_master` 만 premium-limp/check reduce 면제. JSON 데이터는 유지되며 향후 UI persona 추가 시 1줄 매핑 변경으로 활성화

### 액션 변환 (`actionConverter.ts`)

sample된 spec action을 `applyAction()` 입력으로:

| Spec | engine 액션 | chips amount |
|---|---|---|
| fold | `fold` | 0 |
| check | `check` (canCheck 아니면 null) | 0 |
| call | `call` | `legal.callAmount` |
| limp | `call` (SB 0.5bb 완료, BB는 unreachable) | `legal.callAmount` |
| raise_N (2/3/5/7/7.5/8) | `raise` (또는 `bet`) | `Math.round(N × bigBlind)` (엔진이 min/max로 clamp) |
| all_in_25 | `raise` (또는 `bet`) | `legal.maxBetTotal` |

---

## 3. 페르소나 × 페르소나 매핑 (preflop 새 엔진)

UI는 기존 5개 페르소나(`STANDARD/NIT/LAG/CALLING/MANIAC`)를 그대로 노출하고, 새 엔진 진입점에서 사양의 6개 spec 페르소나로 resolve:

| UI 페르소나 | 25bb spec persona | preflop 25bb 행동 요약 |
|---|---|---|
| `STANDARD` | `balanced_pro` | 모든 globalModifier 1.0 — baseline 그대로 |
| `MANIAC` | `pressure_maniac` | fold ×0.75, check ×0.75, limp ×0.8, raise_* ×1.2~1.3, all_in_25 ×1.25 |
| `CALLING` | `sticky_caller` | fold ×0.75, call ×1.3, check ×1.05, limp ×1.15, raise_* ×0.8~0.9 |
| `NIT` | **`tight_survivor`** | fold ×1.3, call ×0.8, check ×1.1, limp ×1.0, raise_* ×0.75~0.85, all_in_25 ×0.8 — UI 라벨 "NIT" 의 tight-passive 정체성과 직관적 일치 |
| `LAG` | `emotional_swinger` | fold ×0.95, call ×1.05, raise_* ×1.05~1.15, all_in_25 ×1.15. stateModifiers(after_big_loss / after_big_win / after_repeated_folds)와 randomness는 후속 PR, 베타는 globalModifiers만 |

> **trap_master 는 예약 spec persona**. 현재 UI 페르소나에 매핑되지 않으며 JSON 데이터는 유지 — 향후 "Tricky Nit" / "Trap Nit" 등 별도 UI persona 추가 시 `personaResolver.ts` 의 매핑 한 줄로 활성화. trap_master 의 nodeSpecific modifier (SB_FIRST_IN limp ×1.25, SB_VS_BB_ISO_3 raise_7_5 ×1.25 + all_in ×1.15, SB_VS_BB_JAM_AFTER_LIMP call ×1.15) 는 그 시점부터 작동한다.

---

## 4. 페르소나 × Postflop 행동 (`persona-modifiers.ts`)

postflop과 25bb 가드 미충족 preflop은 모두 레거시 6단계 파이프라인을 거치며, 페르소나는 ActionScore에 가감으로 정체성을 부여한다. `MOD` 상수: `TINY=4`, `SMALL=8`, `MEDIUM=14`, `LARGE=20`, `HUGE=28`.

### checkContext 기반 분기 (신규)

`DecisionFeatures.checkContext` 가 5개 케이스 중 하나를 결정 (`features.ts:deriveCheckContext`). 페르소나는 `checkBiasForContext(ctx, intent)` 헬퍼로 의도별 가감을 적용:

| Context | 의미 |
|---|---|
| `oop_first_check` | OOP에서 이번 스트릿 첫 액션 (lead 옵션) |
| `oop_check_to_aggressor` | OOP에서 상대가 직전 어그레서 (c-bet 기다림) |
| `ip_check_back` | IP에서 OOP가 체크함 (free realize) |
| `bb_check_option_preflop` | preflop BB, SB 림프 후 free check option |
| `not_check_spot` | facing bet — 체크 불가 |

페르소나별 intent:
- **LAG / MANIAC** (intent `cbet_pressure`) — `oop_first_check` 자리에서 check 페널티 강하게(-MEDIUM), `ip_check_back` / `bb_check_option_preflop` 자리에서는 0 (자연 체크 허용)
- **NIT** (intent `trap`) — monster + OOP 시 `oop_first_check` / `oop_check_to_aggressor` 에서 check +SMALL (트랩), IP check-back 은 +TINY 만
- **CALLING** (intent `passive`) — 모든 체크 가능 자리에 +TINY~SMALL (free showdown 추구)
- STANDARD — 기본 0 (intent `neutral`)

→ 결과: LAG/MANIAC이 IP에서 OOP가 체크하면 무조건 c-bet 페널티를 받던 과거 동작이 사라지고, IP-check-back 같은 합리적 체크는 그대로 허용된다.

### STANDARD — 기준
| 조건 | 보정 |
|---|---|
| handBucket = monster/twoPairPlus | betMedium +SMALL, raise +TINY |
| postflop air + facing bet | fold +SMALL |
| facing overbet/allin | fold +SMALL |

→ 거의 baseline에 가까운 행동. 정체성 약하게 부여된 "표준 상대".

### NIT — 거의 안 들어오지만 들어오면 강함
| 조건 | 보정 |
|---|---|
| air/weakPair | **fold +HUGE**, call −MEDIUM, betLarge −LARGE, raise −LARGE |
| river + low showdown value | fold +LARGE, call −LARGE (블러프 캐치 안 함) |
| air + no draw | betSmall −MEDIUM, betMedium −LARGE, betLarge/raise/allIn −HUGE (블러프 X) |
| monster/twoPairPlus | betMedium +MEDIUM, betLarge +SMALL, raise +SMALL |
| **monster + OOP** | check +SMALL, call +SMALL (slow-play/trap) |
| preflop + 약한 핸드 | fold +MEDIUM, call/raise −SMALL |
| facing large/overbet/allin (강한 핸드 아닐 때) | fold +LARGE, call −MEDIUM |

→ "타이트-패시브-트랩"의 정석. 약하면 빠른 폴드, 강하면 정직한 베팅, 모인스터는 OOP에서 가끔 슬로우플레이.

### LAG — 압박하지만 자살은 안 함
| 조건 | 보정 |
|---|---|
| initiative + facing none | betSmall +LARGE, betMedium +MEDIUM, check −MEDIUM (c-bet) |
| IP | betSmall/betMedium +SMALL, raise +TINY |
| dry board + initiative + facing none | betSmall +LARGE, check −MEDIUM (드라이 보드 작은 c-bet) |
| comboDraw/flushDraw/oesd | betMedium +LARGE, raise +SMALL, call +SMALL, check −SMALL |
| gutshot + initiative | betSmall +SMALL |
| air + no draw | betLarge −SMALL, allIn −HUGE (자살 방지) |
| facing large/overbet (약한 핸드) | call −SMALL, fold +SMALL |
| preflop | fold −MEDIUM, raise/call +SMALL (광범위 참여) |
| monster/twoPairPlus | betMedium +MEDIUM, raise +SMALL, check −MEDIUM (slowplay 회피) |

→ "주도권 + 드라이 보드 + 드로우"가 핵심. 압박하지만 무리하지 않음.

### CALLING — 안 죽지만 무조건 콜은 아님
| 조건 | 보정 |
|---|---|
| 쇼다운 밸류 있음 | call +LARGE, fold −MEDIUM |
| 작은/중간 베팅 facing | call +LARGE, fold −MEDIUM |
| river + low showdown value | call +MEDIUM, fold −SMALL (호기심 콜) |
| 항상 | raise −MEDIUM, betLarge −SMALL, allIn −MEDIUM |
| monster/twoPairPlus | call +SMALL, raise −TINY (방어적) |
| facing overbet/allin (강한 핸드 아닐 때) | call −MEDIUM, fold +MEDIUM (인간적인 폴드) |
| preflop | call +MEDIUM, fold −SMALL, raise −MEDIUM |
| air + no draw | betSmall/betMedium −LARGE, betLarge −HUGE (블러프 X) |

→ "끈질긴 콜링 머신". 작은/중간 베팅 무조건 받아주지만 overbet에는 인간적인 폴드.

### MANIAC — 콜이 아니라 베팅·레이즈로 판 키움
| 조건 | 보정 |
|---|---|
| 항상 | betMedium +MEDIUM, betLarge +LARGE, raise +LARGE, check −MEDIUM, call −TINY |
| 드로우(backdoor 제외) | betLarge +MEDIUM, raise +MEDIUM, check −SMALL |
| air | betMedium/betLarge +SMALL, fold −SMALL. preflop·flop·turn에서 air no-draw allIn −MEDIUM (자살 방지) |
| monster/twoPairPlus | betLarge +LARGE, raise +MEDIUM, check −LARGE (빠른 밸류) |
| initiative + facing none | betLarge +MEDIUM, betMedium +SMALL (배럴) |
| preflop | fold −LARGE, raise +LARGE, call +SMALL |
| facing large/overbet (강한 핸드) | raise +MEDIUM (raise로 응수) |

→ "광폭 어그레션". 드로우/air도 공격 자원, 강한 핸드는 빠른 밸류, 큰 베팅엔 raise로 응수.

---

## 5. Difficulty (EASY / MEDIUM / HARD)

[difficulty-modifiers.ts](src/bot/difficulty-modifiers.ts) + [levels.ts](src/bot/levels.ts):

- `decisionNoise`: 점수에 랜덤 노이즈 (낮을수록 일관적)
- `sizingAccuracy`: 베팅 사이즈 정확도 (낮을수록 ±jitter)
- `adaptationStrength`: 페르소나 modifier 적용 강도(현재는 일관 1.0)
- `delayRangeMs`: 봇 응답 지연 [최소, 최대]
- `temperatureFor()`: softmax 온도 — 높을수록 더 무작위, 낮을수록 결정적

EASY: `[900, 2200]` 느리고 노이즈 큼  
MEDIUM: `[700, 1800]` 표준  
HARD: `[600, 1400]` 빠르고 일관

> **베타 정책**: 홈 페이지의 난이도 picker는 **MEDIUM(보통)만 활성**, EASY/HARD는 `disabled` + "• 곧" 안내. 향후 패치에서 노이즈 시스템 재튜닝 후 활성 예정. 25bb HU preflop 엔진은 현재 difficulty와 무관(베이스라인 그대로).

---

## 6. 응답 지연 (Thinking Time)

| 액션 | 적용 |
|---|---|
| 일반 (call/raise/bet/all_in) | `random(delayRange[0], delayRange[1])` |
| **빠른 결정 (fold/check)** | `max(250, raw × 0.45)` — 폴드/체크가 누적되어 stuck처럼 느껴지는 현상 회피 |

핸드 종료 후 PotAwardAnimation은 **1200ms** 표시 후 다음 핸드 자동 진행.

---

## 7. 데이터 흐름 — 25bb HU 한 핸드 예시

```
세팅: 25bb HU AI 매치. 페르소나 NIT, 난이도 MEDIUM(=Normal).
SB = 봇(NIT). BB = 사람.

1. 핸드 시작 → SB 봇이 액션 차례
2. bot.decide(state, botId)
   - rawThinkingMs ~ 1200ms
   - decide25bbPreflop:
     - preflop + ~25bb ✓
     - adaptHistory → tokens = []
     - nodeId = "SB_FIRST_IN_25BB"
     - baseline = { all_in_25:0, raise_2:42.1, limp:52.1, fold:5.7 }
     - resolveSpecPersona(NIT) = "trap_master"
     - persona global × node-specific:
         raise_2: 42.1 × 0.9 × 0.9 = 34.1
         limp:    52.1 × 1.2 × 1.25 = 78.2
         fold:    5.7  × 0.95 = 5.42
     - holeCards = K♥4♠ → classifyHand = "playable"
     - hand-class boost: limp×1.1, call×1.1, check×1.05
         limp: 78.2 × 1.1 = 86.0
     - normalize → fold 4.3%, raise_2 27.1%, limp 68.5%
     - sample(rng) = "limp"
     - convertSpecAction("limp", state, botId)
         legal.canCall=true, callAmount=10 (SB 10 → BB 20에 맞춰 +10)
         → { action: 'call', amount: 10 }
   - return: { action: 'call', amount: 10, thinkingTimeMs: 1200 }
3. setTimeout(1200ms) 후 applyAction(state, botId, 'call', 10) 실행
4. SB가 limp → BB(사람)이 액션 차례. 이 시점에서 적용된 토큰: ["SB_LIMP"]
```

---

## 8. 디버깅 / 튜닝 포인트

| 증상 | 조사 위치 |
|---|---|
| 봇이 멈춤 (다음 핸드 안 옴) | [game-store.ts `applyBotAction`](src/store/game-store.ts) `setTimeout` 콜백 + `finalizeHand` |
| 봇이 fold만 함 | persona-modifiers.ts NIT/CALLING의 fold +HUGE 조건 + 25bb baseline의 fold% 확인 |
| raise 사이즈 이상 | [actionConverter.ts](src/bot/preflop-25bb/actionConverter.ts) `RAISE_TO_BB`. 엔진이 min/max clamp 적용하므로 illegal 시 안전 |
| 25bb 매치인데 새 엔진 미동작 | adaptHistory의 effective stack 가드(22~30bb 범위). 핸드 진행으로 스택 깎이면 fallback 발동 가능 |
| 4bet 이후 정책 | 노드 미정의 → null → 레거시 파이프라인 fallback (회귀 X) |
| 페르소나가 너무 약함 | `preflopPersonaModifiers.json`의 globalModifiers 값 / `persona-modifiers.ts`의 MOD 상수 비율 |

새 페르소나 행동 튜닝의 우선순위:
1. `preflopPersonaModifiers.json` (preflop 25bb 진입 노드)
2. `handClassRules.ts` (premium/trash 강제)
3. `persona-modifiers.ts` (postflop + non-25bb preflop fallback)

---

## 9. 베타 한계 (반드시 명시)

이 엔진은 **exact GTO solver 가 아니다**. 다음 한계를 사용자/문서/리뷰 시 반드시 명시할 것:

- **Aggregate baseline 기반**: GTO Wizard 스크린샷에서 수동 추출한 노드별 frequency. 콤보 단위 GTO 정확도는 hand-class correction 만으로 제한적으로만 반영
- AKs 와 KQo 가 같은 노드에서 동일 baseline 을 공유. 차이는 4-tier hand-class 보정으로만 분기 (premium / strong / playable / trash)
- ICM / 레이크 / 멀티웨이 / 40bb·100bb 같은 다른 스택 깊이는 미지원 (25bb HU SnG 한정)
- 4bet 이후 / 비표준 raise 사이즈 등 12개 명명 노드 외 시퀀스는 레거시 `getBasePreflopScores` + `chooseAction` 파이프라인으로 fallback
- `emotional_swinger` 의 stateModifiers (after_big_loss / after_big_win / after_repeated_folds) 및 randomness 는 후속 PR
- `trap_master` spec persona 는 데이터만 존재 — UI persona 매핑이 추가될 때까지 활성화되지 않음

> **PR 설명 / 마케팅 / 문서** 어디서든 "exact GTO" 또는 "solver 동급" 표현을 사용하지 말 것. 정확한 표현: **"GTO-inspired aggregate baseline + persona modifier + hand-class correction 기반의 베타 AI"**.

---

## 부록 — 관련 파일 트리

```
apps/heads-up/src/bot/
├── heuristic-bot.ts            ← decide() 6단계 + 25bb 엔진 진입점
├── persona-modifiers.ts        ← 5 페르소나 × 상황별 ActionScore 보정 (postflop + fallback preflop)
├── difficulty-modifiers.ts     ← EASY/MEDIUM/HARD 노이즈
├── levels.ts                   ← AI_LEVELS delayRange / temperature
├── personas.ts                 ← AI_PERSONAS metadata + bias values
├── action-chooser.ts           ← softmax-weighted action selection
├── base-scores.ts              ← preflop hand-chart → 8-action score 변환
├── features.ts                 ← DecisionFeatures 추출
├── hand-chart.ts               ← HU_SB_OPEN_CHART / HU_BB_VS_OPEN_CHART (레거시 preflop)
└── preflop-25bb/               ← NEW 25bb HU preflop 엔진
    ├── data/
    │   ├── preflopBaseline25bbHU.json
    │   └── preflopPersonaModifiers.json
    ├── types.ts                ← SpecAction / NodeId / SpecPersonaKey / HandClass
    ├── historyAdapter.ts       ← GameState → AdaptedHistory(tokens)
    ├── nodeSelector.ts         ← 12 노드 매칭 (positionToAct + tokens)
    ├── handClassRules.ts       ← premium/strong/playable/trash 보정 규칙
    ├── handClassifier.ts       ← holeCards → HandClass
    ├── frequencyMath.ts        ← applyPersonaModifier / applyHandClassCorrection / normalize / sample
    ├── personaResolver.ts      ← AiPersonaId(5) ↔ SpecPersonaKey(6) 매핑
    ├── actionConverter.ts      ← SpecAction → { action, amount } (chips)
    ├── engine.ts               ← 위 모듈 조립: decide25bbPreflop()
    └── __tests__/              ← 37 unit tests (357 / 357 total)
```
