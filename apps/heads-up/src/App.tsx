import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuthState } from '@hh/shared';
import { CompatBanner } from './components/common/CompatBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { MilestoneToast } from './components/common/MilestoneToast';
import { useSettingsStore } from './store/settings-store';
import { initChipDisplayFromSettings } from './hooks/useChipDisplay';
import { useToastStore } from './store/toast-store';

// Code-split each route — keeps the initial bundle lean. HomePage loads the
// stats dashboard eagerly; deeper routes (table, history, analysis, settings,
// about) load on first navigation.
const HomePage = lazy(() => import('./pages/HomePage'));
const TablePage = lazy(() => import('./pages/TablePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
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

/** 로그인 닉네임 → 헤즈업 게임 닉네임 자동 동기화. */
function AuthNicknameSyncer() {
  const { user } = useAuthState();
  const isLoaded = useSettingsStore((s) => s.isLoaded);
  const setNickname = useSettingsStore((s) => s.setNickname);
  // 게임 내 닉네임(nickname)을 우선 사용하고, 없으면 displayName으로 폴백.
  const authNickname = (user?.nickname ?? user?.displayName)?.trim() || null;

  useEffect(() => {
    // 설정 init(getSettings)이 끝난 뒤 적용해야 로드된 settings에 덮어쓰여지지 않는다.
    if (!isLoaded || !authNickname) return;
    setNickname(authNickname);
  }, [authNickname, isLoaded, setNickname]);

  return null;
}

function AppInitializer() {
  useEffect(() => {
    void useSettingsStore.getState().init().then(() => {
      initChipDisplayFromSettings();
    });
    void useToastStore.getState().init();
  }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInitializer />
      <AuthNicknameSyncer />
      <CompatBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/table" element={<TablePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
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
