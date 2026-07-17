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
    const clientSecret = process.env.MIMIC_CLIENT_SECRET;

    const upstream = await fetch(`${apiUrl}/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret, code }),
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
