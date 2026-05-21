import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { createQueryClient } from "@hh/shared";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { OAuthCallback } from "./pages/OAuthCallback";
import { NotFound } from "./pages/NotFound";
import { DevCards } from "./pages/DevCards";

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
                <NutTo3App />
              </Route>
              <Route path="/concept-quiz" nest>
                <ConceptQuizApp />
              </Route>
              <Route path="/heads-up" nest>
                <HeadsUpApp />
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
