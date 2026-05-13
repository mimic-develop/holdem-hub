import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useIsMobile, cn, useAuthState } from "@hh/shared";

const NAV_ITEMS = [
  { label: "홈", path: "/" },
  { label: "POT SPLIT", path: "/pot-quiz" },
  { label: "NUT TO 3", path: "/nut-to-3" },
  { label: "POKER IQ", path: "/concept-quiz" },
  { label: "HEADS-UP", path: "/heads-up" },
] as const;

// Sub-app별 라이트/다크 테마 — Navbar 색상 자동 결정
// `/` (Hub 홈)은 비디오 + 다크 배경이므로 dark
const APP_THEME: { prefix: string; theme: "light" | "dark" }[] = [
  { prefix: "/concept-quiz", theme: "light" },
  { prefix: "/pot-quiz", theme: "light" },
  { prefix: "/heads-up", theme: "dark" },
  { prefix: "/nut-to-3", theme: "dark" },
];

function resolveTheme(loc: string): "light" | "dark" {
  for (const { prefix, theme } of APP_THEME) {
    if (loc.startsWith(prefix)) return theme;
  }
  return "dark"; // Hub home (/) — 비디오 배경이라 dark
}

export function Navbar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const isLight = resolveTheme(location) === "light";
  const isHome = location === "/";
  const { user, busy, error, signIn, signOut, providerName } = useAuthState();
  const [errorBubble, setErrorBubble] = useState<string | null>(null);

  // Hub 홈에서는 hero의 MIMIC PLAYLAB 타이틀이 화면에 있을 때 navbar 로고만 숨김 →
  // 히어로 타이틀이 스크롤로 가려지면 navbar 로고가 슬라이드인. 다른 라우트는 항상 노출.
  const [logoHidden, setLogoHidden] = useState(isHome);
  useEffect(() => {
    if (!isHome) {
      setLogoHidden(false);
      return;
    }
    const handler = () => {
      // 히어로 영역(약 200px)을 지나면 로고 노출
      setLogoHidden(window.scrollY < 200);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [isHome]);

  // signIn 에러는 4초간 작은 토스트(브라우저 alert 대체)로만 표시 — UI 폭주 방지.
  useEffect(() => {
    if (!error) return;
    setErrorBubble(error.message);
    const t = setTimeout(() => setErrorBubble(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const handleAuthClick = async () => {
    if (busy) return;
    if (user) {
      await signOut();
    } else {
      await signIn();
    }
  };

  const authLabel = user
    ? user.displayName || user.email || "로그아웃"
    : busy
      ? "로그인 중…"
      : "로그인";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 backdrop-blur-md"
      style={{
        backgroundColor: isLight ? "rgba(255,255,255,0.97)" : "rgba(10,10,10,0.92)",
        borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(168,0,20,0.2)",
      }}
    >
      <nav className="mx-auto flex h-[52px] max-w-[430px] items-center justify-between gap-4 px-4">
        {/* Logo — Hub 홈에서는 hero 타이틀이 보일 때 숨겨졌다가, 히어로가 스크롤되면 슬라이드인 */}
        <Link
          href="/"
          className="flex items-center gap-0 text-[13px] font-extrabold tracking-[0.18em] uppercase"
          style={{
            color: isLight ? "#1a1a2e" : "#FFFCF3",
            opacity: logoHidden ? 0 : 1,
            transform: logoHidden ? "translateY(-8px)" : "translateY(0)",
            transition: "opacity 0.28s ease, transform 0.28s ease",
            pointerEvents: logoHidden ? "none" : "auto",
            willChange: "opacity, transform",
          }}
        >
          <span style={{ color: "#E53935" }}>MIMIC</span>
          <span className="ml-[0.18em]">PLAYLAB</span>
        </Link>

        {/* Desktop nav links — 모바일 레이아웃 통일을 위해 항상 햄버거 메뉴 사용 (현재 비활성) */}
        {false && !isMobile && (
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={cn(
                    "px-3 py-2 text-[10px] font-medium tracking-[0.14em] uppercase transition-colors",
                    isActive(item.path)
                      ? isLight ? "text-[#1a1a2e]" : "text-[#FFFCF3]"
                      : isLight ? "text-[rgba(0,0,0,0.45)] hover:text-[rgba(0,0,0,0.75)]" : "text-[rgba(255,252,243,0.58)] hover:text-[rgba(255,252,243,0.88)]",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Right: auth + hamburger */}
        <div className="relative flex items-center gap-2">
          {errorBubble && (
            <span
              role="alert"
              className="absolute right-0 top-full mt-2 max-w-xs rounded-md border border-rose-900/40 bg-[#1a0008] px-3 py-1.5 text-xs text-rose-300 shadow-lg"
            >
              {errorBubble}
            </span>
          )}
          <button
            type="button"
            onClick={handleAuthClick}
            disabled={busy}
            className={cn(
              "rounded px-3 py-[5px] text-[10px] font-medium tracking-[0.12em] uppercase transition-colors",
              busy && "cursor-wait opacity-50",
            )}
            style={{
              color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,252,243,0.7)",
              border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,252,243,0.15)",
            }}
            title={
              user
                ? `${providerName} provider`
                : providerName === "none"
                  ? "VITE_AUTH_PROVIDER 미설정 — 인증 비활성"
                  : `${providerName} provider로 로그인`
            }
          >
            {authLabel}
          </button>
          {/* 모바일·데스크톱 공통 햄버거 메뉴 */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            className="rounded p-2 transition-colors"
            style={{ color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,252,243,0.6)" }}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Drawer — 모바일/데스크톱 공통 */}
      {open && (
        <ul
          className="mx-auto flex flex-col gap-0.5 px-4 pb-3 pt-2"
          style={{
            maxWidth: 430,
            borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,252,243,0.08)",
          }}
        >
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-2 py-2.5 text-[11px] font-medium tracking-[0.12em] uppercase transition-colors",
                  isActive(item.path)
                    ? isLight ? "text-[#1a1a2e]" : "text-[#FFFCF3]"
                    : isLight ? "text-[rgba(0,0,0,0.45)] hover:text-[rgba(0,0,0,0.75)]" : "text-[rgba(255,252,243,0.58)] hover:text-[rgba(255,252,243,0.88)]",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
