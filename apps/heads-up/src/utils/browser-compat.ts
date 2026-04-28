/**
 * Run a quick capability check at app boot. We require:
 *   - WebRTC (RTCPeerConnection) for friend matches
 *   - IndexedDB for hand history
 *   - localStorage for settings/milestones
 *
 * If a critical feature is missing, return a list of missing capabilities so
 * the UI can warn the user *before* they try to use a broken feature.
 *
 * Designed minimum versions: Chrome 90+, Edge 90+, Safari 14+, Firefox 88+.
 * iOS Safari < 14 lacks proper WebRTC for PeerJS data channels.
 */
export interface CompatCheckResult {
  ok: boolean;
  /** Critical capabilities missing — app likely won't work. */
  missing: string[];
  /** Non-critical missing features — degraded experience. */
  warnings: string[];
}

export function checkBrowserCompat(): CompatCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // IndexedDB — needed for hand history. App will save nothing without it.
  if (typeof indexedDB === 'undefined') {
    missing.push('IndexedDB');
  }

  // WebRTC — only needed for friend matches. AI mode works without it.
  if (typeof RTCPeerConnection === 'undefined') {
    warnings.push('WebRTC (친구 매치 사용 불가)');
  }

  // localStorage — settings + milestone dedupe. App works degraded without.
  try {
    if (typeof localStorage === 'undefined') {
      warnings.push('localStorage (설정/마일스톤 저장 불가)');
    } else {
      const k = '__hs_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
    }
  } catch {
    warnings.push('localStorage (사파리 시크릿 모드일 수 있음)');
  }

  // Crypto for ID generation — fallback exists, but flag if missing.
  const c = (globalThis as unknown as { crypto?: { getRandomValues?: unknown } }).crypto;
  if (!c?.getRandomValues) {
    warnings.push('crypto.getRandomValues (구형 브라우저)');
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}
