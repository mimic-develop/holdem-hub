import { Router } from "express";

export const authRouter = Router();

authRouter.post("/token", async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ error: "code required" });
    return;
  }

  try {
    const apiUrl = process.env.MIMIC_API_URL;
    const clientId = process.env.MIMIC_CLIENT_ID ?? "mimic-web";

    const upstream = await fetch(`${apiUrl}/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, code }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }
    res.json(data); // { accessToken, refreshToken }
  } catch {
    res.status(502).json({ error: "token exchange failed" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    // MIMIC 호출 없이 즉시 반환 — 클라이언트가 40110(EMPTY_REFRESH_TOKEN)과 동일하게 처리하도록.
    res.status(401).json({ code: "40110" });
    return;
  }

  try {
    const apiUrl = process.env.MIMIC_API_URL;
    const clientId = process.env.MIMIC_CLIENT_ID ?? "mimic-web";
    const clientSecret = process.env.MIMIC_CLIENT_SECRET;

    const upstream = await fetch(`${apiUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 브라우저 쿠키 정책과 무관한 server-to-server 호출이라 Cookie 헤더를 직접 구성한다.
        Cookie: `refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }
    res.json(data); // { accessToken } — MIMIC은 refresh 응답에 새 refreshToken을 주지 않는다.
  } catch {
    res.status(502).json({ error: "refresh failed" });
  }
});
