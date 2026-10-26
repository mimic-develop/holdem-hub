import ReactDOM from "react-dom/client";
import { Router } from "wouter";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";
// 모노레포 전체에서 사용하는 공통 카드 스타일 (한 번만 import)
import "@hh/ui/components/PlayingCard/styles.css";

/**
 * PWA 서비스워커 등록 + 새 버전 자동 적용.
 *
 * vite-plugin-pwa 의 `registerType: "autoUpdate"` 는 새 sw.js 를 설치하고 제어권까지 가져오지만,
 * 플러그인이 기본 주입하는 registerSW.js 는 등록만 할 뿐 열려 있는 페이지를 갱신하지 않는다.
 * 그래서 배포 후 첫 방문은 SPA 라우팅 내내 이전 precache 번들로 돌았다 (한 버전 뒤처짐).
 * `virtual:pwa-register` 의 registerSW 는 autoUpdate 모드에서 새 SW 가 *업데이트로* 활성화되면
 * window.location.reload() 를 호출해 그 자리에서 새 번들을 띄운다 (최초 설치 시에는 reload 안 함).
 * dev 서버에서는 no-op 스텁으로 해석되고(devOptions.enabled=false), 이 import 가 있으면 플러그인이
 * registerSW.js 스크립트 주입을 생략한다 (injectRegister: "auto").
 */
registerSW({ immediate: true });

// Vite base 경로를 wouter에 전달 — "/play-lab-stage/" → "/play-lab-stage", "/" → ""
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

// HMR 시 main.tsx가 재실행되며 동일 container에 createRoot 재호출 경고
// ("You are calling ReactDOMClient.createRoot() on a container that has already been
// passed to createRoot() before") 방지 — root 인스턴스를 globalThis에 stash.
declare global {
  // eslint-disable-next-line no-var
  var __hh_hub_root__: ReactDOM.Root | undefined;
}

const root = globalThis.__hh_hub_root__ ?? ReactDOM.createRoot(rootElement);
globalThis.__hh_hub_root__ = root;

/**
 * VITE_MOCK=true일 때만 MSW worker를 시작한다.
 * mock 정의는 동적 import로만 로드해 production 번들에 포함되지 않게 한다.
 */
async function enableMockingIfRequested(): Promise<void> {
  if (import.meta.env.VITE_MOCK !== "true") return;
  const { worker } = await import("@hh/shared/mocks/browser");
  // BASE_URL을 service worker 경로에 반영 (gh-pages sub-path 대응)
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

void enableMockingIfRequested().then(() => {
  root.render(
    <Router base={routerBase}>
      <App />
    </Router>
  );
});
