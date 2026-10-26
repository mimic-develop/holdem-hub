/**
 * @hh/nut-to-3 — 너트 핸드 맞추기 (Nut-to-3 이식)
 *
 * Hub의 `<Route path="/nut-to-3" nest>` 안에서 마운트.
 * - 라이트 테마(MIMIC red 0 84% 45%) + DM Sans/Outfit 폰트
 * - `.app-nut-to-3` 스코프 격리 → 다른 sub-app과 CSS 변수 충돌 방지
 * - 서버 API: `/api/nut-to-3/game/new` (Hub Vite proxy → @hh/api 3001)
 * - QueryClientProvider는 이 sub-app 내부에서 자체 관리
 *   (다른 sub-app과 캐시 공유 의도 없음, 의존성 명확화)
 */
import { useRef } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { LoginGate } from "@hh/ui";
import { queryClient } from "./lib/queryClient";
import { api } from "./lib/api-schema";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Home from "./pages/Home";
import NotFound from "./pages/not-found";
import mimicLogo from "./assets/mimic-logo.png";
import "./index.css";

interface NutTo3AppProps {
  initialStreak?: number;
  initialBestStreak?: number;
}

export default function NutTo3App({ initialStreak = 0, initialBestStreak = 0 }: NutTo3AppProps) {
  // mount마다 게임 캐시 제거: render phase에서 실행돼 children 보다 먼저 처리됨 (Bug 3 fix)
  // 키는 use-game.ts 의 queryKey 첫 요소(api.game.new.path)와 반드시 일치해야 함.
  // 하드코딩 문자열이 경로 변경 시 어긋나 캐시가 안 지워지던 버그가 있었음.
  const didClearRef = useRef(false);
  if (!didClearRef.current) {
    didClearRef.current = true;
    queryClient.removeQueries({ queryKey: [api.game.new.path], exact: false });
  }

  return (
    <LoginGate appName="NUT TO 3" subtitle="너트 핸드 맞추기" logoSrc={mimicLogo}>
      <div className="app-nut-to-3 bg-background text-foreground" data-theme="dark">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Switch>
              <Route path="/">
                <Home initialStreak={initialStreak} initialBestStreak={initialBestStreak} />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </TooltipProvider>
        </QueryClientProvider>
      </div>
    </LoginGate>
  );
}
