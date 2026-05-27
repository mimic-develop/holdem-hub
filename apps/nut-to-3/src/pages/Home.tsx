import React, { useState, useEffect } from "react";
import {
  RotateCcw, Crown, Medal, Award, CheckCircle2, XCircle,
  Loader2, ChevronRight, AlertTriangle, Flame, Info, X, Timer,
  Download, Trophy, BookOpen, Share2, Gauge, ArrowLeft
} from "lucide-react";
import mimicLogoFull from "../assets/mimic-logo.png";
import introBg from "../assets/intro-bg.png";
import { useGameState, useNewGame } from "../hooks/use-game";
import { useToast } from "../hooks/use-toast";
import { PlayingCard } from "../components/PlayingCard";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { NutTier } from "../lib/api-schema";
import { useAuthState, apiFetch } from "@hh/shared";
import { deriveMetrics, type DerivedMetrics } from "../lib/score";
import { LeaderboardPanel } from "../components/LeaderboardPanel";


interface SubmitResult {
  wasUpdated: boolean;
  previousBest: { streak: number; accuracy: number; avgResponseMs: number; score: number } | null;
  newBest: { streak: number; accuracy: number; avgResponseMs: number; score: number; rank: number } | null;
}

interface RunStats {
  streetsPlayed: number;
  streetResults: (boolean[] | null)[];
  slotsByStreet: string[][][];
  finalStreak: number;
  bestStreak: number;
  completedAll: boolean;
  timedOut: boolean;
  /** Per-street response time in ms. Filled per submit; timed-out streets get
   *  the timer limit (STREET_TIMERS[i] × 1000). 길이는 항상 3. */
  responseTimes: number[];
  /** Derived metrics used by leaderboard submit / UI. Optional for legacy
   *  call sites that haven't filled it yet — will be ensured at results-phase entry. */
  metrics?: DerivedMetrics;
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

interface HomeProps {
  initialStreak?: number;
  initialBestStreak?: number;
}

export default function Home({ initialStreak = 0, initialBestStreak = 0 }: HomeProps) {
  // Persistent across games — initialised from server data passed by Hub App.tsx
  const [streak, setStreak] = useState(initialStreak);
  const [bestStreak, setBestStreak] = useState(initialBestStreak);
  const [recentNutTypes, setRecentNutTypes] = useState<string[]>([]);

  const { data: game, isLoading, error } = useGameState(recentNutTypes);
  const requestNewGame = useNewGame();
  const { toast } = useToast();
  const { user } = useAuthState();
  const [showInfo, setShowInfo] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [appPhase, setAppPhase] = useState<"intro" | "countdown" | "playing" | "results">("intro");
  const refBoard = React.useRef<HTMLDivElement>(null);
  const refSlots = React.useRef<HTMLDivElement>(null);
  const refPicker = React.useRef<HTMLDivElement>(null);
  const [annotationRects, setAnnotationRects] = useState<{ board: DOMRect | null; slots: DOMRect | null; picker: DOMRect | null }>({ board: null, slots: null, picker: null });
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  // 응답 시간 추적 — 매 스트릿 시작 시점과 그 스트릿의 응답 ms (낮을수록 좋음).
  // useRef 로 보관해 매 frame 마다 rerender 발생 안 함.
  const streetStartTimesRef = React.useRef<number[]>([0, 0, 0]);
  const responseTimesRef = React.useRef<number[]>([0, 0, 0]);
  /** leaderboard submit 결과 — results phase 진입 시 자동 채워짐. UI 가 소비. */
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const submitRequestedRef = React.useRef<string | null>(null);
  /** new-record toast/confetti 가 한 게임에서 한 번만 발동되도록 가드. resetGame 에서 false. */
  const newRecordNotifiedRef = React.useRef(false);
  /** 최고기록 달성 시 표시하는 모달 데이터 */
  const [bestRecordModal, setBestRecordModal] = useState<SubmitResult | null>(null);
  /** results 헤더에서 표시할 내 순위 — LeaderboardPanel onRankResolved 콜백이 채움. */
  const [myRank, setMyRank] = useState<number | "overflow" | null>(null);

  // Per-game
  const [streetIndex, setStreetIndex] = useState(0);
  const [phase, setPhase] = useState<"selecting" | "submitted">("selecting");
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(0);
  const [slotCards, setSlotCards] = useState<[string[], string[], string[]]>([[], [], []]);
  const [streetResults, setStreetResults] = useState<(boolean[] | null)[]>([null, null, null]);
  const [savedSlotsByStreet, setSavedSlotsByStreet] = useState<string[][][]>([[], [], []]);
  const [timeLeft, setTimeLeft] = useState(STREET_TIMERS[0]);
  const [timedOut, setTimedOut] = useState(false);
  // tracks if every street in the current session was answered perfectly
  const [sessionAllCorrect, setSessionAllCorrect] = useState(true);

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
    setSessionAllCorrect(true);
    // 응답 시간 ref 초기화. 첫 스트릿 시작 시각은 playing phase 진입 useEffect 에서 기록.
    streetStartTimesRef.current = [0, 0, 0];
    responseTimesRef.current = [0, 0, 0];
    // leaderboard submit 가드 해제 + 이전 결과 비움 (다음 게임 종료 시 다시 submit).
    submitRequestedRef.current = null;
    setSubmitResult(null);
    setBestRecordModal(null);
    newRecordNotifiedRef.current = false;
    setMyRank(null);
  }

  function resetStreet(newStreetIdx?: number) {
    setPhase("selecting");
    setActiveSlot(0);
    setSlotCards([[], [], []]);
    setTimeLeft(STREET_TIMERS[newStreetIdx ?? streetIndex]);
    setTimedOut(false);
  }

  // playing phase + selecting 진입 시점에 그 스트릿 시작 시각 기록. 응답 ms 측정 기준.
  useEffect(() => {
    if (appPhase !== "playing") return;
    if (phase !== "selecting") return;
    if (streetStartTimesRef.current[streetIndex] === 0) {
      streetStartTimesRef.current[streetIndex] = performance.now();
    }
  }, [appPhase, phase, streetIndex]);

  // new-record 모달 — submitResult.wasUpdated 가 true 가 된 직후 한 번.
  useEffect(() => {
    if (!submitResult?.wasUpdated) return;
    if (newRecordNotifiedRef.current) return;
    newRecordNotifiedRef.current = true;
    try { triggerConfetti(); } catch {}
    setBestRecordModal(submitResult);
  }, [submitResult]);

  // results phase 진입 시 한 번 leaderboard upsert. metrics 가 채워졌고 로그인된 경우만.
  // submitRequestedRef 가드로 동일 게임 결과를 두 번 submit 하지 않음.
  useEffect(() => {
    if (appPhase !== "results") return;
    const metrics = runStats?.metrics;
    if (!metrics) return;
    if (!user?.id) return;
    if (submitRequestedRef.current === user.id) return;
    submitRequestedRef.current = user.id;
    void apiFetch<SubmitResult>("/nut-to/leaderboard/submit", {
      method: "POST",
      body: JSON.stringify({
        streak: runStats?.finalStreak ?? 0,
        totalCorrect: metrics.totalCorrect,
        accuracy: metrics.accuracy,
        avgResponseMs: metrics.avgResponseMs,
        recordedAt: Date.now(),
      }),
    }).then(res => setSubmitResult(res)).catch(console.error);
  }, [appPhase, runStats?.metrics, runStats?.finalStreak, user?.id]);

  // (카운트다운 제거 — 터치로 시작)

  // 카운트다운 진입 후 DOM 렌더 완료 시점에 실제 영역 측정
  useEffect(() => {
    if (appPhase !== "countdown") return;
    const measure = () => {
      setAnnotationRects({
        board: refBoard.current?.getBoundingClientRect() ?? null,
        slots: refSlots.current?.getBoundingClientRect() ?? null,
        picker: refPicker.current?.getBoundingClientRect() ?? null,
      });
    };
    // 두 프레임 대기 — 레이아웃 계산 완료 보장
    const id = requestAnimationFrame(() => requestAnimationFrame(measure));
    return () => cancelAnimationFrame(id);
  }, [appPhase]);

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
      setSessionAllCorrect(false);
      setTimedOut(true);
      setPhase("submitted");
      // 타임아웃 시 응답 시간 = 그 스트릿의 timer 한계 (ms).
      responseTimesRef.current[streetIndex] = STREET_TIMERS[streetIndex] * 1000;
      if (streetIndex === 2) {
        const responseTimes = [...responseTimesRef.current];
        const metrics = deriveMetrics({
          streetResults: newStreetResults,
          responseTimes,
          finalStreak: prevStreak,
        });
        setRunStats({
          streetsPlayed: 2,
          streetResults: newStreetResults,
          slotsByStreet: savedSlotsByStreet,
          finalStreak: prevStreak,
          bestStreak,
          completedAll: true,
          timedOut: true,
          responseTimes,
          metrics,
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
    const GOLD = "#D4AF37";
    const GOLD_BRIGHT = "#F5E070";

    return (
      <div style={{ position: 'fixed', top: '52px', left: 0, right: 0, bottom: 0, background: '#050408', overflow: 'hidden', zIndex: 1 }}>

        {/* Crown 배경 이미지 — 대비 완화 (brightness/contrast/saturate) */}
        <img
          src={introBg}
          alt=""
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '430px', height: '100%',
            objectFit: 'cover', objectPosition: 'center center',
            pointerEvents: 'none', zIndex: 0,
            filter: 'brightness(0.92) contrast(0.78) saturate(0.88)',
          }}
        />


        {/* 430px 포스터 컬럼 — 상하 분할: 히어로(top) ↔ CTA(bottom), 가운데는 비디오 */}
        <div style={{
          position: 'relative', zIndex: 2, maxWidth: '430px', margin: '0 auto',
          height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>

          {/* ── Hero (상단) ── */}
          <section style={{ padding: '40px 24px 0' }}>
            {/* 상단 라벨 — Gauge 아이콘 + 골드 라인 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 18, height: 1, background: GOLD }} />
              <Gauge size={14} color={GOLD} strokeWidth={2} />
              <span style={{
                fontSize: 12, letterSpacing: '0.26em', color: GOLD_BRIGHT,
                fontWeight: 700, textTransform: 'uppercase',
              }}>
                Speed Challenge
              </span>
              <div style={{ flex: 1, height: 1, background: GOLD }} />
            </div>

            {/* 타이틀 — Pretendard 고딕, 노란색 + 화이트 */}
            <h1 style={{
              margin: 0, marginTop: 6, lineHeight: 1,
              fontSize: 'clamp(56px, 17vw, 84px)', fontWeight: 800,
              fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
              letterSpacing: '-0.01em',
              display: 'inline-flex', alignItems: 'baseline', gap: '0.1em',
            }}>
              {/* Nut — 노란색 */}
              <span style={{ color: '#F0C840', fontWeight: 800 }}>Nut</span>
              {/* to — 화이트 */}
              <span style={{
                color: '#FFFFFF', fontSize: '0.56em',
                fontWeight: 600,
                margin: '0 0.06em',
                letterSpacing: '0',
              }}>to</span>
              {/* 3 — 노란색 */}
              <span style={{ color: '#F0C840', fontWeight: 800 }}>3</span>
            </h1>

            <p style={{
              marginTop: 16, fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5,
              letterSpacing: 0, fontWeight: 500,
            }}>
              가장 강한 핸드 <span style={{ color: GOLD_BRIGHT, fontWeight: 700 }}>3개</span>를 빠르게 고르세요
            </p>

            {/* 스트릭 칩 — 라벨 포함 */}
            <div style={{
              marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 10,
              fontSize: 12,
              padding: '9px 16px',
              background: 'rgba(8,6,12,0.55)',
              border: `1px solid rgba(212,175,55,0.4)`,
              borderRadius: 12,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>현재 기록</span>
              <span style={{ width: 3, height: 3, background: GOLD, borderRadius: '50%' }} />
              <span style={{ color: '#fff', fontWeight: 700 }}>🔥 {streak}연속</span>
              <span style={{ width: 1, height: 12, background: 'rgba(212,175,55,0.4)' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>최고 {bestStreak}</span>
            </div>
          </section>

          {/* ── CTA cluster (하단) ── */}
          <div style={{ padding: '0 24px 28px' }}>
            {/* 게임 스타트 — 골드 솔리드 */}
            <button
              data-testid="button-start-game"
              type="button"
              onClick={() => setAppPhase("countdown")}
              style={{
                width: '100%', borderRadius: 14, padding: '18px 20px', fontSize: 17,
                fontWeight: 800, color: '#0a0804', border: 'none',
                background: `linear-gradient(180deg, ${GOLD_BRIGHT} 0%, ${GOLD} 55%, #A07820 100%)`,
                letterSpacing: '0.04em',
                boxShadow: '0 8px 28px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.18)',
                cursor: 'pointer',
              }}
            >
              게임 시작 →
            </button>

            {/* 룰 안내 — BookOpen 아이콘 + outline 박스 */}
            <button
              data-testid="button-info-intro"
              type="button"
              onClick={() => setShowInfo(true)}
              style={{
                marginTop: 12, width: '100%', borderRadius: 14, padding: '13px 18px',
                background: 'rgba(8,6,12,0.55)',
                border: '1px solid rgba(212,175,55,0.3)',
                color: 'rgba(212,175,55,0.92)', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                cursor: 'pointer', letterSpacing: 0,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <BookOpen size={16} strokeWidth={2} />
              <span>처음이라면 게임 방법 확인 →</span>
            </button>

            {/* 리더보드 확인 — Trophy 아이콘 + outline 박스 (룰 안내와 같은 톤) */}
            <button
              data-testid="button-leaderboard-intro"
              type="button"
              onClick={() => setShowLeaderboard(true)}
              style={{
                marginTop: 10, width: '100%', borderRadius: 14, padding: '13px 18px',
                background: 'rgba(8,6,12,0.55)',
                border: '1px solid rgba(212,175,55,0.3)',
                color: 'rgba(212,175,55,0.92)', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                cursor: 'pointer', letterSpacing: 0,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <Trophy size={16} strokeWidth={2} />
              <span>리더보드 확인 →</span>
            </button>

            {/* 제한 시간 박스 — Timer 아이콘 + outline */}
            <div style={{
              marginTop: 12, padding: '12px 16px',
              background: 'rgba(8,6,12,0.55)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 12,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              <Timer size={20} color={GOLD} strokeWidth={2} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: 0 }}>
                  제한 시간 18-22초
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, letterSpacing: 0 }}>
                  플랍 18s · 턴 20s · 리버 22s
                </div>
              </div>
            </div>

            {isLoading && (
              <p style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
                게임 데이터 준비 중...
              </p>
            )}
          </div>

        </div>{/* end 430px poster column */}

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

        {/* Leaderboard modal — intro 에서 "리더보드 확인" 클릭 시 표시. */}
        <AnimatePresence>
          {showLeaderboard && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setShowLeaderboard(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-w-[430px] rounded-t-2xl px-4 pt-4 pb-10 overflow-y-auto max-h-[85vh]"
                style={{
                  background: 'linear-gradient(180deg, #1a1410 0%, #0a0608 100%)',
                  borderTop: '1px solid rgba(212,175,55,0.3)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-base text-white">명예의 전당</h2>
                  <button
                    data-testid="button-close-leaderboard"
                    onClick={() => setShowLeaderboard(false)}
                    className="w-7 h-7 rounded-lg border border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <LeaderboardPanel uid={user?.id ?? null} />
                {!user?.id && (
                  <p className="mt-3 text-center text-[11px] text-white/45">
                    로그인하면 본인 기록이 랭킹에 반영됩니다
                  </p>
                )}
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

    // 결과 화면 "홈" 버튼 — 인트로로 이동하되 다음 "게임 시작" 시 새 보드로 시작하도록
    // 게임 state 리셋 + 새 게임 요청. recentNutTypes 도 누적해 같은 너트 타입 반복 방지.
    function handleGoHome() {
      if (game) {
        const riverNut = game.streets[2]?.tiers[0]?.koreanDescr;
        const next = riverNut ? [...recentNutTypes, riverNut].slice(-2) : recentNutTypes;
        if (riverNut) setRecentNutTypes(next);
        resetGame();
        requestNewGame(next);
      }
      setAppPhase("intro");
    }

    return (
      <div className="min-h-screen px-4 pb-10 flex flex-col" style={{ maxWidth: '430px', margin: '0 auto', paddingTop: '52px' }}>
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
            {submitResult?.wasUpdated && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: 'linear-gradient(135deg, #FCD34D, #F59E0B)',
                  color: '#451A03',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.45)',
                }}
                data-testid="new-best-badge"
              >
                🎉 NEW BEST
              </div>
            )}
            {myRank !== null && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                🏅 내 순위{' '}
                <span className="font-display font-bold text-amber-200">
                  {myRank === 'overflow' ? '100위+' : `${myRank}위`}
                </span>
              </div>
            )}
          </div>

          {/* 4 metrics 표시 — accuracy / avgResponseMs / score 를 추가로 노출. */}
          {runStats.metrics && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">정확도</div>
                <div className="font-display font-bold text-lg text-white mt-1">
                  {Math.round(runStats.metrics.accuracy * 100)}%
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">평균 응답</div>
                <div className="font-display font-bold text-lg text-white mt-1">
                  {(runStats.metrics.avgResponseMs / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">점수</div>
                <div className="font-display font-bold text-lg text-emerald-300 mt-1 tabular-nums">
                  {runStats.metrics.score.toLocaleString()}
                </div>
              </div>
            </div>
          )}

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

          {/* All-time leaderboard panel — Top 10 + my rank highlight */}
          <LeaderboardPanel
            uid={user?.id ?? null}
            refreshKey={submitResult?.wasUpdated ? 1 : 0}
            onRankResolved={setMyRank}
          />
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
          <div className="flex gap-2">
            <button
              onClick={handleGoHome}
              className="flex-1 py-4 rounded-2xl border border-white/15 bg-white/5 text-white/70 font-display font-bold text-base hover:bg-white/10 hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              홈
            </button>
            <button
              data-testid="button-restart"
              onClick={handleRestart}
              className="flex-[2] py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-base shadow-xl shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              다시하기
            </button>
          </div>
        </div>

        {/* 최고기록 달성 모달 */}
        {bestRecordModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setBestRecordModal(null)} />
            <div className="relative bg-[#0d0a12] border border-amber-400/30 rounded-2xl p-6 max-w-sm w-full mx-4 text-center shadow-2xl shadow-amber-400/10">
              <div className="text-4xl mb-2">🏆</div>
              <p className="font-display font-bold text-xl text-amber-300 mb-1">최고기록 달성!</p>
              {bestRecordModal.previousBest && (
                <p className="text-sm text-white/50 mb-1">이전 기록: {bestRecordModal.previousBest.streak}연속</p>
              )}
              {bestRecordModal.newBest && (
                <p className="font-display font-bold text-lg text-primary mb-1">
                  새 기록: {bestRecordModal.newBest.streak}연속
                  {bestRecordModal.newBest.rank > 0 && (
                    <span className="ml-2 text-sm text-amber-400">#{bestRecordModal.newBest.rank}위</span>
                  )}
                </p>
              )}
              <button
                className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm hover:bg-primary/90 transition-colors"
                onClick={() => setBestRecordModal(null)}
              >
                닫기
              </button>
            </div>
          </div>
        )}

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
                className="relative w-full max-w-[430px] bg-[#050408] border-t border-white/10 rounded-t-2xl px-4 pt-4 pb-10 overflow-y-auto max-h-[90vh]"
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
                    <div key={si} className={cn("pb-4", si < 2 && "border-b border-white/10 mb-4")}>

                      {/* 스트리트 라벨 + 보드 카드 (가로) */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[10px] font-display font-bold text-white/40 uppercase tracking-widest shrink-0">{label}</span>
                        <div className="flex gap-1">
                          {street.board.map((c, i) => (
                            <PlayingCard key={i} card={c} size="sm" noAnimation />
                          ))}
                        </div>
                      </div>

                      {/* 좌/우 2컬럼 — 내 답 | 정답 */}
                      <div className="grid grid-cols-2 gap-2">

                        {/* 좌: 내 답 */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest text-center">내 답</span>
                          {SLOT_CONFIG.map((cfg, slotIdx) => {
                            const Icon = cfg.Icon;
                            const ok = r?.[slotIdx] ?? false;
                            const userCards = slotsByStreet[si]?.[slotIdx] ?? [];
                            return (
                              <div key={slotIdx} className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
                                ok ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                              )}>
                                <Icon className={cn("w-3 h-3 shrink-0", cfg.color)} />
                                <span className="text-[10px] font-bold text-white w-7 shrink-0">{cfg.label}</span>
                                <div className="flex gap-0.5">
                                  {userCards.length > 0
                                    ? userCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" noAnimation />)
                                    : <span className="text-[9px] text-white/20 italic">미입력</span>
                                  }
                                </div>
                                <div className="ml-auto shrink-0">
                                  {ok
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    : <XCircle className="w-3.5 h-3.5 text-red-400" />
                                  }
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 우: 정답 */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-amber-400/50 uppercase tracking-widest text-center">정답</span>
                          {SLOT_CONFIG.map((cfg, slotIdx) => {
                            const Icon = cfg.Icon;
                            const tier = street.tiers[slotIdx];
                            return (
                              <div key={slotIdx} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
                                <Icon className={cn("w-3 h-3 shrink-0", cfg.color)} />
                                <span className="text-[10px] font-bold text-white w-7 shrink-0">{cfg.label}</span>
                                <div className="flex gap-0.5">
                                  {tier?.exampleCards.map((c, i) => (
                                    <PlayingCard key={i} card={c} size="sm" noAnimation />
                                  ))}
                                </div>
                                {tier && (
                                  <span className="text-[8px] text-amber-400/40 ml-auto truncate">{tier.koreanDescr}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
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

    // 응답 시간 기록 — 그 스트릿 시작 시각이 0(미초기화)인 비정상 케이스엔 limit fallback.
    const startedAt = streetStartTimesRef.current[streetIndex];
    const elapsed = startedAt > 0
      ? performance.now() - startedAt
      : STREET_TIMERS[streetIndex] * 1000;
    responseTimesRef.current[streetIndex] = elapsed;

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
    const nowSessionCorrect = sessionAllCorrect && allCorrect;

    if (!allCorrect) {
      // any wrong answer resets streak immediately
      if (streak > 0) {
        newStreak = 0;
        setStreak(0);
      }
      setSessionAllCorrect(false);
    }

    if (isRiver) {
      if (nowSessionCorrect) {
        // full session (flop+turn+river) all correct → +1 streak
        newStreak = streak + 1;
        newBest = Math.max(bestStreak, newStreak);
        setStreak(newStreak);
        setBestStreak(newBest);
        triggerConfetti();
      }
      const responseTimes = [...responseTimesRef.current];
      const metrics = deriveMetrics({
        streetResults: newStreetResults,
        responseTimes,
        finalStreak: newStreak,
      });
      setRunStats({
        streetsPlayed: 2,
        streetResults: newStreetResults,
        slotsByStreet: newSavedSlots,
        finalStreak: newStreak,
        bestStreak: newBest,
        completedAll: true,
        timedOut: false,
        responseTimes,
        metrics,
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
    <div style={{ position: 'fixed', top: '52px', left: 0, right: 0, bottom: 0, zIndex: 0, background: '#050408' }}>
    <div className="px-3 pb-3 flex flex-col h-full overflow-hidden" style={{ maxWidth: '430px', margin: '0 auto', position: 'relative' }}>

      {/* ── COUNTDOWN OVERLAY ── */}
      <AnimatePresence>
        {appPhase === "countdown" && (
          <>
            {/* ① backdrop — 터치로 게임 시작 */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => setAppPhase("playing")}
              style={{ position: 'fixed', top: '52px', left: 0, right: 0, bottom: 0,
                zIndex: 50, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
                background: 'rgba(8,8,24,0.78)', cursor: 'pointer' }}
            />

            {/* ② 어노테이션 — backdrop 밖에서 별도 렌더, position:fixed 뷰포트 기준 정상 동작 */}
            {([
              { rect: annotationRects.board,  label: '① 보드',     color: 'rgba(212,175,55,0.7)',   bg: 'rgba(212,175,55,0.07)',  textColor: '#D4AF37',               sub: '플랍 · 턴 · 리버 카드', delay: 0.15 },
              { rect: annotationRects.slots,  label: '② 정답 슬롯', color: 'rgba(168,168,255,0.6)', bg: 'rgba(120,120,255,0.06)', textColor: 'rgba(180,180,255,0.9)',  sub: 'NUT · 2ND · 3RD 각 2장',  delay: 0.25 },
              { rect: annotationRects.picker, label: '③ 카드 선택', color: 'rgba(100,210,160,0.6)', bg: 'rgba(100,210,160,0.05)', textColor: 'rgba(100,210,160,0.9)',  sub: '52장 전체 · 탭으로 입력',   delay: 0.35 },
            ] as const).map(({ rect, label, color, bg, textColor, sub, delay }) => {
              if (!rect) return null;
              return (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
                  style={{ position: 'fixed', zIndex: 51, pointerEvents: 'none',
                    top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                    border: `2px solid ${color}`, borderRadius: '12px', background: bg }}
                >
                  <span style={{ position: 'absolute', top: '-11px', left: '10px', fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.18em', color: textColor, background: '#050408', padding: '0 5px',
                    textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                  <span style={{ position: 'absolute', bottom: '7px', right: '10px', fontSize: '10px',
                    color: textColor, opacity: 0.6 }}>{sub}</span>
                </motion.div>
              );
            })}

            {/* ③ 터치하여 시작 안내 */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              onClick={() => setAppPhase("playing")}
              style={{ position: 'fixed', bottom: '36px', left: 0, right: 0, zIndex: 52,
                display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
            >
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.25em',
                color: 'rgba(212,175,55,0.8)', textTransform: 'uppercase' }}>
                화면을 터치하여 시작
              </span>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          {/* Exit button — 뒤로가기 화살표 */}
          <button
            onClick={() => setShowExitConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white active:scale-95 transition-all shrink-0"
            aria-label="게임 나가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {/* Nut to 3 로고 — "Nut"만 골드 강조, 나머지는 화이트 */}
          <span style={{
            display: 'inline-flex', alignItems: 'baseline', gap: '0.1em',
            fontSize: 22, fontWeight: 800, lineHeight: 1,
            letterSpacing: '-0.01em',
            fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
          }}>
            <span style={{ color: '#F0C840' }}>Nut</span>
            <span style={{
              color: '#ffffff', fontSize: '0.56em', fontWeight: 600,
              margin: '0 0.04em',
            }}>to</span>
            <span style={{ color: '#ffffff' }}>3</span>
          </span>
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
      <div ref={refBoard} className="mt-4 mb-3">
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
          <div ref={refSlots} className="grid grid-cols-3 gap-2 mb-3">
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
          <div ref={refPicker} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 flex-1 min-h-0">
            <div className="flex items-center gap-1.5 shrink-0">
              {(() => { const cfg = SLOT_CONFIG[activeSlot]; const Icon = cfg.Icon; return <Icon className={cn("w-3.5 h-3.5", cfg.color)} />; })()}
              <span className="text-xs font-bold text-white">{SLOT_CONFIG[activeSlot].label} 슬롯</span>
              <span className="text-white/50 text-xs">
                — 카드 탭으로 선택 ({slotCards[activeSlot].length}/2)
              </span>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-h-0">
              {SUITS.map(suit => {
                const redSuit = suit === "h" || suit === "d";
                return (
                  <div key={suit} className="flex items-center gap-1.5 flex-1 min-h-[28px] max-h-[52px]">
                    <div className={cn(
                      "w-6 h-full rounded flex items-center justify-center flex-shrink-0 text-sm font-bold leading-none",
                      redSuit
                        ? "bg-red-900/30 text-red-400 border border-red-700/30"
                        : "bg-white/10 text-white border border-white/20"
                    )}>
                      {SUIT_SYMBOLS[suit]}
                    </div>
                    <div className="flex gap-[2px] flex-1 h-full">
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
                              "flex-1 h-full rounded text-[11px] font-bold transition-colors select-none touch-manipulation border",
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
          <div className="mt-3 flex items-center gap-2 shrink-0" data-testid="timer-container">
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
              "w-full mt-3 py-3.5 rounded-xl font-display font-bold text-base transition-all shadow-xl shrink-0",
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

      {/* Exit Confirm Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(8,8,24,0.85)' }}
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#10102a] p-6 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1.5">
                <span className="font-display font-bold text-lg text-white">게임을 나가시겠습니까?</span>
                <span className="text-sm text-white/50 leading-snug">
                  {!sessionAllCorrect
                    ? "오답이 있어 스트릭이 이미 초기화되었습니다."
                    : streak > 0
                      ? `현재 스트릭(🔥 ${streak})은 그대로 유지됩니다.`
                      : "스트릭에는 영향이 없습니다."}
                </span>
              </div>
              {!sessionAllCorrect ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-400/30">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm font-bold text-red-400">스트릭 초기화됨</span>
                </div>
              ) : streak > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-400/30">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-sm font-bold text-orange-400">{streak}연속 스트릭 유지</span>
                </div>
              ) : null}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-white/15 bg-white/5 text-white/70 font-bold text-sm hover:bg-white/10 active:scale-95 transition-all"
                >
                  계속하기
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    // 진행 중 게임 폐기 — 인트로 복귀 후 "게임 시작" 시 새 보드로 시작.
                    resetGame();
                    requestNewGame(recentNutTypes);
                    setAppPhase("intro");
                  }}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all"
                >
                  나가기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="relative w-full max-w-[430px] bg-[#050408] border-t border-white/10 rounded-t-2xl px-4 pt-4 pb-10 overflow-y-auto max-h-[85vh]"
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
    </div>
  );
}
