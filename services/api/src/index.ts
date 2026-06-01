import { createApp } from "./app.js";

function readPort(): number {
  const flagIdx = process.argv.findIndex((a) => a === "--port");
  if (flagIdx >= 0) {
    const next = process.argv[flagIdx + 1];
    const parsed = Number(next);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.API_PORT);
  if (Number.isFinite(envPort) && envPort > 0) return envPort;
  // 기본 포트 3002 (미믹 플레이랩 표준).
  return 3002;
}

const port = readPort();
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[@hh/api] listening on http://localhost:${port}`);
});
