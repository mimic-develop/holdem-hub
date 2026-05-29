import ReactDOM from "react-dom/client";
import { Router } from "wouter";
import { App } from "./App";
import "./index.css";
// 모노레포 전체에서 사용하는 공통 카드 스타일 (한 번만 import)
import "@hh/ui/components/PlayingCard/styles.css";

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

root.render(
  <Router base={routerBase}>
    <App />
  </Router>
);
