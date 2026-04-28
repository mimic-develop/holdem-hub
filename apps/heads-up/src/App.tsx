import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CompatBanner } from './components/common/CompatBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { MilestoneToast } from './components/common/MilestoneToast';

// Code-split each route — keeps the initial bundle lean. HomePage loads the
// stats dashboard eagerly; deeper routes (table, history, analysis, settings,
// about) load on first navigation.
const HomePage = lazy(() => import('./pages/HomePage'));
const TablePage = lazy(() => import('./pages/TablePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      불러오는 중…
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CompatBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/table" element={<TablePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/analysis/:handId" element={<AnalysisPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <MilestoneToast />
    </ErrorBoundary>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <div className="text-5xl">🃏</div>
      <h1 className="text-xl font-bold text-primary">페이지를 찾을 수 없습니다</h1>
      <a
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        홈으로
      </a>
    </main>
  );
}
