import type { CategorySlug } from "./categories";
import { positionQuestions, handRankingQuestions, showdownQuestions, minRaiseQuestions } from "./questions/basic";
import { potCalculationQuestions, outsQuestions, drawProbabilityQuestions } from "./questions/math";
import { actionSelectionQuestions, handSelectionQuestions, betSizingQuestions, bluffValueQuestions } from "./questions/practical";

export type Difficulty = "club" | "diamond" | "heart" | "spade";
export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type TablePosition = "UTG" | "UTG1" | "LJ" | "HJ" | "CO" | "BTN" | "SB" | "BB";

export interface TablePlayer {
  position: TablePosition;
  action?: "fold" | "call" | "raise" | "check" | "bet" | "allin";
  betAmount?: string;
  stackSize?: string;
  isActive?: boolean;
}

export interface TableInfo {
  players: TablePlayer[];
  heroPosition: TablePosition;
  dealerPosition?: TablePosition;
  potSize?: string;
  streetLabel?: string;
  sbAmount?: string;
  bbAmount?: string;
}

export interface PlayerHand {
  label: string;
  cards: Card[];
}

export interface QuizQuestion {
  id: string;
  difficulty: Difficulty;
  scenario: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
  holeCards?: Card[];
  boardCards?: Card[];
  playerHands?: PlayerHand[];
  potSize?: string;
  betSize?: string;
  tableInfo?: TableInfo;
  category?: CategorySlug;
}

export const potOddsQuestions: QuizQuestion[] = [
  {
    id: "po-1",
    difficulty: "club",
    scenario: "상대가 베팅했습니다. 콜할지 폴드할지 결정해야 합니다.",
    question: "'팟 오즈(Pot Odds)'란 무엇입니까?",
    options: ["내가 이길 확률", "콜 금액 대비 딸 수 있는 팟의 비율", "상대가 블러프할 확률", "베팅할 수 있는 최대 금액"],
    correctIndex: 1,
    explanation: "팟 오즈란 '내가 얼마를 투자해서 얼마를 딸 수 있는가'의 비율입니다. 예를 들어 팟에 $30이 있고 상대가 $10을 베팅하면, $10을 콜해서 $40(팟 $30 + 베팅 $10)을 딸 수 있으니 팟 오즈는 4:1입니다. 팟 오즈가 좋을수록(비율이 높을수록) 콜이 유리합니다.",
    hint: "팟 오즈 = '투자 대비 보상'의 비율",
  },
  {
    id: "po-2",
    difficulty: "club",
    scenario: "포커에서 콜할지 폴드할지 고민될 때, 많은 초보자는 '감'으로 결정합니다.",
    question: "팟 오즈를 계산하는 이유는?",
    options: ["상대방의 카드를 추측하기 위해", "콜이 장기적으로 이익인지 수학적으로 판단하기 위해", "딜러에게 좋은 카드를 요청하기 위해", "올인할 타이밍을 정하기 위해"],
    correctIndex: 1,
    explanation: "팟 오즈를 계산하면 콜이 장기적으로 이익인지 손해인지 수학적으로 판단할 수 있습니다. 같은 상황이 100번 반복된다고 상상했을 때, 콜이 이익이면 콜하고, 손해이면 폴드합니다. 감이 아닌 수학으로 결정하는 것이 핵심입니다.",
    hint: "포커는 한 판이 아니라 수천 판의 게임입니다. 수학적으로 유리한 선택을 반복하면 장기적으로 이깁니다.",
  },
  {
    id: "po-3",
    difficulty: "club",
    scenario: "팟에 $30이 쌓여있고, 상대방이 $10을 베팅했습니다. 콜하려면 $10이 필요합니다.",
    question: "이 상황의 팟 오즈는?",
    options: ["2:1", "3:1", "4:1", "1:1"],
    correctIndex: 2,
    explanation: "콜하면 총 팟은 $30(기존) + $10(상대 베팅) + $10(내 콜) = $50이 됩니다. 내 투자 $10으로 $40(팟+상대베팅)을 딸 수 있으니 팟 오즈는 4:1입니다. 즉, 5번 중 1번만 이겨도 손익분기입니다.",
    hint: "팟 오즈 = (팟 + 상대 베팅) : 내 콜 금액",
  },
  {
    id: "po-8",
    difficulty: "club",
    scenario: "상대가 큰 금액을 베팅했습니다. 콜하기 부담스럽습니다.",
    question: "상대의 베팅이 클수록 팟 오즈는 어떻게 변합니까?",
    options: ["팟 오즈가 나빠진다 (콜하기 불리해진다)", "팟 오즈는 베팅 크기와 무관하다", "팟 오즈가 좋아진다 (콜하기 유리해진다)", "팟 오즈는 항상 동일하다"],
    correctIndex: 0,
    explanation: "상대의 베팅이 클수록 콜 비용이 높아지므로 팟 오즈가 나빠집니다. 예: 팟 $100에 $25 베팅이면 5:1(좋은 오즈), $100 베팅이면 2:1(나쁜 오즈). 큰 베팅은 상대가 '콜하지 마라'는 메시지를 보내는 것이기도 합니다.",
    hint: "베팅이 클수록 콜 비용 ↑ → 팟 오즈 ↓",
  },
  {
    id: "po-13",
    difficulty: "club",
    scenario: "리버(마지막 카드)까지 왔습니다. 보드에 5장이 모두 깔렸습니다.",
    question: "리버에서 팟 오즈가 중요한 이유는?",
    options: ["드로우를 완성할 수 있어서", "현재 패로 이기는지만 판단하면 되므로 단순해서", "리버에서는 팟 오즈가 의미 없다", "리버에서는 항상 콜해야 해서"],
    correctIndex: 1,
    explanation: "리버에서는 더 이상 카드가 나오지 않으므로 드로우나 아웃의 개념이 없습니다. 단순히 '지금 내 패가 이기는가?'만 판단하면 됩니다. 팟 오즈가 좋고 이길 확률이 조금이라도 있다면 콜이 유리할 수 있습니다.",
    hint: "리버 = 카드가 더 없음. 현재 패로 이기는지만 생각하세요.",
  },
  {
    id: "po-4",
    difficulty: "diamond",
    scenario: "2/5 노리밋. 턴에서 플러시 드로우(9 아웃)를 갖고 있습니다. 팟 $80, 상대 베팅 $40.",
    question: "팟 오즈상 플러시 드로우 콜이 정당합니까?",
    options: ["예 — 9아웃은 ~36%, 필요 에퀴티 25%보다 높음", "아니오 — 턴 9아웃 ~18%, 필요 에퀴티 25%에 부족", "예 — 플러시 드로우는 항상 콜해야 한다", "아니오 — 레이즈해야 한다"],
    correctIndex: 1,
    explanation: "정답: 아니오(직접 팟오즈 부족). 턴에서는 카드 1장만 남으므로 2배 룰 적용: 9×2 = ~18%. 콜 후 총팟 = $80 + $40 + $40 = $160. 필요 에퀴티 = $40/$160 = 25%. 18% < 25%이므로 직접 팟오즈로는 콜이 부족합니다. 임플라이드 오즈(히트 시 추가 수익)가 충분하다면 콜을 고려할 수 있습니다.",
    hint: "턴에서는 2배 룰: 아웃 × 2 ≈ 에퀴티 %. 4배 룰은 플롭(카드 2장 남음)에서 사용합니다.",
    potSize: "$80",
    betSize: "$40",
    holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
    boardCards: [{ rank: "Q", suit: "spades" }, { rank: "8", suit: "spades" }, { rank: "3", suit: "diamonds" }, { rank: "2", suit: "hearts" }],
  },
  {
    id: "po-5",
    difficulty: "diamond",
    scenario: "플롭에서 오픈엔드 스트레이트 드로우(8아웃). 팟 $30, 상대 베팅 $15.",
    question: "팟 오즈상 콜 또는 폴드?",
    options: ["콜 — 32% vs 33% (아슬아슬, 폴드)", "콜 — 32% vs 25% (수익)", "폴드 — 8아웃은 부족", "레이즈 — 즉시 팟 획득"],
    correctIndex: 1,
    explanation: "정답: 콜(수익적). 플롭에서 8아웃, 카드 두 장 남음(턴+리버를 모두 볼 수 있는 상황 가정): 4배 룰로 8×4 = ~32% 에퀴티. 콜 후 총팟 = $30 + $15 + $15 = $60. 필요 에퀴티 = $15/$60 = 25%. 32% > 25%이므로 수익적인 콜입니다. 단, 4배 룰은 플롭 올인 등 턴+리버를 모두 볼 수 있는 경우에 적용합니다. 턴에서 추가 베팅이 예상되면 2배 룰(16%)로 한 스트리트씩 판단하는 것이 더 정확합니다.",
    hint: "4배 룰은 턴+리버 두 장을 모두 볼 때(예: 플롭 올인) 사용합니다. 추가 베팅이 예상되면 2배 룰로 한 스트리트씩 판단하세요.",
    potSize: "$30",
    betSize: "$15",
    holeCards: [{ rank: "7", suit: "hearts" }, { rank: "8", suit: "diamonds" }],
    boardCards: [{ rank: "5", suit: "clubs" }, { rank: "6", suit: "spades" }, { rank: "K", suit: "hearts" }],
  },
  {
    id: "po-9",
    difficulty: "diamond",
    scenario: "팟 $100에 $25 리버 베팅을 받았습니다.",
    question: "팟 오즈를 X:1 비율로 표현하면?",
    options: ["4:1", "5:1", "6:1", "3:1"],
    correctIndex: 1,
    explanation: "정답: 5:1. 총팟 = $100 + $25 = $125. 콜 = $25. 비율 = $125:$25 = 5:1. 즉 6번 중 1번만 이겨도 손익분기(약 16.7% 필요 에퀴티)이므로, 리버에서 이길 가능성이 조금이라도 있다면 콜이 유리한 가격입니다.",
    hint: "팟오즈 비율 = 총팟 : 콜 금액",
    potSize: "$100",
    betSize: "$25",
  },
  {
    id: "po-15",
    difficulty: "diamond",
    scenario: "상대방이 포켓 에이스를 갖고 있다고 강하게 믿습니다. 하지만 팟오즈가 매우 유리합니다.",
    question: "팟오즈가 아무리 좋아도 폴드해야 하는 경우는?",
    options: ["에퀴티가 필요 에퀴티보다 낮을 때", "상대가 에이스를 가졌을 때 항상", "팟이 $100 이상일 때", "리버에서는 항상 폴드"],
    correctIndex: 0,
    explanation: "정답: 에퀴티가 필요 에퀴티보다 낮을 때. 팟오즈가 아무리 좋아도, 보유 에퀴티가 필요 에퀴티보다 낮으면 폴드가 맞습니다. 팟오즈는 베팅의 '가격'을 보여주고, 에퀴티는 그 가격을 지불할 '가치'가 있는지를 결정합니다. 가치 > 가격일 때만 콜하는 것이 포커 수학의 핵심 원칙입니다.",
    hint: "팟오즈 = 가격. 에퀴티 = 가치. 가치 > 가격일 때만 콜합니다.",
  },
  {
    id: "po-10",
    difficulty: "heart",
    scenario: "팟 $80. 상대방이 $20 리버 베팅. 당신은 10% 에퀴티로 거의 지고 있다고 봅니다.",
    question: "작은 베팅에도 10%면 콜해야 합니까?",
    options: ["아니오 — 10% vs 16.7% 필요, 폴드", "예 — 어떤 에퀴티든 작은 베팅엔 콜", "아니오 — 리버에선 절대 콜 불가", "예 — 팟오즈 5:1이면 10%로 충분"],
    correctIndex: 0,
    explanation: "콜 후 총팟 = $80 + $20 + $20 = $120. 필요 에퀴티 = $20/$120 = 16.7%. 팟 오즈 비율: ($80+$20):$20 = 5:1. 10% < 16.7%이므로 폴드가 맞습니다. '작은 베팅'이어도 정확한 계산이 필요합니다.",
    hint: "5:1 비율 = 6번 중 1번 이기면 됨 = 16.7% 에퀴티 필요",
    potSize: "$80",
    betSize: "$20",
  },
  {
    id: "po-11",
    difficulty: "heart",
    scenario: "팟 $80. 상대방이 $40 베팅(하프팟). 오픈엔드 스트레이트 드로우, 턴 상황.",
    question: "하프팟 베팅에 필요한 에퀴티는?",
    options: ["20%", "25%", "33%", "40%"],
    correctIndex: 1,
    explanation: "콜 후 총팟 = $80 + $40 + $40 = $160. 필요 에퀴티 = $40/$160 = 25%. 하프팟 베팅의 필요 에퀴티는 25%입니다. 턴에서 오픈엔드 드로우(8아웃)의 에퀴티는 8×2 = ~16%이므로 직접 팟오즈로는 부족합니다. 임플라이드 오즈가 좋은 경우에만 콜을 고려합니다.",
    hint: "하프팟 베팅: 콜/(팟+베팅+콜) = 40/160 = 25%",
    potSize: "$80",
    betSize: "$40",
    holeCards: [{ rank: "7", suit: "clubs" }, { rank: "8", suit: "hearts" }],
    boardCards: [{ rank: "5", suit: "spades" }, { rank: "6", suit: "diamonds" }, { rank: "A", suit: "hearts" }, { rank: "K", suit: "clubs" }],
  },
  {
    id: "po-14",
    difficulty: "heart",
    scenario: "세미블러프 레이즈 상황. 팟 $300, 상대 베팅 $150. 드로우를 갖고 있습니다.",
    question: "콜보다 레이즈가 더 수익적일 수 있는 이유는?",
    options: ["세미블러프는 폴드 에퀴티 + 드로우 에퀴티 결합", "레이즈는 항상 콜보다 낫다", "메이드핸드로만 레이즈해야 함", "폴드 에퀴티는 리버에서만 적용"],
    correctIndex: 0,
    explanation: "세미블러프 레이즈는 두 가지 수익원을 결합합니다: (1) 폴드 에퀴티 — 상대가 폴드하면 즉시 팟 획득, (2) 드로우 에퀴티 — 콜당해도 히트 시 승리. 이 조합이 단순 콜보다 훨씬 수익적일 수 있습니다.",
    hint: "세미블러프 = 드로우 에퀴티 + 폴드 압력에서 오는 에퀴티",
    potSize: "$300",
    betSize: "$150",
  },
  {
    id: "po-16",
    difficulty: "heart",
    scenario: "플롭에서 인사이드 스트레이트 드로우(4아웃). 팟 $50, 베팅 $25.",
    question: "4배 룰로 카드 두 장 남았을 때 에퀴티는?",
    options: ["8%", "16%", "32%", "4%"],
    correctIndex: 1,
    explanation: "4배 룰: 4아웃 × 4 = 16%. 두 장 남았을 때 근사 에퀴티입니다. 콜 후 총팟 = $50 + $25 + $25 = $100. 필요 에퀴티 = $25/$100 = 25%. 16% < 25%이므로 팟오즈상 폴드입니다.",
    hint: "4배 룰: 아웃 × 4 (두 장 남음) / 아웃 × 2 (한 장 남음)",
    potSize: "$50",
    betSize: "$25",
    holeCards: [{ rank: "J", suit: "hearts" }, { rank: "7", suit: "clubs" }],
    boardCards: [{ rank: "8", suit: "spades" }, { rank: "9", suit: "diamonds" }, { rank: "A", suit: "clubs" }],
  },
  {
    id: "po-6",
    difficulty: "spade",
    scenario: "리버. 당신은 8 페어(미들 페어)를 갖고 있습니다. 상대가 매우 강해 보이며, 이길 확률을 약 10%로 판단합니다. 팟 $200, 상대 베팅 $100.",
    question: "팟 오즈상 콜이 맞습니까?",
    options: ["예 — 10%면 리버에서는 충분하다", "아니오 — 필요 에퀴티 25%, 10%로는 크게 부족", "예 — 페어가 있으면 항상 콜", "아니오 — 리버에서는 무조건 폴드"],
    correctIndex: 1,
    explanation: "리버에서는 더 이상 카드가 없으므로 순수하게 '이기고 있는가?'만 판단합니다. 콜 후 총팟 = $200 + $100 + $100 = $400. 필요 에퀴티 = $100/$400 = 25%. 이길 확률 10% < 25%이므로 폴드가 맞습니다. 리버에서는 드로우도 임플라이드 오즈도 없으므로, 팟 오즈 vs 이길 확률만 비교하면 됩니다.",
    hint: "리버 = 마지막 카드. 임플라이드 오즈 없음. 이길 확률 vs 필요 에퀴티만 비교하세요.",
    potSize: "$200",
    betSize: "$100",
    holeCards: [{ rank: "8", suit: "hearts" }, { rank: "8", suit: "clubs" }],
    boardCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "diamonds" }, { rank: "9", suit: "clubs" }, { rank: "4", suit: "hearts" }, { rank: "2", suit: "spades" }],
  },
  {
    id: "po-7",
    difficulty: "spade",
    scenario: "콤보 드로우: 플러시 드로우 + 거트샷(12아웃). 턴. 팟 $500, 상대 베팅 $300.",
    question: "필요 최소 에퀴티와 보유 에퀴티는?",
    options: ["27% 필요, ~48% 보유 — 4배 룰 쉬운 콜", "27% 필요, ~24% 보유 — 직접 팟오즈 약간 부족, 세미블러프 레이즈 고려", "50% 필요, ~24% 보유 — 크게 부족", "37.5% 필요, ~24% 보유 — 폴드"],
    correctIndex: 1,
    explanation: "턴에서는 2배 룰: 12아웃 × 2 = ~24%. 콜 후 총팟 = $500 + $300 + $300 = $1,100. 필요 에퀴티 = $300/$1,100 = ~27%. 24% < 27%로 직접 팟오즈는 근소하게 부족하지만, 콤보 드로우는 세미블러프 레이즈의 이상적인 핸드입니다. 폴드 에퀴티(상대 폴드) + 드로우 에퀴티(히트 시 승리) 조합으로 수익적인 플레이가 가능합니다.",
    hint: "턴에서는 2배 룰: 아웃 × 2. 콤보 드로우는 세미블러프 레이즈의 대표적 핸드입니다.",
    potSize: "$500",
    betSize: "$300",
    holeCards: [{ rank: "J", suit: "spades" }, { rank: "T", suit: "spades" }],
    boardCards: [{ rank: "8", suit: "spades" }, { rank: "Q", suit: "hearts" }, { rank: "3", suit: "spades" }, { rank: "5", suit: "diamonds" }],
  },
  {
    id: "po-12",
    difficulty: "spade",
    scenario: "멀티웨이: 3명 플레이어. 두 명이 각각 $30씩 베팅해 팟 $90. 콜 $30.",
    question: "필요 에퀴티는? 멀티웨이는 계산에 어떤 영향?",
    options: ["25% — 멀티웨이는 더 좋은 팟오즈", "20% — 팟이 더 크다", "33% — 상관없이 동일", "40% — 두 상대 모두 이겨야 함"],
    correctIndex: 0,
    explanation: "콜 후 총팟 = $90 + $30 = $120. 필요 에퀴티 = $30/$120 = 25%. 멀티웨이는 팟이 커져 더 좋은 팟오즈를 제공하지만, 상대가 여러 명이므로 실제 이길 확률(에퀴티)은 낮아집니다. 팟오즈 계산법 자체는 동일합니다.",
    hint: "팟오즈 계산은 같지만, 멀티웨이에서 실제 승률은 낮아집니다.",
    potSize: "$90",
    betSize: "$30",
  },
  {
    id: "po-17",
    difficulty: "spade",
    scenario: "턴에서 7아웃 드로우. 팟 $400, 베팅 $200.",
    question: "직접 팟오즈가 부족할 때 임플라이드 오즈는 어떤 역할?",
    options: ["히트 시 추가 수익으로 부족한 팟오즈 보완 가능", "임플라이드 오즈는 리버에서만 적용", "7아웃은 항상 충분", "임플라이드 오즈는 무시해야 함"],
    correctIndex: 0,
    explanation: "턴에서 2배 룰: 7아웃 × 2 = ~14% 에퀴티. 콜 후 총팟 = $400 + $200 + $200 = $800. 필요 에퀴티 = $200/$800 = 25%. 직접 팟오즈가 크게 부족(14% < 25%). 하지만 히트 시 추가 베팅을 받을 수 있다면(임플라이드 오즈) 콜이 수익적이 됩니다. 스택이 깊을수록 임플라이드 오즈가 큽니다.",
    hint: "직접 팟오즈가 아슬아슬하게 부족하면 임플라이드 오즈를 고려하세요.",
    potSize: "$400",
    betSize: "$200",
  },
  {
    id: "po-18",
    difficulty: "spade",
    scenario: "턴. 팟 $200. 상대 $100 베팅. 당신은 넛 플러시 드로우(9아웃)이지만, 보드에 페어(7♣7♦)가 있어 히트해도 상대가 풀하우스를 가질 수 있습니다. 유효 아웃을 7개로 추정합니다.",
    question: "리버스 임플라이드 오즈를 고려한 올바른 판단은?",
    options: [
      "콜 — 9아웃 플러시 드로우는 항상 콜",
      "직접 팟오즈(25% 필요)에 14% 에퀴티로 부족하고, 히트해도 역전당할 위험이 있어 폴드가 적절",
      "레이즈 — 드로우가 강하므로",
      "콜 — 임플라이드 오즈가 보상해준다"
    ],
    correctIndex: 1,
    explanation: "유효 7아웃, 정확한 에퀴티 = 7/46 ≈ 15.2%(2배 룰로 ~14%). 콜 후 총팟 = $200+$100+$100 = $400. 필요 에퀴티 = $100/$400 = 25%. 15.2% < 25%로 직접 팟오즈가 부족합니다. 더 큰 문제는 리버스 임플라이드 오즈입니다: 보드 페어 상황에서 플러시를 완성해도 상대가 풀하우스를 가지면 추가로 큰 금액을 잃을 수 있습니다. 임플라이드 오즈(히트 시 추가 수익)보다 리버스 임플라이드 오즈(히트해도 역으로 잃는 손실)가 클 수 있어, 아웃의 질이 떨어집니다. GTO 관점에서도 유효 에퀴티가 필요 에퀴티에 크게 미달하면 폴드가 균형 전략에 해당합니다.",
    hint: "드로우를 완성해도 더 강한 핸드에 질 수 있으면 '리버스 임플라이드 오즈'가 나쁩니다.",
    potSize: "$200",
    betSize: "$100",
    holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
    boardCards: [{ rank: "Q", suit: "spades" }, { rank: "7", suit: "clubs" }, { rank: "7", suit: "diamonds" }, { rank: "3", suit: "spades" }],
  },
];

export const equityQuestions: QuizQuestion[] = [
  {
    id: "eq-1",
    difficulty: "club",
    scenario: "두 플레이어가 올인했습니다. 카드가 아직 다 깔리지 않았습니다.",
    question: "'에퀴티(Equity)'란 무엇입니까?",
    options: ["베팅에 사용할 수 있는 칩의 양", "현재 상황에서 팟을 차지할 확률(지분)", "테이블에 앉을 수 있는 최소 금액", "상대방의 핸드 강도"],
    correctIndex: 1,
    explanation: "에퀴티(Equity)란 현재 상황에서 내가 팟을 차지할 확률, 즉 '지분'입니다. 에퀴티 60%라면 그 팟의 60%가 장기적으로 내 몫이라는 뜻입니다. 에퀴티를 정확히 파악하면 콜, 레이즈, 폴드 중 수학적으로 최적인 선택을 내릴 수 있습니다.",
    hint: "에퀴티 = 내가 팟을 가져갈 확률(%). 높을수록 좋습니다.",
  },
  {
    id: "eq-2",
    difficulty: "club",
    scenario: "포켓 에이스(AA)는 프리플롭에서 가장 강한 핸드입니다.",
    question: "AA가 강한 이유는?",
    options: ["에이스가 예쁜 카드라서", "어떤 상대 핸드를 만나도 프리플롭 에퀴티가 가장 높아서", "에이스가 있으면 무조건 이기니까", "에이스 페어는 절대 질 수 없어서"],
    correctIndex: 1,
    explanation: "AA는 어떤 상대 핸드를 만나도 프리플롭에서 가장 높은 에퀴티를 가집니다. 랜덤 핸드 상대로 약 85%, 특정 핸드 상대로도 보통 75~85% 수준입니다. 하지만 '무조건' 이기는 것은 아닙니다! 상대가 더 강한 핸드(스트레이트, 플러시 등)를 만들 수 있기 때문에 질 수 있습니다.",
    hint: "AA는 가장 강하지만 무적은 아닙니다. 약 80% 승률입니다.",
    holeCards: [{ rank: "A", suit: "spades" }, { rank: "A", suit: "hearts" }],
  },
  {
    id: "eq-3",
    difficulty: "club",
    scenario: "AK vs 22(포켓 투), 프리플롭 올인 상황입니다.",
    question: "이 대결에서 누가 유리합니까?",
    options: ["AK가 크게 유리 (약 70%)", "AK가 약간 유리 (약 55%)", "거의 동등 — 22가 약간 유리 (약 52%)", "22가 크게 유리 (약 70%)"],
    correctIndex: 2,
    explanation: "놀랍게도 작은 포켓 페어(22)가 AK보다 약간 유리합니다! 22는 이미 '페어'라는 완성된 핸드이고, AK는 보드에서 페어를 맞춰야 합니다. 이런 대결을 '코인플립(Coinflip)' 또는 줄여서 '플립'이라고 부르며 에퀴티가 약 52:48입니다. 토너먼트에서 올인 결정 시 이 구도를 이해하면 기대값을 정확히 판단할 수 있습니다.",
    hint: "이미 만들어진 핸드(페어) vs 아직 만들 핸드(AK) — 페어가 약간 유리!",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "A", suit: "hearts" }, { rank: "K", suit: "spades" }] },
      { label: "상대 핸드", cards: [{ rank: "2", suit: "clubs" }, { rank: "2", suit: "diamonds" }] },
    ],
  },
  {
    id: "eq-10",
    difficulty: "club",
    scenario: "포커에서는 특정 대결 구도에 이름이 붙어있습니다. '페어 vs 높은 카드 2장'의 대결을 생각해봅시다.",
    question: "'코인플립(Coinflip)'이란 무엇입니까?",
    options: ["빨리 베팅하는 것", "포켓 페어 vs 오버카드 두 장의 약 50:50 대결", "가장 먼저 올인하는 플레이어", "카드를 빨리 보는 규칙"],
    correctIndex: 1,
    explanation: "'코인플립(플립)'은 포켓 페어(예: 77) vs 오버카드 두 장(예: AK)의 대결을 말합니다. 에퀴티가 약 52:48로 거의 동전 던지기에 가깝습니다. 영어로 coin flip(동전 던지기)에서 유래한 용어로, 승률이 거의 50:50이라 동전을 던지는 것과 비슷하다는 뜻입니다. 영어권에서는 'race(레이스)'라고도 부르지만, 한국에서는 '플립' 또는 '코인플립'이라고 합니다. 토너먼트에서 자주 발생하며, 칩 리더가 아닌 이상 플립 상황에서의 올인 판단이 생존에 직결됩니다.",
    hint: "코인플립 = 거의 50:50인 대결. 동전 던지기 같은 상황!",
  },
  {
    id: "eq-12",
    difficulty: "club",
    scenario: "에퀴티가 높으면 좋다는 것은 알겠는데, 에퀴티를 어떻게 활용해야 할까요?",
    question: "에퀴티를 아는 것이 중요한 이유는?",
    options: ["상대에게 보여주면 상대가 폴드하니까", "콜, 레이즈, 폴드 중 최적의 결정을 내리기 위해", "에퀴티가 높으면 무조건 올인해야 하니까", "에퀴티는 실전에서는 의미가 없다"],
    correctIndex: 1,
    explanation: "에퀴티를 알면 현재 상황에서 콜이 이익인지, 폴드가 나은지, 레이즈로 압박할지 수학적으로 판단할 수 있습니다. 예를 들어 에퀴티가 40%인데 팟 오즈가 25%만 요구한다면 콜이 유리합니다. 에퀴티와 팟 오즈를 비교하는 것이 포커 수학의 핵심입니다.",
    hint: "에퀴티 > 필요 에퀴티(팟 오즈) → 콜 유리!",
  },
  {
    id: "eq-17",
    difficulty: "club",
    scenario: "포커에서 '에퀴티'와 '기대값(EV)'은 비슷해 보이지만 다른 개념입니다.",
    question: "'에퀴티'와 '기대값(EV)'의 차이는?",
    options: ["같은 의미이다", "에퀴티는 이길 확률(%), EV는 특정 액션의 장기적 평균 수익($)", "에퀴티는 팟 크기, EV는 스택 크기이다", "에퀴티는 프리플롭에서만, EV는 포스트플롭에서만 사용한다"],
    correctIndex: 1,
    explanation: "에퀴티(Equity)는 현재 상황에서 팟을 차지할 확률(%)입니다. 예: 에퀴티 60%면 팟의 60%가 내 지분. 기대값(EV, Expected Value)은 특정 액션(콜, 레이즈, 폴드)을 했을 때 장기적으로 얻는 평균 수익($)입니다. 예: 콜의 EV가 +$15이면 같은 상황에서 콜을 반복하면 평균 $15를 벌게 됩니다. 에퀴티가 높아도 베팅 구조에 따라 EV가 마이너스일 수 있으므로, 두 개념을 구분하는 것이 중요합니다.",
    hint: "에퀴티 = 승률(%), EV = 액션의 평균 수익($)",
  },
  {
    id: "eq-4",
    difficulty: "diamond",
    scenario: "플롭: A♠K♦9♠. 당신은 J♠T♠(넛 플러시 드로우 + 거트샷 스트레이트 드로우). 상대: A♥A♦(탑 셋).",
    question: "콤보 드로우의 대략적 에퀴티는?",
    options: ["약 20%", "약 38%", "약 48%", "약 60%"],
    correctIndex: 1,
    explanation: "정답: 약 38%. 넛 플러시 드로우 9아웃 + 거트샷(Q로 AKQJT 스트레이트) 4아웃 − Q♠ 겹침 1장 = 12아웃(명목상). 단순 4배 룰로는 48%이지만, (1) K♠는 보드를 페어시켜 상대 셋이 풀하우스(AAA+KK)가 되는 더티 아웃이고, (2) 플러시를 맞춰도 상대 셋이 리버에서 보드 페어링으로 역전할 수 있습니다. 이를 반영하면 실제 에퀴티는 약 38% 전후입니다. 그럼에도 셋 상대로 약 38%나 되는 강력한 콤보 드로우이므로, 세미블러프 레이즈를 적극 고려할 수 있습니다.",
    hint: "플러시(9) + 거트샷 Q(4) − Q♠ 겹침(1) = 12아웃. 상대 셋의 풀하우스 개선을 고려하면 4배 룰(48%)보다 실제 에퀴티가 낮습니다.",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "J", suit: "spades" }, { rank: "T", suit: "spades" }] },
      { label: "상대 핸드", cards: [{ rank: "A", suit: "hearts" }, { rank: "A", suit: "diamonds" }] },
    ],
    boardCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "diamonds" }, { rank: "9", suit: "spades" }],
  },
  {
    id: "eq-5",
    difficulty: "diamond",
    scenario: "당신: K♠Q♠, 보드: A♠J♠5♥. 상대: A♥A♦(에이스 셋). 플롭에서 큰 베팅을 받았습니다.",
    question: "상대 셋의 풀하우스 개선을 고려한 실제 에퀴티는 대략?",
    options: ["약 48% — 12아웃 × 4배 룰 그대로", "약 36% — 플러시 9아웃 × 4배 룰", "약 34% — 클린 아웃과 상대 셋 개선을 반영한 실제 에퀴티", "약 24%"],
    correctIndex: 2,
    explanation: "정답: 약 34%. 명목상 아웃은 넛 플러시 드로우 9개 + 비스페이드 T(브로드웨이 스트레이트 AKQJT) 3개 = 12아웃입니다. 하지만 (1) 5♠는 보드의 5를 페어시켜 상대에게 풀하우스(AAA+55)를 주는 더티 아웃이고, (2) 플러시를 맞춰도 남은 카드에서 보드가 페어링되면 상대 셋이 풀하우스로 역전할 수 있습니다. 이러한 더티 아웃과 상대 셋의 개선 가능성을 반영하면 실제 에퀴티는 약 34%입니다. 4배 룰(48%)이나 플러시만 기준(36%)과 차이가 나는 이유를 이해하는 것이 셋 상대 드로우 판단의 핵심입니다.",
    hint: "명목상 12아웃이지만, 5♠는 더티 아웃(상대 풀하우스)이고 상대 셋의 보드 페어링 역전 가능성까지 고려해야 합니다.",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "K", suit: "spades" }, { rank: "Q", suit: "spades" }] },
      { label: "상대 핸드", cards: [{ rank: "A", suit: "hearts" }, { rank: "A", suit: "diamonds" }] },
    ],
    boardCards: [{ rank: "A", suit: "spades" }, { rank: "J", suit: "spades" }, { rank: "5", suit: "hearts" }],
  },
  {
    id: "eq-9",
    difficulty: "diamond",
    scenario: "포켓 파이브(5♠5♦) vs AK수티드(A♠K♠), 프리플롭.",
    question: "55 vs AKs가 55 vs AKo와 에퀴티가 다른 이유는?",
    options: ["수티드는 에퀴티에 영향 없음", "AKs는 플러시 가능성으로 ~3% 추가 에퀴티", "AKo가 수티드 블락으로 더 강함", "55는 수티드 상대에 항상 더 큰 우위"],
    correctIndex: 1,
    explanation: "정답: 플러시 가능성으로 ~3% 추가 에퀴티. AKs vs 55: 약 46:54. AKo vs 55: 약 43:57. 수티드는 플러시 가능성이 추가되어 약 3%p 에퀴티가 더 높습니다. 이 차이는 핸드 셀렉션에서 수티드 핸드를 오프수트보다 넓게 오픈하는 근거가 되며, 장기적으로 수익에 상당한 영향을 미칩니다.",
    hint: "수티드는 플러시 가능성으로 어떤 핸드에도 약 2-4% 에퀴티를 추가합니다.",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "5", suit: "spades" }, { rank: "5", suit: "diamonds" }] },
      { label: "상대 핸드", cards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }] },
    ],
  },
  {
    id: "eq-11",
    difficulty: "diamond",
    scenario: "A♠J♦ vs A♥K♣, 프리플롭.",
    question: "이 매치업의 용어와 대략적 에퀴티는?",
    options: ["코인플립 — 약 48%", "도미네이션 — 약 26%", "동전 던지기 — 약 50%", "쿨러 — 약 15%"],
    correctIndex: 1,
    explanation: "정답: 도미네이션 — 약 26%. AJ vs AK는 에이스를 공유하지만 킥커(J)가 상대 킥커(K)에 열세인 '도미네이션' 구도입니다. A를 맞추면 상대도 에이스 페어가 되어 킥커 싸움에서 지고, J를 맞춰야 역전됩니다. 도미네이션 상황의 열세 핸드는 약 25-30% 에퀴티뿐이므로, 도미네이션을 피하는 것이 핸드 셀렉션의 핵심 원칙 중 하나입니다.",
    hint: "한 장을 공유하고 두 번째 카드가 낮으면 '도미네이션' ≈ 25-30% 에퀴티",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "A", suit: "spades" }, { rank: "J", suit: "diamonds" }] },
      { label: "상대 핸드", cards: [{ rank: "A", suit: "hearts" }, { rank: "K", suit: "clubs" }] },
    ],
  },
  {
    id: "eq-6",
    difficulty: "heart",
    scenario: "플롭 올인: A♠K♥ vs Q♦8♣3♥ 보드에서 Q♥Q♠(탑 셋).",
    question: "오버카드 두 장만 가졌을 때의 대략적 에퀴티는?",
    options: ["약 2% (러너러너만 가능)", "약 15%", "약 28%", "약 45%"],
    correctIndex: 0,
    explanation: "AK vs QQ 셋(Q83 보드): 직접 드로우가 전혀 없으므로 러너러너에만 의존합니다. 유일한 실질적 역전 경로는 J+T 러너로 브로드웨이 스트레이트(AKQJT)를 만드는 것으로, 확률은 약 1.6%입니다. AA나 KK 러너는 상대가 풀하우스(QQQ+AA 또는 QQQ+KK)를 만들어 여전히 지므로 유효하지 않습니다. 셋 상대로 드로우 없는 오버카드만 가지고 있으면 즉시 폴드가 올바른 판단입니다.",
    hint: "드로우 없는 오버카드 두 장 vs 셋 = 러너러너에만 의존하는 극히 낮은 에퀴티",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "hearts" }] },
      { label: "상대 핸드", cards: [{ rank: "Q", suit: "hearts" }, { rank: "Q", suit: "spades" }] },
    ],
    boardCards: [{ rank: "Q", suit: "diamonds" }, { rank: "8", suit: "clubs" }, { rank: "3", suit: "hearts" }],
  },
  {
    id: "eq-13",
    difficulty: "heart",
    scenario: "T♣J♣ 보유, 보드 8♠9♦K♣. 오픈엔드 스트레이트 드로우 + 백도어 플러시 드로우.",
    question: "직접 아웃(백도어 제외)은 몇 개입니까?",
    options: ["6아웃", "8아웃", "10아웃", "12아웃"],
    correctIndex: 1,
    explanation: "T♣J♣ on 8♠9♦K♣: 낮은 쪽(7, 4장) + 높은 쪽(Q, 4장) = 8아웃 오픈엔드. 백도어 클럽 플러시 드로우(클럽 3장)는 직접 아웃이 아니라 약 4%의 추가 에퀴티만 줍니다. 직접 아웃과 백도어 드로우를 구분해서 세는 것이 정확한 에퀴티 판단의 기본입니다.",
    hint: "직접 아웃 먼저: 다음 카드 하나로 드로우를 완성하는 카드만 셉니다.",
    holeCards: [{ rank: "T", suit: "clubs" }, { rank: "J", suit: "clubs" }],
    boardCards: [{ rank: "8", suit: "spades" }, { rank: "9", suit: "diamonds" }, { rank: "K", suit: "clubs" }],
  },
  {
    id: "eq-14",
    difficulty: "heart",
    scenario: "55% 에퀴티로 플롭 올인, 팟 $500.",
    question: "이 올인의 기대값(EV)은?",
    options: ["$250", "$275", "$550", "$500"],
    correctIndex: 1,
    explanation: "EV = 에퀴티 × 총팟 = 55% × $500 = $275. 이 올인에 투입한 금액이 $250(팟의 절반)이라면 수익 EV = $275 - $250 = +$25. 플러스 EV이므로 한 번은 질 수도 있지만 같은 상황을 반복하면 장기적으로 수익이 됩니다. EV 계산은 포커에서 모든 의사결정의 궁극적 기준입니다.",
    hint: "EV = 에퀴티% × 총팟",
  },
  {
    id: "eq-15",
    difficulty: "heart",
    scenario: "리버: 보드 K♠K♥K♦A♠A♥. 당신 Q♠J♠, 상대 2♣2♦.",
    question: "누가 이기며 각각 어떤 패를 만들었습니까?",
    options: ["로열 플러시로 승리", "상대가 풀하우스로 승리", "무승부 — 보드 공유(KKKAA)", "하이 카드로 승리"],
    correctIndex: 2,
    explanation: "보드 K♠K♥K♦A♠A♥는 이미 풀하우스(KKKAA)입니다. Q♠J♠도 2♣2♦도 이 보드의 5장을 개선하지 못합니다. 최선의 5장이 보드와 동일하므로 무승부(팟 분할). 이 예시는 에퀴티가 항상 핸드 강도만으로 결정되지 않음을 보여주며, 보드 텍스처를 읽는 것의 중요성을 강조합니다.",
    hint: "보드가 이미 최강 5장 핸드를 구성하면 홀카드가 개선하지 못하면 무승부입니다.",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "Q", suit: "spades" }, { rank: "J", suit: "spades" }] },
      { label: "상대 핸드", cards: [{ rank: "2", suit: "clubs" }, { rank: "2", suit: "diamonds" }] },
    ],
    boardCards: [{ rank: "K", suit: "spades" }, { rank: "K", suit: "hearts" }, { rank: "K", suit: "diamonds" }, { rank: "A", suit: "spades" }, { rank: "A", suit: "hearts" }],
  },
  {
    id: "eq-16",
    difficulty: "heart",
    scenario: "당신: A♦K♦, 보드: Q♦J♦T♠. 상대가 K♠Q♠으로 올인했습니다.",
    question: "대략적 에퀴티와 이 핸드가 흥미로운 이유는?",
    options: ["AK ~88% — 메이드 넛 스트레이트 + 넛 플러시 드로우", "둘 다 ~50% — 공유 카드로 균형", "AK ~70% — 최강 스트레이트 vs 페어", "KQ ~65% — 탑 페어 vs 드로우"],
    correctIndex: 0,
    explanation: "A♦K♦ on Q♦J♦T♠: 이미 넛 스트레이트(A-K-Q-J-T)가 완성되어 있습니다! 추가로 다이아몬드 넛 플러시 드로우도 보유. 상대 K♠Q♠은 현재 탑 페어뿐이고, 9가 와도 K-하이 스트레이트라 A-하이 넛에 지며, 이기려면 러너-러너 풀하우스 이상이 필요합니다. 에퀴티는 약 88%. 드로우를 세기 전에 이미 메이드핸드인지 먼저 확인하는 습관이 중요합니다.",
    hint: "드로우를 계산하기 전에 이미 최강패인지 확인하세요!",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "A", suit: "diamonds" }, { rank: "K", suit: "diamonds" }] },
      { label: "상대 핸드", cards: [{ rank: "K", suit: "spades" }, { rank: "Q", suit: "spades" }] },
    ],
    boardCards: [{ rank: "Q", suit: "diamonds" }, { rank: "J", suit: "diamonds" }, { rank: "T", suit: "spades" }],
  },
  {
    id: "eq-7",
    difficulty: "spade",
    scenario: "턴: K♦Q♠J♥9♠. 당신: A♥T♥(넛 스트레이트). 상대: K♠K♥(탑 셋).",
    question: "한 장 남은 상황에서 대략적 에퀴티는?",
    options: ["95%", "78%", "65%", "50%"],
    correctIndex: 1,
    explanation: "A♥T♥(넛 스트레이트 AKQJT) vs K♠K♥(셋) on K♦Q♠J♥9♠: 현재 최강패(넛) 보유. 상대는 보드를 페어링해 풀하우스를 만들어야 합니다. 풀하우스/쿼드 완성 카드: K♣(1장) + Q(3장) + J(3장) + 9(3장) = 10장. 10/44 ≈ 23%이므로 당신 에퀴티 ≈ 77%. 넛을 잡아도 상대 셋이 있으면 리버에서 약 1/4 확률로 역전당할 수 있다는 점을 기억하세요.",
    hint: "상대가 셋을 보유 시 리버에서 몇 장이 풀하우스나 포카드를 완성하는지 세세요.",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "A", suit: "hearts" }, { rank: "T", suit: "hearts" }] },
      { label: "상대 핸드", cards: [{ rank: "K", suit: "spades" }, { rank: "K", suit: "hearts" }] },
    ],
    boardCards: [{ rank: "K", suit: "diamonds" }, { rank: "Q", suit: "spades" }, { rank: "J", suit: "hearts" }, { rank: "9", suit: "spades" }],
  },
  {
    id: "eq-8",
    difficulty: "spade",
    scenario: "3웨이 올인: 당신 A♠A♦, 플레이어B K♠K♥, 플레이어C Q♣Q♦.",
    question: "3웨이 팟에서 AA의 대략적 에퀴티는?",
    options: ["33% (균등분배)", "60%", "73%", "85%"],
    correctIndex: 1,
    explanation: "AA vs KK vs QQ 3웨이: AA 약 63-67%, KK 약 22%, QQ 약 11% (합계 100%). AA가 여전히 크게 유리하지만, 헤즈업(AA vs KK ≈ 82%)보다 에퀴티가 낮아집니다. 상대가 늘어날수록 AA의 에퀴티가 감소하므로, 멀티웨이 팟에서는 강한 핸드라도 가능하면 프리플롭에서 참여 인원을 줄이는 것이 유리합니다.",
    hint: "3웨이 팟에서 에퀴티는 합이 100%. 에이스는 여전히 압도적 우위지만 헤즈업보다는 낮습니다.",
    playerHands: [
      { label: "내 핸드", cards: [{ rank: "A", suit: "spades" }, { rank: "A", suit: "diamonds" }] },
      { label: "플레이어 B", cards: [{ rank: "K", suit: "spades" }, { rank: "K", suit: "hearts" }] },
      { label: "플레이어 C", cards: [{ rank: "Q", suit: "clubs" }, { rank: "Q", suit: "diamonds" }] },
    ],
  },
  {
    id: "eq-18",
    difficulty: "spade",
    scenario: "프리플롭 올인. 3명 참여. 플레이어A: A♠A♥(에이스 페어). 플레이어B: K♦K♣(킹 페어). 플레이어C: Q♠J♠(수티드 커넥터). 팟 $300.",
    question: "3-웨이 올인에서 각 플레이어의 대략적 에퀴티는?",
    options: [
      "A ~63%, B ~18%, C ~19%",
      "A ~33%, B ~33%, C ~33% — 모두 동일",
      "A ~82%, B ~10%, C ~8%",
      "A ~45%, B ~35%, C ~20%"
    ],
    correctIndex: 0,
    explanation: "3-웨이 올인에서 AA ≈ 63%, KK ≈ 18%, QJs ≈ 19%입니다. AA는 헤즈업에서 KK 대비 ~82%이지만, 3-웨이에서는 두 상대를 모두 이겨야 하므로 에퀴티가 ~63%로 줄어듭니다. KK는 AA에 크게 열세이면서 QJs의 스트레이트/플러시에도 취약해 ~18%까지 떨어집니다. QJs는 약 19%로 KK와 비슷한데, 커넥티드+수티드 핸드의 플레이어빌리티 덕분에 멀티웨이에서 의외로 높은 에퀴티를 확보합니다. 핵심 교훈: 멀티웨이에서는 프리미엄 핸드(AA)도 에퀴티가 크게 줄고 분산(variance)이 매우 커지므로, 3-웨이 올인에 너무 의존하면 안 됩니다.",
    hint: "3-웨이에서는 헤즈업보다 모든 핸드의 에퀴티가 달라집니다. AA도 82%가 아닌 ~63%로 줄어듭니다.",
  },
];

const rawMap: Record<CategorySlug, QuizQuestion[]> = {
  "position": positionQuestions,
  "hand-ranking": handRankingQuestions,
  "showdown": showdownQuestions,
  "min-raise": minRaiseQuestions,
  "pot-calculation": potCalculationQuestions,
  "outs": outsQuestions,
  "equity": equityQuestions,
  "reverse-probability": drawProbabilityQuestions,
  "pot-odds": potOddsQuestions,
  "hand-selection": handSelectionQuestions,
  "action-selection": actionSelectionQuestions,
  "bet-sizing": betSizingQuestions,
  "bluff-value": bluffValueQuestions,
};

export const quizDataMap: Record<CategorySlug, QuizQuestion[]> = Object.fromEntries(
  Object.entries(rawMap).map(([slug, questions]) => [
    slug,
    questions.map(q => ({ ...q, category: slug as CategorySlug })),
  ])
) as Record<CategorySlug, QuizQuestion[]>;

export function getQuestionsByCategory(slug: string): QuizQuestion[] {
  return quizDataMap[slug as CategorySlug] ?? [];
}
