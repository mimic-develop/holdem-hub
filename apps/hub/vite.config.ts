import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // .env / .env.local / .env.<mode>.local 모두 읽음 (prefix 없음)
  const env = loadEnv(mode, process.cwd(), "");
  // 기본 포트: Hub 5175, API 3002. (env로 override 가능)
  const apiTarget =
    env.HUB_API_TARGET || `http://localhost:${env.API_PORT || 3002}`;

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "홀덤 허브",
          short_name: "홀덤 허브",
          description:
            "홀덤 학습/연습 앱 통합 — 팟 분배, 너트 핸드, 개념 퀴즈, 헤즈업 트레이너.",
          lang: "ko",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,svg,ico,png,jpg,jpeg,woff2}"],
          navigateFallback: "/index.html",
          // /api/* 요청은 서비스워커가 가로채지 않음 (실서버로 직접)
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Pretendard CDN — 변경 빈도 낮음, network-first w/ fallback.
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*pretendard.*/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "pretendard-cdn",
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          // dev에서 SW를 끄지 않으면 HMR과 캐시 충돌이 일어남.
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // 모노레포에서 sub-app(@hh/heads-up 등)이 react/react-dom 의존성을 가질 때
      // Vite가 두 개의 React 인스턴스를 번들에 포함시켜 useState/useCallback 등
      // 훅 호출이 깨지는 문제를 방지. zustand 같은 상태 라이브러리가 sub-app 내부에서
      // 사용될 때 특히 발생.
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: Number(env.HUB_PORT) || 3000,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
