import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional: render-prop fallback, gets the error + a reset callback. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary — wraps the entire app to keep render errors from
 * showing the browser's default error page (or, worse, a blank screen). Logs
 * errors to console; in production we'd ship to an error tracker.
 *
 * Async errors (Promise rejections, setTimeout callbacks) are NOT caught here
 * — that's a React limitation. We rely on store-level try/catch for those.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] caught render error', error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return <DefaultErrorScreen error={error} onReset={this.reset} />;
  }
}

function DefaultErrorScreen({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const isDev = (() => {
    try {
      return (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
    } catch {
      return false;
    }
  })();

  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-foreground"
    >
      <div className="text-5xl">😵</div>
      <h1 className="text-xl font-bold text-primary">앱에 문제가 발생했습니다</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        예상치 못한 오류가 발생했습니다. 새로고침하거나 아래 버튼으로 복구를 시도해주세요.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          다시 시도
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          새로고침
        </button>
      </div>
      {isDev && (
        <details className="w-full max-w-2xl">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            개발자: 에러 상세 보기
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-card p-3 text-[11px] text-red-300">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      )}
    </main>
  );
}
