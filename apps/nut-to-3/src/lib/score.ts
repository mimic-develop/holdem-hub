/**
 * NUT TO 3 점수 메트릭 계산 헬퍼.
 *
 * 게임 한 판(3 스트릿 × 3 슬롯 = 9 정답 슬롯) 의 결과를 받아 leaderboard 가
 * 정렬·비교에 사용하는 메트릭을 도출한다.
 *
 *   streak        : 게임 종료 시점의 streak (이미 호출자에서 유지)
 *   accuracy      : totalCorrect / totalSlots  (0..1, 표시용)
 *   avgResponseMs : 각 스트릿 응답 시간 평균 (ms, 낮을수록 좋음, 표시용)
 *   score         : totalCorrect × 10000 − avgResponseMs
 *                   → 정답 1개 차이(=10000)는 시간으로 절대 못 따라잡고,
 *                     같은 정답 수일 때만 빠른 응답이 미세 tie-break.
 *
 * Leaderboard 정렬: streak DESC → score DESC (2단계).
 */

const TOTAL_SLOTS = 9; // 3 streets × 3 slots
const MIN_AVG_RESPONSE_MS = 500; // floor — 너무 빠른 응답으로 점수가 폭주하는 것을 막는다

export interface MetricInputs {
  streetResults: (boolean[] | null)[];
  /** 각 스트릿의 응답 시간 (ms). 미응답 스트릿은 그 스트릿 limit 값 (ms) 으로 채움. */
  responseTimes: number[];
  /** 게임 종료 시점의 streak (호출자가 이미 계산). */
  finalStreak: number;
}

export interface DerivedMetrics {
  totalCorrect: number;
  totalSlots: number;
  accuracy: number;
  avgResponseMs: number;
  score: number;
}

export function countCorrectSlots(streetResults: (boolean[] | null)[]): number {
  let c = 0;
  for (const street of streetResults) {
    if (!street) continue;
    for (const slot of street) if (slot) c++;
  }
  return c;
}

export function computeAccuracy(totalCorrect: number, totalSlots: number = TOTAL_SLOTS): number {
  if (totalSlots <= 0) return 0;
  return totalCorrect / totalSlots;
}

export function computeAvgResponseMs(responseTimes: number[]): number {
  if (responseTimes.length === 0) return MIN_AVG_RESPONSE_MS;
  const sum = responseTimes.reduce((s, v) => s + v, 0);
  const avg = sum / responseTimes.length;
  return Math.max(MIN_AVG_RESPONSE_MS, Math.round(avg));
}

export function computeScore(args: {
  totalCorrect: number;
  avgResponseMs: number;
}): number {
  // 정답 1개 = +10000. avg 는 ms 단위 그대로 차감 (최대 ~22000ms 라 정답 1개 차이를 못 메움).
  return args.totalCorrect * 10000 - args.avgResponseMs;
}

export function deriveMetrics(input: MetricInputs): DerivedMetrics {
  const totalCorrect = countCorrectSlots(input.streetResults);
  const accuracy = computeAccuracy(totalCorrect, TOTAL_SLOTS);
  const avgResponseMs = computeAvgResponseMs(input.responseTimes);
  const score = computeScore({ totalCorrect, avgResponseMs });
  return { totalCorrect, totalSlots: TOTAL_SLOTS, accuracy, avgResponseMs, score };
}

export { TOTAL_SLOTS, MIN_AVG_RESPONSE_MS };
