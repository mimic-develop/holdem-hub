import { useState } from 'react';
import { useLocation } from 'wouter';
import { Brain, Trophy, Play, Timer, Users, Coins, Flame } from 'lucide-react';
import type { PuzzleDifficulty } from "../types/poker";

export default function Home() {
  const [, setLocation] = useLocation();
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('medium');

  const difficultyConfig: Record<PuzzleDifficulty, { label: string; border: string; text: string; desc: string }> = {
    easy:   { label: '쉬움',   border: 'border-green-500',  text: 'text-green-400',  desc: '3명, 단순 팟 구조' },
    medium: { label: '보통',   border: 'border-yellow-500', text: 'text-yellow-400', desc: '3~4명, 사이드팟 포함' },
    hard:   { label: '어려움', border: 'border-red-500',    text: 'text-red-400',    desc: '4~5명, 복잡한 멀티팟' },
  };

  const records = (['easy', 'medium', 'hard'] as const).map(d => ({
    d,
    score: parseInt(localStorage.getItem(`pot-quiz:bestScore_${d}`) ?? '0', 10),
    streak: parseInt(localStorage.getItem(`pot-quiz:bestStreak_${d}`) ?? '0', 10),
  }));
  const hasAnyRecord = records.some(r => r.score > 0 || r.streak > 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">포커 퀴즈</h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            텍사스 홀덤 쇼다운 · 핸드 순위 · 팟 분배 트레이너
          </p>
        </div>

        {/* Best records card */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">나의 최고 기록</p>
          {/* Header row */}
          <div className="flex items-center mb-1">
            <div className="w-14" />
            <div className="flex-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-medium">
              <Flame className="w-3 h-3" /> 연속정답
            </div>
            <div className="flex-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-medium">
              <Trophy className="w-3 h-3" /> 점수
            </div>
          </div>
          <div className="border-t border-border mb-1" />
          {/* Data rows */}
          {records.map(({ d, score, streak }) => {
            const cfg = difficultyConfig[d];
            const isSelected = d === difficulty;
            return (
              <div key={d} className={`flex items-center py-1.5 ${isSelected ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-14 text-xs font-bold ${cfg.text}`}>
                  {cfg.label}
                  {isSelected && <span className="ml-1 text-[9px] text-muted-foreground">◀</span>}
                </div>
                <div className={`flex-1 text-center text-sm font-bold ${streak > 0 ? 'text-white' : 'text-muted-foreground'}`} data-testid={`home-best-streak-${d}`}>
                  {streak > 0 ? `${streak}연속` : '-'}
                </div>
                <div className={`flex-1 text-center text-sm font-bold ${score > 0 ? 'text-white' : 'text-muted-foreground'}`} data-testid={`home-best-score-${d}`}>
                  {score > 0 ? score.toLocaleString() : '-'}
                </div>
              </div>
            );
          })}
          {!hasAnyRecord && (
            <p className="text-center text-muted-foreground text-xs mt-3">아직 기록이 없습니다. 첫 게임을 시작해보세요!</p>
          )}
        </div>

        {/* How it works */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">게임 방식</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-primary/20 border border-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-foreground font-semibold">1단계 · 핸드 순위</p>
                <p className="text-xs text-muted-foreground mt-0.5">시트를 탭해 핸드 강도 순서를 지정</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-accent/20 border border-purple-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-foreground font-semibold">2단계 · 팟 금액</p>
                <p className="text-xs text-muted-foreground mt-0.5">메인팟·사이드팟 각 금액 계산 입력</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-600/20 border border-green-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-foreground font-semibold">3단계 · 수령 칩</p>
                <p className="text-xs text-muted-foreground mt-0.5">각 플레이어가 수령할 칩 금액 입력</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-orange-600/20 border border-orange-500/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Timer className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-foreground font-semibold">스톱워치 · 90초 합격</p>
                <p className="text-xs text-muted-foreground mt-0.5">오답 시 즉시 정답 해설 표시</p>
              </div>
            </div>
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">난이도 선택</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(difficultyConfig) as PuzzleDifficulty[]).map(d => {
              const cfg = difficultyConfig[d];
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  data-testid={`difficulty-${d}`}
                  className={`py-3 px-2 rounded-xl border text-center transition-all ${
                    active
                      ? `${cfg.border} bg-muted ${cfg.text}`
                      : 'border-border text-muted-foreground hover:border-input hover:text-foreground bg-card'
                  }`}
                >
                  <p className="font-bold text-sm">{cfg.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{cfg.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={() => setLocation(`/quiz/${difficulty}`)}
          data-testid="btn-start"
          className="w-full py-4 rounded-2xl bg-primary hover:bg-primary text-primary-foreground font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95"
        >
          <Play className="w-5 h-5" />
          시작하기
        </button>

        <p className="text-center text-muted-foreground text-xs mt-6 leading-relaxed">
          쇼다운 상황에서 핸드를 빠르게 판독하고<br />정확한 팟 분배를 계산하세요.
        </p>
      </div>
    </div>
  );
}
