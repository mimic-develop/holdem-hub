import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Send,
  RotateCcw, Lightbulb, CheckCircle2, XCircle, Trophy, BookOpen, Info, RefreshCw, Eye, Check
} from "lucide-react";
import { getQuestionsByCategory, type QuizQuestion, type Difficulty } from "../lib/quizData";
import { getCategoryBySlug, getSectionById } from "../lib/categories";
import { getConceptsByCategory } from "../lib/concepts";
import { PlayingCard } from "../components/PlayingCard";
import { PokerTable } from "../components/PokerTable";
import { GlossaryText, GlossaryTrackerProvider } from "../components/GlossaryText";
import { useProgress } from "../hooks/useProgress";

interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  selectedOption: number | null;
  isAnswered: boolean;
  score: number;
  showExplanation: boolean;
  isComplete: boolean;
  optionMapping: number[][];
  retryCount: number;
  wrongQuestions: Set<number>;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; diffLabel: string; suit: string; color: string; bg: string; border: string; dot: string }> = {
  club:    { label: "클럽",    diffLabel: "쉬움",       suit: "♣\uFE0E", color: "text-green-700",  bg: "bg-green-50",   border: "border-green-200",  dot: "bg-green-600"  },
  diamond: { label: "다이아",  diffLabel: "보통",       suit: "♦\uFE0E", color: "text-blue-600",   bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500"   },
  heart:   { label: "하트",    diffLabel: "어려움",     suit: "♥\uFE0E", color: "text-rose-500",   bg: "bg-rose-50",    border: "border-rose-200",   dot: "bg-rose-500"   },
  spade:   { label: "스페이드", diffLabel: "매우 어려움", suit: "♠\uFE0E", color: "text-gray-800",   bg: "bg-gray-100",   border: "border-gray-300",   dot: "bg-gray-700"   },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createOptionMappings(questions: QuizQuestion[]): number[][] {
  return questions.map(q => {
    const indices = q.options.map((_, i) => i);
    return shuffle(indices);
  });
}

export default function Quiz() {
  const { category } = useParams<{ category: string }>();
  const [, navigate] = useLocation();
  const { isCardUnlocked, markCardCleared, getNextCard } = useProgress();
  const categoryConfig = getCategoryBySlug(category ?? "");
  const section = categoryConfig ? getSectionById(categoryConfig.sectionId) : undefined;
  const allQuestions = getQuestionsByCategory(category ?? "");

  const selectedDifficulty = (() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("difficulty");
    if (d === "club" || d === "diamond" || d === "heart" || d === "spade") return d as Difficulty | "all";
    return "all" as const;
  })();

  useEffect(() => {
    if (categoryConfig && selectedDifficulty !== "all" && !isCardUnlocked(categoryConfig.slug, selectedDifficulty)) {
      navigate("/", { replace: true });
    }
  }, [categoryConfig, selectedDifficulty, isCardUnlocked, navigate]);

  const [completionMarked, setCompletionMarked] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [introTab, setIntroTab] = useState<"concepts" | "quiz">("concepts");
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);
  const concepts = getConceptsByCategory(category ?? "", selectedDifficulty !== "all" ? selectedDifficulty : "club");

  useEffect(() => {
    setCompletionMarked(false);
    setQuizStarted(false);
    setIntroTab("concepts");
    setExpandedConcept(null);
    setState({ questions: [], currentIndex: 0, selectedOption: null, isAnswered: false, score: 0, showExplanation: false, isComplete: false, optionMapping: [], retryCount: 0, wrongQuestions: new Set() });
  }, [category]);

  const filteredQuestions = useMemo(() => {
    const base = selectedDifficulty === "all"
      ? allQuestions
      : allQuestions.filter(q => q.difficulty === selectedDifficulty);
    return shuffle(base);
  }, [allQuestions, selectedDifficulty]);

  const [state, setState] = useState<QuizState>({
    questions: [], currentIndex: 0, selectedOption: null,
    isAnswered: false, score: 0, showExplanation: false, isComplete: false, optionMapping: [], retryCount: 0, wrongQuestions: new Set(),
  });

  const [scenarioExpanded, setScenarioExpanded] = useState(false);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [explanationExpanded, setExplanationExpanded] = useState(false);

  const feedbackRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const scenarioTextRef = useRef<HTMLParagraphElement>(null);
  const [scenarioOverflows, setScenarioOverflows] = useState(false);

  const currentQuestion = state.questions[state.currentIndex];
  const currentMapping = state.optionMapping[state.currentIndex];

  useEffect(() => {
    setScenarioExpanded(false);
    setTableExpanded(false);
    setExplanationExpanded(false);
  }, [state.currentIndex, state.retryCount]);

  useEffect(() => {
    const el = scenarioTextRef.current;
    if (el) {
      setScenarioOverflows(el.scrollHeight > el.clientHeight + 2);
    }
  }, [currentQuestion?.scenario, scenarioExpanded]);

  const selectOption = (displayIdx: number) => {
    if (state.isAnswered) return;
    setState(prev => ({ ...prev, selectedOption: displayIdx }));
  };

  const submitAnswer = useCallback(() => {
    if (state.selectedOption === null || state.isAnswered || !currentMapping) return;
    setState(prev => {
      if (prev.isAnswered) return prev;
      const originalIdx = prev.optionMapping[prev.currentIndex][prev.selectedOption!];
      const isCorrect = originalIdx === prev.questions[prev.currentIndex].correctIndex;
      const newWrong = new Set(prev.wrongQuestions);
      if (isCorrect) {
        newWrong.delete(prev.currentIndex);
      } else {
        newWrong.add(prev.currentIndex);
      }
      return {
        ...prev,
        isAnswered: true,
        score: isCorrect ? prev.score + 1 : prev.score,
        showExplanation: true,
        wrongQuestions: newWrong,
      };
    });
    setTimeout(() => {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
  }, [state.selectedOption, state.isAnswered, currentMapping]);

  const isPerfect = state.isComplete && state.wrongQuestions.size === 0;

  useEffect(() => {
    if (state.isComplete && isPerfect && categoryConfig && selectedDifficulty !== "all" && !completionMarked) {
      markCardCleared(categoryConfig.slug, selectedDifficulty);
      setCompletionMarked(true);
    }
  }, [state.isComplete, isPerfect, categoryConfig, selectedDifficulty, markCardCleared, completionMarked]);

  const retryCurrentQuestion = useCallback(() => {
    setState(prev => {
      const newMapping = [...prev.optionMapping];
      const indices = currentQuestion.options.map((_, i) => i);
      newMapping[prev.currentIndex] = shuffle(indices);
      return {
        ...prev,
        selectedOption: null,
        isAnswered: false,
        showExplanation: false,
        optionMapping: newMapping,
        retryCount: prev.retryCount + 1,
      };
    });
    setExplanationExpanded(false);
    setTimeout(() => {
      optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
  }, [currentQuestion]);

  const nextQuestion = () => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.questions.length) {
      setState(prev => ({ ...prev, isComplete: true }));
    } else {
      setState(prev => ({
        ...prev, currentIndex: nextIndex, selectedOption: null,
        isAnswered: false, showExplanation: false,
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const startQuiz = () => {
    if (filteredQuestions.length === 0) return;
    const mappings = createOptionMappings(filteredQuestions);
    setState({
      questions: filteredQuestions, currentIndex: 0, selectedOption: null,
      isAnswered: false, score: 0, showExplanation: false, isComplete: false, optionMapping: mappings, retryCount: 0, wrongQuestions: new Set(),
    });
    setQuizStarted(true);
  };

  const restartQuiz = () => {
    setQuizStarted(false);
    setCompletionMarked(false);
    setState({ questions: [], currentIndex: 0, selectedOption: null, isAnswered: false, score: 0, showExplanation: false, isComplete: false, optionMapping: [], retryCount: 0, wrongQuestions: new Set() });
  };

  const modeLabel = categoryConfig?.label ?? "퀴즈";
  const ModeIcon = categoryConfig?.icon ?? BookOpen;
  const sectionLabel = section?.label;
  const accentBar = section?.accentBar ?? "bg-primary";

  if (!categoryConfig || allQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b border-border">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/">
              <button data-testid="link-back-home" aria-label="홈으로 돌아가기" className="min-w-[44px] min-h-[44px] rounded-lg border border-border flex items-center justify-center active:scale-95 transition-transform">
                <ArrowLeft className="w-4 h-4 text-foreground" />
              </button>
            </Link>
            <span className="font-bold text-foreground">MIMIC Poker IQ</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground">{categoryConfig ? `${modeLabel} — 준비 중` : "카테고리를 찾을 수 없습니다"}</h2>
            <p className="text-sm text-muted-foreground">이 카테고리의 문제가 곧 추가될 예정입니다.</p>
            <Link href="/">
              <button data-testid="link-back-home-empty" className="mt-4 px-6 py-3 rounded-xl bg-primary text-white font-bold active:scale-[0.97] transition-transform">
                홈으로 돌아가기
              </button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!quizStarted) {
    const displayCount = selectedDifficulty === "all"
      ? allQuestions.length
      : allQuestions.filter(q => q.difficulty === selectedDifficulty).length;

    const hasConcepts = concepts.length > 0;

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border sticky top-0 z-20">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <Link href="/">
              <button data-testid="link-back-home" aria-label="홈으로 돌아가기" className="min-w-[44px] min-h-[44px] rounded-lg border border-border flex items-center justify-center active:scale-95 transition-transform">
                <ArrowLeft className="w-4 h-4 text-foreground" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <ModeIcon className={`w-4 h-4 ${section?.color ?? "text-primary"}`} />
              <span className="font-bold text-foreground">{modeLabel}</span>
              {sectionLabel && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${section?.bgLight} ${section?.color} font-medium`}>{sectionLabel}</span>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {hasConcepts && (
            <div className="bg-card border border-border rounded-2xl p-1.5 shadow-sm">
              <div className="flex gap-1">
                <button
                  data-testid="tab-concepts"
                  onClick={() => setIntroTab("concepts")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    introTab === "concepts"
                      ? `${section?.bgLight ?? "bg-primary/10"} ${section?.color ?? "text-primary"}`
                      : "text-muted-foreground"
                  }`}
                >
                  <BookOpen className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  개념 학습
                </button>
                <button
                  data-testid="tab-quiz"
                  onClick={() => setIntroTab("quiz")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    introTab === "quiz"
                      ? `${section?.bgLight ?? "bg-primary/10"} ${section?.color ?? "text-primary"}`
                      : "text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  퀴즈
                </button>
              </div>
            </div>
          )}

          {introTab === "concepts" && hasConcepts ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <BookOpen className={`w-4 h-4 ${section?.color ?? "text-primary"}`} />
                <p className="text-sm font-medium text-foreground">핵심 개념을 먼저 학습하세요</p>
              </div>
              {concepts.map((concept) => {
                const isOpen = expandedConcept === concept.id;
                return (
                  <div
                    key={concept.id}
                    className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                  >
                    <button
                      data-testid={`concept-toggle-${concept.id}`}
                      onClick={() => setExpandedConcept(isOpen ? null : concept.id)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left active:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${section?.bgLight ?? "bg-primary/10"}`}>
                          <Info className={`w-3.5 h-3.5 ${section?.color ?? "text-primary"}`} />
                        </div>
                        <span className="text-sm font-semibold text-foreground truncate">{concept.title}</span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                            <p className="text-sm text-muted-foreground leading-relaxed">{concept.description}</p>
                            {concept.example && (
                              <div className={`text-xs px-3 py-2 rounded-lg ${section?.bgLight ?? "bg-muted"} ${section?.color ?? "text-primary"} leading-relaxed`}>
                                {concept.example}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              <button
                data-testid="button-go-to-quiz"
                onClick={() => setIntroTab("quiz")}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm active:scale-[0.97] transition-all flex items-center justify-center gap-2 border-2 ${section?.borderColor ?? "border-primary"} ${section?.color ?? "text-primary"}`}
              >
                개념 학습 완료 → 퀴즈 풀기
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${section?.bgLight ?? "bg-primary/10"}`}>
                    <ModeIcon className={`w-5 h-5 ${section?.color ?? "text-primary"}`} />
                  </div>
                  <div>
                    <h1 className="font-bold text-foreground">{modeLabel}</h1>
                    <p className="text-xs text-muted-foreground">총 {displayCount}개 문제</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{categoryConfig.description}</p>
                <ul className="space-y-1.5">
                  {["모든 문제를 맞혀야 카드 클리어", "틀리면 힌트와 함께 다시 풀기 가능", "상세 해설로 개념 완벽 이해", "선택 후 제출 버튼으로 확인"].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${section?.color ?? "text-primary"}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                data-testid="button-start-quiz"
                onClick={startQuiz}
                disabled={displayCount === 0}
                className={`w-full py-4 rounded-2xl font-bold text-base active:scale-[0.97] transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 ${
                  displayCount === 0
                    ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                    : "bg-primary text-white"
                }`}
              >
                {displayCount === 0 ? "문제가 없습니다" : "퀴즈 시작"}
                {displayCount > 0 && <ChevronRight className="w-5 h-5" />}
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  if (state.isComplete) {
    const pct = Math.round((state.score / state.questions.length) * 100);
    const wrongCount = state.wrongQuestions.size;

    const nextCard = (isPerfect && categoryConfig && selectedDifficulty !== "all")
      ? getNextCard(categoryConfig.slug, selectedDifficulty)
      : null;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b border-border">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <ModeIcon className={`w-4 h-4 ${section?.color ?? "text-primary"}`} />
            <span className="font-bold text-foreground">{modeLabel}</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm space-y-4"
          >
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPerfect ? "bg-emerald-50" : "bg-amber-50"}`}>
                {isPerfect ? (
                  <Trophy className="w-8 h-8 text-emerald-600" />
                ) : (
                  <RotateCcw className="w-8 h-8 text-amber-600" />
                )}
              </div>

              {(() => {
                const completedDiffCfg = selectedDifficulty !== "all" ? DIFFICULTY_CONFIG[selectedDifficulty] : null;
                const nextDiffCfg = nextCard ? DIFFICULTY_CONFIG[nextCard.suit as Difficulty] : null;
                return isPerfect ? (
                  <>
                    {completedDiffCfg ? (
                      <>
                        <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-stage-clear">
                          <span className={`${completedDiffCfg.color}`}>{completedDiffCfg.suit}</span> {completedDiffCfg.label} 단계 클리어!
                        </h2>
                        <p className={`font-bold text-lg ${completedDiffCfg.color}`}>{completedDiffCfg.diffLabel} 단계 완료</p>
                      </>
                    ) : (
                      <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-stage-clear">전체 퀴즈 완료!</h2>
                    )}
                    <p className="text-sm text-muted-foreground mt-1 mb-2">완벽한 실력입니다!</p>
                    {nextDiffCfg && (
                      <p className={`text-sm font-semibold mb-4 ${nextDiffCfg.color}`} data-testid="text-next-stage">
                        다음 단계: {nextDiffCfg.suit} {nextDiffCfg.label} · {nextDiffCfg.diffLabel}
                      </p>
                    )}
                    {!nextDiffCfg && <div className="mb-4" />}
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-foreground mb-1">퀴즈 완료</h2>
                    {completedDiffCfg && (
                      <p className={`text-sm font-medium mb-1 ${completedDiffCfg.color}`}>
                        {completedDiffCfg.suit} {completedDiffCfg.label} · {completedDiffCfg.diffLabel}
                      </p>
                    )}
                    <p className="font-bold text-lg text-amber-600">{wrongCount}문제 오답</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-6">모든 문제를 맞혀야 카드가 클리어됩니다. 다시 도전해보세요!</p>
                  </>
                );
              })()}

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { value: state.questions.length, label: "총 문제", cls: section?.color ?? "text-primary" },
                  { value: wrongCount, label: "틀린 문제", cls: wrongCount > 0 ? "text-red-500" : "text-emerald-600" },
                  { value: `${pct}%`, label: "정확도", cls: isPerfect ? "text-emerald-600" : "text-amber-600" },
                ].map(({ value, label, cls }) => (
                  <div key={label} className="bg-background border border-border rounded-xl p-3">
                    <div className={`text-2xl font-bold ${cls}`}>{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>점수</span><span>{state.score}/{state.questions.length}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className={`h-full rounded-full ${isPerfect ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {isPerfect && nextCard && (
                  <Link href={`/quiz/${nextCard.slug}?difficulty=${nextCard.suit}`}>
                    <button
                      data-testid="button-next-step"
                      className="w-full py-3.5 rounded-xl bg-primary text-white font-bold active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                    >
                      다음 단계
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </Link>
                )}
                <button
                  data-testid="button-restart-quiz"
                  onClick={restartQuiz}
                  className={`w-full py-3.5 rounded-xl font-bold active:scale-[0.97] transition-transform flex items-center justify-center gap-2 ${
                    isPerfect && nextCard
                      ? "border border-border text-muted-foreground"
                      : "bg-primary text-white"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />다시 도전
                </button>
                <Link href="/">
                  <button data-testid="button-home" className="w-full py-3.5 rounded-xl border border-border text-muted-foreground font-medium active:scale-[0.97] transition-transform">
                    홈으로
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  const progress = (state.currentIndex / state.questions.length) * 100;
  const diffCfg = currentQuestion ? DIFFICULTY_CONFIG[currentQuestion.difficulty] : null;
  const isCurrentCorrect = state.isAnswered && currentMapping
    ? currentMapping[state.selectedOption!] === currentQuestion?.correctIndex
    : false;

  const hasCards = !!(currentQuestion?.holeCards || currentQuestion?.boardCards || currentQuestion?.playerHands);
  const hasTable = !!currentQuestion?.tableInfo;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            data-testid="button-quit-quiz"
            aria-label="퀴즈 나가기"
            onClick={restartQuiz}
            className="min-w-[44px] min-h-[44px] rounded-lg border border-border flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>

          <div className="flex items-center gap-2">
            <ModeIcon className={`w-4 h-4 ${section?.color ?? "text-primary"}`} />
            <span className="font-semibold text-foreground text-sm">{modeLabel}</span>
          </div>

          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${section?.bgLight ?? "bg-primary/10"}`} aria-label={`점수 ${state.score}점 / ${state.questions.length}문제`}>
            <Trophy className={`w-3.5 h-3.5 ${section?.color ?? "text-primary"}`} />
            <span className={`text-sm font-bold ${section?.color ?? "text-primary"}`}>{state.score}</span>
            <span className={`text-xs opacity-50 ${section?.color ?? "text-primary"}`}>/ {state.questions.length}</span>
          </div>
        </div>

        <div className="h-1 bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className={`h-full ${accentBar}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        {currentQuestion && currentMapping && (
          <GlossaryTrackerProvider key={`glossary-${state.currentIndex}-${state.retryCount}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${state.currentIndex}-${state.retryCount}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                {diffCfg && (
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${diffCfg.color} ${diffCfg.bg} ${diffCfg.border}`} aria-label={`난이도: ${diffCfg.label} (${diffCfg.diffLabel})`} data-testid="badge-difficulty">
                    <span className="text-sm leading-none">{diffCfg.suit}</span>
                    {diffCfg.label}
                    <span className="opacity-60">·</span>
                    <span className="opacity-80">{diffCfg.diffLabel}</span>
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-medium ml-auto flex items-center gap-1" aria-label={`${state.currentIndex + 1}번 문제 / 총 ${state.questions.length}문제`} data-testid="text-progress-counter">
                  {diffCfg && <span className={`text-sm leading-none ${diffCfg.color}`}>{diffCfg.suit}</span>}
                  {state.currentIndex + 1} / {state.questions.length}
                </span>
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">시나리오</span>
                    {(currentQuestion.potSize || currentQuestion.betSize) && (
                      <div className="ml-auto flex items-center gap-1.5">
                        {currentQuestion.potSize && (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-mono">팟 {currentQuestion.potSize}</span>
                        )}
                        {currentQuestion.betSize && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${section?.bgLight ?? "bg-primary/10"} ${section?.color ?? "text-primary"}`}>베팅 {currentQuestion.betSize}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <GlossaryText
                    ref={scenarioTextRef}
                    text={currentQuestion.scenario}
                    className={`text-sm text-foreground leading-relaxed transition-all ${!scenarioExpanded ? "line-clamp-3" : ""}`}
                  />
                  {scenarioOverflows && !scenarioExpanded && (
                    <button
                      data-testid="button-scenario-expand"
                      onClick={() => setScenarioExpanded(true)}
                      className="mt-1.5 min-h-[44px] flex items-center gap-1 text-xs font-medium text-muted-foreground active:opacity-70 transition-opacity"
                      aria-label="시나리오 더 보기"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      더 보기
                    </button>
                  )}
                  {scenarioExpanded && (
                    <button
                      data-testid="button-scenario-collapse"
                      onClick={() => setScenarioExpanded(false)}
                      className="mt-1.5 min-h-[44px] flex items-center gap-1 text-xs font-medium text-muted-foreground active:opacity-70 transition-opacity"
                      aria-label="시나리오 접기"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      접기
                    </button>
                  )}
                </div>

                {hasCards && (
                  <div className="px-4 py-3 border-b border-border" style={{ background: "linear-gradient(180deg, #1a5c2e 0%, #145226 100%)" }}>
                    {currentQuestion.playerHands && currentQuestion.playerHands.length > 0 ? (
                      <div className="space-y-3">
                        {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                          <div>
                            <p className="text-[11px] font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>커뮤니티 카드</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {currentQuestion.boardCards.map((card, i) => (
                                <div key={i} className="shadow-md rounded-lg">
                                  <PlayingCard card={card} size="md" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                          <div className="h-px" style={{ background: "rgba(255,255,255,0.15)" }} />
                        )}
                        <div className="flex flex-wrap gap-4 items-start">
                          {currentQuestion.playerHands.map((hand, idx) => (
                            <div key={idx} className="flex flex-col">
                              <p className="text-[11px] font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>{hand.label}</p>
                              <div className="flex gap-1.5">
                                {hand.cards.map((card, i) => (
                                  <div key={i} className="shadow-md rounded-lg">
                                    <PlayingCard card={card} size="md" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-4 items-start">
                        {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                          <div>
                            <p className="text-[11px] font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>커뮤니티 카드</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {currentQuestion.boardCards.map((card, i) => (
                                <div key={i} className="shadow-md rounded-lg">
                                  <PlayingCard card={card} size="md" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {currentQuestion.holeCards && currentQuestion.holeCards.length > 0 && (
                          <>
                            {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                              <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.2)" }} />
                            )}
                            <div>
                              <p className="text-[11px] font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>내 홀카드</p>
                              <div className="flex gap-1.5">
                                {currentQuestion.holeCards.map((card, i) => (
                                  <div key={i} className="shadow-md rounded-lg">
                                    <PlayingCard card={card} size="md" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {hasTable && (
                  <div className="border-b border-border">
                    <button
                      data-testid="button-table-toggle"
                      onClick={() => setTableExpanded(prev => !prev)}
                      className="w-full px-4 py-2.5 min-h-[44px] flex items-center justify-between text-xs font-semibold text-muted-foreground active:bg-muted/50 transition-colors"
                      aria-label={tableExpanded ? "테이블 접기" : "테이블 보기"}
                      aria-expanded={tableExpanded}
                    >
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        테이블 보기
                      </span>
                      {tableExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <AnimatePresence initial={false}>
                      {tableExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 py-3" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%)" }}>
                            <PokerTable tableInfo={currentQuestion.tableInfo!} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className={`bg-card border border-border rounded-2xl px-4 py-4 shadow-sm relative overflow-hidden`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} />
                <GlossaryText text={currentQuestion.question} className="font-bold text-foreground text-[15px] leading-snug pl-2" />
              </div>

              <div className="space-y-2.5" ref={optionsRef} role="radiogroup" aria-label="선택지">
                {currentMapping.map((originalIdx, displayIdx) => {
                  const option = currentQuestion.options[originalIdx];
                  const isSelectedOpt = state.selectedOption === displayIdx;
                  const isCorrectOpt = originalIdx === currentQuestion.correctIndex;

                  let cls = "bg-card border-border text-foreground cursor-pointer active:bg-muted/40";
                  let letterCls = "border-border text-muted-foreground bg-card";
                  let statusIcon: React.ReactNode = null;
                  let ariaState = "";

                  if (!state.isAnswered && isSelectedOpt) {
                    cls = `bg-card border-2 text-foreground cursor-pointer ${section?.borderColor ?? "border-primary"} ring-1 ${section?.borderColor ?? "ring-primary/30"} active:bg-muted/40`;
                    letterCls = `${section?.borderColor ?? "border-primary"} ${section?.bgLight ?? "bg-primary/10"} ${section?.color ?? "text-primary"}`;
                    statusIcon = <Check className={`w-4 h-4 flex-shrink-0 ${section?.color ?? "text-primary"}`} aria-hidden="true" />;
                    ariaState = "선택됨";
                  } else if (!state.isAnswered && !isSelectedOpt) {
                    cls = "bg-card border-border text-foreground cursor-pointer active:bg-muted/40";
                  }

                  if (state.isAnswered) {
                    if (isCorrectOpt) {
                      cls = "bg-emerald-50 border-emerald-500 text-emerald-800 cursor-default";
                      letterCls = "border-emerald-500 bg-emerald-500 text-white";
                      statusIcon = <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-label="정답" />;
                      ariaState = "정답";
                    } else if (isSelectedOpt) {
                      cls = "bg-rose-50 border-rose-400 text-rose-800 cursor-default";
                      letterCls = "border-rose-400 bg-rose-400 text-white";
                      statusIcon = <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" aria-label="오답" />;
                      ariaState = "오답";
                    } else {
                      cls = "bg-muted/30 border-border text-muted-foreground cursor-default opacity-50";
                      ariaState = "미선택";
                    }
                  }

                  return (
                    <motion.button
                      key={`${displayIdx}-${originalIdx}`}
                      data-testid={`button-option-${displayIdx}`}
                      onClick={() => selectOption(displayIdx)}
                      disabled={state.isAnswered}
                      whileTap={!state.isAnswered ? { scale: 0.98 } : {}}
                      className={`w-full text-left px-4 py-4 min-h-[52px] rounded-xl border-2 transition-all duration-150 flex items-center justify-between gap-3 shadow-xs ${cls}`}
                      role="radio"
                      aria-checked={isSelectedOpt}
                      aria-label={`선택지 ${String.fromCharCode(65 + displayIdx)}: ${option}${ariaState ? ` (${ariaState})` : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${letterCls}`}>
                          {String.fromCharCode(65 + displayIdx)}
                        </span>
                        <GlossaryText text={option} as="span" className="text-sm leading-snug font-medium" />
                      </div>
                      {statusIcon}
                    </motion.button>
                  );
                })}
              </div>

              {!state.isAnswered && state.selectedOption !== null && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-testid="button-submit-answer"
                  onClick={submitAnswer}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold active:scale-[0.97] transition-transform shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                  aria-label="답변 제출"
                >
                  <Send className="w-5 h-5" />
                  제출
                </motion.button>
              )}

              <AnimatePresence>
                {state.showExplanation && (
                  <motion.div
                    ref={feedbackRef}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2.5 scroll-mt-20"
                    aria-live="polite"
                  >
                    {isCurrentCorrect ? (
                      <>
                        <div className="flex items-center gap-3 rounded-xl px-4 py-3 border-2 bg-emerald-50 border-emerald-500" role="alert">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="text-emerald-700 font-bold text-sm block">정답입니다!</span>
                            <span className="text-emerald-600 text-xs mt-0.5 block leading-relaxed">
                              {(() => {
                                const firstSentence = currentQuestion.explanation.match(/^[^.!?]+[.!?]/)?.[0] ?? currentQuestion.explanation;
                                return firstSentence.length > 50 ? firstSentence.slice(0, 50) + "…" : firstSentence;
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
                          <button
                            data-testid="button-explanation-toggle"
                            onClick={() => setExplanationExpanded(prev => !prev)}
                            className="w-full px-4 py-3 min-h-[44px] flex items-center justify-between active:bg-muted/50 transition-colors"
                            aria-expanded={explanationExpanded}
                            aria-label={explanationExpanded ? "자세한 해설 접기" : "자세한 해설 보기"}
                          >
                            <span className="flex items-center gap-2">
                              <BookOpen className={`w-4 h-4 ${section?.color ?? "text-primary"}`} />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">자세히 보기</span>
                            </span>
                            {explanationExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <AnimatePresence initial={false}>
                            {explanationExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-0">
                                  <GlossaryText text={currentQuestion.explanation} className="text-sm text-foreground leading-relaxed" />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 rounded-xl px-4 py-3 border-2 bg-rose-50 border-rose-400" role="alert">
                          <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                          <span className="text-rose-700 font-bold text-sm">오답입니다. 다시 도전해보세요.</span>
                        </div>

                        {currentQuestion.hint && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4"
                            role="note"
                            aria-label="힌트"
                          >
                            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <GlossaryText text={currentQuestion.hint} className="text-amber-700 text-sm leading-relaxed" />
                          </motion.div>
                        )}

                        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
                          <button
                            data-testid="button-explanation-toggle"
                            onClick={() => setExplanationExpanded(prev => !prev)}
                            className="w-full px-4 py-3 min-h-[44px] flex items-center justify-between active:bg-muted/50 transition-colors"
                            aria-expanded={explanationExpanded}
                            aria-label={explanationExpanded ? "해설 접기" : "해설 보기"}
                          >
                            <span className="flex items-center gap-2">
                              <BookOpen className={`w-4 h-4 ${section?.color ?? "text-primary"}`} />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">해설 보기</span>
                            </span>
                            {explanationExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <AnimatePresence initial={false}>
                            {explanationExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-0">
                                  <GlossaryText text={currentQuestion.explanation} className="text-sm text-foreground leading-relaxed" />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {state.isAnswered && (
                <div className="space-y-2.5">
                  {!isCurrentCorrect ? (
                    <>
                      <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        data-testid="button-retry-question"
                        onClick={retryCurrentQuestion}
                        className="w-full py-4 rounded-2xl bg-primary text-white font-bold active:scale-[0.97] transition-transform shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                        aria-label="이 문제 다시 풀기"
                      >
                        <RefreshCw className="w-4 h-4" />
                        다시 풀기
                      </motion.button>
                      <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        data-testid="button-next-question"
                        onClick={nextQuestion}
                        className="w-full py-3.5 rounded-2xl border-2 border-border text-muted-foreground font-bold active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                        aria-label={state.currentIndex + 1 >= state.questions.length ? "결과 보기" : "다음 문제로 이동"}
                      >
                        {state.currentIndex + 1 >= state.questions.length ? (
                          <><Trophy className="w-4 h-4" />결과 보기</>
                        ) : (
                          <>다음 문제<ChevronRight className="w-4 h-4" /></>
                        )}
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      data-testid="button-next-question"
                      onClick={nextQuestion}
                      className="w-full py-4 rounded-2xl bg-primary text-white font-bold active:scale-[0.97] transition-transform shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                      aria-label={state.currentIndex + 1 >= state.questions.length ? "결과 보기" : "다음 문제로 이동"}
                    >
                      {state.currentIndex + 1 >= state.questions.length ? (
                        <><Trophy className="w-5 h-5" />결과 보기</>
                      ) : (
                        <>다음 문제<ChevronRight className="w-5 h-5" /></>
                      )}
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          </GlossaryTrackerProvider>
        )}
      </main>
    </div>
  );
}
