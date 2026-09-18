export const SCENARIOS = Object.freeze({
  FIRST_000: 'FIRST_000',
  FIRST_100: 'FIRST_100',
  FIRST_010: 'FIRST_010',
  FIRST_001: 'FIRST_001',
  FIRST_110: 'FIRST_110',
  FIRST_101: 'FIRST_101',
  FIRST_011: 'FIRST_011',
  UPAY1_X2: 'UPAY1_X2',
  UPAY1_X3: 'UPAY1_X3',
  UPAY1_X5: 'UPAY1_X5',
  UPAY2_X25: 'UPAY2_X25',
  KHAN_X500: 'KHAN_X500',
});

const PLANS = Object.freeze({
  [SCENARIOS.FIRST_000]: { hits: [0,0,0], khanHit: false },
  [SCENARIOS.FIRST_100]: { hits: [1,0,0], khanHit: false },
  [SCENARIOS.FIRST_010]: { hits: [0,1,0], khanHit: false },
  [SCENARIOS.FIRST_001]: { hits: [0,0,1], khanHit: false },
  [SCENARIOS.FIRST_110]: { hits: [1,1,0], khanHit: false },
  [SCENARIOS.FIRST_101]: { hits: [1,0,1], khanHit: false },
  [SCENARIOS.FIRST_011]: { hits: [0,1,1], khanHit: false },

  // First UPAY = 1-1-1. The second trio determines the total 3/4/5/6.
  [SCENARIOS.UPAY1_X2]: { hits: [1,1,1,0,0,0], khanHit: false },
  [SCENARIOS.UPAY1_X3]: { hits: [1,1,1,1,0,0], khanHit: false },
  [SCENARIOS.UPAY1_X5]: { hits: [1,1,1,1,1,0], khanHit: false },
  [SCENARIOS.UPAY2_X25]: { hits: [1,1,1,1,1,1], khanHit: false },
  [SCENARIOS.KHAN_X500]: { hits: [1,1,1,1,1,1], khanHit: true },
});

export class ScenarioEngine {
  constructor() {
    this.order = [
      SCENARIOS.FIRST_000,
      SCENARIOS.FIRST_100,
      SCENARIOS.FIRST_010,
      SCENARIOS.FIRST_001,
      SCENARIOS.FIRST_110,
      SCENARIOS.FIRST_101,
      SCENARIOS.FIRST_011,
      SCENARIOS.UPAY1_X2,
      SCENARIOS.UPAY1_X3,
      SCENARIOS.UPAY1_X5,
      SCENARIOS.UPAY2_X25,
      SCENARIOS.KHAN_X500,
    ];
    this.demoIndex = 0;
    this.current = this.order[0];
    this._resetState();
  }

  _resetState() {
    const p = PLANS[this.current];
    this.plan = [...p.hits];
    this.plannedKhanHit = !!p.khanHit;
    this.normalThrows = 0;
    this.collected = 0;
    this.stage = 1;
    this.multiplier = 0;
    this.khanAttempted = false;
    this.khanHit = false;
    this.finished = false;
    this.history = [];
  }

  reset({ advanceDemo = false } = {}) {
    if (advanceDemo) this.demoIndex = (this.demoIndex + 1) % this.order.length;
    this.current = this.order[this.demoIndex];
    this._resetState();
    return this.snapshot();
  }

  setScenario(code) {
    if (!PLANS[code]) throw new Error(`Unknown scenario: ${code}`);
    this.current = code;
    this.demoIndex = Math.max(0, this.order.indexOf(code));
    this._resetState();
    return this.snapshot();
  }

  setPlan({ hits, khanHit = false } = {}) {
    if (!Array.isArray(hits) || hits.length < 3) throw new Error('hits must contain at least 3 outcomes');
    this.current = 'CUSTOM';
    this.plan = hits.slice(0, 6).map(v => v ? 1 : 0);
    while (this.plan.length < 6) this.plan.push(0);
    this.plannedKhanHit = !!khanHit;
    this.normalThrows = 0;
    this.collected = 0;
    this.stage = 1;
    this.multiplier = 0;
    this.khanAttempted = false;
    this.khanHit = false;
    this.finished = false;
    this.history = [];
    return this.snapshot();
  }

  nextNormalHit() {
    if (this.finished || this.khanActive()) return null;
    return !!this.plan[this.normalThrows];
  }

  needsFailedStrike() {
    return this.nextNormalHit() === false;
  }

  canCollectNormal() {
    return !this.finished && !this.khanActive() && this.normalThrows < (this.stage === 1 ? 3 : 6);
  }

  registerCollection() {
    return this.registerNormalThrow(true);
  }

  registerFailedStrike() {
    return this.registerNormalThrow(false);
  }

  registerNormalThrow(hit) {
    if (!this.canCollectNormal()) return this.snapshot();

    const actualHit = !!hit;
    this.normalThrows++;
    if (actualHit) this.collected++;
    this.history.push(actualHit ? 1 : 0);

    if (this.normalThrows === 3) {
      if (this.collected <= 1) {
        this.multiplier = 0;
        this.finished = true;
      } else if (this.collected === 2) {
        this.multiplier = 1;
        this.finished = true;
      } else {
        this.multiplier = 2;
        this.stage = 2;
      }
    }

    if (this.normalThrows === 6 && !this.finished) {
      if (this.collected === 3) {
        this.multiplier = 2;
        this.finished = true;
      } else if (this.collected === 4) {
        this.multiplier = 3;
        this.finished = true;
      } else if (this.collected === 5) {
        this.multiplier = 5;
        this.finished = true;
      } else if (this.collected === 6) {
        this.multiplier = 25;
        this.stage = 3;
      }
    }

    return this.snapshot();
  }

  khanActive() {
    return !this.finished &&
      this.stage === 3 &&
      this.normalThrows === 6 &&
      this.collected === 6 &&
      !this.khanAttempted;
  }

  registerKhanAttempt(hit) {
    if (!this.khanActive()) return this.snapshot();
    this.khanAttempted = true;
    this.khanHit = !!hit;
    this.multiplier = this.khanHit ? 500 : 25;
    this.finished = true;
    return this.snapshot();
  }

  registerKhanHit() {
    return this.registerKhanAttempt(true);
  }

  registerKhanMiss() {
    return this.registerKhanAttempt(false);
  }

  snapshot() {
    const stageThrows = this.stage === 1
      ? this.normalThrows
      : this.stage === 2
        ? Math.max(0, this.normalThrows - 3)
        : 0;

    const stageLimit = this.stage === 1 || this.stage === 2 ? 3 : 1;

    return {
      scenario: this.current,
      collected: this.collected,
      normalThrows: this.normalThrows,
      stage: this.stage,
      stageThrows,
      stageLimit,
      throwsUsed: this.normalThrows + (this.khanAttempted ? 1 : 0),
      throwsRemaining: this.stage === 1
        ? Math.max(0, 3 - this.normalThrows)
        : this.stage === 2
          ? Math.max(0, 6 - this.normalThrows)
          : this.khanActive() ? 1 : 0,
      multiplier: this.multiplier,
      nextNormalHit: this.nextNormalHit(),
      failedStrikeRequired: this.needsFailedStrike(),
      khanRequired: this.collected === 6,
      khanActive: this.khanActive(),
      nextKhanHit: this.khanActive() ? this.plannedKhanHit : null,
      khanAttempted: this.khanAttempted,
      khanHit: this.khanHit,
      finished: this.finished,
      history: [...this.history],
    };
  }

  resultText() {
    if (!this.finished) {
      if (this.khanActive()) return '2 УПАЙ • ×25 • финальный удар по Хану';
      if (this.stage === 2) return '1 УПАЙ • ×2 • ещё 3 удара';
      return 'Первый этап • 3 удара';
    }

    if (this.khanAttempted) {
      return this.khanHit
        ? 'ХАН выбит! Главный выигрыш ×500'
        : 'ХАН не выбит • выигрыш ×25';
    }

    return `Игра завершена • выбито ${this.collected} чуко • выигрыш ×${this.multiplier}`;
  }
}
