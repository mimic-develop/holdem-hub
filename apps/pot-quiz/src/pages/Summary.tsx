import { useLocation } from 'wouter';
import { Flame, Target, RotateCcw, Home, Trophy } from 'lucide-react';
import type { Difficulty } from "../types/poker";

export default function Summary() {
  const [location, setLocation] = useLocation();

  const state = window.history.state as {
    score: number;
    streak: number;
    correctCount: number;
    totalAnswered: number;
    bestStreak?: number;
    wasNewBestStreak?: boolean;
  } | null;

  const score = state?.score ?? 0;
  const maxStreak = state?.streak ?? 0;
  const correctCount = state?.correctCount ?? 0;
  const totalAnswered = state?.totalAnswered ?? 0;

  const difficulty = location.split('/')[2] as Difficulty | undefined;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const isNewBestStreak = state?.wasNewBestStreak ?? false;

  const getStreakRating = () => {
    if (maxStreak >= 10) return { label: '마스터', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };
    if (maxStreak >= 5)  return { label: '숙련자', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
    if (maxStreak >= 3)  return { label: '학습중', color: 'text-primary',   bg: 'bg-primary/10 border-blue-500/30' };
    return                      { label: '입문자', color: 'text-muted-foreground',   bg: 'bg-zinc-500/10 border-input/30' };
  };

  const rating = getStreakRating();

  return (
    <div
      className="pot-quiz-ingame min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          'radial-gradient(ellipse 85% 50% at 50% 0%, rgba(59,130,246,0.26) 0%, rgba(59,130,246,0) 55%),' +
          'radial-gradient(ellipse 65% 45% at 50% 100%, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 60%),' +
          'linear-gradient(180deg, #1A2247 0%, #0F1428 45%, #0A0E1F 80%, #08091A 100%)',
        color: '#FAFAF8',
      }}
    >
      <div className="w-full max-w-[430px]">

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/10">
            <Flame className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">플레이 결과</h2>
          {isNewBestStreak && maxStreak >= 2 && (
            <span className="inline-block bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs px-3 py-1 rounded-full font-semibold">
              🔥 새로운 최고 연속정답!
            </span>
          )}
        </div>

        {/* Main metric — max streak */}
        <div
          className="rounded-2xl p-6 mb-4 text-center"
          style={{ background: '#181A20', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-muted-foreground text-sm mb-1">최고 연속정답</p>
          <p className="text-6xl font-bold text-white mb-1" data-testid="summary-streak">{maxStreak}<span className="text-2xl text-muted-foreground font-normal ml-1">연속</span></p>
          <div className={`inline-flex items-center gap-1.5 border text-sm font-semibold px-3 py-1 rounded-full mt-2 ${rating.bg} ${rating.color}`}>
            {rating.label}
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: '#181A20', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="summary-score">{score.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">점수</p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: '#181A20', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Target className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">정답률</p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: '#181A20', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="w-4 h-4 flex items-center justify-center mx-auto mb-1">
              <span className="text-green-400 text-sm font-bold">✓</span>
            </div>
            <p className="text-xl font-bold text-white">{correctCount}<span className="text-xs text-muted-foreground font-normal">/{totalAnswered}</span></p>
            <p className="text-xs text-muted-foreground">정답 수</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setLocation(`/quiz/${difficulty ?? 'medium'}`)}
            data-testid="btn-replay"
            className="w-full rounded-xl font-bold transition-opacity active:opacity-80 hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(180deg, #60A5FA 0%, #3B82F6 55%, #2563EB 100%)',
              color: '#FAFAF8',
              fontSize: 15,
              letterSpacing: '0.04em',
              padding: '14px 0',
              boxShadow:
                '0 12px 28px rgba(59,130,246,0.45), ' +
                '0 0 0 1px rgba(96,165,250,0.40), ' +
                'inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            다시 플레이
          </button>
          <button
            onClick={() => setLocation('/')}
            data-testid="btn-home-summary"
            className="w-full rounded-xl font-semibold transition-opacity active:opacity-70 hover:opacity-85 flex items-center justify-center gap-2"
            style={{
              padding: '12px 0',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.78)',
              fontSize: 13.5,
            }}
          >
            <Home className="w-4 h-4" />
            홈으로
          </button>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          {maxStreak >= 7
            ? '훌륭합니다! 포커 판독 실력이 늘고 있습니다.'
            : maxStreak >= 3
            ? '잘 하고 있습니다. 해설을 복습하면 더 빠르게 늘 거예요.'
            : '포기하지 마세요. 반복 훈련이 핵심입니다!'}
        </p>

      </div>
    </div>
  );
}
