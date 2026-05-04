import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import mimicLogo from "../assets/mimic-logo.png";
import bgVideo from "../assets/bg_sdr.mp4";

export default function Login() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div
        style={{
          height: "100dvh",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#E5343A] rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div
      style={{
        height: "100dvh",
        background: "#ffffff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="relative flex flex-col w-full overflow-hidden"
        style={{ maxWidth: 430, height: "100%" }}
      >
        {/* Background video */}
        <video
          autoPlay
          muted
          playsInline
          loop
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0, transform: "scaleX(-1)" }}
          src={bgVideo}
        />

        {/* Overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0.85) 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <img
              src={mimicLogo}
              alt="MIMIC"
              style={{ height: 36, marginBottom: 8 }}
              data-testid="login-logo"
            />
            <h1
              className="font-black tracking-tight"
              style={{
                fontSize: 32,
                color: "#1a1a2e",
                fontFamily:
                  "'Apple SD Gothic Neo', 'Noto Sans KR', 'Pretendard', sans-serif",
                marginBottom: 8,
              }}
            >
              Poker IQ
            </h1>
            <p
              className="text-center font-medium"
              style={{
                fontSize: 14,
                color: "rgba(0,0,0,0.45)",
                lineHeight: 1.5,
                marginBottom: 40,
              }}
            >
              텍사스 홀덤 퀴즈로
              <br />
              포커 실력을 키워보세요
            </p>

            {/* 상단 네비 로그인 안내 */}
            <div
              className="flex flex-col items-center gap-3 rounded-2xl px-6 py-5 text-center"
              style={{
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.08)",
                width: "100%",
                maxWidth: 300,
              }}
              data-testid="login-guide"
            >
              {/* 아이콘 */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "#E5343A" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>

              {/* 안내 문구 */}
              <p
                style={{
                  fontSize: 14,
                  color: "#1a1a2e",
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                화면 상단의 로그인 버튼을
                <br />
                눌러 시작하세요
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(0,0,0,0.4)",
                  lineHeight: 1.6,
                }}
              >
                MIMIC PLAYLAB 계정 하나로
                <br />
                모든 앱을 이용할 수 있습니다
              </p>
            </div>
          </motion.div>
        </div>

        <div
          className="relative z-10 text-center pb-8"
          style={{ fontSize: 10, color: "rgba(0,0,0,0.2)" }}
        >
          © MIMIC Poker IQ
        </div>
      </div>
    </div>
  );
}
