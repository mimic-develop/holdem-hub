import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { createQueryClient, createFirebaseAuthProvider, registerAuthProvider } from "@hh/shared";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { DevCards } from "./pages/DevCards";

// ── Firebase 초기화 (VITE_AUTH_PROVIDER=firebase 일 때 Hub 전역 로그인) ──
// 환경변수 접근: Vite static 감지를 위해 옵셔널 체이닝 금지, 직접 접근 사용.
const _hubEnv = (import.meta as unknown as { env: Record<string, unknown> }).env;
if (_hubEnv.VITE_AUTH_PROVIDER === "firebase" && _hubEnv.VITE_FIREBASE_API_KEY) {
  // 동적 import — Firebase SDK는 필요 시에만 로드 (초기 번들 분할)
  import("firebase/app").then(({ initializeApp }) => {
    import("firebase/auth").then(({ getAuth }) => {
      const firebaseApp = initializeApp({
        apiKey:            String(_hubEnv.VITE_FIREBASE_API_KEY),
        authDomain:        String(_hubEnv.VITE_FIREBASE_AUTH_DOMAIN ?? ""),
        projectId:         String(_hubEnv.VITE_FIREBASE_PROJECT_ID ?? ""),
        storageBucket:     String(_hubEnv.VITE_FIREBASE_STORAGE_BUCKET ?? ""),
        messagingSenderId: String(_hubEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ""),
        appId:             String(_hubEnv.VITE_FIREBASE_APP_ID ?? ""),
        measurementId:     String(_hubEnv.VITE_FIREBASE_MEASUREMENT_ID ?? ""),
      }, "hub"); // "hub" name으로 concept-quiz Firebase 앱과 충돌 방지
      const firebaseAuth = getAuth(firebaseApp);
      registerAuthProvider(createFirebaseAuthProvider(firebaseAuth));
    });
  });
}

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
