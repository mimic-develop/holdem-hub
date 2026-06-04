/**
 * 브라우저용 MSW worker.
 *
 * `VITE_MOCK=true`일 때만 Hub 진입점에서 동적 import + worker.start() 한다.
 * (production 번들에 포함되지 않도록 정적 import 금지.)
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers/index.js";

export const worker = setupWorker(...handlers);
