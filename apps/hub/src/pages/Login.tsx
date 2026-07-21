import { useLocation } from "wouter";
import { redirectToUnifiedLogin } from "../lib/unifiedLogin";

export function Login() {
  const [, navigate] = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#000", color: "#fff" }}>
      <div className="w-full max-w-sm space-y-6 rounded-xl p-8 text-center" style={{ background: "rgb(0, 0, 0)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold tracking-[0.22em] uppercase text-[rgba(255,252,243,0.4)]">
            MIMIC PLAYLAB
          </p>
          <h1 className="text-xl font-bold tracking-tight">로그인</h1>
        </div>

        <button
          type="button"
          onClick={() => redirectToUnifiedLogin()}
          className="w-full rounded-md bg-[#E53935] py-2.5 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90 cursor-pointer"
        >
          MIMIC 계정으로 로그인
        </button>

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
