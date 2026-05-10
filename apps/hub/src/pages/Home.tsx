import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthState } from "@hh/shared";
import { getLastVisit, recordVisit } from "../lib/last-visited";
import { tickStreakOnVisit } from "../lib/streak";
import heroBg from "../assets/hero-bg.mp4";

/* ── 앱 카드 데이터 ───────────────────────────────────────── */
interface AppCard {
  id: string;
  tag: string;
  title: string;
  desc: string;
  path: string;
  accentColor: string;
  enterLabel?: string;
  enterColor?: string;
}

const FEATURED: AppCard = {
  id: "heads-up",
  tag: "★ 추천 모드",
  title: "HEADS-UP",
  desc: "AI 또는 친구와 1:1 맞대결. 빠르게 실전 감각을 키워보세요.",
  path: "/heads-up",
  accentColor: "#BA0C19",
};

const SECONDARY: AppCard[] = [
  {
    id: "nut-to-3",
    tag: "훈련",
    title: "NUT TO 3",
    desc: "넛 핸드를 역산해 최적 베팅 감각 훈련",
    path: "/nut-to-3",
    accentColor: "rgba(255,252,243,0.5)",
  },
  {
    id: "concept-quiz",
    tag: "학습",
    title: "POKER IQ",
    desc: "개념부터 실전 판단까지 퀴즈로 점수화",
    path: "/concept-quiz",
    accentColor: "#BA0C19",
  },
  {
    id: "pot-quiz",
    tag: "계산",
    title: "POT SPLIT",
    desc: "팟 분배 계산력과 확률 직관 훈련",
    path: "/pot-quiz",
    accentColor: "#000CED",
    enterLabel: "곧 출시",
    enterColor: "rgba(100,130,255,0.75)",
  },
];

const ALL_APPS: AppCard[] = [FEATURED, ...SECONDARY];
const isDev = import.meta.env.DEV;

/* ── 메인 컴포넌트 ───────────────────────────────────────── */
export function Home() {
  const [, navigate] = useLocation();
  const { user, signIn } = useAuthState();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(tickStreakOnVisit());
  }, []);

  const lastVisit = getLastVisit();
  const lastApp = lastVisit
    ? ALL_APPS.find((a) => a.id === lastVisit.id) ?? null
    : null;

  const handleAppClick = (id: string) => recordVisit(id);

  const handleStartNow = () => {
    const target = lastApp?.id ?? "heads-up";
    recordVisit(target);
    navigate(lastApp?.path ?? "/heads-up");
  };

  const handleLoginClick = () => {
    if (user) return;
    signIn().catch(() => {});
  };

  void streak;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ── 전체 페이지 비디오 배경 (fixed) ─────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
        style={{ zIndex: 0 }}
        src={heroBg}
      />

      {/* ── 히어로 + 카드 — 풀 뷰포트 ──────────────────────── */}
      <section
        className="relative flex min-h-0 flex-1 flex-col"
        style={{ zIndex: 1 }}
      >
        {/* ── 히어로 텍스트 ── */}
        <div
          className="relative flex flex-none items-start px-4 pt-10 pb-5 sm:flex-1 sm:items-center sm:py-14 sm:px-7"
          style={{ zIndex: 1 }}
        >
          <div className="mx-auto w-full max-w-6xl" style={{ paddingLeft: "16px" }}>
            <div style={{ maxWidth: "420px", position: "relative" }}>
              {/* 브랜드 레이블 */}
              <p
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                  color: "rgba(255,252,243,0.50)",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Poker Training Lab
              </p>

              {/* 메인 타이틀 */}
              <h1
                style={{
                  fontSize: "clamp(28px, 5.5vw, 56px)",
                  fontWeight: 700,
                  color: "#FFFCF3",
                  letterSpacing: "0.03em",
                  lineHeight: 1.1,
                  marginBottom: "10px",
                  textTransform: "uppercase",
                }}
              >
                <span style={{ color: "#BA0C19" }}>MIMIC</span> PLAYLAB
              </h1>

              {/* 서브카피 — 모바일에서 숨김 */}
              <p
                className="hidden sm:block"
                style={{
                  fontSize: "16px",
                  color: "rgba(255,252,243,0.72)",
                  letterSpacing: "0.02em",
                  lineHeight: 1.7,
                  marginBottom: "28px",
                  maxWidth: "340px",
                }}
              >
                퀴즈부터 대결까지,
                <br />
                포커 감각을 실험하는 공간
              </p>
              {/* 서브카피 — 모바일 한 줄 */}
              <p
                className="sm:hidden"
                style={{
                  fontSize: "13px",
                  color: "rgba(255,252,243,0.65)",
                  marginBottom: "20px",
                }}
              >
                퀴즈부터 대결까지, 포커 감각을 실험하는 공간
              </p>

              {/* CTA */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleStartNow}
                  style={{
                    background: "#BA0C19",
                    color: "#FFFCF3",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.20em",
                    textTransform: "uppercase",
                    padding: "13px 28px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  지금 바로 시작 →
                </button>
                <Link
                  href="/heads-up"
                  onClick={() => recordVisit("heads-up")}
                  style={{
                    display: "inline-block",
                    border: "1px solid rgba(255,252,243,0.35)",
                    color: "#FFFCF3",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    padding: "10px 22px",
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  HEADS-UP 한 판 →
                </Link>
              </div>

              <button
                type="button"
                onClick={handleLoginClick}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,252,243,0.25)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  marginTop: "14px",
                  display: "block",
                }}
              >
                {user ? (user.displayName ?? "로그아웃") : "로그인"}
              </button>
            </div>
          </div>
        </div>

        {/* ── 모드 카드 — 하단 ── */}
        <div className="relative px-4 pb-4 sm:pb-8 sm:px-7" style={{ zIndex: 1 }}>
          <div className="mx-auto max-w-[430px]">
            <div
              style={{
                background: "rgba(255,255,255,0.28)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.40)",
                padding: "12px",
              }}
            >
              {/* HEADS-UP — 피처드 */}
              <Link
                href={FEATURED.path}
                onClick={() => handleAppClick(FEATURED.id)}
                className="group mb-2 block"
              >
                <div
                  className="relative overflow-hidden transition-opacity hover:opacity-90"
                  style={{
                    background: "rgba(10,10,10,0.72)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    padding: "16px 20px",
                  }}
                >
                  <div
                    className="absolute left-0 right-0 top-0"
                    style={{ height: "2px", background: "#BA0C19" }}
                  />
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p style={{ fontSize: "9px", letterSpacing: "0.3em", color: "#BA0C19", textTransform: "uppercase", marginBottom: "5px" }}>
                        {FEATURED.tag}
                      </p>
                      <p style={{ fontSize: "20px", fontWeight: 700, color: "#FFFCF3", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                        {FEATURED.title}
                      </p>
                      <p className="hidden sm:block" style={{ fontSize: "12px", color: "rgba(255,252,243,0.72)", lineHeight: 1.5 }}>
                        {FEATURED.desc}
                      </p>
                    </div>
                    <p
                      style={{
                        flexShrink: 0,
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        color: "#FFFCF3",
                        textTransform: "uppercase",
                      }}
                    >
                      시작하기 →
                    </p>
                  </div>
                </div>
              </Link>

              {/* PLAY MODES 라벨 */}
              <p
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.35em",
                  color: "rgba(255,252,243,0.50)",
                  textTransform: "uppercase",
                  marginTop: "4px",
                  marginBottom: "6px",
                  paddingLeft: "2px",
                }}
              >
                Play Modes
              </p>

              {/* 서브 모드 3개 — 모바일도 3열 */}
              <div className="grid grid-cols-3 gap-1.5">
                {SECONDARY.map((app) => (
                  <Link
                    key={app.id}
                    href={app.path}
                    onClick={() => handleAppClick(app.id)}
                    className="block"
                  >
                    <div
                      className="relative flex flex-col overflow-hidden transition-opacity hover:opacity-90"
                      style={{
                        background: "rgba(10,10,10,0.65)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        padding: "12px 10px",
                        minHeight: "80px",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        className="absolute left-0 right-0 top-0"
                        style={{ height: "2px", background: app.accentColor }}
                      />
                      <div>
                        <p style={{ fontSize: "8px", letterSpacing: "0.15em", color: "rgba(255,252,243,0.55)", textTransform: "uppercase", marginBottom: "4px" }}>
                          {app.tag}
                        </p>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#FFFCF3", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>
                          {app.title}
                        </p>
                        <p className="hidden sm:block" style={{ fontSize: "11px", color: "rgba(255,252,243,0.70)", lineHeight: 1.5 }}>
                          {app.desc}
                        </p>
                      </div>
                      <p style={{ fontSize: "9px", color: app.enterColor ?? "rgba(255,252,243,0.75)", marginTop: "8px", letterSpacing: "0.08em", fontWeight: 600 }}>
                        {app.enterLabel ?? "시작하기 →"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 푸터 — 데스크톱만 ── */}
      <footer
        className="relative hidden sm:flex"
        style={{
          zIndex: 1,
          background: "transparent",
          borderTop: "1px solid rgba(255,252,243,0.05)",
          padding: "14px 28px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "9px", letterSpacing: "0.18em", color: "rgba(255,252,243,0.18)", fontStyle: "italic" }}>
          "All in Fun" — MIMIC
        </span>
        <span style={{ fontSize: "9px", letterSpacing: "0.1em", color: "rgba(255,252,243,0.14)" }}>
          © 2026 MIMIC PLAYLAB
        </span>
      </footer>

      {isDev && (
        <div className="relative hidden sm:block" style={{ zIndex: 1, padding: "8px 28px" }}>
          <Link
            href="/dev/cards"
            style={{ fontSize: "11px", color: "rgba(255,252,243,0.28)", textDecoration: "underline" }}
          >
            /dev/cards
          </Link>
        </div>
      )}
    </div>
  );
}
