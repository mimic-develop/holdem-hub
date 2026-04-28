/// <reference types="vitest/config" />
/**
 * @hh/heads-up vitest 설정.
 *
 * 모노레포 통합 시 원본 `vite.config.ts`의 PWA/build 설정은 Hub로 이전했으나,
 * Vitest setupFiles 만 별도 vitest 설정으로 분리해 보존.
 *
 * - `test-setup.ts` 는 `fake-indexeddb/auto` 를 import → IndexedDB 의존 테스트
 *   (storage/history, store/game-store, store/remote-mode 등) 가 node 환경에서 동작.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/__tests__/*.test.ts"],
    setupFiles: ["./src/test-setup.ts"],
  },
});
