/**
 * @hh/pot-quiz — 팟 분배 퀴즈 (MIMIC-Assets 이식)
 *
 * Hub의 `<Route path="/pot-quiz" nest>` 안에서 마운트된다.
 * - 라이트 테마 + MIMIC red(#BA0C19) — 원본 다크 + 파랑에서 모노레포 통합 시 브랜드로 swap.
 *   기존 elevate 애니메이션은 그대로 보존, hover overlay만 어두운 톤으로 반전 (`index.css` 참조).
 *   `.app-pot-quiz` 스코프로 다른 sub-app과 CSS 격리.
 * - 라우팅: wouter (Hub와 동일). nest 컨텍스트 안에서 `/`, `/quiz/:difficulty` 등 상대 경로
 */

import { Switch, Route } from "wouter";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Summary from "./pages/Summary";
import NotFound from "./pages/not-found";
import "./index.css";

export default function PotQuizApp() {
  return (
    <div className="app-pot-quiz bg-background text-foreground">
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/quiz/:difficulty" component={Quiz} />
          <Route path="/summary/:difficulty" component={Summary} />
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </div>
  );
}
