/**
 * BotStatsTracker — AI 플레이 통계 수집 (개발/검증용).
 *
 * 사용법:
 *   const stats = new BotStatsTracker('LAG', 'HARD');
 *   // HeuristicBot에 주입 후 각 결정 시 record* 메서드 호출
 *   stats.report(); // 콘솔 출력
 *   window.__botStats = stats; // 브라우저 콘솔에서 직접 접근
 */

export interface BotStatsSnapshot {
  persona: string;
  level: string;
  handsPlayed: number;
  vpip: string;
  pfr: string;
  threeBet: string;
  flopCbet: string;
  turnBarrel: string;
  riverBarrel: string;
  bluffAttempt: string;
  callFacingBet: string;
  foldFacingBet: string;
  wentToShowdown: string;
  avgBetSize: string;
  avgRaiseSize: string;
  aggressionFrequency: string;
}

export class BotStatsTracker {
  readonly persona: string;
  readonly level: string;

  handsPlayed       = 0;
  vpipCount         = 0;
  pfrCount          = 0;
  threeBetCount     = 0;
  flopCbetCount     = 0;   flopCbetOpps      = 0;
  turnBarrelCount   = 0;   turnBarrelOpps    = 0;
  riverBarrelCount  = 0;   riverBarrelOpps   = 0;
  bluffAttempts     = 0;
  callFacingBet     = 0;
  foldFacingBet     = 0;
  showdownCount     = 0;
  aggrActions       = 0;   totalActions      = 0;
  private betAmounts: number[]   = [];
  private raiseAmounts: number[] = [];

  constructor(persona: string, level: string) {
    this.persona = persona;
    this.level   = level;
  }

  recordHand() { this.handsPlayed++; }

  recordPreflopAction(action: string, facingRaise: boolean) {
    this.totalActions++;
    if (action !== 'fold') this.vpipCount++;
    if (action === 'raise') {
      this.pfrCount++;
      this.aggrActions++;
      if (facingRaise) this.threeBetCount++;
    }
  }

  recordFlopAction(action: string, wasCbet: boolean) {
    this.totalActions++;
    if (wasCbet) {
      this.flopCbetOpps++;
      if (action === 'bet' || action === 'raise') this.flopCbetCount++;
    }
    if (action === 'bet' || action === 'raise') this.aggrActions++;
  }

  recordBarrel(street: 'turn' | 'river', didBarrel: boolean) {
    if (street === 'turn') {
      this.turnBarrelOpps++;
      if (didBarrel) this.turnBarrelCount++;
    } else {
      this.riverBarrelOpps++;
      if (didBarrel) this.riverBarrelCount++;
    }
  }

  recordBluffAttempt() { this.bluffAttempts++; this.aggrActions++; this.totalActions++; }

  recordFacingBet(action: 'call' | 'fold') {
    this.totalActions++;
    if (action === 'call') this.callFacingBet++;
    else this.foldFacingBet++;
  }

  recordShowdown() { this.showdownCount++; }

  recordBetSize(amount: number)   { this.betAmounts.push(amount); }
  recordRaiseSize(amount: number) { this.raiseAmounts.push(amount); }

  private pct(num: number, den: number): string {
    if (den === 0) return '–';
    return `${((num / den) * 100).toFixed(1)}%`;
  }

  private avg(arr: number[]): string {
    if (arr.length === 0) return '–';
    return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  }

  snapshot(): BotStatsSnapshot {
    const facing = this.callFacingBet + this.foldFacingBet;
    return {
      persona:             this.persona,
      level:               this.level,
      handsPlayed:         this.handsPlayed,
      vpip:                this.pct(this.vpipCount, this.handsPlayed),
      pfr:                 this.pct(this.pfrCount, this.handsPlayed),
      threeBet:            this.pct(this.threeBetCount, this.handsPlayed),
      flopCbet:            this.pct(this.flopCbetCount, this.flopCbetOpps),
      turnBarrel:          this.pct(this.turnBarrelCount, this.turnBarrelOpps),
      riverBarrel:         this.pct(this.riverBarrelCount, this.riverBarrelOpps),
      bluffAttempt:        String(this.bluffAttempts),
      callFacingBet:       this.pct(this.callFacingBet, facing),
      foldFacingBet:       this.pct(this.foldFacingBet, facing),
      wentToShowdown:      this.pct(this.showdownCount, this.handsPlayed),
      avgBetSize:          this.avg(this.betAmounts),
      avgRaiseSize:        this.avg(this.raiseAmounts),
      aggressionFrequency: this.pct(this.aggrActions, this.totalActions),
    };
  }

  report(): void {
    const s = this.snapshot();
    console.group(`[BotStats] ${s.persona} / ${s.level} — ${s.handsPlayed} hands`);
    console.table({
      'VPIP':             s.vpip,
      'PFR':              s.pfr,
      '3Bet':             s.threeBet,
      'Flop Cbet':        s.flopCbet,
      'Turn Barrel':      s.turnBarrel,
      'River Barrel':     s.riverBarrel,
      'Bluff Attempts':   s.bluffAttempt,
      'Call vs Bet':      s.callFacingBet,
      'Fold vs Bet':      s.foldFacingBet,
      'Went to Showdown': s.wentToShowdown,
      'Avg Bet Size':     s.avgBetSize,
      'Avg Raise Size':   s.avgRaiseSize,
      'Aggr Frequency':   s.aggressionFrequency,
    });
    console.groupEnd();
  }

  reset() {
    this.handsPlayed = this.vpipCount = this.pfrCount = this.threeBetCount = 0;
    this.flopCbetCount = this.flopCbetOpps = 0;
    this.turnBarrelCount = this.turnBarrelOpps = 0;
    this.riverBarrelCount = this.riverBarrelOpps = 0;
    this.bluffAttempts = this.callFacingBet = this.foldFacingBet = this.showdownCount = 0;
    this.aggrActions = this.totalActions = 0;
    this.betAmounts = [];
    this.raiseAmounts = [];
  }
}

/** 브라우저 콘솔에서 window.__botStats.report() 로 통계 확인 */
declare global {
  interface Window { __botStats?: BotStatsTracker; }
}
