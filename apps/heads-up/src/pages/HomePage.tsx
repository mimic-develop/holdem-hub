import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import type { Difficulty } from '../bot/heuristic-bot';
import { CreateRoomDialog } from '../components/home/CreateRoomDialog';
import { GrowthStats } from '../components/home/GrowthStats';
import { JoinRoomDialog } from '../components/home/JoinRoomDialog';
import { SpotBreakdown } from '../components/home/SpotBreakdown';
import { useSettings } from '../hooks/useSettings';
import { useStats } from '../hooks/useStats';
import { useGameStore } from '../store/game-store';

const DIFFICULTIES: { key: Difficulty; label: string; blurb: string }[] = [
  { key: 'EASY', label: '쉬움', blurb: '약한 봇 · 콜/체크 위주' },
  { key: 'MEDIUM', label: '보통', blurb: '표준 휴리스틱' },
  { key: 'HARD', label: '어려움', blurb: '공격적 · 3벳 많음' },
];

type RemoteDialog = 'none' | 'create' | 'join';

export default function HomePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [selected, setSelected] = useState<Difficulty>('MEDIUM');
  const [remoteDialog, setRemoteDialog] = useState<RemoteDialog>('none');
  const startAiGame = useGameStore((s) => s.startAiGame);
  const handHistory = useGameStore((s) => s.handHistory);
  const { stats, isLoading: statsLoading, range, setRange } = useStats('today');

  const start = () => {
    startAiGame(selected);
    navigate('/table');
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-10">
      <div className="mt-4 flex w-full max-w-md items-start justify-between">
        <div />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">헤즈업 홀덤 연습장</h1>
          <p className="text-sm text-muted-foreground">1:1 노리밋 홀덤 연습</p>
        </div>
        <Link
          to="/settings"
          aria-label="설정"
          className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <SettingsIcon />
        </Link>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3 mt-4">
        <GrowthStats
          stats={stats}
          range={range}
          onRangeChange={setRange}
          isLoading={statsLoading}
        />

        <SpotBreakdown stats={stats} />

        {!showDifficulty ? (
          <button
            type="button"
            onClick={() => setShowDifficulty(true)}
            className="group rounded-xl bg-primary p-5 text-left shadow-lg transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-100"
          >
            <div className="text-xl font-bold text-white">AI와 연습</div>
            <div className="text-sm text-white/70">봇 상대로 바로 시작</div>
          </button>
        ) : (
          <div className="rounded-xl bg-primary p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xl font-bold text-white">난이도 선택</div>
              <button
                type="button"
                onClick={() => setShowDifficulty(false)}
                className="text-xs text-white/70 underline hover:text-white"
              >
                취소
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelected(d.key)}
                  className={clsx(
                    'flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors',
                    selected === d.key
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-white/20 bg-black/30 text-white/80 hover:bg-black/50',
                  )}
                >
                  <div>
                    <div className="text-sm font-semibold">{d.label}</div>
                    <div className="text-xs text-white/60">{d.blurb}</div>
                  </div>
                  {selected === d.key && <span className="text-primary">●</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={start}
              className="mt-4 w-full rounded-md bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90 active:scale-95"
            >
              시작
            </button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-base font-semibold text-foreground">친구와 플레이</div>
          <div className="mb-3 text-xs text-muted-foreground">
            WebRTC P2P 연결 · 서버 없음
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRemoteDialog('create')}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95"
            >
              방 만들기
            </button>
            <button
              type="button"
              onClick={() => setRemoteDialog('join')}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary active:scale-95"
            >
              코드 입력
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/history')}
          className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
        >
          <div className="text-base font-semibold text-foreground">내 기록 보기</div>
          <div className="text-xs text-muted-foreground">과거 플레이한 핸드 검토</div>
        </button>
      </div>

      <div className="mt-auto pt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>이번 세션: {handHistory.length} 핸드</div>
        <div>닉네임: {settings.nickname}</div>
        <Link to="/about" className="hover:text-foreground">
          앱 정보
        </Link>
      </div>

      <CreateRoomDialog
        open={remoteDialog === 'create'}
        onClose={() => setRemoteDialog('none')}
        myName={settings.nickname}
      />
      <JoinRoomDialog
        open={remoteDialog === 'join'}
        onClose={() => setRemoteDialog('none')}
        myName={settings.nickname}
      />
    </main>
  );
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
