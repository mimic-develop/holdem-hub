import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useIsMobile, cn, useAuthState } from "@hh/shared";

const NAV_ITEMS = [
  { label: "홈", path: "/" },
  { label: "팟 퀴즈", path: "/pot-quiz" },
  { label: "너트 게임", path: "/nut-to-3" },
  { label: "개념 퀴즈", path: "/concept-quiz" },
  { label: "헤즈업", path: "/heads-up" },
] as const;

export function Navbar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
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
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-md"
            style={{ background: "var(--color-mimic-red)" }}
          />
          홀덤 허브
        </Link>

        {!isMobile && (
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="relative flex items-center gap-2">
          {errorBubble && (
            <span
              role="alert"
              className="absolute right-0 top-full mt-2 max-w-xs rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 shadow-sm"
            >
              {errorBubble}
            </span>
          )}
          <button
            type="button"
            onClick={handleAuthClick}
            disabled={busy}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              user
                ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
              busy && "cursor-wait opacity-60",
            )}
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
              className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </nav>

      {isMobile && open && (
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 border-t border-zinc-200 bg-white px-4 py-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
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
