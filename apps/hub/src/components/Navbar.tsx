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

export function Navbar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const isLight = location.startsWith("/concept-quiz");
  const { user, busy, error, signIn, signOut, providerName } = useAuthState();
  const [errorBubble, setErrorBubble] = useState<string | null>(null);

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
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        backgroundColor: isLight ? "rgba(255,255,255,0.97)" : "rgba(10,10,10,0.92)",
        borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(168,0,20,0.2)",
      }}
    >
      <nav className="mx-auto flex h-[52px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-0 text-[13px] font-bold tracking-[0.22em] uppercase"
          style={{ color: isLight ? "#1a1a2e" : "#FFFCF3" }}
        >
          <span style={{ color: "#A80014" }}>MIMIC</span>
          <span className="ml-[0.22em]">PLAYLAB</span>
        </Link>

        {/* Desktop nav links */}
        {!isMobile && (
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
          {isMobile && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
              className="rounded p-2 transition-colors"
              style={{ color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,252,243,0.6)" }}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile drawer */}
      {isMobile && open && (
        <ul
          className="flex flex-col gap-0.5 px-4 pb-3 pt-2"
          style={{ borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,252,243,0.08)" }}
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
