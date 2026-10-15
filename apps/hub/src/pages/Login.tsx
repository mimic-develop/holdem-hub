import { useState } from "react";
import { useLocation } from "wouter";
import { isAutoLoginEnabled, setAutoLoginEnabled } from "@hh/shared";
import { redirectToUnifiedLogin } from "../lib/unifiedLogin";

export function Login() {
  const [, navigate] = useLocation();
  // 마지막에 고른 값을 기본값으로 보여준다 (한 번도 고른 적 없으면 해제 상태)
  const [autoLogin, setAutoLogin] = useState(() => isAutoLoginEnabled());

  const handleLogin = () => {
    // 통합 로그인 페이지로 나갔다 돌아오면 이 컴포넌트는 사라진다.
    // 체크 여부를 먼저 저장해 두고, 콜백의 setTokens가 읽어 쿠키 수명을 정한다.
    setAutoLoginEnabled(autoLogin);
    redirectToUnifiedLogin();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#000", color: "#fff" }}>
      <div className="w-full max-w-sm space-y-6 rounded-xl p-8 text-center" style={{ background: "rgb(0, 0, 0)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold tracking-[0.22em] uppercase text-[rgba(255,252,243,0.4)]">
            MIMIC PLAYLAB
          </p>
          <h1 className="text-xl font-bold tracking-tight">로그인</h1>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-md bg-[#E53935] py-2.5 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            MIMIC 계정으로 로그인
          </button>

          {/* 로그인 버튼 바로 아래. 체크를 바꾸는 것만으로는 저장되지 않고, 로그인 버튼을 눌러야 저장된다. */}
          <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-[rgba(255,252,243,0.7)]">
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[#E53935]"
            />
            자동 로그인
          </label>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xs text-[rgba(255,252,243,0.35)] hover:text-[rgba(255,252,243,0.6)] transition-colors cursor-pointer"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
