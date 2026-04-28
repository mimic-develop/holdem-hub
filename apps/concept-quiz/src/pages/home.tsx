import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LogIn, LogOut } from "lucide-react";
import { CATEGORIES } from "../lib/categories";
import { getQuestionsByCategory, type Difficulty } from "../lib/quizData";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import bgVideo from "../assets/bg_sdr.mp4";
import mimicLogo from "../assets/mimic-logo.png";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS: Difficulty[] = ["club", "diamond", "heart", "spade"];

const SUIT_META: Record<Difficulty, { sym: string; color: string; bg: string; label: string; diffLabel: string }> = {
  club:    { sym: "♣\uFE0E", color: "#16a34a", bg: "#f0fdf4", label: "클럽", diffLabel: "쉬움" },
  diamond: { sym: "♦\uFE0E", color: "#2563eb", bg: "#eff6ff", label: "다이아몬드", diffLabel: "보통" },
  heart:   { sym: "♥\uFE0E", color: "#dc2626", bg: "#fef2f2", label: "하트", diffLabel: "어려움" },
  spade:   { sym: "♠\uFE0E", color: "#4b5563", bg: "#f3f4f6", label: "스페이드", diffLabel: "매우 어려움" },
};

const SECTION_LABELS: Record<string, string> = {
  basic: "기본 지식",
  math: "수학적 판단",
  practical: "실전 판단",
};

type DeckCard = { suit: Difficulty; rank: string; catIdx: number };

function playTick(ctx: AudioContext) {
  if (ctx.state === "closed") return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => playTick(ctx)).catch(() => {});
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1800;
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.025);
}

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

function triggerHaptic() {
  if (canVibrate) navigator.vibrate(10);
}

const CARD_W = 120;
const CARD_H = 168;
const NUM_CARDS = 13;
const GAP = 50;
const STACK_H = (NUM_CARDS - 1) * GAP + CARD_H;
const FAN_DEG = -12;
const EDGE_PX = 30;

function DeckFace({ card, isActive }: { card: DeckCard; isActive: boolean }) {
  const sm = SUIT_META[card.suit];

  return (
    <div
      className="relative select-none"
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 14,
        background: `linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 100%)`,
        border: `1px solid rgba(255,255,255,0.6)`,
        boxShadow: isActive
          ? `0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)`
          : "0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)",
        fontFamily: "'Nunito', sans-serif",
        overflow: "hidden",
        transition: "box-shadow 0.3s ease, border 0.3s ease, background 0.3s ease",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)`,
          borderRadius: 14,
        }}
      />

      <div className="absolute flex flex-col items-center" style={{ top: 8, left: 10 }}>
        <span className="leading-none" style={{ fontSize: 18, color: sm.color, fontWeight: 800, letterSpacing: "-0.02em", textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
          {card.rank}
        </span>
        <span className="leading-none" style={{ fontSize: 14, color: sm.color, marginTop: 0, textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
          {sm.sym}
        </span>
      </div>

      <div className="absolute flex flex-col items-center rotate-180" style={{ bottom: 8, right: 10 }}>
        <span className="leading-none" style={{ fontSize: 18, color: sm.color, fontWeight: 800, letterSpacing: "-0.02em", textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
          {card.rank}
        </span>
        <span className="leading-none" style={{ fontSize: 14, color: sm.color, marginTop: 0, textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
          {sm.sym}
        </span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="leading-none" style={{ fontSize: 48, color: sm.color, textShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          {sm.sym}
        </span>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 3,
          background: isActive ? sm.color : "transparent",
          borderRadius: "0 0 14px 14px",
          opacity: 0.7,
          transition: "background 0.3s ease",
        }}
      />
    </div>
  );
}

export default function Home() {
  const { isCardUnlocked, isCardCleared, currentStepIndex, cleared } = useProgress();
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const initSuit = SUITS[Math.floor(currentStepIndex / 13)] ?? "club";
  const initRank = currentStepIndex % 13;

  const [activeSuit, setActiveSuit] = useState<Difficulty>(initSuit);
  const [activeRankIdx, setActiveRankIdx] = useState(initRank);

  const scrollRef = useRef<HTMLDivElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<"A" | "B">("A");

  useEffect(() => {
    const elA = videoARef.current;
    const elB = videoBRef.current;
    if (!elA || !elB) return;
    const FADE_MS = 600;
    let fading = false;

    const onTime = () => {
      const current = activeVideo === "A" ? elA : elB;
      if (!current.duration) return;
      const remaining = current.duration - current.currentTime;

      if (remaining <= FADE_MS / 1000 && !fading) {
        fading = true;

        if (activeVideo === "A") {
          elB.currentTime = 0;
          elB.play();
          setActiveVideo("B");
          setTimeout(() => {
            elA.pause();
            elA.currentTime = 0;
            fading = false;
          }, FADE_MS);
        } else {
          elA.currentTime = 0;
          elA.play();
          setActiveVideo("A");
          setTimeout(() => {
            elB.pause();
            elB.currentTime = 0;
            fading = false;
          }, FADE_MS);
        }
      }
    };

    elA.addEventListener("timeupdate", onTime);
    elB.addEventListener("timeupdate", onTime);
    return () => {
      elA.removeEventListener("timeupdate", onTime);
      elB.removeEventListener("timeupdate", onTime);
    };
  });
  const rafRef = useRef<number>(0);
  const scrollLockRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const scrollIdleTimer = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeRankRef = useRef(activeRankIdx);
  activeRankRef.current = activeRankIdx;
  const containerRef = useRef<HTMLDivElement>(null);
  const [padPx, setPadPx] = useState(0);
  const [slidePx, setSlidePx] = useState(135);

  const visibleCards: DeckCard[] = RANKS.map((rank, ri) => ({
    suit: activeSuit,
    rank,
    catIdx: ri,
  }));

  const activeCard = visibleCards[activeRankIdx];
  const aMeta = SUIT_META[activeSuit];
  const aCat = CATEGORIES[activeCard.catIdx];
  const aUnlocked = isCardUnlocked(aCat.slug, activeSuit);
  const aCleared = isCardCleared(aCat.slug, activeSuit);
  const aQuestions = getQuestionsByCategory(aCat.slug);
  const aCount = aQuestions.filter(q => q.difficulty === activeSuit).length;

  const suitIdx = SUITS.indexOf(activeSuit);
  // deckIdx 계산은 추후 사용 예정 — 현재 직접 사용처 없으나 기존 로직 보존
  void suitIdx;

  const totalCleared = cleared.size;
  const progressPct = Math.round((totalCleared / 52) * 100);

  useEffect(() => {
    return () => { audioCtxRef.current?.close(); };
  }, []);

  useEffect(() => {
    const calc = () => {
      const w = containerRef.current?.clientWidth ?? Math.min(430, window.innerWidth);
      setSlidePx(Math.min(135, Math.max(80, w * 0.35)));
    };
    calc();
    const obs = new ResizeObserver(calc);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    document.documentElement.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prev;
      document.documentElement.style.backgroundColor = "";
    };
  }, []);

  const cardTop = useCallback((i: number) => (NUM_CARDS - 1 - i) * GAP, []);

  const updatePad = useCallback(() => {
    const c = scrollRef.current;
    if (!c) return;
    setPadPx(Math.max(0, (c.clientHeight - CARD_H) / 2));
  }, []);

  const scrollTo = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const c = scrollRef.current;
    if (!c) return;
    scrollLockRef.current = true;
    const pad = Math.max(0, (c.clientHeight - CARD_H) / 2);
    const target = pad + cardTop(i) + CARD_H / 2 - c.clientHeight / 2;
    c.scrollTo({ top: Math.max(0, target), behavior });
    setTimeout(() => { scrollLockRef.current = false; }, behavior === "auto" ? 50 : 400);
  }, [cardTop]);

  useEffect(() => {
    updatePad();
    const t = setTimeout(() => scrollTo(activeRankRef.current, "auto"), 16);
    return () => clearTimeout(t);
  }, [activeSuit, scrollTo, updatePad]);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const obs = new ResizeObserver(() => {
      updatePad();
      if (!isUserScrollingRef.current) {
        scrollTo(activeRankRef.current, "auto");
      }
    });
    obs.observe(c);
    return () => obs.disconnect();
  }, [scrollTo, updatePad]);

  const findNearest = useCallback(() => {
    if (scrollLockRef.current) return;
    const c = scrollRef.current;
    if (!c) return;
    const pad = Math.max(0, (c.clientHeight - CARD_H) / 2);
    const center = c.scrollTop + c.clientHeight / 2;
    let best = 0, minD = Infinity;
    for (let i = 0; i < NUM_CARDS; i++) {
      const d = Math.abs(center - (pad + cardTop(i) + CARD_H / 2));
      if (d < minD) { minD = d; best = i; }
    }
    if (best !== activeRankRef.current) {
      triggerHaptic();
      if (!audioCtxRef.current && typeof window !== "undefined" && typeof window.AudioContext !== "undefined") {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current) playTick(audioCtxRef.current);
      setActiveRankIdx(best);
    }
  }, [cardTop]);

  const onScroll = useCallback(() => {
    isUserScrollingRef.current = true;
    clearTimeout(scrollIdleTimer.current);
    scrollIdleTimer.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 200);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(findNearest);
  }, [findNearest]);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      c.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(scrollIdleTimer.current);
    };
  }, [onScroll]);

  const handleSuitChange = (suit: Difficulty) => {
    if (suit === activeSuit) return;
    setActiveSuit(suit);
  };

  return (
    <div
      style={{
        height: "100dvh",
        background: "#ffffff",
        display: "flex",
        justifyContent: "center",
      }}
    >
    <div
      ref={containerRef}
      className="flex flex-col overflow-hidden w-full relative"
      style={{
        maxWidth: 430,
        height: "100%",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <video
        ref={videoARef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0, opacity: 1, transform: "scaleX(-1)" }}
        src={bgVideo}
      />
      <video
        ref={videoBRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 1, opacity: activeVideo === "B" ? 1 : 0, transition: "opacity 0.6s ease", transform: "scaleX(-1)" }}
        src={bgVideo}
      />

      <header
        className="flex-shrink-0 z-30"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="px-4 pt-2 pb-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <img
                src={mimicLogo}
                alt="MIMIC"
                style={{ height: 18 }}
                data-testid="logo-mimic"
              />
              <span
                className="font-bold text-[13px] tracking-tight"
                style={{ color: "#1a1a2e", fontFamily: "'Nunito', sans-serif" }}
              >
                Poker IQ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-1">
                <span style={{ color: aMeta.color, fontSize: 13 }}>{aMeta.sym}</span>
                <span className="text-[11px] font-semibold" style={{ color: "#1a1a2e" }}>
                  {aCat.label}
                </span>
              </div>
              {!authLoading && (
                user ? (
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5"
                    style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}
                    data-testid="btn-logout"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-500">
                          {(user.displayName || "U")[0]}
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] font-semibold max-w-[60px] truncate" style={{ color: "rgba(0,0,0,0.55)" }}>
                      {user.displayName || "사용자"}
                    </span>
                    <LogOut className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(0,0,0,0.4)" }} />
                  </button>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}
                    data-testid="btn-login"
                  >
                    <LogIn className="w-3.5 h-3.5" style={{ color: "rgba(0,0,0,0.5)" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "rgba(0,0,0,0.5)" }}>로그인</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 4, background: "rgba(0,0,0,0.06)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "#E5343A" }}
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "rgba(0,0,0,0.35)" }}>
              {totalCleared}/52
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden z-10">
        <div
          className="absolute left-0 top-0 bottom-0 z-20 flex"
          style={{
            width: "calc(100% - 100px)",
            maxWidth: "70%",
            pointerEvents: "none",
          }}
        >
          <div className="px-5 w-full flex flex-col justify-start h-full pt-5">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${activeCard.catIdx}-${activeSuit}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col"
                style={{ pointerEvents: "auto" }}
              >
                <span
                  className="text-[12px] font-extrabold tracking-wider mb-1"
                  style={{ color: aMeta.color }}
                >
                  {aMeta.sym} {aMeta.diffLabel}
                </span>

                <span
                  className="font-black leading-tight mb-1 block"
                  style={{ fontSize: 26, wordBreak: "keep-all", color: "#1a1a2e" }}
                  data-testid="active-category-title"
                >
                  {aCat.label}
                </span>

                <span className="text-[13px] mb-1.5 block font-medium" style={{ color: "rgba(0,0,0,0.5)" }}>
                  {aCat.subtitle}
                </span>

                <span
                  className="text-[11px] font-bold tracking-wide mb-3 block"
                  style={{ color: aMeta.color }}
                >
                  {SECTION_LABELS[aCat.sectionId] ?? ""} · {aCount}문제
                </span>

                {aUnlocked ? (
                  <motion.button
                    data-testid="btn-start-quiz"
                    onClick={() => {
                      if (!user) {
                        signInWithGoogle().then(() => {
                          navigate(`/quiz/${aCat.slug}?difficulty=${activeSuit}`);
                        }).catch(() => {
                          toast({ title: "로그인이 취소되었습니다", variant: "destructive" });
                        });
                        return;
                      }
                      navigate(`/quiz/${aCat.slug}?difficulty=${activeSuit}`);
                    }}
                    className="self-start px-6 py-2.5 rounded-xl font-bold text-white text-sm"
                    style={{
                      background: aMeta.color,
                      boxShadow: `0 2px 12px ${aMeta.color}40`,
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {aCleared ? "다시 풀기" : "시작"}
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4" style={{ color: "rgba(0,0,0,0.3)" }} />
                    <span className="text-[12px] font-medium" style={{ color: "rgba(0,0,0,0.35)" }}>
                      이전 단계를 클리어하세요
                    </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="h-full overflow-y-auto relative z-10"
          style={{ scrollbarWidth: "none", overflowX: "hidden" }}
          data-testid="scroll-container"
        >
          <div style={{ height: padPx }} aria-hidden />
          <div
            className="relative"
            style={{ height: STACK_H }}
          >
            {visibleCards.map((card, i) => {
              const top = cardTop(i);
              const cat = CATEGORIES[card.catIdx];
              const unlocked = isCardUnlocked(cat.slug, card.suit);
              const isActive = i === activeRankIdx;
              const zBase = NUM_CARDS - i;
              const sm = SUIT_META[card.suit];
              void sm; // SUIT_META 참조 보존

              return (
                <div
                  key={`${card.suit}-${card.rank}`}
                  className="absolute"
                  style={{
                    top,
                    right: -(CARD_W - EDGE_PX),
                    zIndex: isActive ? 200 : zBase,
                  }}
                  data-testid={`card-${card.suit}-${card.rank}`}
                >
                  <motion.div
                    animate={{
                      x: isActive ? -slidePx : 0,
                      rotate: isActive ? FAN_DEG : 0,
                    }}
                    style={{ transformOrigin: "50% 100%", cursor: "pointer" }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    onClick={() => {
                      if (isActive && unlocked) {
                        if (!user) {
                          signInWithGoogle().then(() => {
                            navigate(`/quiz/${cat.slug}?difficulty=${card.suit}`);
                          }).catch(() => {
                            toast({ title: "로그인이 취소되었습니다", variant: "destructive" });
                          });
                          return;
                        }
                        navigate(`/quiz/${cat.slug}?difficulty=${card.suit}`);
                      } else if (i !== activeRankIdx) {
                        triggerHaptic();
                        if (!audioCtxRef.current && typeof window !== "undefined" && typeof window.AudioContext !== "undefined") {
                          audioCtxRef.current = new AudioContext();
                        }
                        if (audioCtxRef.current) playTick(audioCtxRef.current);
                        setActiveRankIdx(i);
                        scrollTo(i);
                      }
                    }}
                    data-testid={unlocked ? `card-link-${card.suit}-${card.rank}` : `card-locked-${card.suit}-${card.rank}`}
                  >
                    <div style={{
                      opacity: unlocked ? 1 : 0.45,
                      transition: "opacity 0.3s ease",
                    }}>
                      <DeckFace card={card} isActive={isActive} />
                    </div>

                    {!unlocked && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ borderRadius: 14, background: "rgba(0,0,0,0.15)" }}
                      >
                        <Lock className="w-8 h-8" style={{ color: "rgba(255,255,255,0.7)" }} />
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
          <div style={{ height: padPx }} aria-hidden />
        </div>
      </div>

      <div
        className="flex-shrink-0 z-30"
        style={{
          background: "#ffffff",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="px-3 py-3">
          <div className="flex items-stretch justify-center gap-2" data-testid="suit-tabs">
            {SUITS.map((suit) => {
              const sm = SUIT_META[suit];
              const isActive = activeSuit === suit;
              const clearedInSuit = CATEGORIES.filter(c => isCardCleared(c.slug, suit)).length;
              return (
                <button
                  key={suit}
                  onClick={() => handleSuitChange(suit)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all"
                  style={{
                    color: isActive ? sm.color : "rgba(0,0,0,0.3)",
                    background: isActive ? `${sm.color}10` : "transparent",
                    fontWeight: isActive ? 700 : 500,
                    border: isActive ? `2px solid ${sm.color}30` : "2px solid transparent",
                  }}
                  data-testid={`suit-tab-${suit}`}
                >
                  <span style={{ fontSize: 20 }}>{sm.sym}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.02em" }}>
                    {sm.diffLabel}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>
                    {clearedInSuit}/13
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
