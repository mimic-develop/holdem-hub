import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/use-toast";
import mimicLogo from "../assets/mimic-logo.png";
import bgVideo from "../assets/bg_sdr.mp4";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ height: "100dvh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="w-8 h-8 border-3 border-gray-200 border-t-[#E5343A] rounded-full animate-spin" />
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
        style={{
          maxWidth: 430,
          height: "100%",
        }}
      >
        <video
          autoPlay
          muted
          playsInline
          loop
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0, transform: "scaleX(-1)" }}
          src={bgVideo}
        />

        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0.85) 100%)",
          }}
        />

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
                fontFamily: "'Nunito', sans-serif",
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
                marginBottom: 48,
              }}
            >
              텍사스 홀덤 퀴즈로<br />포커 실력을 키워보세요
            </p>

            <motion.button
              onClick={async () => {
                if (isSigningIn) return;
                setIsSigningIn(true);
                try {
                  await signInWithGoogle();
                } catch {
                  toast({ title: "로그인이 취소되었습니다", variant: "destructive" });
                } finally {
                  setIsSigningIn(false);
                }
              }}
              disabled={isSigningIn}
              className="flex items-center gap-3 rounded-2xl font-bold text-[15px] active:scale-[0.97] transition-transform disabled:opacity-60 disabled:pointer-events-none"
              style={{
                background: "#ffffff",
                color: "#1a1a2e",
                padding: "14px 32px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.06)",
                width: "100%",
                maxWidth: 300,
                justifyContent: "center",
              }}
              whileTap={{ scale: 0.97 }}
              data-testid="btn-google-login"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-[#E5343A] rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.04 24.04 0 000 21.56l7.98-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              )}
              {isSigningIn ? "로그인 중..." : "Google로 로그인"}
            </motion.button>

            <p
              className="text-center mt-6"
              style={{
                fontSize: 11,
                color: "rgba(0,0,0,0.3)",
                lineHeight: 1.6,
              }}
            >
              로그인하면 진행 상황이 자동으로 저장됩니다
            </p>
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
