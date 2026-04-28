// App version — sourced from package.json at build time via Vite's
// `define` mechanism if available, falling back to a hardcoded constant.
//
// Vite-define injection happens in vite.config.ts; this constant is the
// runtime-visible value.

export const APP_VERSION = '0.1.0';
