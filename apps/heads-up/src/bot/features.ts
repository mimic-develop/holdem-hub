/**
 * DecisionFeatures 추출기.
 *
 * GameState → "객관적 상황 features" 변환. 페르소나/난이도와 무관.
 * 모든 modifier는 이 features만 보고 ActionScore를 조정.
 *
 * 성능: equity 1회 + boardTexture 캐시. 핸드당 평균 < 5ms 목표.
 */

import type { Card } from '../engine/card';
import type { GameState, Player } from '../types/game';
import { classifyBoardTexture } from './board-texture';
import { classifyHand, type HandStrength } from './postflop-rules';
import { EquityCache } from './equity-cache';
import type {
  DecisionFeatures,
  DrawStrength,
  FacingBetSize,
  HandStrengthBucket,
  Position,
  ShowdownValue,
} from './decision-types';
import { HandRank } from '../engine/hand-evaluator';

export interface ExtractContext {
  state: GameState;
  me: Player;
  hole: [Card, Card];
  iterations: number;
  rng: () => number;
  equityCache: EquityCache;
}

/**
 * 메인 진입점.
 * - equity 캐시 사용
 * - boardTexture 캐시 사용
 * - illegal action 플래그 동시 계산 (chooseAction에서 재사용)
 */
export function evaluateDecisionFeatures(ctx: ExtractContext): DecisionFeatures {
  const { state, me, hole, iterations, rng, equityCache } = ctx;

  const toCall = Math.max(0, state.currentBet - me.currentBet);
  const canCheck = toCall === 0;
  const canCall = toCall > 0 && me.stack > 0;
  const canRaise = me.stack > toCall;

  // Preflop은 equity가 의미 약함 — 휴리스틱으로 대체 가능하지만
  // 일관성을 위해 항상 계산 (캐시되므로 부담 적음).
  const equity =
    state.street === 'preflop'
      ? estimatePreflopEquity(hole)
      : equityCache.get(hole, state.board, iterations, rng);

  const handStrength = state.street === 'preflop'
    ? classifyPreflopStrength(hole)
    : classifyHand(hole, state.board);

  const handStrengthBucket = mapToHandBucket(handStrength, equity, state.street);
  const drawStrength = mapToDrawStrength(handStrength, state.street);
  const showdownValue = mapToShowdownValue(equity, handStrengthBucket);
  const boardTexture = classifyBoardTexture(state.board);
  const position = derivePosition(state, me);
  const initiative = deriveInitiative(state, me);
  const previousAggressor = derivePreviousAggressor(state, me);
  const potOdds = toCall === 0 ? 0 : toCall / (state.pot + toCall);
  const spr = state.pot > 0 ? me.stack / state.pot : 100;
  const facingBetSize = classifyFacingBetSize(toCall, state.pot);

  return {
    street: state.street,
    handStrengthBucket,
    drawStrength,
    showdownValue,
    boardTexture,
    position,
    initiative,
    potOdds,
    spr,
    facingBetSize,
    previousAggressor,
    equity,
    canCheck,
    canCall,
    canRaise,
  };
}

/**
 * Preflop equity heuristic — 휴리스틱 카드 강도 점수.
 * AA = 0.85, KK = 0.82, ..., 72o = 0.30 근사.
 * 정확도보다 단순함 우선.
 */
function estimatePreflopEquity(hole: [Card, Card]): number {
  const [a, b] = hole;
  const isPair = a.rank === b.rank;
  const isSuited = a.suit === b.suit;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  const gap = hi - lo;

  if (isPair) {
    // AA=0.85, KK=0.82, ..., 22=0.50
    return Math.min(0.85, 0.50 + (a.rank - 2) * 0.027);
  }

  // High card weight
  const hiWeight = (hi - 2) / 12; // 0..1
  const loWeight = (lo - 2) / 12; // 0..1
  // suited bonus
  const suitedBonus = isSuited ? 0.05 : 0;
  // connectivity bonus
  const gapPenalty = Math.min(0.15, Math.max(0, gap - 1) * 0.025);

  return Math.max(0.30, 0.40 + hiWeight * 0.20 + loWeight * 0.12 + suitedBonus - gapPenalty);
}

function classifyPreflopStrength(hole: [Card, Card]): HandStrength {
  // preflop은 madeHand 의미 약함 — pair 여부만 의미 있음
  return {
    madeHand: hole[0].rank === hole[1].rank ? HandRank.PAIR : HandRank.HIGH_CARD,
    isPocketPair: hole[0].rank === hole[1].rank,
    isOverpair: false,
    isTopPair: false,
    isPair: hole[0].rank === hole[1].rank,
    isTwoPair: false,
    isSet: false,
    isStraight: false,
    isFlush: false,
    isFullHouse: false,
    isFlushDraw: false,
    isOESD: false,
    isGutshot: false,
    hasDraw: false,
  };
}

/**
 * HandStrength + equity → bucket 매핑.
 *
 * Preflop은 equity 기반, postflop은 made hand + equity 조합.
 */
function mapToHandBucket(
  s: HandStrength,
  equity: number,
  street: GameState['street'],
): HandStrengthBucket {
  if (street === 'preflop') {
    if (equity >= 0.78) return 'monster';
    if (equity >= 0.65) return 'overPair';
    if (equity >= 0.58) return 'topPair';
    if (equity >= 0.52) return 'middlePair';
    if (equity >= 0.45) return 'weakPair';
    return 'air';
  }

  // Postflop
  if (s.madeHand >= HandRank.STRAIGHT) return 'monster';
  if (s.isFullHouse || s.madeHand === HandRank.FLUSH) return 'monster';
  if (s.isSet || s.isTwoPair) return 'twoPairPlus';
  if (s.isOverpair) return 'overPair';
  if (s.isTopPair) return 'topPair';
  if (s.isPair) {
    // equity로 middle/weak 구분
    if (equity >= 0.55) return 'middlePair';
    return 'weakPair';
  }
  // 페어 미만 — equity로 air/weakPair 판정
  if (equity >= 0.40) return 'weakPair';
  return 'air';
}

/**
 * HandStrength → DrawStrength.
 *
 * comboDraw = flushDraw + (OESD or Gutshot)
 * backdoor: turn에서만 backdoor 가능 (현재 보드 분석으로 추정 — 단순화: backdoor 미사용)
 */
function mapToDrawStrength(
  s: HandStrength,
  street: GameState['street'],
): DrawStrength {
  if (street === 'preflop') return 'none';
  if (street === 'river') return 'none'; // 리버에서 드로우 의미 없음
  const draw = s.isFlushDraw && (s.isOESD || s.isGutshot) ? 'comboDraw'
    : s.isFlushDraw ? 'flushDraw'
    : s.isOESD ? 'oesd'
    : s.isGutshot ? 'gutshot'
    : 'none';
  return draw;
}

/**
 * Showdown value — "쇼다운에서 이길 만한가" 직관 점수.
 * equity와 handStrengthBucket의 조합.
 */
function mapToShowdownValue(
  equity: number,
  bucket: HandStrengthBucket,
): ShowdownValue {
  // monster/twoPairPlus는 무조건 high
  if (bucket === 'monster' || bucket === 'twoPairPlus') return 'high';
  if (bucket === 'overPair' || bucket === 'topPair') {
    return equity >= 0.60 ? 'high' : 'medium';
  }
  if (bucket === 'middlePair') return equity >= 0.50 ? 'medium' : 'low';
  if (bucket === 'weakPair') return 'low';
  // air
  return equity >= 0.30 ? 'low' : 'none';
}

function derivePosition(state: GameState, me: Player): Position {
  // HU: SB는 preflop OOP-에 가깝지만 postflop에서 IP (act last).
  // Heads-up 규칙: postflop은 SB가 IP, BB가 OOP.
  if (state.street === 'preflop') {
    return me.position === 'SB' ? 'IP' : 'OOP';
  }
  return me.position === 'SB' ? 'IP' : 'OOP';
}

/**
 * Initiative: 이번 스트릿(또는 직전 액션)에서 hero가 마지막 어그레서인지.
 * 단순 추정: history를 역순으로 보고 bet/raise를 만나면 그게 어그레서.
 * 같은 스트릿에서 hero가 마지막으로 bet/raise했으면 initiative=true.
 */
function deriveInitiative(state: GameState, me: Player): boolean {
  // 이번 스트릿의 마지막 bet/raise 액터
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.street !== state.street) continue;
    if (h.action === 'bet' || h.action === 'raise') {
      return h.playerId === me.id;
    }
  }
  // 이번 스트릿에 어그레션 없음 → 이전 스트릿 어그레서 추정
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.action === 'bet' || h.action === 'raise') {
      return h.playerId === me.id;
    }
  }
  // 프리플랍에서 raise한 적 없으면 SB가 default initiative (open 가정)
  return state.street === 'preflop' && me.position === 'SB';
}

function derivePreviousAggressor(state: GameState, me: Player) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.action === 'bet' || h.action === 'raise') {
      return h.playerId === me.id ? 'hero' : 'villain';
    }
  }
  return 'none';
}

function classifyFacingBetSize(toCall: number, potBeforeCall: number): FacingBetSize {
  if (toCall <= 0) return 'none';
  if (potBeforeCall <= 0) return 'overbet'; // 안전 폴백
  const ratio = toCall / potBeforeCall;
  if (ratio <= 0.33) return 'small';
  if (ratio <= 0.66) return 'medium';
  if (ratio <= 1.10) return 'large';
  if (ratio <= 2.00) return 'overbet';
  return 'allin';
}
