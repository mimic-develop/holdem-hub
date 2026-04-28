export type GlossaryCategory = "수학" | "전략" | "베팅" | "핸드·드로우" | "포지션";

export interface GlossaryEntry {
  term: string;
  english: string;
  category: GlossaryCategory;
  definition: string;
  example?: string;
}

export const glossary: GlossaryEntry[] = [
  { term: "팟오즈", english: "Pot Odds", category: "수학", definition: "콜 금액 대비 딸 수 있는 팟의 비율. 콜이 수익적인지 판단하는 기본 지표.", example: "팟 $100, 콜 $20 → 팟오즈 = 20/120 ≈ 17%" },
  { term: "임플라이드 오즈", english: "Implied Odds", category: "수학", definition: "히트 시 추가로 딸 수 있는 미래 칩까지 고려한 확장된 팟오즈.", example: "팟오즈는 부족하지만, 히트하면 상대 스택 전체를 딸 수 있을 때" },
  { term: "에퀴티", english: "Equity", category: "수학", definition: "현재 시점에서 팟을 차지할 확률(%). 핸드 강도를 수치로 표현한 것.", example: "AA vs KK 프리플롭 → AA 에퀴티 약 82%" },
  { term: "폴드 에퀴티", english: "Fold Equity", category: "수학", definition: "베팅/레이즈로 상대를 폴드시켜 팟을 가져올 수 있는 확률.", example: "블러프 시 상대가 40% 폴드하면 폴드 에퀴티 = 40%" },
  { term: "아웃", english: "Outs", category: "수학", definition: "내 핸드를 개선시켜줄 남은 카드의 수.", example: "플러시 드로우 → 같은 무늬 남은 9장 = 9아웃" },
  { term: "더티 아웃", english: "Dirty Outs", category: "수학", definition: "내 핸드를 개선하지만 동시에 상대 핸드도 강화할 수 있는 아웃.", example: "스트레이트 드로우의 아웃이 보드를 플러시로 완성시킬 때" },
  { term: "클린 아웃", english: "Clean Outs", category: "수학", definition: "히트하면 확실히 최강 핸드가 되는 순수한 아웃.", example: "넛 플러시 드로우의 같은 무늬 카드" },
  { term: "EV", english: "Expected Value", category: "수학", definition: "기대값(Expected Value). 특정 액션을 무한히 반복했을 때 평균적으로 얻거나 잃는 금액.", example: "+EV = 장기적 이익, -EV = 장기적 손실" },
  { term: "역확률", english: "Reverse Probability", category: "수학", definition: "확률의 역수 개념으로, '몇 번에 1번' 형태로 확률을 표현한 것.", example: "25% = 4번에 1번 히트" },
  { term: "코인플립", english: "Coinflip", category: "수학", definition: "에퀴티가 거의 50:50인 상황. 보통 페어 vs 오버카드 2장.", example: "QQ vs AKs → 약 54% vs 46%" },
  { term: "OESD", english: "Open-Ended Straight Draw", category: "핸드·드로우", definition: "양쪽 스트레이트 드로우. 양쪽 끝 카드로 스트레이트가 완성되는 드로우. 8아웃.", example: "9-T 홀카드 + 보드 J-Q → 8 또는 K로 완성" },
  { term: "거트샷", english: "Gutshot", category: "핸드·드로우", definition: "안쪽 스트레이트 드로우. 중간 한 장만으로 스트레이트가 완성. 4아웃.", example: "9-T + 보드 7-J → 8만 필요" },
  { term: "플러시 드로우", english: "Flush Draw", category: "핸드·드로우", definition: "같은 무늬 4장을 가지고 있어 한 장만 더 맞으면 플러시가 완성되는 상태. 9아웃.", example: "홀카드 A♠K♠ + 보드 7♠3♠ → 스페이드 한 장 더 필요" },
  { term: "넛", english: "Nuts", category: "핸드·드로우", definition: "현재 보드에서 만들 수 있는 최강의 핸드.", example: "보드 A♠K♠Q♠J♠ → T♠를 가지면 넛(로열 플러시)" },
  { term: "오버페어", english: "Overpair", category: "핸드·드로우", definition: "보드의 모든 카드보다 높은 포켓 페어.", example: "AA, KK → 보드 Q-8-3에서 오버페어" },
  { term: "셋", english: "Set", category: "핸드·드로우", definition: "포켓 페어가 보드의 한 장과 맞아 만들어진 쓰리오브어카인드. 상대가 알기 어려워 가치가 높다.", example: "포켓 9-9 + 보드 9-K-3 = 나인 셋" },
  { term: "트립스", english: "Trips", category: "핸드·드로우", definition: "홀카드 1장 + 보드 페어로 만들어진 쓰리오브어카인드. 셋보다 상대에게 읽히기 쉽다.", example: "홀카드 A-9 + 보드 9-9-K = 나인 트립스" },
  { term: "탑 페어", english: "Top Pair", category: "핸드·드로우", definition: "보드의 가장 높은 카드와 홀카드로 만든 페어.", example: "보드 K-8-3 + 홀카드 K-Q = 킹 탑 페어" },
  { term: "TPTK", english: "Top Pair Top Kicker", category: "핸드·드로우", definition: "탑 페어 탑 킥커. 보드 최고 카드와 페어 + 가장 높은 킥커.", example: "AK + 보드 K-8-3 = 킹 탑 페어 에이스 킥커" },
  { term: "킥커", english: "Kicker", category: "핸드·드로우", definition: "같은 족보(예: 원 페어)일 때 승패를 결정하는 나머지 높은 카드.", example: "A-K vs A-Q: 둘 다 에이스 페어지만 K 킥커가 승리" },
  { term: "도미네이트", english: "Dominated", category: "핸드·드로우", definition: "비슷한 핸드이지만 킥커 차이로 크게 열세인 관계.", example: "AK vs AJ → AJ가 도미네이트당함 (J 킥커 열세)" },
  { term: "스타팅 핸드", english: "Starting Hand", category: "핸드·드로우", definition: "게임 시작 시 받는 2장의 개인 카드(홀카드). 게임 참여 여부의 기본 판단 기준.", example: "AA, AKs, KQo 등" },
  { term: "수티드", english: "Suited", category: "핸드·드로우", definition: "같은 무늬의 2장 홀카드. 플러시 가능성이 추가되어 오프수트보다 약 2-3% 에퀴티 우위.", example: "A♠K♠ (수티드) vs A♠K♦ (오프수트)" },
  { term: "오프수트", english: "Offsuit", category: "핸드·드로우", definition: "다른 무늬의 2장 홀카드. 플러시를 만들 수 없다.", example: "A♠K♦ — 수티드보다 약간 약하다" },
  { term: "웻 보드", english: "Wet Board", category: "핸드·드로우", definition: "드로우(스트레이트, 플러시)가 많이 가능한 보드. 핸드 순위가 변할 가능성이 높다.", example: "보드 7♠8♠9♣ → 스트레이트+플러시 드로우 가능" },
  { term: "드라이 보드", english: "Dry Board", category: "핸드·드로우", definition: "드로우 가능성이 적은 보드. 현재 메이드핸드의 가치가 유지될 가능성이 높다.", example: "보드 K♦7♠2♣ → 드로우 거의 없음" },
  { term: "레인지", english: "Range", category: "전략", definition: "특정 상황에서 플레이어가 가질 수 있는 모든 핸드의 조합.", example: "UTG 오픈 레인지 ≈ AA-TT, AKs-ATs, KQs 등 상위 15%" },
  { term: "세미블러프", english: "Semi-Bluff", category: "전략", definition: "현재는 최강이 아니지만 드로우가 있어 개선 가능성이 있는 상태에서의 베팅/레이즈.", example: "플러시 드로우로 레이즈 → 상대 폴드 시 즉시 승리, 콜당해도 히트 가능" },
  { term: "블러프", english: "Bluff", category: "전략", definition: "약한 핸드로 강한 핸드인 것처럼 베팅하여 상대를 폴드시키려는 전략.", example: "미스된 드로우로 리버에서 큰 베팅" },
  { term: "밸류벳", english: "Value Bet", category: "전략", definition: "강한 핸드로 상대의 약한 핸드에서 콜을 받아 이익을 얻는 베팅.", example: "탑 페어로 2/3팟 베팅 → 세컨드 페어가 콜해줌" },
  { term: "슬로우플레이", english: "Slow Play", category: "전략", definition: "강한 핸드를 숨기기 위해 의도적으로 체크/콜하는 것.", example: "플롭에서 풀하우스를 만들고 체크 → 턴에서 베팅" },
  { term: "이니셔티브", english: "Initiative", category: "전략", definition: "마지막으로 공격적 액션(레이즈)을 취하여 얻는 주도권.", example: "프리플롭 레이저 → 플롭에서 이니셔티브 보유" },
  { term: "핸드 셀렉션", english: "Hand Selection", category: "전략", definition: "어떤 스타팅 핸드로 게임에 참여할지 선택하는 것. 포지션에 따라 달라진다.", example: "UTG ~15%, BTN ~45% 핸드로 오픈" },
  { term: "매몰 비용", english: "Sunk Cost", category: "전략", definition: "이미 팟에 넣어 회수 불가능한 칩. 향후 판단에 영향을 주면 안 된다.", example: "블라인드를 이미 냈지만, 약한 패면 추가 투자 없이 폴드" },
  { term: "C-벳", english: "Continuation Bet", category: "베팅", definition: "연속 베팅. 프리플롭에서 레이즈한 후 플롭에서도 이어서 베팅하는 것.", example: "프리플롭 레이즈 → 플롭 미스해도 C-벳으로 팟 차지 가능" },
  { term: "3-벳", english: "3-Bet", category: "베팅", definition: "오픈 레이즈(첫 번째 레이즈)에 대한 리레이즈. 프리플롭에서 상대 오픈에 레이즈하는 것.", example: "UTG $6 오픈 → CO $18 3-벳" },
  { term: "체크레이즈", english: "Check-Raise", category: "베팅", definition: "먼저 체크한 후 상대가 베팅하면 레이즈하는 전략. 트랩이나 밸류 극대화에 사용.", example: "셋을 만든 후 체크 → 상대 베팅 → 레이즈" },
  { term: "오버벳", english: "Overbet", category: "베팅", definition: "현재 팟 크기보다 큰 금액을 베팅하는 것.", example: "팟 $50에 $75 이상 베팅" },
  { term: "올인", english: "All-in", category: "베팅", definition: "보유한 모든 칩을 베팅하는 것.", example: "스택 $200 전부를 팟에 투입" },
  { term: "블라인드 스틸", english: "Blind Steal", category: "베팅", definition: "레이트 포지션에서 레이즈하여 블라인드를 폴드시키고 팟을 가져오는 전략.", example: "BTN에서 K8s로 레이즈 → SB, BB 폴드" },
  { term: "데드머니", english: "Dead Money", category: "베팅", definition: "이미 팟에 들어간 후 폴드한 플레이어의 칩. 회수 불가한 칩.", example: "블라인드가 폴드하면 블라인드 금액이 데드머니" },
  { term: "팟", english: "Pot", category: "베팅", definition: "현재 테이블 중앙에 모인 전체 베팅 금액.", example: "SB $1 + BB $2 + 레이즈 $6 + 콜 $6 = 팟 $15" },
  { term: "콜링 스테이션", english: "Calling Station", category: "전략", definition: "거의 모든 베팅에 콜하는 소극적 플레이어. 블러프가 통하지 않는 상대.", example: "C-벳, 세미블러프에도 자주 콜하는 상대" },
  { term: "포지셔널 어드밴티지", english: "Positional Advantage", category: "포지션", definition: "상대보다 뒤에서 행동하여 더 많은 정보를 가진 유리한 위치.", example: "BTN은 포스트플롭에서 마지막에 행동 → 최대 정보 보유" },
  { term: "IP", english: "In Position", category: "포지션", definition: "인 포지션. 상대보다 뒤에서 행동하는 유리한 위치.", example: "BTN이 BB에 대해 IP" },
  { term: "OOP", english: "Out of Position", category: "포지션", definition: "아웃 오브 포지션. 상대보다 먼저 행동하는 불리한 위치.", example: "BB가 BTN에 대해 OOP" },
  { term: "프리플롭", english: "Preflop", category: "포지션", definition: "홀카드를 받은 후 보드 카드가 깔리기 전 첫 베팅 라운드.", example: "2장의 홀카드만으로 베팅/폴드 결정" },
  { term: "플롭", english: "Flop", category: "포지션", definition: "처음 공개되는 3장의 커뮤니티 카드 및 그 후 베팅 라운드.", example: "홀카드 2장 + 플롭 3장 = 총 5장으로 판단" },
  { term: "턴", english: "Turn", category: "포지션", definition: "플롭 이후 공개되는 4번째 커뮤니티 카드 및 베팅 라운드.", example: "플롭 3장 + 턴 1장 = 보드 4장" },
  { term: "리버", english: "River", category: "포지션", definition: "마지막(5번째) 커뮤니티 카드 및 최종 베팅 라운드.", example: "보드 5장 + 홀카드 2장 = 최종 7장으로 승패 결정" },
  { term: "넛 플러시 드로우", english: "Nut Flush Draw", category: "핸드·드로우", definition: "완성되면 넛 플러시(최강 플러시)가 되는 플러시 드로우. 보통 에이스 수티드 홀카드로 만들어진다.", example: "A♠5♠ + 보드 K♠9♠7♣ → 스페이드 히트 시 에이스하이 넛 플러시" },
  { term: "넛 플러시", english: "Nut Flush", category: "핸드·드로우", definition: "현재 보드에서 가능한 최강의 플러시. 보통 에이스가 포함된 플러시.", example: "A♠K♠ + 보드에 스페이드 3장 → 에이스하이 넛 플러시" },
  { term: "넛 스트레이트", english: "Nut Straight", category: "핸드·드로우", definition: "현재 보드에서 가능한 최강의 스트레이트.", example: "보드 9-T-J → Q-K를 가지면 넛 스트레이트(9-T-J-Q-K)" },
  { term: "스트레이트 드로우", english: "Straight Draw", category: "핸드·드로우", definition: "한 장만 더 맞으면 스트레이트가 완성되는 상태. OESD(8아웃)와 거트샷(4아웃)으로 나뉜다.", example: "7-8 + 보드 9-T → 6 또는 J로 스트레이트 완성 (OESD)" },
  { term: "에이스 블로커", english: "Ace Blocker", category: "전략", definition: "에이스를 보유하여 상대가 AA, AK 등 에이스 포함 핸드를 가질 확률을 줄이는 효과.", example: "A♠5♠로 블러프 시 상대의 AK/AQ 보유 확률 감소 → 폴드 유도" },
  { term: "탑 페어 탑 킥커", english: "Top Pair Top Kicker", category: "핸드·드로우", definition: "보드 최고 카드와 페어를 만들고, 가장 높은 킥커(보통 에이스)를 보유한 강한 원 페어 핸드.", example: "AK + 보드 K-8-3 = 킹 탑 페어 에이스 킥커(TPTK)" },
];

const sortedTerms = [...glossary].sort((a, b) => b.term.length - a.term.length);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const termPattern = new RegExp(
  `(${sortedTerms.map((g) => escapeRegex(g.term)).join("|")})`,
  "g"
);

const termMap = new Map<string, GlossaryEntry>(
  glossary.map((g) => [g.term, g])
);

export interface TextSegment {
  text: string;
  entry?: GlossaryEntry;
}

const HANGUL_RE = /[\uAC00-\uD7AF]/;

function isValidBoundary(text: string, matchStart: number, matchEnd: number, termLen: number): boolean {
  if (termLen > 2) return true;
  const before = matchStart > 0 ? text[matchStart - 1] : "";
  const after = matchEnd < text.length ? text[matchEnd] : "";
  if (before && HANGUL_RE.test(before)) return false;
  if (after && HANGUL_RE.test(after)) return false;
  return true;
}

export function parseGlossaryText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  const matches = Array.from(text.matchAll(termPattern));
  for (let mi = 0; mi < matches.length; mi++) {
    const match = matches[mi];
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    if (!isValidBoundary(text, matchStart, matchEnd, match[0].length)) {
      continue;
    }

    if (matchStart > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchStart) });
    }
    const entry = termMap.get(match[0]);
    segments.push({ text: match[0], entry });
    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}
