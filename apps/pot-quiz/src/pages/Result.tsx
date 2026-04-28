import { useLocation, useParams } from 'wouter';
import { CheckCircle2, XCircle, ArrowRight, Home } from 'lucide-react';
import CardDisplay from '../components/CardDisplay';
import PlayerArea from '../components/PlayerArea';
import type { Pot, PotResult } from '@hh/poker-engine';

// State passed from Quiz via location state
interface ResultState {
  puzzle: {
    id: string;
    mode: string;
    difficulty: string;
    titleKo: string;
    descKo: string;
    players: Array<{ id: string; name: string; cards: string[]; invested: number }>;
    board: string[];
  };
  answer: {
    pots: Pot[];
    potResults: Array<{ pot: Pot; winners: string[]; perWinner: number }>;
    playerPayouts: Record<string, number>;
    winners: string[];
    handMap: Record<string, { descriptionKo: string; rankValue: number }>;
  };
  userAnswer: string[] | Record<string, string>;
  correct: boolean;
  points: number;
  score: number;
  streak: number;
  maxStreak: number;
  correctCount: number;
  totalAnswered: number;
  totalPuzzles: number;
  timeLeft: number;
  timerSeconds: number;
  puzzleIndex: number;
}

export default function Result() {
  const { mode, difficulty, puzzleIndex: indexStr } = useParams<{ mode: string; difficulty: string; puzzleIndex: string }>();
  const [location, setLocation] = useLocation();

  // Read state from history.state
  const state: ResultState | undefined = (window.history.state as any)?.state;

  if (!state) {
    setLocation('/');
    return null;
  }

  const {
    puzzle,
    answer,
    userAnswer,
    correct,
    points,
    score,
    streak,
    correctCount,
    totalAnswered,
    totalPuzzles,
  } = state;

  const winnerSet = new Set(answer.winners);
  const isLastPuzzle = state.puzzleIndex >= totalPuzzles - 1;

  const handleNext = () => {
    if (isLastPuzzle) {
      setLocation(`/summary/${mode}/${difficulty}`, {
        state: {
          score,
          streak: state.maxStreak,
          correctCount,
          totalAnswered,
        },
      });
    } else {
      // Navigate to next puzzle
      const nextIndex = state.puzzleIndex + 1;
      setLocation(`/quiz/${mode}/${difficulty}`, {
        state: { startIndex: nextIndex, score, streak, maxStreak: state.maxStreak, correctCount },
      });
      // Reload quiz page fresh
      window.location.href = `/quiz/${mode}/${difficulty}`;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-lg mx-auto px-4 pb-10">
      {/* Result header */}
      <div className="pt-6 pb-4 text-center">
        {correct ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mb-1">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">정답!</h2>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold text-lg">+{points}점</span>
              {streak >= 2 && (
                <span className="bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs px-2 py-0.5 rounded-full">
                  🔥 {streak}연속!
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mb-1">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">오답</h2>
            <span className="text-muted-foreground text-sm">+{points}점</span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">누적 점수</p>
            <p className="font-bold text-white" data-testid="result-score">{score}</p>
          </div>
          <div className="w-px h-6 bg-secondary" />
          <div className="text-center">
            <p className="text-muted-foreground text-xs">정답률</p>
            <p className="font-bold text-white">{totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0}%</p>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground text-center mb-2 uppercase tracking-wider">보드</p>
        <div className="flex gap-2 justify-center">
          {puzzle.board.map(c => <CardDisplay key={c} card={c} size="lg" />)}
        </div>
      </div>

      {/* Player results */}
      <div className={`grid gap-2 mb-5 ${puzzle.players.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {puzzle.players.map(player => (
          <PlayerArea
            key={player.id}
            player={player}
            isWinner={winnerSet.has(player.id)}
            isLoser={!winnerSet.has(player.id)}
            showResult={true}
            payout={answer.playerPayouts[player.id] ?? 0}
            handDesc={answer.handMap[player.id]?.descriptionKo}
          />
        ))}
      </div>

      {/* Explanation */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-primary/20 border border-blue-500/30 rounded flex items-center justify-center text-primary text-xs">해</span>
          해설
        </h3>

        {/* Pot breakdown */}
        <div className="space-y-3">
          {answer.potResults.map((pr, i) => {
            const isPotCorrect = mode === 'winner'
              ? true
              : pr.winners.every(w => {
                  const userVal = parseInt((userAnswer as Record<string, string>)[w] ?? '0', 10) || 0;
                  return Math.abs(userVal - (answer.playerPayouts[w] ?? 0)) <= 1;
                });

            return (
              <div key={i} className="bg-muted/60 rounded-lg p-3 border border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    pr.pot.type === 'main'
                      ? 'bg-primary/20 text-primary border border-blue-500/30'
                      : 'bg-accent/20 text-purple-400 border border-purple-500/30'
                  }`}>
                    {pr.pot.label}
                  </span>
                  <span className="text-sm font-bold text-foreground">{pr.pot.amount.toLocaleString()}칩</span>
                </div>

                <div className="text-xs text-muted-foreground mb-1.5">
                  <span>참여: </span>
                  {pr.pot.eligible.map(id => {
                    const p = puzzle.players.find(pp => pp.id === id);
                    return (
                      <span key={id} className="mr-1 text-muted-foreground">{p?.name ?? id}</span>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <span>승자: </span>
                    {pr.winners.map(id => {
                      const p = puzzle.players.find(pp => pp.id === id);
                      return (
                        <span key={id} className="text-yellow-400 font-semibold mr-1">
                          {p?.name ?? id} ({answer.handMap[id]?.descriptionKo})
                        </span>
                      );
                    })}
                    {pr.winners.length > 1 && <span className="text-muted-foreground">(공동 승리)</span>}
                  </div>
                  <div className="text-xs text-green-400 font-semibold">
                    1인당 {pr.perWinner.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Final payouts */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">최종 수령 칩</p>
          <div className="grid grid-cols-2 gap-1.5">
            {puzzle.players.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1">
                <span className="text-xs text-muted-foreground">{p.name}</span>
                <span className={`text-xs font-bold ${(answer.playerPayouts[p.id] ?? 0) > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                  {(answer.playerPayouts[p.id] ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* User answer summary for sidepot mode */}
        {mode === 'sidepot' && !correct && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">내가 입력한 값</p>
            <div className="grid grid-cols-2 gap-1.5">
              {puzzle.players.map(p => {
                const myVal = parseInt((userAnswer as Record<string, string>)[p.id] ?? '0', 10) || 0;
                const correct = Math.abs(myVal - (answer.playerPayouts[p.id] ?? 0)) <= 1;
                return (
                  <div key={p.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1">
                    <span className="text-xs text-muted-foreground">{p.name}</span>
                    <span className={`text-xs font-bold ${correct ? 'text-green-400' : 'text-red-400'}`}>
                      {myVal.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setLocation('/')}
          data-testid="btn-home"
          className="flex-1 py-3 rounded-xl border border-border text-muted-foreground hover:border-input hover:text-foreground font-semibold transition-all flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          홈
        </button>
        <button
          onClick={handleNext}
          data-testid="btn-next"
          className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
        >
          {isLastPuzzle ? '결과 보기' : '다음 문제'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
