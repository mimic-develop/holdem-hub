import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Brain, Scale } from "lucide-react";
import { getLastVisit, recordVisit } from "../lib/last-visited";
import { tickStreakOnVisit } from "../lib/streak";
import heroBgImg from "../assets/hero-bg.png";

const RED = "#E53935";
const CARD_BG = "#1A1A1A";
const SUB_TEXT = "#8A8A8A";

interface Mode {
  id: string;
  title: string;
  desc: string;
  path: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const MODES: Mode[] = [
  {
    id: "nut-to-3",
    title: "NUT TO 3",
    desc: "상대보다 높은 족보를 만들어 3번 이기세요.",
    path: "/nut-to-3",
    icon: (
      <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.04em", color: "#fff" }}>
        N3
      </span>
    ),
  },
  {
    id: "concept-quiz",
    title: "POKER IQ",
    desc: "퀴즈로 포커 판단력을 점수화하세요.",
    path: "/concept-quiz",
    icon: <Brain size={17} color="#fff" strokeWidth={2} />,
  },
  {
    id: "pot-quiz",
    title: "POT SPLIT",
    desc: "사이드팟과 분배 계산을 연습하세요.",
    path: "/pot-quiz",
    icon: <Scale size={17} color="#666" strokeWidth={2} />,
    comingSoon: true,
  },
];

const isDev = import.meta.env.DEV;

export function Home() {
  const [, navigate] = useLocation();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(tickStreakOnVisit());
  }, []);

  const lastVisit = getLastVisit();

  const handleNavigate = (id: string, path: string) => {
    recordVisit(id);
    navigate(path);
  };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100dvh", marginTop: -52 }}>
      {/* 데스크톱에서도 모바일과 동일한 단일 컬럼 레이아웃 (max-width 430px 중앙 정렬) */}
      <div style={{ maxWidth: 430, margin: "0 auto", background: "#111", minHeight: "100dvh", position: "relative" }}>

      {/* ── 히어로 ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <img
          src={heroBgImg}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ objectFit: "cover", objectPosition: "center top" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(10,10,10,0.4) 50%, rgba(17,17,17,0.92) 82%, #111 100%)",
          }}
        />
        <div className="relative px-4 pt-20 pb-6 sm:px-5">
          <p style={{ fontSize: 11, letterSpacing: "0.22em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 10 }}>
            Poker Training Lab
          </p>
          <h1 style={{ fontSize: "clamp(30px, 8vw, 46px)", fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1.12, textTransform: "uppercase", marginBottom: 10 }}>
            <span style={{ color: RED }}>MIMIC</span> PLAYLAB
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, letterSpacing: 0 }}>
            퀴즈부터 대결까지, 포커 감각을 실험하는 공간
          </p>
        </div>
      </section>

      {/* ── 리워드 스트립 ────────────────────────────────────── */}
      <div
        className="mx-auto px-4 sm:px-5"
        style={{ maxWidth: 520 }}
      >
        <div
          className="flex items-center rounded-xl overflow-hidden"
          style={{ background: CARD_BG, fontSize: 12 }}
        >
          <div className="flex flex-1 items-center justify-center gap-1.5 py-2.5" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ color: "#fff", fontWeight: 600 }}>{streak}일 연속</span>
          </div>
          <div className="flex flex-1 items-center justify-center gap-1.5 py-2.5" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: 13 }}>🎯</span>
            <span style={{ color: "#fff", fontWeight: 600 }}>미션 0/1</span>
          </div>
          <div className="flex flex-1 items-center justify-center gap-1.5 py-2.5">
            <span style={{ fontSize: 13 }}>🎁</span>
            <span style={{ color: SUB_TEXT }}>리워드 대기</span>
          </div>
        </div>

        {/* ── HEADS-UP 피처 카드 ──────────────────────────────── */}
        <div
          className="mt-4 overflow-hidden rounded-2xl"
          style={{ background: CARD_BG, border: `1px solid rgba(229,57,53,0.28)` }}
        >
          <div style={{ height: 3, background: RED }} />
          <div className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 50, height: 50,
                  background: `radial-gradient(circle at 38% 32%, #ff5252, ${RED})`,
                  boxShadow: `0 0 20px rgba(229,57,53,0.35)`,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>HU</span>
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>
                  HEADS-UP
                </p>
                <p style={{ fontSize: 13, color: SUB_TEXT, lineHeight: 1.5, letterSpacing: 0 }}>
                  AI와 1:1 실전 대결 · 상대 성향 읽기
                </p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {["실전 대결", "상대 성향 학습", "포커 감각 강화"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    background: "rgba(229,57,53,0.1)",
                    color: "#ff8a80",
                    border: "1px solid rgba(229,57,53,0.22)",
                    letterSpacing: 0,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <button
              type="button"
              className="w-full rounded-xl py-3.5 text-[15px] font-bold transition-opacity active:opacity-80 hover:opacity-90"
              style={{ background: RED, color: "#fff", letterSpacing: "0.04em", boxShadow: `0 4px 16px rgba(229,57,53,0.38)` }}
              onClick={() => handleNavigate("heads-up", "/heads-up")}
            >
              HEADS-UP 시작하기 →
            </button>

            {/* 이어서 시작하기 — 마지막 방문 앱이 있을 때만 */}
            {lastVisit && (
              <button
                type="button"
                className="mt-2.5 w-full rounded-xl py-2.5 text-[13px] font-medium transition-opacity active:opacity-70 hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: SUB_TEXT,
                  letterSpacing: 0,
                }}
                onClick={() => {
                  const mode = MODES.find((m) => m.id === lastVisit.id);
                  if (mode) handleNavigate(mode.id, mode.path);
                  else handleNavigate("heads-up", "/heads-up");
                }}
              >
                이어서{" "}
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                  {MODES.find((m) => m.id === lastVisit.id)?.title ?? "HEADS-UP"}
                </span>{" "}
                계속하기 →
              </button>
            )}
          </div>
        </div>

        {/* ── 다른 모드 ────────────────────────────────────────── */}
        <div className="mt-6">
          <p className="mb-3 text-[11px] uppercase" style={{ color: SUB_TEXT, letterSpacing: "0.16em" }}>
            다른 모드
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {MODES.map((mode) =>
              mode.comingSoon ? (
                <div
                  key={mode.id}
                  className="flex flex-col overflow-hidden rounded-xl p-3.5"
                  style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.05)", minHeight: 120, opacity: 0.45, cursor: "default" }}
                >
                  <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {mode.icon}
                  </div>
                  <p className="mb-1 text-[12px] font-bold leading-tight" style={{ letterSpacing: "0.04em" }}>
                    {mode.title}
                  </p>
                  <p className="mb-auto text-[11px] leading-snug" style={{ color: SUB_TEXT, letterSpacing: 0 }}>
                    {mode.desc}
                  </p>
                  <span
                    className="mt-2.5 block rounded-full px-2 py-0.5 text-center text-[10px] font-semibold"
                    style={{ background: "rgba(80,80,120,0.2)", color: "#8080cc", border: "1px solid rgba(80,80,120,0.3)" }}
                  >
                    출시 예정
                  </span>
                </div>
              ) : (
                <button
                  key={mode.id}
                  type="button"
                  className="flex w-full flex-col overflow-hidden rounded-xl p-3.5 transition-all active:scale-[0.97] hover:brightness-110"
                  style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.07)", minHeight: 120, textAlign: "left" }}
                  onClick={() => handleNavigate(mode.id, mode.path)}
                >
                  <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }}>
                    {mode.icon}
                  </div>
                  <p className="mb-1 text-[12px] font-bold leading-tight" style={{ letterSpacing: "0.04em" }}>
                    {mode.title}
                  </p>
                  <p className="mb-auto text-[11px] leading-snug" style={{ color: SUB_TEXT, letterSpacing: 0 }}>
                    {mode.desc}
                  </p>
                  <p className="mt-2.5 text-[11px] font-semibold" style={{ color: RED, letterSpacing: 0 }}>
                    시작하기 →
                  </p>
                </button>
              )
            )}
          </div>
        </div>

        {/* ── 푸터 ─────────────────────────────────────────────── */}
        <footer
          className="mt-8 flex items-center justify-between pb-6 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.16)", fontStyle: "italic", letterSpacing: "0.08em" }}>
            "All in Fun" — MIMIC
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.12)" }}>
            © 2026 MIMIC PLAYLAB
          </span>
        </footer>

        {isDev && (
          <div className="pb-4">
            <a href="/dev/cards" style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textDecoration: "underline" }}>
              /dev/cards
            </a>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
