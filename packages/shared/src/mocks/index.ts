/**
 * @hh/shared/mocks — MSW mock 정의.
 *
 * 사용: 진입점에서 `VITE_MOCK==="true"`일 때만 동적 import.
 *   const { worker } = await import("@hh/shared/mocks/browser");
 *   await worker.start({ onUnhandledRequest: "bypass" });
 */
export { handlers } from "./handlers/index.js";
