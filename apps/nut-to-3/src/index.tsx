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
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { LoginGate } from "@hh/ui";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Home from "./pages/Home";
import NotFound from "./pages/not-found";
import mimicLogo from "./assets/mimic-logo.png";
import "./index.css";

export default function NutTo3App() {
  return (
    <LoginGate appName="NUT TO 3" subtitle="너트 핸드 맞추기" logoSrc={mimicLogo}>
      <div className="app-nut-to-3 bg-background text-foreground" data-theme="dark">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Switch>
              <Route path="/" component={Home} />
              <Route component={NotFound} />
            </Switch>
          </TooltipProvider>
        </QueryClientProvider>
      </div>
    </LoginGate>
  );
}
