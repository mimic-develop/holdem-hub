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
  } | null;

  const score = state?.score ?? 0;
  const maxStreak = state?.streak ?? 0;
  const correctCount = state?.correctCount ?? 0;
  const totalAnswered = state?.totalAnswered ?? 0;

  const difficulty = location.split('/')[2] as Difficulty | undefined;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const bestStreakKey = `pot-quiz:bestStreak_${difficulty ?? 'medium'}`;
  const bestStreak = parseInt(localStorage.getItem(bestStreakKey) ?? '0', 10);
  const isNewBestStreak = maxStreak > 0 && maxStreak >= bestStreak;
  if (isNewBestStreak) localStorage.setItem(bestStreakKey, String(maxStreak));

  const getStreakRating = () => {
    if (maxStreak >= 10) return { label: '마스터', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };
    if (maxStreak >= 5)  return { label: '숙련자', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
    if (maxStreak >= 3)  return { label: '학습중', color: 'text-primary',   bg: 'bg-primary/10 border-blue-500/30' };
    return                      { label: '입문자', color: 'text-muted-foreground',   bg: 'bg-zinc-500/10 border-input/30' };
  };

  const rating = getStreakRating();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

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
        <div className="bg-card border border-border rounded-2xl p-6 mb-4 text-center">
          <p className="text-muted-foreground text-sm mb-1">최고 연속정답</p>
          <p className="text-6xl font-bold text-white mb-1" data-testid="summary-streak">{maxStreak}<span className="text-2xl text-muted-foreground font-normal ml-1">연속</span></p>
          <div className={`inline-flex items-center gap-1.5 border text-sm font-semibold px-3 py-1 rounded-full mt-2 ${rating.bg} ${rating.color}`}>
            {rating.label}
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="summary-score">{score.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">점수</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Target className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">정답률</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
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
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            다시 플레이
          </button>
          <button
            onClick={() => setLocation('/')}
            data-testid="btn-home-summary"
            className="w-full py-3 rounded-xl border border-border text-muted-foreground hover:border-input hover:text-foreground font-semibold transition-all flex items-center justify-center gap-2"
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
