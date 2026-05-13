import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { SubAppHeader } from "@hh/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Send,
  RotateCcw, CheckCircle2, XCircle, Trophy, BookOpen, Info, RefreshCw, Eye, Check
} from "lucide-react";
import { getQuestionsByCategory, type QuizQuestion, type Difficulty } from "../lib/quizData";
import { getCategoryBySlug, getSectionById } from "../lib/categories";
import { getConceptsByCategory } from "../lib/concepts";
import { PlayingCard } from "../components/PlayingCard";
import { PokerTable } from "../components/PokerTable";
import { GlossaryText, GlossaryTrackerProvider } from "../components/GlossaryText";
import { useProgress } from "../hooks/useProgress";
import {
  PIQ,
  SUIT_META,
  PokerIQConceptCard,
  PokerIQHeroCard,
  PokerIQCTAButton,
} from "../components/PokerIQShared";

// ──────────────────────────────────────────────
// Option style helpers
// ──────────────────────────────────────────────
type OptionState = "neutral" | "selected" | "correct" | "wrong" | "dimmed";

function getOptionStyle(state: OptionState): React.CSSProperties {
  switch (state) {
    case "selected":
      return {
        background: PIQ.bg,
        border: `2px solid ${PIQ.red}`,
        boxShadow: "0 0 0 3px rgba(186,12,25,0.08)",
        cursor: "pointer",
      };
    case "correct":
      return { background: "#f0fdf4", border: "1.5px solid #16a34a", cursor: "default" };
    case "wrong":
      return { background: "#fef2f2", border: "1.5px solid #dc2626", cursor: "default" };
    case "dimmed":
      return {
        background: PIQ.bgSoft,
        border: `1px solid ${PIQ.border}`,
        opacity: 0.5,
        cursor: "default",
      };
    default:
      return {
        background: PIQ.bg,
        border: "1px solid rgba(0,0,0,0.08)",
        cursor: "pointer",
      };
  }
}

function getLetterStyle(state: OptionState): React.CSSProperties {
  switch (state) {
    case "selected":
      return { border: `1.5px solid ${PIQ.red}`, background: PIQ.red, color: "#fff" };
    case "correct":
      return { border: "1.5px solid #16a34a", background: "#16a34a", color: "#fff" };
    case "wrong":
      return { border: "1.5px solid #dc2626", background: "#dc2626", color: "#fff" };
    default:
      return {
        border: "1.5px solid rgba(0,0,0,0.12)",
        background: PIQ.bg,
        color: PIQ.text35,
      };
  }
}

// ──────────────────────────────────────────────
// Quiz state interface (unchanged)
// ──────────────────────────────────────────────
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

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

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
    const originalIdx = currentMapping[state.selectedOption];
    const isCorrect = originalIdx === currentQuestion.correctIndex;
    setState(prev => {
      if (prev.isAnswered) return prev;
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
  }, [state.selectedOption, state.isAnswered, currentMapping, currentQuestion]);

  const isPerfect = state.isComplete && state.wrongQuestions.size === 0;

  useEffect(() => {
    if (state.isComplete && isPerfect && categoryConfig && selectedDifficulty !== "all" && !completionMarked) {
      markCardCleared(categoryConfig.slug, selectedDifficulty);
      setCompletionMarked(true);
    }
  }, [state.isComplete, isPerfect, categoryConfig, selectedDifficulty, markCardCleared, completionMarked]);

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

  const restartWrongOnly = () => {
    const wrongList = Array.from(state.wrongQuestions)
      .sort((a, b) => a - b)
      .map(idx => state.questions[idx])
      .filter((q): q is QuizQuestion => Boolean(q));
    if (wrongList.length === 0) return;
    const shuffled = shuffle(wrongList);
    const mappings = createOptionMappings(shuffled);
    setCompletionMarked(false);
    setState({
      questions: shuffled,
      currentIndex: 0,
      selectedOption: null,
      isAnswered: false,
      score: 0,
      showExplanation: false,
      isComplete: false,
      optionMapping: mappings,
      retryCount: 0,
      wrongQuestions: new Set(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const modeLabel = categoryConfig?.label ?? "퀴즈";
  const ModeIcon = categoryConfig?.icon ?? BookOpen;
  const sectionLabel = section?.label;

  // ── Empty state ──────────────────────────────
  if (!categoryConfig || allQuestions.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: PIQ.bg, display: "flex", flexDirection: "column" }}>
        <SubAppHeader title="MIMIC Poker IQ" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: PIQ.bgSoft, display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 12px",
              }}
            >
              <BookOpen style={{ width: 32, height: 32, color: PIQ.text35 }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: PIQ.dark, margin: "0 0 8px" }}>
              {categoryConfig ? `${modeLabel} — 준비 중` : "카테고리를 찾을 수 없습니다"}
            </h2>
            <p style={{ fontSize: 14, color: PIQ.text55, margin: "0 0 20px" }}>이 카테고리의 문제가 곧 추가될 예정입니다.</p>
            <a
              href="/"
              data-testid="link-back-home-empty"
              style={{
                display: "inline-block",
                padding: "12px 24px", borderRadius: PIQ.radius, background: PIQ.red,
                color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none",
              }}
            >
              홈으로 돌아가기
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ── Intro state ──────────────────────────────
  if (!quizStarted) {
    const displayCount = selectedDifficulty === "all"
      ? allQuestions.length
      : allQuestions.filter(q => q.difficulty === selectedDifficulty).length;

    const hasConcepts = concepts.length > 0;
    const activeDiff = selectedDifficulty !== "all" ? selectedDifficulty : null;

    return (
      <div style={{ minHeight: "100vh", background: PIQ.bgSoft }}>
        <SubAppHeader
          title={modeLabel}
          right={sectionLabel ? (
            <span
              style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                background: "rgba(186,12,25,0.08)", color: PIQ.red,
                fontWeight: 600, border: `1px solid rgba(186,12,25,0.15)`,
              }}
            >
              {sectionLabel}
            </span>
          ) : undefined}
        />

        <main style={{ maxWidth: 430, margin: "0 auto", padding: "16px 16px 32px" }}>
          {/* Segmented tabs */}
          {hasConcepts && (
            <div
              style={{
                background: PIQ.bg,
                border: `1px solid ${PIQ.border}`,
                borderRadius: PIQ.radius,
                padding: 6,
                display: "flex",
                gap: 4,
                marginBottom: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <button
                data-testid="tab-concepts"
                onClick={() => setIntroTab("concepts")}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: PIQ.radius - 4,
                  fontSize: 15, fontWeight: 700,
                  background: introTab === "concepts" ? "rgba(186,12,25,0.08)" : "transparent",
                  color: introTab === "concepts" ? PIQ.red : PIQ.text55,
                  border: "none", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                <BookOpen style={{ width: 15, height: 15 }} />
                개념 학습
              </button>
              <button
                data-testid="tab-quiz"
                onClick={() => setIntroTab("quiz")}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: PIQ.radius - 4,
                  fontSize: 15, fontWeight: 700,
                  background: introTab === "quiz" ? "rgba(186,12,25,0.08)" : "transparent",
                  color: introTab === "quiz" ? PIQ.red : PIQ.text55,
                  border: "none", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                <CheckCircle2 style={{ width: 15, height: 15 }} />
                퀴즈
              </button>
            </div>
          )}

          {introTab === "concepts" && hasConcepts ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
                <BookOpen style={{ width: 14, height: 14, color: PIQ.red }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: PIQ.dark, margin: 0 }}>핵심 개념을 먼저 학습하세요</p>
              </div>

              {concepts.map((concept) => (
                <PokerIQConceptCard
                  key={concept.id}
                  concept={concept}
                  isOpen={expandedConcept === concept.id}
                  onToggle={() => setExpandedConcept(expandedConcept === concept.id ? null : concept.id)}
                />
              ))}

              <PokerIQCTAButton
                data-testid="button-go-to-quiz"
                onClick={() => setIntroTab("quiz")}
                variant="outline"
                style={{ border: `1.5px solid ${PIQ.red}`, color: PIQ.red }}
              >
                개념 학습 완료 → 퀴즈 풀기
                <ChevronRight style={{ width: 16, height: 16 }} />
              </PokerIQCTAButton>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PokerIQHeroCard
                categoryLabel={modeLabel}
                description={categoryConfig.description}
                difficulty={activeDiff}
                sectionLabel={sectionLabel}
                questionCount={displayCount}
                icon={ModeIcon}
              >
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {["모든 문제를 맞혀야 카드 클리어", "틀리면 힌트와 함께 다시 풀기 가능", "상세 해설로 개념 완벽 이해", "선택 후 제출 버튼으로 확인"].map(item => (
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: PIQ.text55 }}>
                      <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0, color: PIQ.red }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </PokerIQHeroCard>

              <PokerIQCTAButton
                data-testid="button-start-quiz"
                onClick={startQuiz}
                disabled={displayCount === 0}
                variant="primary"
              >
                {displayCount === 0 ? "문제가 없습니다" : "퀴즈 시작"}
                {displayCount > 0 && <ChevronRight style={{ width: 18, height: 18 }} />}
              </PokerIQCTAButton>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── Results state ────────────────────────────
  if (state.isComplete) {
    const pct = Math.round((state.score / state.questions.length) * 100);
    const wrongCount = state.wrongQuestions.size;

    const nextCard = (isPerfect && categoryConfig && selectedDifficulty !== "all")
      ? getNextCard(categoryConfig.slug, selectedDifficulty)
      : null;

    const completedSM = selectedDifficulty !== "all" ? SUIT_META[selectedDifficulty] : null;
    const nextSM = nextCard ? SUIT_META[nextCard.suit as Difficulty] : null;

    return (
      <div style={{ minHeight: "100vh", background: PIQ.bgSoft, display: "flex", flexDirection: "column" }}>
        <SubAppHeader title={modeLabel} />

        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ width: "100%", maxWidth: 390, display: "flex", flexDirection: "column", gap: 12 }}
          >
            {/* Result card */}
            <div
              style={{
                background: PIQ.bg, border: `1px solid ${PIQ.border}`,
                borderRadius: PIQ.radiusLg, padding: 24,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)", textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: isPerfect ? "#f0fdf4" : "#fef9ee",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                {isPerfect ? (
                  <Trophy style={{ width: 32, height: 32, color: "#16a34a" }} />
                ) : (
                  <RotateCcw style={{ width: 32, height: 32, color: "#d97706" }} />
                )}
              </div>

              {isPerfect ? (
                <>
                  {completedSM ? (
                    <>
                      <h2 style={{ fontSize: 22, fontWeight: 700, color: PIQ.dark, margin: "0 0 4px" }} data-testid="text-stage-clear">
                        <span style={{ color: completedSM.color }}>{completedSM.sym}</span> {completedSM.label} 단계 클리어!
                      </h2>
                      <p style={{ fontWeight: 700, fontSize: 16, color: completedSM.color, margin: "0 0 4px" }}>
                        {completedSM.diffLabel} 단계 완료
                      </p>
                    </>
                  ) : (
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: PIQ.dark, margin: "0 0 4px" }} data-testid="text-stage-clear">
                      전체 퀴즈 완료!
                    </h2>
                  )}
                  <p style={{ fontSize: 13, color: PIQ.text55, margin: "4px 0 8px" }}>완벽한 실력입니다!</p>
                  {nextSM && (
                    <p style={{ fontSize: 13, fontWeight: 600, color: nextSM.color, margin: "0 0 16px" }} data-testid="text-next-stage">
                      다음 단계: {nextSM.sym} {nextSM.label} · {nextSM.diffLabel}
                    </p>
                  )}
                  {!nextSM && <div style={{ marginBottom: 16 }} />}
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: PIQ.dark, margin: "0 0 4px" }}>퀴즈 완료</h2>
                  {completedSM && (
                    <p style={{ fontSize: 13, fontWeight: 500, color: completedSM.color, margin: "0 0 4px" }}>
                      {completedSM.sym} {completedSM.label} · {completedSM.diffLabel}
                    </p>
                  )}
                  <p style={{ fontWeight: 700, fontSize: 16, color: "#d97706", margin: "0 0 4px" }}>{wrongCount}문제 오답</p>
                  <p style={{ fontSize: 13, color: PIQ.text55, margin: "4px 0 24px" }}>
                    모든 문제를 맞혀야 카드가 클리어됩니다. 다시 도전해보세요!
                  </p>
                </>
              )}

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { value: state.questions.length, label: "총 문제", color: PIQ.red },
                  { value: wrongCount, label: "틀린 문제", color: wrongCount > 0 ? "#dc2626" : "#16a34a" },
                  { value: `${pct}%`, label: "정확도", color: isPerfect ? "#16a34a" : "#d97706" },
                ].map(({ value, label, color }) => (
                  <div
                    key={label}
                    style={{
                      background: PIQ.bgSoft, border: `1px solid ${PIQ.border}`,
                      borderRadius: PIQ.radius, padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: PIQ.text35, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: PIQ.text35, marginBottom: 6 }}>
                  <span>점수</span><span>{state.score}/{state.questions.length}</span>
                </div>
                <div style={{ height: 10, background: PIQ.bgSoft, borderRadius: 999, overflow: "hidden", border: `1px solid ${PIQ.border}` }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    style={{ height: "100%", borderRadius: 999, background: isPerfect ? "#16a34a" : "#d97706" }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {isPerfect && nextCard && (
                  <Link href={`/quiz/${nextCard.slug}?difficulty=${nextCard.suit}`}>
                    <button
                      data-testid="button-next-step"
                      style={{
                        width: "100%", padding: "13px 16px", borderRadius: PIQ.radius,
                        background: PIQ.red, color: "#fff", fontWeight: 700, fontSize: 14,
                        border: "none", cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      다음 단계
                      <ChevronRight style={{ width: 16, height: 16 }} />
                    </button>
                  </Link>
                )}
                {!isPerfect && wrongCount > 0 && (
                  <button
                    data-testid="button-restart-wrong-only"
                    onClick={restartWrongOnly}
                    style={{
                      width: "100%", padding: "13px 16px", borderRadius: PIQ.radius,
                      background: PIQ.red, color: "#fff", fontWeight: 700, fontSize: 14,
                      border: "none", cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <RefreshCw style={{ width: 16, height: 16 }} />
                    틀린 {wrongCount}문제만 다시 풀기
                  </button>
                )}
                <button
                  data-testid="button-restart-quiz"
                  onClick={restartQuiz}
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: PIQ.radius,
                    background: (isPerfect && nextCard) || (!isPerfect && wrongCount > 0) ? "transparent" : PIQ.red,
                    color: (isPerfect && nextCard) || (!isPerfect && wrongCount > 0) ? PIQ.text55 : "#fff",
                    fontWeight: 700, fontSize: 14,
                    border: `1px solid ${PIQ.border}`, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <RotateCcw style={{ width: 16, height: 16 }} />다시 도전
                </button>
                <a
                  href="/"
                  data-testid="button-home"
                  style={{
                    display: "block", width: "100%", padding: "13px 16px", borderRadius: PIQ.radius,
                    background: "transparent", color: PIQ.text55, fontWeight: 500, fontSize: 14,
                    border: `1px solid ${PIQ.border}`, cursor: "pointer", textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  홈으로
                </a>
              </div>
            </div>

            {/* Wrong review */}
            {!isPerfect && wrongCount > 0 && (
              <div
                style={{
                  background: PIQ.bg, border: `1px solid ${PIQ.border}`,
                  borderRadius: PIQ.radiusLg, padding: 20,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                }}
              >
                <h3
                  style={{
                    fontSize: 15, fontWeight: 800, color: PIQ.dark,
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
                    letterSpacing: "-0.02em",
                  }}
                >
                  <BookOpen style={{ width: 16, height: 16, color: PIQ.red }} />
                  틀린 문제 해설 ({wrongCount}문제)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {Array.from(state.wrongQuestions)
                    .sort((a, b) => a - b)
                    .map((idx) => {
                      const q = state.questions[idx];
                      if (!q) return null;
                      return (
                        <div
                          key={q.id}
                          style={{
                            borderTop: `1px solid ${PIQ.border}`, paddingTop: 20,
                          }}
                        >
                          <p style={{ fontSize: 11, color: PIQ.text35, fontWeight: 600, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>문제 {idx + 1}</p>
                          <p style={{ fontWeight: 700, color: "#111827", fontSize: 15, marginBottom: 14, lineHeight: 1.6, letterSpacing: "-0.015em" }}>{q.question}</p>
                          <div
                            style={{
                              background: "#f0fdf4", border: "1px solid #bbf7d0",
                              borderRadius: PIQ.radius, padding: "12px 14px", marginBottom: 10,
                            }}
                          >
                            <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>정답</p>
                            <p style={{ fontSize: 14, color: "#166534", fontWeight: 600, margin: 0, lineHeight: 1.55 }}>{q.options[q.correctIndex]}</p>
                          </div>
                          <div
                            style={{
                              background: "#FFF1F2", borderLeft: `3px solid ${PIQ.red}`,
                              borderRadius: PIQ.radius, padding: "12px 14px",
                            }}
                          >
                            <p style={{ fontSize: 11, color: PIQ.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>해설</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {splitSentences(q.explanation).map((sentence, i) => (
                                <GlossaryText
                                  key={i}
                                  text={sentence}
                                  className={`text-sm leading-[1.75] tracking-[-0.01em] text-[#374151] ${i === 0 ? "font-semibold text-[#1f2937]" : "font-medium"}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  // ── Active quiz state ────────────────────────
  const progress = (state.currentIndex / state.questions.length) * 100;
  const diffSM = currentQuestion ? SUIT_META[currentQuestion.difficulty] : null;
  const isCurrentCorrect = state.isAnswered && currentMapping
    ? currentMapping[state.selectedOption!] === currentQuestion?.correctIndex
    : false;

  const hasCards = !!(currentQuestion?.holeCards || currentQuestion?.boardCards || currentQuestion?.playerHands);
  const hasTable = !!currentQuestion?.tableInfo;

  return (
    <div style={{ minHeight: "100vh", background: PIQ.bgSoft, display: "flex", flexDirection: "column" }}>
      {/* Sticky header */}
      <header
        style={{
          background: PIQ.bg,
          borderBottom: `1px solid ${PIQ.border}`,
          position: "sticky",
          top: 52,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 430, margin: "0 auto", padding: "0 16px",
            height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <button
            data-testid="button-quit-quiz"
            aria-label="퀴즈 나가기"
            onClick={restartQuiz}
            style={{
              minWidth: 44, minHeight: 44, borderRadius: 10,
              border: `1px solid ${PIQ.border}`, background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16, color: PIQ.dark }} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModeIcon style={{ width: 16, height: 16, color: PIQ.red }} />
            <span style={{ fontFamily: "inherit", fontWeight: 600, fontSize: 14, color: PIQ.dark }}>
              {modeLabel}
            </span>
          </div>

          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              borderRadius: 999, padding: "8px 14px",
              background: "#FFF1F2",
            }}
            aria-label={`문제 ${state.currentIndex + 1} / ${state.questions.length}`}
          >
            <Trophy style={{ width: 14, height: 14, color: PIQ.red }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: PIQ.red, letterSpacing: "-0.02em" }}>
              {state.currentIndex + 1}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: PIQ.red, opacity: 0.5 }}>
              / {state.questions.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{ height: 4, background: "#F3F4F6" }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            style={{ height: "100%", background: PIQ.red, borderRadius: "0 999px 999px 0" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 430, margin: "0 auto", width: "100%", padding: "16px 16px 24px" }}>
        {currentQuestion && currentMapping && (
          <GlossaryTrackerProvider key={`glossary-${state.currentIndex}-${state.retryCount}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${state.currentIndex}-${state.retryCount}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {/* Difficulty badge */}
                {diffSM && (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", borderRadius: 999,
                      fontSize: 13, fontWeight: 700,
                      background: "#F9FAFB", color: "#4B5563",
                      border: "1px solid #D1D5DB",
                    }}
                    aria-label={`난이도: ${diffSM.label} (${diffSM.diffLabel})`}
                    data-testid="badge-difficulty"
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, color: diffSM.color }}>{diffSM.sym}</span>
                    {diffSM.label}
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{diffSM.diffLabel}</span>
                  </span>
                )}

                {/* Scenario card */}
                <div
                  style={{
                    background: PIQ.bg, border: `1px solid ${PIQ.border}`,
                    borderRadius: PIQ.radius, overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${PIQ.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Info style={{ width: 14, height: 14, color: PIQ.text55 }} />
                      <span
                        style={{
                          fontSize: 11, fontWeight: 600, color: PIQ.text35,
                          textTransform: "uppercase", letterSpacing: "0.08em",
                        }}
                      >
                        시나리오
                      </span>
                      {(currentQuestion.potSize || currentQuestion.betSize) && (
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                          {currentQuestion.potSize && (
                            <span
                              style={{
                                padding: "2px 8px", borderRadius: 999,
                                background: PIQ.bgSoft, fontSize: 11,
                                color: PIQ.text55, fontFamily: "inherit",
                                border: `1px solid ${PIQ.border}`,
                              }}
                            >
                              팟 {currentQuestion.potSize}
                            </span>
                          )}
                          {currentQuestion.betSize && (
                            <span
                              style={{
                                padding: "2px 8px", borderRadius: 999,
                                background: "rgba(186,12,25,0.08)", fontSize: 11,
                                color: PIQ.red, fontFamily: "inherit", fontWeight: 600,
                                border: `1px solid rgba(186,12,25,0.15)`,
                              }}
                            >
                              베팅 {currentQuestion.betSize}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {splitSentences(currentQuestion.scenario).map((sentence, i) => (
                        <GlossaryText
                          key={i}
                          ref={i === 0 ? scenarioTextRef : undefined}
                          text={sentence}
                          className={`text-sm leading-relaxed ${i === 0 ? "font-semibold text-foreground" : "text-foreground/80"}`}
                        />
                      ))}
                    </div>
                    {scenarioOverflows && !scenarioExpanded && (
                      <button
                        data-testid="button-scenario-expand"
                        onClick={() => setScenarioExpanded(true)}
                        style={{
                          marginTop: 6, minHeight: 44, display: "flex", alignItems: "center",
                          gap: 4, fontSize: 12, fontWeight: 500, color: PIQ.text55,
                          background: "transparent", border: "none", cursor: "pointer",
                          padding: 0,
                        }}
                        aria-label="시나리오 더 보기"
                      >
                        <ChevronDown style={{ width: 14, height: 14 }} />
                        더 보기
                      </button>
                    )}
                    {scenarioExpanded && (
                      <button
                        data-testid="button-scenario-collapse"
                        onClick={() => setScenarioExpanded(false)}
                        style={{
                          marginTop: 6, minHeight: 44, display: "flex", alignItems: "center",
                          gap: 4, fontSize: 12, fontWeight: 500, color: PIQ.text55,
                          background: "transparent", border: "none", cursor: "pointer",
                          padding: 0,
                        }}
                        aria-label="시나리오 접기"
                      >
                        <ChevronUp style={{ width: 14, height: 14 }} />
                        접기
                      </button>
                    )}
                  </div>

                  {/* Cards strip */}
                  {hasCards && (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${PIQ.border}`,
                        background: "linear-gradient(180deg, #1a5c2e 0%, #145226 100%)",
                      }}
                    >
                      {currentQuestion.playerHands && currentQuestion.playerHands.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: "rgba(255,255,255,0.7)" }}>커뮤니티 카드</p>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {currentQuestion.boardCards.map((card, i) => (
                                  <div key={i} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)", borderRadius: 8 }}>
                                    <PlayingCard card={card} size="md" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                            <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                            {currentQuestion.playerHands.map((hand, idx) => (
                              <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                                <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: "rgba(255,255,255,0.7)" }}>{hand.label}</p>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {hand.cards.map((card, i) => (
                                    <div key={i} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)", borderRadius: 8 }}>
                                      <PlayingCard card={card} size="md" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                          {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: "rgba(255,255,255,0.7)" }}>커뮤니티 카드</p>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {currentQuestion.boardCards.map((card, i) => (
                                  <div key={i} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)", borderRadius: 8 }}>
                                    <PlayingCard card={card} size="md" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {currentQuestion.holeCards && currentQuestion.holeCards.length > 0 && (
                            <>
                              {currentQuestion.boardCards && currentQuestion.boardCards.length > 0 && (
                                <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.2)" }} />
                              )}
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: "rgba(255,255,255,0.7)" }}>내 홀카드</p>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {currentQuestion.holeCards.map((card, i) => (
                                    <div key={i} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)", borderRadius: 8 }}>
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

                  {/* Table toggle */}
                  {hasTable && (
                    <div style={{ borderBottom: `1px solid ${PIQ.border}` }}>
                      <button
                        data-testid="button-table-toggle"
                        onClick={() => setTableExpanded(prev => !prev)}
                        style={{
                          width: "100%", padding: "10px 16px", minHeight: 44,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          fontSize: 12, fontWeight: 600, color: PIQ.text55,
                          background: "transparent", border: "none", cursor: "pointer",
                        }}
                        aria-label={tableExpanded ? "테이블 접기" : "테이블 보기"}
                        aria-expanded={tableExpanded}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Eye style={{ width: 14, height: 14 }} />
                          테이블 보기
                        </span>
                        {tableExpanded
                          ? <ChevronUp style={{ width: 14, height: 14 }} />
                          : <ChevronDown style={{ width: 14, height: 14 }} />}
                      </button>
                      <AnimatePresence initial={false}>
                        {tableExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div style={{ padding: "12px 16px", background: "linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%)" }}>
                              <PokerTable tableInfo={currentQuestion.tableInfo!} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Question text card */}
                <div
                  style={{
                    background: PIQ.bg, border: `1px solid ${PIQ.border}`,
                    borderRadius: PIQ.radius, padding: "16px 16px 16px 20px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                      background: PIQ.red, borderRadius: "12px 0 0 12px",
                    }}
                  />
                  <GlossaryText text={currentQuestion.question} className="font-bold text-foreground text-[15px] leading-snug pl-2" />
                </div>

                {/* Answer options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }} ref={optionsRef} role="radiogroup" aria-label="선택지">
                  {currentMapping.map((originalIdx, displayIdx) => {
                    const option = currentQuestion.options[originalIdx];
                    const isSelectedOpt = state.selectedOption === displayIdx;

                    let optState: OptionState = "neutral";
                    let statusIcon: React.ReactNode = null;
                    let ariaState = "";

                    if (!state.isAnswered && isSelectedOpt) {
                      optState = "selected";
                      statusIcon = <Check style={{ width: 16, height: 16, flexShrink: 0, color: PIQ.red }} aria-hidden />;
                      ariaState = "선택됨";
                    } else if (!state.isAnswered && !isSelectedOpt) {
                      optState = "neutral";
                    }

                    if (state.isAnswered) {
                      if (isSelectedOpt && isCurrentCorrect) {
                        optState = "correct";
                        statusIcon = <CheckCircle2 style={{ width: 20, height: 20, color: "#16a34a", flexShrink: 0 }} aria-label="정답" />;
                        ariaState = "정답";
                      } else if (isSelectedOpt && !isCurrentCorrect) {
                        optState = "wrong";
                        statusIcon = <XCircle style={{ width: 20, height: 20, color: "#dc2626", flexShrink: 0 }} aria-label="오답" />;
                        ariaState = "오답";
                      } else {
                        optState = "dimmed";
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
                        style={{
                          width: "100%", textAlign: "left",
                          padding: "14px 16px", minHeight: 52,
                          borderRadius: PIQ.radius,
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between", gap: 12,
                          transition: "all 0.15s ease",
                          ...getOptionStyle(optState),
                        }}
                        role="radio"
                        aria-checked={isSelectedOpt}
                        aria-label={`선택지 ${String.fromCharCode(65 + displayIdx)}: ${option}${ariaState ? ` (${ariaState})` : ""}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 28, height: 28, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, flexShrink: 0,
                              transition: "all 0.15s ease",
                              ...getLetterStyle(optState),
                            }}
                          >
                            {String.fromCharCode(65 + displayIdx)}
                          </span>
                          <GlossaryText text={option} as="span" className="text-sm leading-snug font-medium" />
                        </div>
                        {statusIcon}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Submit button */}
                {!state.isAnswered && state.selectedOption !== null && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid="button-submit-answer"
                    onClick={submitAnswer}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: PIQ.radius,
                      background: PIQ.red, color: "#fff", fontWeight: 700, fontSize: 14,
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 2px 12px rgba(186,12,25,0.25)",
                    }}
                    aria-label="답변 제출"
                  >
                    <Send style={{ width: 18, height: 18 }} />
                    제출
                  </motion.button>
                )}

                {/* Feedback */}
                <AnimatePresence>
                  {state.showExplanation && (
                    <motion.div
                      ref={feedbackRef}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ display: "flex", flexDirection: "column", gap: 8, scrollMarginTop: 80 }}
                      aria-live="polite"
                    >
                      {isCurrentCorrect ? (
                        <>
                          <div
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              borderRadius: PIQ.radius, padding: "14px 16px",
                              background: "#f0fdf4", border: "2px solid #16a34a",
                            }}
                            role="alert"
                          >
                            <CheckCircle2 style={{ width: 22, height: 22, color: "#16a34a", flexShrink: 0 }} />
                            <div>
                              <span style={{ color: "#15803d", fontWeight: 800, fontSize: 16, display: "block", letterSpacing: "-0.02em" }}>정답입니다!</span>
                              <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 500, marginTop: 3, display: "block", lineHeight: 1.55 }}>
                                {(() => {
                                  const firstSentence = currentQuestion.explanation.match(/^[^.!?]+[.!?]/)?.[0] ?? currentQuestion.explanation;
                                  return firstSentence.length > 60 ? firstSentence.slice(0, 60) + "…" : firstSentence;
                                })()}
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              background: PIQ.bg, border: `1px solid ${PIQ.border}`,
                              borderRadius: PIQ.radius, overflow: "hidden",
                              boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                            }}
                          >
                            <button
                              data-testid="button-explanation-toggle"
                              onClick={() => setExplanationExpanded(prev => !prev)}
                              style={{
                                width: "100%", padding: "14px 18px", minHeight: 48,
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                background: "transparent", border: "none", cursor: "pointer",
                                WebkitTapHighlightColor: "transparent",
                              }}
                              aria-expanded={explanationExpanded}
                              aria-label={explanationExpanded ? "자세한 해설 접기" : "자세한 해설 보기"}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <BookOpen style={{ width: 16, height: 16, color: PIQ.red }} />
                                <span
                                  style={{
                                    fontSize: 14, fontWeight: 700, color: PIQ.dark,
                                    letterSpacing: "-0.01em",
                                  }}
                                >
                                  자세히 보기
                                </span>
                              </span>
                              {explanationExpanded
                                ? <ChevronUp style={{ width: 16, height: 16, color: PIQ.text55 }} />
                                : <ChevronDown style={{ width: 16, height: 16, color: PIQ.text55 }} />}
                            </button>
                            <AnimatePresence initial={false}>
                              {explanationExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22 }}
                                  style={{ overflow: "hidden" }}
                                >
                                  <div
                                    style={{
                                      padding: "16px 20px 20px",
                                      borderTop: `1px solid ${PIQ.border}`,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 10,
                                    }}
                                  >
                                    {splitSentences(currentQuestion.explanation).map((sentence, i) => (
                                      <GlossaryText
                                        key={i}
                                        text={sentence}
                                        className={`text-[15px] font-medium leading-[1.75] tracking-[-0.015em] text-[#374151] ${i === 0 ? "font-semibold text-[#1f2937]" : ""}`}
                                      />
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 12,
                            borderRadius: PIQ.radius, padding: "14px 16px",
                            background: "#fef2f2", border: "2px solid #dc2626",
                          }}
                          role="alert"
                        >
                          <XCircle style={{ width: 22, height: 22, color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <span style={{ color: "#991b1b", fontWeight: 800, fontSize: 16, display: "block", letterSpacing: "-0.02em" }}>오답입니다</span>
                            <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 500, marginTop: 3, display: "block", lineHeight: 1.55 }}>
                              정답과 해설은 모든 문제 완료 후 확인할 수 있어요.
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Next button */}
                {state.isAnswered && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid="button-next-question"
                    onClick={nextQuestion}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: PIQ.radius,
                      background: PIQ.red, color: "#fff", fontWeight: 700, fontSize: 14,
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 2px 12px rgba(186,12,25,0.25)",
                    }}
                    aria-label={state.currentIndex + 1 >= state.questions.length ? "결과 보기" : "다음 문제로 이동"}
                  >
                    {state.currentIndex + 1 >= state.questions.length ? (
                      <><Trophy style={{ width: 18, height: 18 }} />결과 보기</>
                    ) : (
                      <>다음 문제<ChevronRight style={{ width: 18, height: 18 }} /></>
                    )}
                  </motion.button>
                )}
              </motion.div>
            </AnimatePresence>
          </GlossaryTrackerProvider>
        )}
      </main>
    </div>
  );
}
