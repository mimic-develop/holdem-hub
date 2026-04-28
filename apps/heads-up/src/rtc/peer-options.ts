/**
 * Build PeerJS broker options from Vite env vars.
 *
 * Defaults: PeerJS public broker (`0.peerjs.com:443/`). Override at build time
 * via `.env.production` or runtime via Vercel project env vars:
 *
 *   VITE_PEERJS_HOST   — broker hostname (default: omitted → peerjs default)
 *   VITE_PEERJS_PORT   — broker port (default: omitted)
 *   VITE_PEERJS_PATH   — broker path (default: omitted, peerjs uses `/`)
 *   VITE_PEERJS_SECURE — "true" to force wss:// (default: true unless localhost)
 *   VITE_PEERJS_KEY    — API key (peerjs cloud uses "peerjs"; self-hosted may differ)
 *
 * If no env var is set, returns `undefined` so PeerJS falls back to its built-in
 * defaults. This keeps existing tests working without modification.
 */
export interface PeerOptions extends Record<string, unknown> {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  key?: string;
}

function readEnv(key: string): string | undefined {
  // import.meta.env is statically replaced by Vite at build time. In Node test
  // environments without DefinePlugin, it may be undefined — guard against that.
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const v = env?.[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  } catch {
    // ignore
  }
  return undefined;
}

export function getPeerOptions(): PeerOptions | undefined {
  const host = readEnv('VITE_PEERJS_HOST');
  const port = readEnv('VITE_PEERJS_PORT');
  const path = readEnv('VITE_PEERJS_PATH');
  const secure = readEnv('VITE_PEERJS_SECURE');
  const key = readEnv('VITE_PEERJS_KEY');

  // No overrides → return undefined so PeerJS uses its defaults.
  if (!host && !port && !path && !secure && !key) return undefined;

  const opts: PeerOptions = {};
  if (host) opts.host = host;
  if (port) {
    const parsed = Number.parseInt(port, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed < 65536) opts.port = parsed;
  }
  if (path) opts.path = path;
  if (secure) opts.secure = secure.toLowerCase() === 'true';
  if (key) opts.key = key;
  return opts;
}
