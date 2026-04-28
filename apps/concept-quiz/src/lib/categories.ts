import {
  MapPin, Crown, Trophy, ArrowUpDown,
  Calculator, TrendingUp, Percent, Target, BarChart3,
  Crosshair, Hand, DollarSign, Drama,
  BookOpen, Brain, Flame,
  type LucideIcon,
} from "lucide-react";

export type CategorySlug =
  | "position" | "hand-ranking" | "showdown" | "min-raise"
  | "pot-calculation" | "pot-odds" | "equity" | "outs" | "reverse-probability"
  | "action-selection" | "hand-selection" | "bet-sizing" | "bluff-value";

export interface Section {
  id: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  accentBar: string;
}

export interface CategoryConfig {
  slug: CategorySlug;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  sectionId: string;
}

export const SECTIONS: Section[] = [
  {
    id: "basic",
    label: "기본 지식",
    emoji: "🔵",
    icon: BookOpen,
    color: "text-sky-600",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
    textColor: "text-sky-700",
    dotColor: "bg-sky-500",
    accentBar: "bg-sky-500",
  },
  {
    id: "math",
    label: "수학적 판단",
    emoji: "🔵",
    icon: Brain,
    color: "text-blue-600",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    dotColor: "bg-blue-500",
    accentBar: "bg-blue-500",
  },
  {
    id: "practical",
    label: "실전 판단",
    emoji: "🔴",
    icon: Flame,
    color: "text-red-600",
    bgLight: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
    accentBar: "bg-red-500",
  },
];

export const CATEGORIES: CategoryConfig[] = [
  {
    slug: "position",
    label: "포지션 이해",
    subtitle: "Position",
    description: "테이블 포지션(UTG, CO, BTN, SB, BB)과 행동 순서, 포지셔널 어드밴티지를 이해하세요.",
    icon: MapPin,
    sectionId: "basic",
  },
  {
    slug: "hand-ranking",
    label: "족보 판정",
    subtitle: "Hand Ranking",
    description: "핸드 랭킹을 정확히 식별하고, 두 핸드의 강도를 비교하는 능력을 키우세요.",
    icon: Crown,
    sectionId: "basic",
  },
  {
    slug: "showdown",
    label: "승리 판정",
    subtitle: "Showdown",
    description: "쇼다운에서 승자를 판별하고, 스플릿 팟과 키커 상황을 이해하세요.",
    icon: Trophy,
    sectionId: "basic",
  },
  {
    slug: "min-raise",
    label: "민레이즈 개념",
    subtitle: "Min-Raise",
    description: "최소 레이즈 계산, 가능한 액션, 베팅 규칙의 기초를 익히세요.",
    icon: ArrowUpDown,
    sectionId: "basic",
  },
  {
    slug: "pot-calculation",
    label: "팟 계산",
    subtitle: "Pot Calculation",
    description: "액션 시퀀스를 따라 현재 팟 크기를 정확히 계산하는 연습을 하세요.",
    icon: Calculator,
    sectionId: "math",
  },
  {
    slug: "outs",
    label: "아웃츠 개념",
    subtitle: "Outs",
    description: "플러시 드로우, 스트레이트 드로우 등 아웃 수를 정확히 세는 법을 배우세요.",
    icon: Target,
    sectionId: "math",
  },
  {
    slug: "equity",
    label: "에퀴티",
    subtitle: "Equity",
    description: "핸드 vs 핸드 에퀴티, 승률을 이해하고 핸드 강도를 정확히 파악하세요.",
    icon: TrendingUp,
    sectionId: "math",
  },
  {
    slug: "reverse-probability",
    label: "역전 확률",
    subtitle: "Improve Probability",
    description: "턴/리버까지 아웃을 활용한 역전 확률을 계산하는 법을 익히세요.",
    icon: BarChart3,
    sectionId: "math",
  },
  {
    slug: "pot-odds",
    label: "팟 오즈",
    subtitle: "Pot Odds",
    description: "팟 크기와 콜 금액을 기반으로 수학적으로 수익이 되는 콜인지 판단하세요.",
    icon: Percent,
    sectionId: "math",
  },
  {
    slug: "hand-selection",
    label: "핸드 선택",
    subtitle: "Hand Selection",
    description: "포지션과 상황에 따라 가장 적절한 스타팅 핸드를 선택하세요.",
    icon: Hand,
    sectionId: "practical",
  },
  {
    slug: "action-selection",
    label: "액션 선택",
    subtitle: "Action Selection",
    description: "팟오즈, 에퀴티, 포지션을 종합해 Fold/Call/Raise를 판단하세요.",
    icon: Crosshair,
    sectionId: "practical",
  },
  {
    slug: "bet-sizing",
    label: "베팅 크기",
    subtitle: "Bet Sizing",
    description: "팟 대비 적절한 베팅 크기(1/3, 1/2, 2/3, 팟, 오버벳)를 이해하세요.",
    icon: DollarSign,
    sectionId: "practical",
  },
  {
    slug: "bluff-value",
    label: "블러프 / 밸류",
    subtitle: "Bluff & Value",
    description: "베팅의 의도를 파악하세요 — 밸류, 블러프, 프로텍션 중 무엇인가?",
    icon: Drama,
    sectionId: "practical",
  },
];

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return CATEGORIES.find(c => c.slug === slug);
}

export function getSectionById(id: string): Section | undefined {
  return SECTIONS.find(s => s.id === id);
}

export function getCategoriesBySection(sectionId: string): CategoryConfig[] {
  return CATEGORIES.filter(c => c.sectionId === sectionId);
}
