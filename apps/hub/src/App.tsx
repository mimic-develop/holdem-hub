import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";
import { createQueryClient, useAuthState, apiFetch, setPlayLapHomeCache } from "@hh/shared";
import type { PlayLapHomeData } from "@hh/shared";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { NaverUnavailable } from "./pages/NaverUnavailable";
import { OAuthCallback } from "./pages/OAuthCallback";
import { SnsCallback } from "./pages/SnsCallback";
import { NotFound } from "./pages/NotFound";
import { DevCards } from "./pages/DevCards";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";

const isDev = import.meta.env.DEV;

// 각 sub-app은 코드 분할되어 필요할 때만 로드된다.
const PotQuizApp = lazy(() => import("@hh/pot-quiz"));
const NutTo3App = lazy(() => import("@hh/nut-to-3"));
const ConceptQuizApp = lazy(() => import("@hh/concept-quiz"));
const HeadsUpApp = lazy(() => import("@hh/heads-up"));

const queryClient = createQueryClient();

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-zinc-400">
      <span className="animate-pulse text-sm">로드 중…</span>
    </div>
  );
}

export function App() {
  const { user } = useAuthState();
  const [homeData, setHomeData] = useState<PlayLapHomeData | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    if (!user) {
      setHomeData(null);
      return;
    }
    // "/" 라우트 진입 시마다 최신 데이터 fetch
    if (location !== "/") return;
    void apiFetch<PlayLapHomeData>("/play-lab/home")
      .then(data => {
        setHomeData(data);
        setPlayLapHomeCache(data);
      })
      .catch(() => {});
  }, [user?.id, location]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-hub min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="pt-[52px]">
          <Suspense fallback={<PageFallback />}>
            <Switch>
              <Route path="/login">
                <Login />
              </Route>
              <Route path="/oauth/redirect">
                <OAuthCallback />
              </Route>
              <Route path="/oauth/redirect/naver">
                <SnsCallback snsType="NAVER" />
              </Route>
              <Route path="/oauth/redirect/google">
                <SnsCallback snsType="GOOGLE" />
              </Route>
              <Route path="/oauth/redirect/apple">
                <SnsCallback snsType="APPLE" />
              </Route>
              {/* Home 페이지는 자체 풀폭 레이아웃을 가짐 */}
              <Route path="/">
                <Home />
              </Route>
              {isDev && (
                <Route path="/dev/cards">
                  <div className="mx-auto max-w-6xl px-4 py-8">
                    <DevCards />
                  </div>
                </Route>
              )}
              {/* Sub-app은 자체 레이아웃을 가지므로 풀폭으로 마운트 */}
              <Route path="/pot-quiz" nest>
                <PotQuizApp />
              </Route>
              <Route path="/nut-to-3" nest>
                <NutTo3App
                  initialStreak={homeData?.nutStreak ?? 0}
                  initialBestStreak={homeData?.nutBestStreak ?? 0}
                />
              </Route>
              <Route path="/concept-quiz" nest>
                <ConceptQuizApp lastClearedCard={homeData?.lastClearedCard ?? null} />
              </Route>
              <Route path="/heads-up" nest>
                <HeadsUpApp />
              </Route>
              <Route path="/terms">
                <div className="mx-auto max-w-3xl px-4 py-8">
                  <Terms />
                </div>
              </Route>
              <Route path="/privacy">
                <div className="mx-auto max-w-3xl px-4 py-8">
                  <Privacy />
                </div>
              </Route>
              <Route>
                <div className="mx-auto max-w-6xl px-4 py-8">
                  <NotFound />
                </div>
              </Route>
            </Switch>
          </Suspense>
        </main>
      </div>
    </QueryClientProvider>
  );
}
