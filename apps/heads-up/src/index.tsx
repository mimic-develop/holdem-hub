/**
 * @hh/heads-up — 헤즈업 트레이너 (mimic_heads_up 이식)
 *
 * Hub의 `<Route path="/heads-up" nest>` 안에서 마운트.
 *
 * - 다른 sub-app(wouter)과 달리 `react-router-dom v6` 사용. `<BrowserRouter basename="/heads-up">`
 *   로 base path 격리. RR6 `<Link>`/`useNavigate`는 자동으로 `/heads-up/...` prefix 적용.
 * - 다크 테마 + felt-green/gold/card-back 컬러 → `.app-heads-up` 스코프 격리
 * - 원본 `main.tsx`의 `registerSW()` PWA 등록은 Hub로 통합되어 여기서는 제거
 *   (manifest/Service Worker 정의는 `apps/hub/vite.config.ts`)
 * - localStorage / IndexedDB는 origin 단위로 공유. 키 prefix는 `heads-up:`로 격리
 *   (`storage/history.ts`의 DB 이름, `storage/settings.ts`/`stats.ts`의 localStorage 키 참조)
 */
import { BrowserRouter } from "react-router-dom";
import { LoginGate } from "@hh/ui";
import App from "./App";
import mimicLogo from "./assets/mimic-logo.png";
import "./index.css";

export default function HeadsUpApp() {
  return (
    <LoginGate appName="HEADS-UP" subtitle="헤즈업 트레이너" logoSrc={mimicLogo}>
      <div className="app-heads-up" data-theme="dark">
        {/*
          RR6 v6 + React 18 StrictMode + Suspense 조합에서 BrowserRouter가 render 도중
          history state를 sync 업데이트해서 발생하는 "Cannot update a component while
          rendering a different component" 경고 해결을 위해 v7 future flag 활성화.
          v7_startTransition: 상태 업데이트를 startTransition으로 defer (경고 제거).
          v7_relativeSplatPath: splat 라우트의 상대 경로 동작을 v7과 동일하게 (현재
          heads-up은 splat 라우트 미사용이라 영향 없음, 호환성 차원에서 함께 켬).
        */}
        <BrowserRouter
          basename="/heads-up"
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </BrowserRouter>
      </div>
    </LoginGate>
  );
}
