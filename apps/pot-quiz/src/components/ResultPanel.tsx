import { CheckCircle, ChevronRight, Home } from 'lucide-react';
import { RANK_EMOJI, rankColor } from '../lib/ranking';
import { bbaAdjusted, normalizeRanks, type LastResult, type Phase } from '../lib/game-logic';
import type { Puzzle } from '../types/poker';

interface ResultPanelProps {
  phase: Phase;
  lastResult: LastResult;
  puzzle: Puzzle;
  score: number;
  onQuit: () => void;
  onNext: () => void;
}

export default function ResultPanel({ phase, lastResult, puzzle, score, onQuit, onNext }: ResultPanelProps) {
  return (
    <>
      {/* Wrong banner */}
      {phase === 'wrong' && (
        <div className="mb-3 rounded-xl px-4 py-3 flex items-center gap-3 border bg-red-500/10 border-red-500/30">
          <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
            <span className="text-red-400 font-black text-xl">✗</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-red-400">오답</p>
            <p className="text-xs text-red-300/70 mt-0.5">
              {lastResult.wrongStep === 'ranking' && '1단계 핸드 순위가 틀렸습니다'}
              {lastResult.wrongStep === 'forming' && '2단계 팟 형성 중 오답이 있었습니다'}
              {lastResult.wrongStep === 'awarding' && '3단계 승자 결정 중 오답이 있었습니다'}
            </p>
            {(lastResult.brokenStreak ?? 0) >= 2 && (
              <p className="text-xs text-orange-400 mt-1">🔥 {lastResult.brokenStreak}연속 스트릭이 끊겼습니다</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">+0점</span>
        </div>
      )}

      {/* Result banner */}
      {phase === 'result' && (
        <div className={`mb-3 rounded-xl px-4 py-3 flex items-center gap-3 border ${
          lastResult.correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            lastResult.correct ? 'bg-green-500/20 border border-green-500/40' : 'bg-red-500/20 border border-red-500/40'
          }`}>
            {lastResult.correct
              ? <CheckCircle className="w-5 h-5 text-green-400" />
              : <span className="text-red-400 font-bold text-lg">✗</span>}
          </div>
          <div className="flex-1">
            <p className={`font-bold text-sm ${lastResult.correct ? 'text-green-400' : 'text-red-400'}`}>
              {lastResult.correct ? '완벽 정답!' : lastResult.rankingCorrect ? '순위만 정답' : '오답'}
            </p>
            <div className="flex gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded ${lastResult.rankingCorrect ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                순위 {lastResult.rankingCorrect ? '✓' : '✗'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${lastResult.payoutScore === 100 ? 'bg-green-500/10 text-green-400' : lastResult.payoutScore > 0 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                팟 분배 {lastResult.payoutScore}%
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${lastResult.passed ? 'bg-green-500/15 text-green-300' : 'bg-red-500/10 text-red-400'}`}>
                ⏱ {Math.floor(lastResult.elapsed)}초{lastResult.passed ? ' 합격' : ' 초과'}
                {lastResult.timeScore != null && (
                  <span className="ml-1">({lastResult.timeScore >= 0 ? '+' : ''}{lastResult.timeScore}pt)</span>
                )}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">+{lastResult.points}점</p>
            <p className="text-lg font-bold text-white">{score}</p>
          </div>
        </div>
      )}

      <div
        className="rounded-xl p-4 mb-4 max-h-[260px] overflow-y-auto"
        style={{
          background: '#181A20',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <h3 className="text-sm font-bold text-foreground mb-3">해설</h3>

        {/* Correct ranking list */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">정답 순위</p>
          <div className="space-y-1.5">
            {[...puzzle.players]
              .sort((a, b) => lastResult.answer.correctRanks[a.id] - lastResult.answer.correctRanks[b.id])
              .map(p => {
                const cr = lastResult.answer.correctRanks[p.id];
                const nu = normalizeRanks(lastResult.userRankings);
                const nc = normalizeRanks(lastResult.answer.correctRanks);
                const rankOk = nu[p.id] === nc[p.id];
                return (
                  <div key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${rankColor(cr)}`}>
                    <span className="text-base flex-shrink-0">{RANK_EMOJI[cr] ?? `${cr}위`}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold">{p.name}</span>
                      <span className="text-xs opacity-70 ml-2">{lastResult.answer.handMap[p.id]?.descriptionKo}</span>
                    </div>
                    <span className={`text-xs font-bold ${rankOk ? 'text-green-400' : 'text-red-400'}`}>
                      {rankOk ? '✓' : '✗'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Pot breakdown — with calculation formula */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">팟 계산</p>
          <div className="space-y-2">
            {lastResult.answer.potResults.map((pr, i) => {
              const isMain = pr.pot.type === 'main';
              const isAutoReturn = pr.pot.eligible.length < 2;
              const deadMoney = isMain ? bbaAdjusted(puzzle).deadMoney : 0;
              const playerAmount = pr.pot.amount - deadMoney;
              const perContrib = pr.pot.eligible.length > 0 && playerAmount > 0
                ? Math.round(playerAmount / pr.pot.eligible.length)
                : 0;
              const eligibleNames = pr.pot.eligible.map(id => puzzle.players.find(pp => pp.id === id)?.name ?? id);

              if (isAutoReturn) {
                const returnName = eligibleNames[0] ?? '?';
                return (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: '#15171D',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                  >
                    <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{pr.pot.label}</span>
                      <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{pr.pot.amount.toLocaleString()}칩</span>
                    </div>
                    <div className="px-3 py-1.5 text-xs italic" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      <span style={{ color: '#FBBF24', fontWeight: 700 }}>{returnName}</span>
                      <span style={{ color: 'rgba(255,255,255,0.60)' }}>에게 자동 반환 (유효 스택 초과분)</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className={`rounded-xl border overflow-hidden ${isMain ? 'border-blue-500/30' : 'border-purple-500/30'}`}>
                  <div className={`flex items-center justify-between px-3 py-1.5 ${isMain ? 'bg-primary/10' : 'bg-accent/10'}`}>
                    <span className={`text-xs font-bold ${isMain ? 'text-primary' : 'text-purple-400'}`}>
                      {pr.pot.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {pr.pot.amount.toLocaleString()}칩
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-card/60 border-b border-border/40">
                    <div className="flex items-center gap-1 flex-wrap text-xs">
                      <span className="text-muted-foreground">참여자:</span>
                      {eligibleNames.map((nm, j) => (
                        <span key={j} className="text-foreground font-semibold">{nm}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs font-mono flex-wrap">
                      <span className="text-muted-foreground">{pr.pot.eligible.length}명</span>
                      <span className="text-muted-foreground">×</span>
                      <span className="text-yellow-300 font-bold">{perContrib.toLocaleString()}칩</span>
                      {deadMoney > 0 && (
                        <>
                          <span className="text-muted-foreground">+</span>
                          <span className="text-orange-400 font-bold">{deadMoney.toLocaleString()}칩</span>
                          <span className="text-orange-400/60 text-[10px]">(데드머니)</span>
                        </>
                      )}
                      <span className="text-muted-foreground">=</span>
                      <span className="text-white font-bold">{pr.pot.amount.toLocaleString()}칩</span>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-muted/30 flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground text-xs">→ 승리:</span>
                    {pr.winners.map(id => {
                      const pl = puzzle.players.find(pp => pp.id === id);
                      return (
                        <span key={id} className="flex items-center gap-1 text-xs">
                          <span className="text-yellow-400 font-bold">{pl?.name ?? id}</span>
                          <span className="text-muted-foreground">({lastResult.answer.handMap[id]?.descriptionKo})</span>
                        </span>
                      );
                    })}
                    {pr.winners.length > 1 && <span className="text-muted-foreground text-xs">· 공동 분배</span>}
                    <span className="ml-auto text-green-400 font-bold text-xs">+{pr.perWinner.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payout comparison */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">최종 수령 칩 비교</p>
          <div className="grid grid-cols-2 gap-1.5">
            {puzzle.players.map(p => {
              const correct = Math.abs((lastResult.userPayouts[p.id] ?? 0) - (lastResult.answer.playerPayouts[p.id] ?? 0)) <= 1;
              const correctAmt = lastResult.answer.playerPayouts[p.id] ?? 0;
              const userAmt = lastResult.userPayouts[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded px-2 py-1.5"
                  style={{
                    background: '#15171D',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.name}</span>
                  <div className="flex items-center gap-1">
                    {!correct && <span className="text-xs text-red-400">{userAmt.toLocaleString()}→</span>}
                    <span
                      className="text-xs font-bold"
                      style={{ color: correctAmt > 0 ? '#4ADE80' : 'rgba(255,255,255,0.45)' }}
                    >
                      {correctAmt.toLocaleString()}
                    </span>
                    <span className={`text-xs ${correct ? 'text-green-400' : 'text-red-400'}`}>
                      {correct ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onQuit}
          data-testid="btn-home"
          className="flex items-center justify-center gap-2 rounded-xl transition-all active:scale-95"
          style={{
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          <Home className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          data-testid="btn-next"
          className="flex-1 rounded-xl font-bold transition-opacity active:opacity-80 hover:opacity-90 flex items-center justify-center gap-2"
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
          다음 문제
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
