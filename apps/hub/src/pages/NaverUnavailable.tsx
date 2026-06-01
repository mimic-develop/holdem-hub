// TODO(naver-login): 네이버 로그인 연동 재개 시 이 파일 전체와 App.tsx의 라우트 제거
import { useState } from "react";
import { useLocation } from "wouter";
import { getActiveAuthProvider, AuthError } from "@hh/shared";

const ERROR_MESSAGES: Record<string, string> = {
  "40101": "존재하지 않는 계정입니다.",
  "40103": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "400025": "정지된 계정입니다. 관리자에게 문의해주세요.",
  "400026": "차단된 계정입니다. 관리자에게 문의해주세요.",
  "400000": "가입된 계정이 없습니다.",
  "None registered account": "가입된 계정이 없습니다.",
};

function resolveError(err: unknown): string {
  if (err instanceof AuthError) {
    return ERROR_MESSAGES[err.code] ?? `오류가 발생했습니다. (${err.code})`;
  }
  if (err instanceof Error) return err.message;
  return "로그인 중 오류가 발생했습니다.";
}

export function NaverUnavailable() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#000", color: "#fff" }}>
      <div className="w-full max-w-sm space-y-6 rounded-xl p-8" style={{ background: "rgb(0, 0, 0)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="flex items-center gap-1.5 text-xs text-[rgba(255,252,243,0.4)] hover:text-[rgba(255,252,243,0.7)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          로그인으로 돌아가기
        </button>

        {/* 안내 문구 */}
        <div className="space-y-3 rounded-lg border border-[rgba(255,252,243,0.1)] bg-[rgba(255,252,243,0.04)] p-4">
          <div className="flex items-center gap-2">
            <NaverIcon />
            <p className="text-sm font-semibold text-[rgba(255,252,243,0.85)]">
              네이버 로그인은 현재 준비 중이에요.
            </p>
          </div>
          <p className="text-sm text-[rgba(255,252,243,0.55)]">
            아래 이메일 로그인을 이용해 주세요.
          </p>
          <p className="text-xs text-[rgba(255,252,243,0.4)] leading-relaxed">
            비밀번호가 기억나지 않으신다면<br />
            <span className="text-[rgba(255,252,243,0.6)]">마이플레이 → 프로필 설정 → 비밀번호 변경</span>
            에서 재설정할 수 있어요.
          </p>
        </div>

        {/* 이메일 로그인 폼 — signInWithEmail API 사용 (일반 로그인과 동일) */}
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
            {busy ? "로그인 중…" : "이메일로 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NaverIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#03C75A" />
      <path d="M13.5 12.3L10.2 7H7v10h3.5V11.7l3.3 5.3H17V7h-3.5v5.3z" fill="white" />
    </svg>
  );
}
