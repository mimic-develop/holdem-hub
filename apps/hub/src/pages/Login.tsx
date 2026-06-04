import { useState } from "react";
import { useLocation } from "wouter";
import { getActiveAuthProvider, AuthError } from "@hh/shared";

const ERROR_MESSAGES: Record<string, string> = {
  "40101": "존재하지 않는 계정입니다.",
  "40103": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "400025": "정지된 계정입니다. 관리자에게 문의해주세요.",
  "400026": "차단된 계정입니다. 관리자에게 문의해주세요.",
  "400000": "가입된 계정이 없습니다.",
  "None registered account": "가입된 계정이 없습니다."
};

function resolveError(err: unknown): string {
  if (err instanceof AuthError) {
    return ERROR_MESSAGES[err.code] ?? `오류가 발생했습니다. (${err.code})`;
  }
  if (err instanceof Error) return err.message;
  return "로그인 중 오류가 발생했습니다.";
}

export function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("error");
    if (!raw) return null;

    const decoded = decodeURIComponent(raw);

    if (ERROR_MESSAGES[decoded]) {
      return ERROR_MESSAGES[decoded];
    }
    if (decoded === "oauth_failed") return "소셜 로그인에 실패했습니다.";

    try {
      if (decoded.includes("{")) {
        const parsed = JSON.parse(decoded);
        const code = parsed.code || parsed.message;
        if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
      }
    } catch (e) {}

    return decoded;
  });

  const provider = getActiveAuthProvider();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider.signInWithEmail) return;
    setBusy(true);
    setError(null);
    try {
      await provider.signInWithEmail(email, password);
      navigate("/");
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSns = async (method: "signInWithGoogle" | "signInWithNaver" | "signInWithApple") => {
    const fn = provider[method];
    if (!fn) return;
    setBusy(true);
    setError(null);
    try {
      await fn.call(provider);
      navigate("/");
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#000", color: "#fff" }}>
      <div className="w-full max-w-sm space-y-6 rounded-xl p-8" style={{ background: "rgb(0, 0, 0)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-extrabold tracking-[0.22em] uppercase text-[rgba(255,252,243,0.4)]">
            MIMIC PLAYLAB
          </p>
          <h1 className="text-xl font-bold tracking-tight">로그인</h1>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            className="w-full rounded-md border border-[rgba(255,252,243,0.12)] bg-[rgba(255,252,243,0.05)] px-4 py-2.5 text-sm placeholder:text-[rgba(255,252,243,0.3)] focus:outline-none focus:border-[#E53935] disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
            className="w-full rounded-md border border-[rgba(255,252,243,0.12)] bg-[rgba(255,252,243,0.05)] px-4 py-2.5 text-sm placeholder:text-[rgba(255,252,243,0.3)] focus:outline-none focus:border-[#E53935] disabled:opacity-50"
          />

          {error && (
            <p role="alert" className="text-xs text-rose-400 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[#E53935] py-2.5 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50 cursor-pointer"
          >
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[rgba(255,252,243,0.1)]" />
          <span className="text-[10px] tracking-widest text-[rgba(255,252,243,0.3)] uppercase">or</span>
          <div className="h-px flex-1 bg-[rgba(255,252,243,0.1)]" />
        </div>

        <div className="space-y-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSns("signInWithGoogle")}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[rgba(255,252,243,0.12)] py-2.5 text-sm font-medium text-[rgba(255,252,243,0.7)] transition-colors hover:bg-[rgba(255,252,243,0.05)] disabled:opacity-40 cursor-pointer"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>

          {/* Naver Login with Badge */}
          <div className="relative">
            <div className="absolute -top-2.5 left-3 px-1.5 py-0.5 rounded-full bg-[#03C75A] text-[9px] font-bold text-white leading-none z-10 shadow-lg">
              로그인 가능
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSns("signInWithNaver")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[rgba(255,252,243,0.12)] py-2.5 text-sm font-medium text-[rgba(255,252,243,0.7)] transition-colors hover:bg-[rgba(255,252,243,0.05)] disabled:opacity-40 cursor-pointer"
            >
              <NaverIcon />
              네이버로 계속하기
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => handleSns("signInWithApple")}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[rgba(255,252,243,0.12)] py-2.5 text-sm font-medium text-[rgba(255,252,243,0.7)] transition-colors hover:bg-[rgba(255,252,243,0.05)] disabled:opacity-40 cursor-pointer"
          >
            <AppleIcon />
            Apple로 계속하기
          </button>
        </div>

        <p className="text-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-xs text-[rgba(255,252,243,0.35)] hover:text-[rgba(255,252,243,0.6)] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#03C75A"/>
      <path d="M13.5 12.3L10.2 7H7v10h3.5V11.7l3.3 5.3H17V7h-3.5v5.3z" fill="white"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.43c1.4.07 2.38.74 3.2.8 1.22-.24 2.38-.94 3.7-.84 1.58.12 2.77.74 3.54 1.9-3.25 1.95-2.48 5.87.58 7.02-.68 1.77-1.56 3.5-3.02 4.97zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
