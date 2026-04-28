/**
 * @hh/concept-quiz — 홀덤 개념 퀴즈 (Poker-Quiz-Master 이식)
 *
 * Hub의 `<Route path="/concept-quiz" nest>` 안에서 마운트된다.
 * - 라이트 테마 + #E5343A + Pretendard: `.app-concept-quiz` 스코프 격리
 * - Firebase Auth (Google) + Firestore 진행률 동기화 (원본 유지)
 * - VITE_FIREBASE_API_KEY가 없으면 로그인은 실패하지만 UI 자체는 로드됨
 */

import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthContext, useAuthProvider, useAuth } from "./hooks/useAuth";
import NotFound from "./pages/not-found";
import Home from "./pages/home";
import Quiz from "./pages/quiz";
import Login from "./pages/login";
import "./index.css";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: "60vh",
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

  if (!user) return <Redirect to="/login" />;

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AuthGuard>
          <Home />
        </AuthGuard>
      </Route>
      <Route path="/quiz/:category">
        <AuthGuard>
          <Quiz />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function ConceptQuizApp() {
  const authValue = useAuthProvider();

  return (
    <div className="app-concept-quiz bg-background text-foreground">
      <AuthContext.Provider value={authValue}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthContext.Provider>
    </div>
  );
}
