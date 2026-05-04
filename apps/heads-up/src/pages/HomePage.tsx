import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { CreateRoomDialog } from '../components/home/CreateRoomDialog';
import { GrowthStats } from '../components/home/GrowthStats';
import { JoinRoomDialog } from '../components/home/JoinRoomDialog';
import { SpotBreakdown } from '../components/home/SpotBreakdown';
import { useSettings } from '../hooks/useSettings';
import { useStats } from '../hooks/useStats';
import { useGameStore } from '../store/game-store';
import { AI_PERSONAS, ALL_PERSONA_IDS } from '../bot/personas';
import { ALL_LEVELS, LEVEL_LABEL } from '../bot/levels';
import type { AiLevel, AiPersonaId } from '../types/ai';

const LEVEL_BLURB: Record<AiLevel, string> = {
  EASY: '들쑥날쑥 · 누수 많음',
  MEDIUM: '기본 전략 일관 유지',
  HARD: '성향을 정교하게 수행',
};

type AiStartStep = 'idle' | 'persona' | 'level';

type RemoteDialog = 'none' | 'create' | 'join';

export default function HomePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [aiStep, setAiStep] = useState<AiStartStep>('idle');
  const [pickedPersona, setPickedPersona] = useState<AiPersonaId>('STANDARD');
  const [personaIdx, setPersonaIdx] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [remoteDialog, setRemoteDialog] = useState<RemoteDialog>('none');

  const goPersona = (nextIdx: number) => {
    setSlideDir(nextIdx > personaIdx ? 1 : -1);
    setPersonaIdx(nextIdx);
  };
  const prevPersona = () => goPersona((personaIdx - 1 + ALL_PERSONA_IDS.length) % ALL_PERSONA_IDS.length);
  const nextPersona = () => goPersona((personaIdx + 1) % ALL_PERSONA_IDS.length);
  const startAiGame = useGameStore((s) => s.startAiGame);
  const handHistory = useGameStore((s) => s.handHistory);
  const { stats, isLoading: statsLoading, range, setRange } = useStats('today');

  const start = (level: AiLevel) => {
    startAiGame(pickedPersona, level);
    navigate('/table');
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-10">
      {/* Header banner */}
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border"
        style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 70%,#334155 100%)' }}
      >
        <div className="relative flex h-16 items-center justify-center overflow-hidden">
          <span aria-hidden className="absolute inset-0 flex items-center justify-center select-none text-6xl font-bold text-white opacity-10">♥♠</span>
        </div>
        <div className="flex items-center justify-between px-5 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">HEADS-UP</h1>
            <p className="text-xs text-white/60 mt-0.5">AI 또는 친구와 빠른 1:1 대결</p>
          </div>
          <Link
            to="/settings"
            aria-label="설정"
            className="rounded-full border border-white/20 bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <SettingsIcon />
          </Link>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col gap-3 mt-4">
        {aiStep === 'idle' && (
          <button
            type="button"
            onClick={() => setAiStep('persona')}
            className="group rounded-xl border border-mimic-red/20 bg-white p-5 text-left shadow-lg transition-all hover:border-mimic-red/40 hover:scale-[1.02] active:scale-100"
          >
            <div className="text-xl font-bold text-mimic-red">AI와 한 판</div>
            <div className="text-sm text-zinc-600">기다림 없이 바로 대결</div>
          </button>
        )}

        {/* STEP 1: persona 선택 — 스와이프 캐러셀 */}
        {aiStep === 'persona' && (() => {
          const currentId = ALL_PERSONA_IDS[personaIdx];
          const p = AI_PERSONAS[currentId];
          return (
            <div className="rounded-xl border border-mimic-red/20 bg-white shadow-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="text-xl font-bold text-mimic-red">상대 성향 선택</div>
                <button
                  type="button"
                  onClick={() => setAiStep('idle')}
                  className="text-xs text-zinc-500 underline hover:text-zinc-900"
                >
                  취소
                </button>
              </div>

              {/* Carousel — image fills panel, slides overlap during transition */}
              <div className="relative overflow-hidden" style={{ height: '280px' }}>
                <AnimatePresence initial={false} custom={slideDir}>
                  <motion.div
                    key={currentId}
                    custom={slideDir}
                    variants={{
                      enter:  (dir: number) => ({ x: `${dir * 100}%` }),
                      center: { x: '0%' },
                      exit:   (dir: number) => ({ x: `${dir * -100}%` }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.8 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.12}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -60) nextPersona();
                      else if (info.offset.x > 60) prevPersona();
                    }}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  >
                    {p.avatarSrc ? (
                      <img
                        src={p.avatarSrc}
                        alt={p.displayName}
                        draggable={false}
                        className="h-full w-full object-cover object-top select-none pointer-events-none"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100">
                        <span className="text-6xl font-bold text-zinc-300">{p.displayName[0]}</span>
                      </div>
                    )}
                    {/* Bottom gradient + name/desc overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-3 pt-10">
                      <div className="text-base font-bold text-white">{p.displayName}</div>
                      <div className="text-xs text-white/70 mt-0.5">{p.description}</div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Side nav buttons */}
                <button
                  type="button"
                  onClick={prevPersona}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm hover:bg-white/40 transition-colors text-lg"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={nextPersona}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm hover:bg-white/40 transition-colors text-lg"
                >
                  ›
                </button>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-1.5 py-3">
                {ALL_PERSONA_IDS.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goPersona(i)}
                    className={clsx(
                      'rounded-full transition-all',
                      i === personaIdx
                        ? 'w-5 h-2 bg-mimic-red'
                        : 'w-2 h-2 bg-zinc-300 hover:bg-zinc-400',
                    )}
                  />
                ))}
              </div>

              {/* Select button */}
              <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setPickedPersona(currentId);
                    setAiStep('level');
                  }}
                  className="w-full rounded-lg bg-mimic-red py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                >
                  {p.displayName}와 대결
                </button>
              </div>
            </div>
          );
        })()}

        {/* STEP 2: level 선택 → 즉시 시작 */}
        {aiStep === 'level' && (() => {
          const p = AI_PERSONAS[pickedPersona];
          return (
            <div className="rounded-xl border border-mimic-red/20 bg-white shadow-lg overflow-hidden">
              {/* Selected persona header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
                {p.avatarSrc && (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-950">
                    <img
                      src={p.avatarSrc}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="h-full w-full object-contain select-none"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500">선택한 상대</div>
                  <div className="text-base font-bold text-mimic-red">{p.displayName}</div>
                  <div className="text-xs text-zinc-400 truncate">{p.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiStep('persona')}
                  className="text-xs text-zinc-500 underline hover:text-zinc-900 shrink-0"
                >
                  ← 다시
                </button>
              </div>

              {/* Level buttons */}
              <div className="p-4">
                <div className="text-xs font-medium text-zinc-500 mb-2.5">난이도 선택</div>
                <div className="flex flex-col gap-2">
                  {ALL_LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => start(lv)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-all hover:border-mimic-red hover:bg-mimic-red/5 active:scale-[0.98]"
                    >
                      <div>
                        <div className="text-sm font-semibold text-zinc-800">{LEVEL_LABEL[lv]}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{LEVEL_BLURB[lv]}</div>
                      </div>
                      <span className="text-mimic-red text-lg">▶</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

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

        {!statsLoading && stats && stats.totalHands > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-2.5 w-full">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{stats.totalHands}</div>
              <div className="text-[10px] text-muted-foreground">핸드</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{Math.round(stats.winRate * 100)}%</div>
              <div className="text-[10px] text-muted-foreground">승률</div>
            </div>
            {stats.winStreak >= 2 && (
              <>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">{stats.winStreak}연승</div>
                  <div className="text-[10px] text-muted-foreground">현재 연승</div>
                </div>
              </>
            )}
          </div>
        )}
        <GrowthStats
          stats={stats}
          range={range}
          onRangeChange={setRange}
          isLoading={statsLoading}
        />

        <SpotBreakdown stats={stats} />

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
