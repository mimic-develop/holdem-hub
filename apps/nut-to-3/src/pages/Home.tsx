import React, { useState, useEffect } from "react";
import {
  RotateCcw, Crown, Medal, Award, CheckCircle2, XCircle,
  Loader2, ChevronRight, AlertTriangle, Flame, Info, X, Timer,
  Download, Trophy, BookOpen, Share2
} from "lucide-react";
import mimicLogoFull from "../assets/mimic-logo.png";
import crownBg from "../assets/crown-bg.mp4";
import { useGameState, useNewGame } from "../hooks/use-game";
import { useToast } from "../hooks/use-toast";
import { PlayingCard } from "../components/PlayingCard";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { NutTier } from "../lib/api-schema";

interface RunStats {
  streetsPlayed: number;
  streetResults: (boolean[] | null)[];
  slotsByStreet: string[][][];
  finalStreak: number;
  bestStreak: number;
  completedAll: boolean;
  timedOut: boolean;
}

const HAND_RANKINGS = [
  {
    name: "스트레이트 플러시",
    desc: "같은 무늬의 연속된 5장 (예: A♠K♠Q♠J♠T♠ = 로열 플러시)",
    rule: null,
    tag: null,
    highlight: false,
  },
  {
    name: "포카드",
    desc: "같은 숫자 4장 (예: A♠A♥A♦A♣)",
    rule: "⚠️ 이 게임의 규칙: 원핸드 포카드(보드에 트립 있어 홀카드 1장으로 포카드 완성)가 너트인 경우, 이후 포카드 핸드들은 건너뜁니다. 포카드 다음 순위는 다음 비-포카드 족보(풀하우스 등)가 됩니다.",
    tag: "특수 룰",
    highlight: true,
  },
  {
    name: "풀하우스",
    desc: "트리플 + 원페어 (예: A♠A♥A♦K♠K♥)",
    rule: null,
    tag: null,
    highlight: false,
  },
  {
    name: "플러시",
    desc: "같은 무늬 5장 (예: A♠K♠9♠6♠2♠)",
    rule: "⚠️ 이 게임의 규칙: 플러시가 너트(또는 2nd)인 경우, 바로 아래의 플러시 핸드들은 건너뜁니다. 플러시 다음 순위는 다음 비-플러시 족보(스트레이트·트리플 등)가 됩니다.",
    tag: "특수 룰",
    highlight: true,
  },
  {
    name: "스트레이트",
    desc: "숫자가 연속된 5장 서로 다른 무늬 (예: A♠K♥Q♦J♣T♠)",
    rule: null,
    tag: null,
    highlight: false,
  },
  {
    name: "트리플",
    desc: "같은 숫자 3장 (예: A♠A♥A♦)",
    rule: null,
    tag: null,
    highlight: false,
  },
  {
    name: "투페어",
    desc: "페어 두 쌍 (예: A♠A♥K♦K♣)",
    rule: null,
    tag: null,
    highlight: false,
  },
  {
    name: "원페어",
    desc: "같은 숫자 2장 (예: A♠A♥)",
    rule: null,
    tag: null,
    highlight: false,
  },
  {
    name: "하이카드",
    desc: "위 족보에 해당하지 않는 경우 (가장 높은 카드가 기준)",
    rule: null,
    tag: null,
    highlight: false,
  },
];

const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS = ["s","h","d","c"] as const;

const SUIT_SYMBOLS: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

const SLOT_CONFIG = [
  { label: "Nut",  Icon: Crown, color: "text-yellow-500", borderActive: "border-yellow-500", bg: "bg-yellow-500/10" },
  { label: "2nd",  Icon: Medal, color: "text-indigo-500", borderActive: "border-indigo-500", bg: "bg-indigo-500/10" },
  { label: "3rd",  Icon: Award, color: "text-teal-600",   borderActive: "border-teal-600",   bg: "bg-teal-600/10"  },
] as const;

const STREET_LABELS = ["플랍", "턴", "리버"];
// 일부러 number로 풀어줌 — `as const` 시 useState가 첫 인덱스 리터럴(18)로 좁혀져
// 이후 STREET_TIMERS[1] 같은 값을 setState에 넘길 때 타입 에러 발생.
const STREET_TIMERS: readonly number[] = [18, 20, 22];

function displayRank(r: string | null | undefined) {
  if (!r) return "?";
  return r === "T" ? "10" : r;
}

function checkSlotAnswer(cards: string[], tier: NutTier): boolean {
  if (tier.isBoardPlay) return true;
  if (cards.length === 0) return false;
  const [c1, c2] = cards;
  if (tier.validSingleCards.includes(c1) || (c2 && tier.validSingleCards.includes(c2))) return true;
  if (cards.length < 2) return false;
  return tier.validCombos.some(([a, b]) =>
    (a === c1 && b === c2) || (a === c2 && b === c1)
  );
}

function triggerConfetti() {
  const end = Date.now() + 2500;
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 50, origin: { x: 0 }, colors: ["#e82222","#f59e0b","#22c55e","#3b82f6","#a855f7","#ffffff"] });
    confetti({ particleCount: 4, angle: 120, spread: 50, origin: { x: 1 }, colors: ["#e82222","#f59e0b","#22c55e","#3b82f6","#a855f7","#ffffff"] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateShareCard(params: {
  finalStreak: number;
  bestStreak: number;
  logoUrl: string;
}): Promise<Blob> {
  const { finalStreak, bestStreak, logoUrl } = params;

  // Canvas dimensions — fixed, not cumulative
  const W = 600;
  const H = 420;
  const DPR = 2;
  const PAD = 40;

  // Zone boundaries (absolute y)
  const HEADER_TOP = 6;       // below red bar
  const HEADER_BOT = 68;      // header zone bottom
  const HERO_TOP   = 68;
  const FOOTER_TOP = 310;

  const HEADER_MID = (HEADER_TOP + HEADER_BOT) / 2;  // 37

  // Vertical anchors inside hero zone (absolute)
  const NUM_Y   = HERO_TOP + 110;   // 178 — number baseline-middle
  const LABEL_Y = NUM_Y + 73;       // 251 — "연속 스트릭" baseline-middle
  const BADGE_Y = LABEL_Y + 38;     // 289 — badge baseline-middle

  // Footer text anchors
  const CTA1_Y = FOOTER_TOP + 36;   // 346
  const CTA2_Y = FOOTER_TOP + 72;   // 382

  const canvas = document.createElement("canvas");
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);

  // ── Background ────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── Top red accent bar ────────────────────────────────────────────────
  ctx.fillStyle = "#e82222";
  ctx.fillRect(0, 0, W, HEADER_TOP);

  // ── Load logo ─────────────────────────────────────────────────────────
  const logo = await new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });

  // ── Zone 1: Header ────────────────────────────────────────────────────
  ctx.textBaseline = "middle";

  if (logo) {
    const SZ = 28;
    ctx.save();
    rrect(ctx, PAD, HEADER_MID - SZ / 2, SZ, SZ, 6);
    ctx.clip();
    ctx.drawImage(logo, PAD, HEADER_MID - SZ / 2, SZ, SZ);
    ctx.restore();
  }

  ctx.fillStyle = "#111827";
  ctx.font = "bold 16px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("NUT TO 3", PAD + (logo ? 38 : 0), HEADER_MID);

  ctx.fillStyle = "#9ca3af";
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("by MIMIC", W - PAD, HEADER_MID);

  // ── Divider: header / hero ────────────────────────────────────────────
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, HEADER_BOT);
  ctx.lineTo(W - PAD, HEADER_BOT);
  ctx.stroke();

  // ── Zone 2: Hero ──────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Streak number
  ctx.fillStyle = "#e82222";
  ctx.font = "bold 120px -apple-system, system-ui, sans-serif";
  ctx.fillText(`${finalStreak}`, W / 2, NUM_Y);

  // "연속 스트릭" label
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 20px -apple-system, system-ui, sans-serif";
  ctx.fillText("연속 스트릭", W / 2, LABEL_Y);

  // Best-streak badge (conditional, no emoji to avoid alignment issues)
  if (finalStreak > 0 && finalStreak >= bestStreak && bestStreak > 0) {
    ctx.fillStyle = "#f97316";
    ctx.font = "bold 13px -apple-system, system-ui, sans-serif";
    ctx.fillText("★  최고 기록 달성!  ★", W / 2, BADGE_Y);
  }

  // ── Divider: hero / footer ────────────────────────────────────────────
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, FOOTER_TOP);
  ctx.lineTo(W - PAD, FOOTER_TOP);
  ctx.stroke();

  // ── Zone 3: Footer ────────────────────────────────────────────────────
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  ctx.fillStyle = "#9ca3af";
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  ctx.fillText("가능한 최강 핸드 3개 찾기", W / 2, CTA1_Y);

  ctx.fillStyle = "#e82222";
  ctx.font = "bold 14px -apple-system, system-ui, sans-serif";
  ctx.fillText("NUT TO 3에 도전해보세요 →", W / 2, CTA2_Y);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), "image/png");
  });
}

export default function Home() {
  // Persistent across games
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [recentNutTypes, setRecentNutTypes] = useState<string[]>([]);

  const { data: game, isLoading, error } = useGameState(recentNutTypes);
  const requestNewGame = useNewGame();
  const { toast } = useToast();
  const [showInfo, setShowInfo] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [appPhase, setAppPhase] = useState<"intro" | "playing" | "results">("intro");
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Per-game
  const [streetIndex, setStreetIndex] = useState(0);
  const [phase, setPhase] = useState<"selecting" | "submitted">("selecting");
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(0);
  const [slotCards, setSlotCards] = useState<[string[], string[], string[]]>([[], [], []]);
  const [streetResults, setStreetResults] = useState<(boolean[] | null)[]>([null, null, null]);
  const [savedSlotsByStreet, setSavedSlotsByStreet] = useState<string[][][]>([[], [], []]);
  const [timeLeft, setTimeLeft] = useState(STREET_TIMERS[0]);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (game) resetGame();
  }, [game]);

  function resetGame() {
    setStreetIndex(0);
    setPhase("selecting");
    setActiveSlot(0);
    setSlotCards([[], [], []]);
    setStreetResults([null, null, null]);
    setSavedSlotsByStreet([[], [], []]);
    setTimeLeft(STREET_TIMERS[0]);
    setTimedOut(false);
  }

  function resetStreet(newStreetIdx?: number) {
    setPhase("selecting");
    setActiveSlot(0);
    setSlotCards([[], [], []]);
    setTimeLeft(STREET_TIMERS[newStreetIdx ?? streetIndex]);
    setTimedOut(false);
  }

  // Timer countdown — must be before early returns (Rules of Hooks)
  useEffect(() => {
    if (appPhase !== "playing") return;
    if (phase !== "selecting") return;
    if (timeLeft <= 0) {
      const failResults: [boolean, boolean, boolean] = [false, false, false];
      const newStreetResults = [...streetResults];
      newStreetResults[streetIndex] = failResults;
      setStreetResults(newStreetResults);
      const prevStreak = streak;
      setStreak(0);
      setTimedOut(true);
      setPhase("submitted");
      if (streetIndex === 2) {
        setRunStats({
          streetsPlayed: 2,
          streetResults: newStreetResults,
          slotsByStreet: savedSlotsByStreet,
          finalStreak: prevStreak,
          bestStreak,
          completedAll: true,
          timedOut: true,
        });
        setAppPhase("results");
      }
      return;
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft, streetIndex, appPhase]);

  // ── INTRO SCREEN ──
  if (appPhase === "intro") {
    return (
      <div style={{ position: 'fixed', top: '52px', left: 0, right: 0, bottom: 0, background: '#080818', overflow: 'hidden', zIndex: 1 }}>
        {/* Crown background video — 430px 컬럼 기준 */}
        <video
          autoPlay muted playsInline loop
          style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '430px', height: '100%', zIndex: 0,
            objectFit: 'cover', objectPosition: 'center top',
            pointerEvents: 'none',
          }}
          src={crownBg}
        />
        {/* 배경 오버레이 — 명도 조절 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'rgba(8,8,24,0.45)',
          pointerEvents: 'none',
        }} />

        {/* 430px 센터 컨테이너 */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '430px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%', paddingTop: 'clamp(20px, 9vh, 64px)' }}>

          {/* HERO */}
          <div style={{ position: 'relative', padding: '20px 20px 24px', overflow: 'hidden', borderBottom: '1px solid rgba(212,175,55,0.2)', textAlign: 'center' }}>
            {/* 텍스트 가독성 오버레이 */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(to bottom, rgba(8,8,24,0.72) 0%, rgba(8,8,24,0.45) 60%, rgba(8,8,24,0.72) 100%)',
            }} />
            {/* Gold glow */}
            <div style={{
              position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
              width: '320px', height: '160px', borderRadius: '50%',
              background: 'rgba(212,175,55,0.18)', filter: 'blur(60px)', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: '9px', letterSpacing: '0.4em', color: 'rgba(212,175,55,0.8)', textTransform: 'uppercase', marginBottom: '14px' }}>
                Board Reading · Speed Challenge
              </div>
              <div style={{ fontSize: 'clamp(40px, 10vw, 52px)', fontWeight: 700, color: '#FFFCF3', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '12px' }}>
                NUT <span style={{ color: '#D4AF37' }}>TO</span> 3
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,252,243,0.65)', letterSpacing: '0.08em', fontStyle: 'italic' }}>
                "가능한 최강 핸드 3개를 가장 빠르게"
              </div>
            </div>
          </div>

          {/* MY STATS BAR */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'rgba(255,252,243,0.75)', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
              내 기록
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid rgba(212,175,55,0.6)', background: 'rgba(8,8,24,0.75)', marginBottom: '12px' }}>
              <div style={{ padding: '14px 8px', textAlign: 'center', borderRight: '1px solid rgba(212,175,55,0.35)' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,252,243,0.75)', textTransform: 'uppercase', marginBottom: '6px' }}>현재 스트릭</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#F5C842' }}>{streak}</div>
              </div>
              <div style={{ padding: '14px 8px', textAlign: 'center', borderRight: '1px solid rgba(212,175,55,0.35)' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,252,243,0.75)', textTransform: 'uppercase', marginBottom: '6px' }}>최고 스트릭</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#F5C842' }}>{bestStreak}</div>
              </div>
              <div style={{ padding: '14px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,252,243,0.75)', textTransform: 'uppercase', marginBottom: '6px' }}>제한 시간</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#F5C842' }}>18-22s</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <button
              data-testid="button-start-game"
              onClick={() => setAppPhase("playing")}
              style={{
                width: '100%', minHeight: '52px', background: '#D4AF37', color: '#080818',
                fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', padding: '14px 20px', border: 'none',
                cursor: 'pointer',
              }}
            >
              게임 스타트 →
            </button>
            <button
              data-testid="button-info-intro"
              onClick={() => setShowInfo(true)}
              style={{
                width: '100%', minHeight: '52px', background: 'transparent', color: 'rgba(255,252,243,0.65)',
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                padding: '13px 20px', border: '1px solid rgba(212,175,55,0.25)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              게임 방법 · 족보 순위 확인
              <span style={{ fontSize: '8px', padding: '2px 7px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)', letterSpacing: '0.1em' }}>
                특수 룰 포함
              </span>
            </button>
          </div>

          {isLoading && (
            <p className="text-center text-xs text-muted-foreground pb-3 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              게임 데이터 준비 중...
            </p>
          )}

        </div>{/* end 430px container */}

        {/* Info modal (족보) — reused from playing screen */}
        <AnimatePresence>
          {showInfo && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setShowInfo(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-w-[430px] bg-background border-t border-gray-200 rounded-t-2xl px-4 pt-4 pb-10 overflow-y-auto max-h-[85vh]"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-base">족보 순위</h2>
                  <button
                    data-testid="button-close-info"
                    onClick={() => setShowInfo(false)}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {HAND_RANKINGS.map((hand, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-3 rounded-xl px-3 py-2.5 border",
                        hand.highlight
                          ? "bg-amber-50 border-amber-300"
                          : "bg-card border-gray-100"
                      )}
                    >
                      <span className="text-muted-foreground text-xs font-mono w-5 shrink-0 mt-0.5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("font-bold text-sm", hand.highlight && "text-amber-700")}>{hand.name}</span>
                          {hand.tag && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold shrink-0">
                              {hand.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hand.desc}</p>
                        {hand.rule && (
                          <p className="text-[11px] text-amber-700/80 mt-1.5 leading-snug border-t border-amber-200 pt-1.5">
                            {hand.rule}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-white/60 font-display tracking-widest uppercase text-sm">Shuffling Deck...</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-display font-bold">오류 발생</h2>
        <button onClick={() => requestNewGame(recentNutTypes)}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold">다시 시도</button>
      </div>
    );
  }

  const currentStreet = game.streets?.[streetIndex];
  if (!currentStreet) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>;
  }

  const currentBoard = currentStreet.board;
  const boardSet = new Set(currentBoard);

  // ── SHARED HANDLERS (used in both submitted-failure and results screens) ──
  // Use runStats.finalStreak when available (preserves pre-failure streak after setStreak(0))
  const effectiveShareStreak = runStats?.finalStreak ?? streak;

  async function handleShare() {
    const shareText = effectiveShareStreak > 0
      ? `🔥 ${effectiveShareStreak}연속 스트릭 달성! NUT TO 3에 도전해보세요`
      : "가능한 최강 핸드 3개 찾기 — NUT TO 3에 도전해보세요";
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "NUT TO 3", text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ description: "링크가 클립보드에 복사되었습니다" });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({ description: "링크가 클립보드에 복사되었습니다" });
        } catch {
          toast({ description: "공유에 실패했습니다", variant: "destructive" });
        }
      }
    }
  }

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const blob = await generateShareCard({ finalStreak: effectiveShareStreak, bestStreak: runStats?.bestStreak ?? bestStreak, logoUrl: mimicLogoFull });
      downloadBlob(blob, "nut-to-3.png");
    } finally {
      setIsDownloading(false);
    }
  }

  // ── RESULTS PAGE (completed all 3 streets) ──
  if (appPhase === "results" && runStats) {
    const { streetResults: rs, slotsByStreet, finalStreak, bestStreak: bs } = runStats;
    const totalCorrect = rs.reduce((sum, r) => sum + (r ? r.filter(Boolean).length : 0), 0);
    const totalPossible = 9;

    function handleRestart() {
      if (game) {
        const riverNut = game.streets[2]?.tiers[0]?.koreanDescr;
        if (riverNut) {
          const next = [...recentNutTypes, riverNut].slice(-2);
          setRecentNutTypes(next);
          resetGame();
          requestNewGame(next);
        } else {
          resetGame();
          requestNewGame(recentNutTypes);
        }
      }
      setAppPhase("playing");
    }

    return (
      <div className="min-h-screen px-4 pb-10 flex flex-col" style={{ maxWidth: '430px', margin: '0 auto' }}>
        <div className="flex flex-col gap-4 pt-8 pb-4">

          {/* Branding row */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border border-white/20 shadow-sm flex items-center justify-center">
              <img src={mimicLogoFull} alt="MIMIC" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">NUT TO 3</span>
          </div>

          {/* Title section */}
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="font-display font-bold text-4xl text-emerald-600">완주!</span>
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-white/60 text-sm mt-1">
              {totalCorrect === totalPossible ? "플랍·턴·리버 모두 완벽 정답" : `총 ${totalCorrect}/${totalPossible} 정답`}
            </p>
            {finalStreak > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="font-bold text-sm text-orange-500">{finalStreak}연속 정답!</span>
                {bs > 0 && finalStreak === bs && (
                  <span className="text-xs text-amber-600 font-bold">🏆 최고 기록</span>
                )}
              </div>
            )}
          </div>

          {/* A안: 3×3 스코어카드 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {/* 헤더 행 */}
            <div className="grid grid-cols-4 bg-white/8 border-b border-white/10">
              <div className="p-2.5" />
              {SLOT_CONFIG.map(cfg => {
                const Icon = cfg.Icon;
                return (
                  <div key={cfg.label} className="p-2.5 flex flex-col items-center justify-center border-l border-white/10 gap-0.5">
                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    <span className="text-[9px] font-bold text-white/50">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
            {/* 스트리트 행 */}
            {STREET_LABELS.map((label, si) => {
              const r = rs[si];
              const correctInRow = r?.filter(Boolean).length ?? 0;
              const summaryLabel = correctInRow === 3 ? "완벽" : correctInRow === 2 ? "2정답" : correctInRow === 1 ? "1정답" : "아웃";
              const summaryColor = correctInRow === 3 ? "text-green-600" : correctInRow === 2 ? "text-amber-500" : correctInRow === 1 ? "text-orange-500" : "text-red-400";
              return (
                <div key={label} className={cn("grid grid-cols-4", si < 2 && "border-b border-white/10")}>
                  <div className="p-2.5 flex flex-col justify-center gap-0.5">
                    <span className="text-xs font-display font-bold text-white">{label}</span>
                    <span className={cn("text-[9px] font-bold", summaryColor)}>{summaryLabel}</span>
                  </div>
                  {SLOT_CONFIG.map((_, slotIdx) => {
                    const ok = r?.[slotIdx] ?? false;
                    return (
                      <div key={slotIdx} className={cn(
                        "p-2.5 flex items-center justify-center border-l border-white/10",
                        ok ? "bg-green-500/5" : "bg-red-500/5"
                      )}>
                        <div className={cn("w-3 h-3 rounded-full", ok ? "bg-green-500" : "bg-red-400")} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Streak row */}
          {(finalStreak > 0 || bs > 0) && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className={cn("w-5 h-5", finalStreak > 0 ? "text-orange-500" : "text-white/50")} />
                <div>
                  <div className="text-[10px] text-white/50 font-semibold">이번 스트릭</div>
                  <div className={cn("font-display font-bold text-xl", finalStreak > 0 ? "text-orange-500" : "text-white/50")}>
                    {finalStreak}연속
                  </div>
                </div>
              </div>
              {bs > 0 && (
                <div className="text-right">
                  <div className="text-[10px] text-white/50 font-semibold">최고 기록</div>
                  <div className="font-display font-bold text-xl text-amber-600">{bs}연속</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex gap-2">
            <button
              data-testid="button-share"
              onClick={handleShare}
              disabled={isDownloading}
              className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-display font-bold text-sm hover:text-white hover:border-white/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              공유하기
            </button>
            <button
              data-testid="button-download"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-display font-bold text-sm hover:text-white hover:border-white/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              이미지 저장
            </button>
          </div>
          <button
            data-testid="button-review"
            onClick={() => setShowReview(true)}
            className="w-full py-3 rounded-2xl bg-amber-400/15 border border-amber-400/50 text-amber-600 font-display font-bold text-sm hover:bg-amber-400/25 hover:border-amber-400/70 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            게임 리뷰
          </button>
          <button
            data-testid="button-restart"
            onClick={handleRestart}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-base shadow-xl shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            다시하기
          </button>
        </div>

        {/* 게임 리뷰 Modal (C안) */}
        <AnimatePresence>
          {showReview && game && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setShowReview(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-w-[430px] bg-[#080818] border-t border-white/10 rounded-t-2xl px-4 pt-4 pb-10 overflow-y-auto max-h-[90vh]"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-bold text-base text-white">게임 리뷰</h2>
                  <button
                    data-testid="button-close-review"
                    onClick={() => setShowReview(false)}
                    className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 스트리트별 리뷰 */}
                {STREET_LABELS.map((label, si) => {
                  const street = game.streets[si];
                  const r = rs[si];
                  if (!street) return null;
                  return (
                    <div key={si} className="mb-5">
                      {/* 스트리트 라벨 + 보드 카드 */}
                      <div className="text-[10px] font-display font-bold text-white/50 uppercase tracking-widest mb-2">
                        {label} 보드
                      </div>
                      <div className="flex gap-1 mb-3 flex-wrap">
                        {street.board.map((c, i) => (
                          <PlayingCard key={i} card={c} size="sm" />
                        ))}
                      </div>

                      {/* 슬롯 3개 */}
                      <div className="flex flex-col gap-2">
                        {SLOT_CONFIG.map((cfg, slotIdx) => {
                          const Icon = cfg.Icon;
                          const ok = r?.[slotIdx] ?? false;
                          const tier = street.tiers[slotIdx];
                          const userCards = slotsByStreet[si]?.[slotIdx] ?? [];
                          return (
                            <div
                              key={slotIdx}
                              className={cn(
                                "flex flex-col rounded-xl border",
                                ok ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                              )}
                            >
                              {/* 첫 줄: 아이콘+라벨, 내 카드, ✓/✗, 족보명 */}
                              <div className="flex items-center gap-2 p-2.5">
                                {/* 슬롯 아이콘 + 라벨 */}
                                <div className="flex items-center gap-1 w-14 shrink-0">
                                  <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.color)} />
                                  <span className="text-[10px] font-bold text-white">{cfg.label}</span>
                                </div>

                                {/* 내가 선택한 카드 */}
                                <div className="flex gap-0.5">
                                  {userCards.length > 0
                                    ? userCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
                                    : <span className="text-[10px] text-white/30 italic">미입력</span>
                                  }
                                </div>

                                {/* 정답/오답 아이콘 */}
                                {ok
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                  : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                }

                                {/* 족보명 */}
                                {tier && (
                                  <span className="text-[10px] text-white/50 ml-auto truncate">{tier.koreanDescr}</span>
                                )}
                              </div>

                              {/* 둘째 줄: 틀렸을 때만 — 정답예시 카드 (전체 너비, 충분한 공간) */}
                              {!ok && tier && (
                                <div className="flex items-center gap-2 px-2.5 pb-2.5">
                                  <div className="w-14 shrink-0" />
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-white/50">정답 예시 · {tier.koreanDescr}</span>
                                    <div className="flex gap-0.5">
                                      {tier.exampleCards.map((c, i) => (
                                        <PlayingCard key={i} card={c} size="sm" noAnimation />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {si < 2 && <div className="border-b border-white/10 mt-4" />}
                    </div>
                  );
                })}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  function handlePickCard(card: string) {
    if (phase === "submitted") return;
    if (boardSet.has(card)) return;
    const currentSlot = slotCards[activeSlot];
    if (currentSlot.length >= 2) return;
    if (currentSlot.includes(card)) return;
    const newSlot = [...currentSlot, card];
    const updated = slotCards.map((s, i) =>
      i === activeSlot ? newSlot : s
    ) as [string[], string[], string[]];
    setSlotCards(updated);
    if (newSlot.length >= 2) {
      const next = [0, 1, 2].find(idx => idx !== activeSlot && updated[idx].length < 2);
      if (next !== undefined) setActiveSlot(next as 0 | 1 | 2);
    }
  }

  function handleRemoveCard(slotIdx: number, cardIdx: number) {
    if (phase === "submitted") return;
    const updated = slotCards.map((s, i) =>
      i === slotIdx ? s.filter((_, ci) => ci !== cardIdx) : s
    ) as [string[], string[], string[]];
    setSlotCards(updated);
    setActiveSlot(slotIdx as 0 | 1 | 2);
  }

  function handleActivateSlot(idx: 0 | 1 | 2) {
    if (phase === "submitted") return;
    setActiveSlot(idx);
  }

  const allReady = slotCards.every(s => s.length >= 2);

  function handleSubmit() {
    if (!allReady || phase === "submitted") return;

    const tiers = currentStreet.tiers;
    const results = slotCards.map((cards, idx) =>
      checkSlotAnswer(cards, tiers[idx])
    ) as boolean[];

    const allCorrect = results.every(Boolean);
    const isRiver = streetIndex === 2;

    const newSavedSlots = [...savedSlotsByStreet] as string[][][];
    newSavedSlots[streetIndex] = slotCards.map(s => [...s]);
    setSavedSlotsByStreet(newSavedSlots);

    const newStreetResults = [...streetResults];
    newStreetResults[streetIndex] = results;
    setStreetResults(newStreetResults);
    setPhase("submitted");

    let newStreak = streak;
    let newBest = bestStreak;
    if (allCorrect) {
      newStreak = streak + 1;
      newBest = Math.max(bestStreak, newStreak);
      setStreak(newStreak);
      setBestStreak(newBest);
    } else {
      newStreak = 0;
      setStreak(0);
    }

    if (isRiver) {
      if (allCorrect) triggerConfetti();
      setRunStats({
        streetsPlayed: 2,
        streetResults: newStreetResults,
        slotsByStreet: newSavedSlots,
        finalStreak: newStreak,
        bestStreak: newBest,
        completedAll: true,
        timedOut: false,
      });
      setAppPhase("results");
    }
  }

  function handleNextStreet() {
    if (streetIndex < 2) {
      setStreetIndex(i => i + 1);
      resetStreet(streetIndex + 1);
    }
  }

  const currentResults = streetResults[streetIndex];
  const correctCount = currentResults ? currentResults.filter(Boolean).length : 0;

  return (
    <div className="min-h-screen px-3 pb-6 flex flex-col" style={{ maxWidth: '430px', margin: '0 auto' }}>
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-md shrink-0">
            <img src={mimicLogoFull} alt="MIMIC" className="w-9 h-9 object-contain" />
          </div>
          <span className="font-display font-bold text-xl leading-none tracking-tight text-white">NUT TO 3</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Street pills */}
          <div className="flex gap-1">
            {STREET_LABELS.map((label, i) => (
              <div key={label} className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold font-display transition-all",
                i < streetIndex && "bg-emerald-500/25 text-emerald-600",
                i === streetIndex && "bg-primary text-primary-foreground",
                i > streetIndex && "bg-white/8 text-white/50",
              )}>
                {label}
              </div>
            ))}
          </div>

          {/* Streak */}
          <div data-testid="streak-display" className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all",
            streak > 0 ? "border-orange-400/60 bg-orange-500/10" : "border-white/10 bg-white/5"
          )}>
            <Flame className={cn("w-3.5 h-3.5", streak > 0 ? "text-orange-500" : "text-white/50")} />
            <span className={cn("font-display font-bold text-sm", streak > 0 ? "text-orange-500" : "text-white/50")}>
              {streak}
            </span>
          </div>
        </div>
      </header>

      {/* Hand rankings / rules info button */}
      <button
        data-testid="button-info"
        onClick={() => setShowInfo(true)}
        className="mt-3 w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-blue-500" />
          <span className="text-xs font-semibold">족보 순위 · 게임 룰 확인</span>
        </div>
        <ChevronRight className="w-4 h-4 opacity-60" />
      </button>

      {/* Board */}
      <div className="mt-4 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-2 text-center">
          {STREET_LABELS[streetIndex]} 보드
        </p>
        <div className="flex gap-2 justify-center items-center flex-wrap">
          {currentBoard.map((card, i) => (
            <motion.div
              key={`${streetIndex}-${card}-${i}`}
              initial={{ opacity: 0, y: -12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
            >
              <PlayingCard card={card} size="md" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── SELECTION PHASE ── */}
      {phase === "selecting" && (
        <>
          {/* Nut Slots */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {SLOT_CONFIG.map((cfg, idx) => {
              const Icon = cfg.Icon;
              const cards = slotCards[idx];
              const isActive = activeSlot === idx;
              return (
                <div
                  key={idx}
                  data-testid={`slot-${idx}`}
                  onClick={() => handleActivateSlot(idx as 0 | 1 | 2)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-colors duration-200 cursor-pointer select-none",
                    !isActive && "border-white/10 bg-white/5 hover:border-white/20",
                    isActive && `${cfg.borderActive} ${cfg.bg}`,
                  )}
                >
                  <div className="flex items-center gap-1">
                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                    <span className="text-[11px] font-display font-bold text-white">{cfg.label}</span>
                  </div>

                  <div className="flex gap-1.5 justify-center min-h-[56px] items-center">
                    {cards.length === 0 && (
                      <>
                        <div className="w-10 h-14 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
                          <span className="text-white/30 text-xs font-bold">1</span>
                        </div>
                        <div className="w-10 h-14 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
                          <span className="text-white/30 text-xs font-bold">2</span>
                        </div>
                      </>
                    )}
                    {cards.map((card, ci) => (
                      <div
                        key={ci}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                        onClick={e => { e.stopPropagation(); handleRemoveCard(idx, ci); }}
                      >
                        <PlayingCard card={card} size="sm" noAnimation />
                      </div>
                    ))}
                    {cards.length === 1 && (
                      <div className="w-10 h-14 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
                        <span className="text-white/30 text-xs font-bold">2</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 52-Card Grid Picker */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              {(() => { const cfg = SLOT_CONFIG[activeSlot]; const Icon = cfg.Icon; return <Icon className={cn("w-3.5 h-3.5", cfg.color)} />; })()}
              <span className="text-xs font-bold text-white">{SLOT_CONFIG[activeSlot].label} 슬롯</span>
              <span className="text-white/50 text-xs">
                — 카드 탭으로 선택 ({slotCards[activeSlot].length}/2)
              </span>
            </div>

            <div className="flex flex-col gap-1">
              {SUITS.map(suit => {
                const redSuit = suit === "h" || suit === "d";
                return (
                  <div key={suit} className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-6 h-7 rounded flex items-center justify-center flex-shrink-0 text-sm font-bold leading-none",
                      redSuit
                        ? "bg-red-900/30 text-red-400 border border-red-700/30"
                        : "bg-white/10 text-white border border-white/20"
                    )}>
                      {SUIT_SYMBOLS[suit]}
                    </div>
                    <div className="flex gap-[2px] flex-1">
                      {RANKS.map(rank => {
                        const card = rank + suit;
                        const isBoard = boardSet.has(card);
                        const isInActiveSlot = slotCards[activeSlot].includes(card);

                        return (
                          <button
                            key={card}
                            data-testid={`pick-card-${card}`}
                            onClick={() => !isBoard && handlePickCard(card)}
                            disabled={isBoard}
                            className={cn(
                              "flex-1 h-7 rounded text-[11px] font-bold transition-colors select-none touch-manipulation border",
                              isBoard && "border-transparent bg-white/5 text-white/20 cursor-not-allowed",
                              isInActiveSlot && "border-transparent bg-primary text-primary-foreground ring-1 ring-primary/70 cursor-default",
                              !isBoard && !isInActiveSlot && cn(
                                "border-gray-200 bg-white hover:border-primary hover:ring-1 hover:ring-primary/60 active:scale-95",
                                redSuit ? "text-red-600" : "text-gray-800"
                              ),
                            )}
                          >
                            {displayRank(rank)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timer bar */}
          <div className="mt-3 flex items-center gap-2" data-testid="timer-container">
            <Timer className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              timeLeft <= 5 ? "text-red-500" : timeLeft <= 10 ? "text-orange-400" : "text-green-500"
            )} />
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                data-testid="timer-bar"
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-orange-400" : "bg-green-500"
                )}
                style={{ width: `${(timeLeft / STREET_TIMERS[streetIndex]) * 100}%` }}
              />
            </div>
            <span
              data-testid="timer-display"
              className={cn(
                "font-display font-bold text-sm w-8 text-right tabular-nums transition-colors",
                timeLeft <= 5 ? "text-red-500" : timeLeft <= 10 ? "text-orange-400" : "text-green-500"
              )}
            >
              {timeLeft}s
            </span>
          </div>

          {/* Submit */}
          <button
            data-testid="button-submit"
            onClick={handleSubmit}
            disabled={!allReady}
            className={cn(
              "w-full mt-3 py-3.5 rounded-xl font-display font-bold text-base transition-all shadow-xl",
              allReady
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 shadow-primary/25"
                : "bg-white/5 text-white/30 cursor-not-allowed border border-white/10"
            )}
          >
            {allReady ? "제출하기" : `슬롯을 채워주세요 (${slotCards.filter(s => s.length >= 2).length}/3)`}
          </button>
        </>
      )}

      {/* ── SUBMITTED PHASE ── */}
      {phase === "submitted" && (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 mt-2"
          >
            {/* Title section */}
            {correctCount === 3 ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center">
                <div className="font-display font-bold text-3xl text-emerald-600 mb-1">완벽!</div>
                <div className="text-white/60 text-sm">3/3 정답</div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="font-bold text-sm text-orange-500">{streak}연속 정답!</span>
                  {bestStreak > 1 && streak === bestStreak && (
                    <span className="text-xs text-amber-600 font-bold ml-1">🏆 최고 기록</span>
                  )}
                </div>
              </div>
            ) : (
              <div className={cn(
                "rounded-2xl border p-5 text-center",
                timedOut
                  ? "bg-red-500/10 border-red-500/30"
                  : correctCount > 0
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-red-500/10 border-red-500/30"
              )}>
                {timedOut ? (
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Timer className="w-5 h-5 text-red-400" />
                    <span className="font-display font-bold text-2xl text-red-400">시간 초과</span>
                  </div>
                ) : (
                  <div className={cn(
                    "font-display font-bold text-3xl mb-1",
                    correctCount > 0 ? "text-amber-600" : "text-red-400"
                  )}>
                    {correctCount}/3 정답
                  </div>
                )}
              </div>
            )}

            {/* Circular stat badges — 3 in a row */}
            <div className="grid grid-cols-3 gap-2">
              {SLOT_CONFIG.map((cfg, idx) => {
                const Icon = cfg.Icon;
                const ok = currentResults?.[idx] ?? false;
                const userCards = slotCards[idx];

                return (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    {/* Circle badge */}
                    <div className={cn(
                      "w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center gap-0.5",
                      ok ? "bg-green-500/10 border-green-500/40" : "bg-red-500/10 border-red-500/40"
                    )}>
                      <Icon className={cn("w-5 h-5", cfg.color)} />
                      {ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400" />
                      }
                    </div>

                    {/* Slot label */}
                    <span className="text-[11px] font-display font-bold text-center text-white">{cfg.label}</span>

                    {/* User's selected cards */}
                    <div className="flex gap-0.5 justify-center">
                      {userCards.map((card, ci) => (
                        <PlayingCard key={ci} card={card} size="sm" />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action button — always advance to next street */}
            {streetIndex < 2 && (
              <div className="flex flex-col gap-2">
                <button
                  data-testid="button-next-street"
                  onClick={handleNextStreet}
                  className="w-full py-4 rounded-2xl font-display font-bold text-base bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
                >
                  다음 스트릿 공개
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Hand Rankings Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowInfo(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-[#080818] border-t border-white/10 rounded-t-2xl px-4 pt-4 pb-10 overflow-y-auto max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-base text-white">족보 순위</h2>
                <button
                  data-testid="button-close-info"
                  onClick={() => setShowInfo(false)}
                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {HAND_RANKINGS.map((hand, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-xl px-3 py-2.5 border",
                      hand.highlight
                        ? "bg-amber-50 border-amber-300"
                        : "bg-white/5 border-white/10"
                    )}
                  >
                    <span className="text-white/50 text-xs font-mono w-5 shrink-0 mt-0.5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("font-bold text-sm text-white", hand.highlight && "text-amber-700")}>{hand.name}</span>
                        {hand.tag && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold shrink-0">
                            {hand.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/50 mt-0.5 leading-snug">{hand.desc}</p>
                      {hand.rule && (
                        <p className="text-[11px] text-amber-700/80 mt-1.5 leading-snug border-t border-amber-200 pt-1.5">
                          {hand.rule}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
