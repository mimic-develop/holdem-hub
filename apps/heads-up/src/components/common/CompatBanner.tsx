import { useEffect, useState } from 'react';
import { checkBrowserCompat } from '../../utils/browser-compat';

const DISMISSED_KEY = 'hs-compat-dismissed';

/**
 * Boot-time browser-capability banner. Shows ONCE per session if WebRTC or
 * other expected features are missing. User can dismiss; we remember the
 * dismissal in sessionStorage so it doesn't keep nagging in the same tab.
 *
 * Critical missing features (e.g., IndexedDB) render a non-dismissable
 * full-screen warning instead — the app effectively can't function.
 */
export function CompatBanner() {
  const [result, setResult] = useState(() => checkBrowserCompat());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(DISMISSED_KEY) === '1'
        : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setResult(checkBrowserCompat());
  }, []);

  if (!result.ok) {
    // Critical — block usage.
    return (
      <div
        role="alert"
        className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6"
      >
        <div className="max-w-md rounded-xl border border-red-700 bg-card p-6 text-center">
          <div className="text-4xl">🚫</div>
          <h2 className="mt-3 text-lg font-bold text-red-400">
            브라우저가 지원되지 않습니다
          </h2>
          <p className="mt-2 text-sm text-foreground">
            이 앱을 사용하려면 다음 기능이 필요합니다:
          </p>
          <ul className="mt-2 text-sm text-foreground">
            {result.missing.map((m) => (
              <li key={m}>· {m}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            최신 Chrome 90+, Safari 14+, Firefox 88+ 브라우저로 다시 접속해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (dismissed || result.warnings.length === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-3 left-1/2 z-50 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-lg border border-amber-700/60 bg-amber-950/90 px-3 py-2 text-xs text-amber-200 shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true">⚠</span>
        <div className="flex-1">
          <div className="font-semibold">일부 기능이 제한됩니다</div>
          <div className="mt-0.5">{result.warnings.join(' · ')}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              sessionStorage?.setItem(DISMISSED_KEY, '1');
            } catch {
              // ignored
            }
          }}
          aria-label="알림 닫기"
          className="rounded p-0.5 text-amber-400 hover:bg-amber-900"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
