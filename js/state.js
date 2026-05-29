// ============================================================
// state.js — Single source of truth for all game data
// REIT Simulator Game
// ============================================================

window.GameState = {

  // ----------------------------------------------------------
  // PLAYER IDENTITY
  // ----------------------------------------------------------
  player: {
    name:     "CEO",
    reitName: "My",   // auto-appends REIT in display
  },

  // ----------------------------------------------------------
  // META
  // ----------------------------------------------------------
  meta: {
    version:        "0.2.0",
    quarter:        1,
    year:           1,
    totalQuarters:  0,
    gameOver:       false,
    gameOverReason: "",
    started:        false,
    tutorialYear:   true,   // Year 1 safety — no firing
  },

  // ----------------------------------------------------------
  // COMPANY
  // ----------------------------------------------------------
  company: {
    name:                 "My REIT",   // built from player.reitName
    sharePrice:           10.00,
    sharesOutstanding:    10,          // millions
    marketCap:            100,         // $ millions
    dividendPerShare:     0.10,        // $ per share per quarter (rebalanced)
    dividendHistory:      [],
    dividendCutQuarters:  0,
  },

  // ----------------------------------------------------------
  // BALANCE SHEET (rebalanced starting position)
  // ----------------------------------------------------------
  balance: {
    cash:         50,     // modest cash reserve
    totalAssets:  0,      // calculated on init
    totalDebt:    50,     // two small tranches matching property values
    totalEquity:  0,      // calculated on init
  },

  // ----------------------------------------------------------
  // DEBT TRANCHES
  // ----------------------------------------------------------
  debtTranches: [
    {
      id:                   "d001",
      amount:               25,
      rate:                 5.0,
      maturityQuarter:      2,
      maturityYear:         4,
      quartersUntilMaturity:13,
      label:                "5.0% Sr Notes due Y4Q2",
    },
    {
      id:                   "d002",
      amount:               25,
      rate:                 5.5,
      maturityQuarter:      4,
      maturityYear:         6,
      quartersUntilMaturity:23,
      label:                "5.5% Sr Notes due Y6Q4",
    },
  ],

  // ----------------------------------------------------------
  // CREDIT RATING
  // ----------------------------------------------------------
  credit: {
    rating:        "BBB",
    spread:        1.5,
    watchNegative: false,
  },

  // ----------------------------------------------------------
  // MARKET CONDITIONS
  // ----------------------------------------------------------
  market: {
    baseInterestRate: 3.5,
    capRates: {
      office:      { tier1: 5.5, tier2: 6.5, suburban: 7.5 },
      industrial:  { tier1: 4.5, tier2: 5.5, suburban: 6.5 },
      multifamily: { tier1: 5.0, tier2: 6.0, suburban: 7.0 },
      retail:      { tier1: 6.0, tier2: 7.0, suburban: 8.5 },
    },
    cycle:                  "stable",
    cycleQuartersRemaining: 8,
    rateDirection:          "flat",
  },

  // ----------------------------------------------------------
  // PORTFOLIO & MARKET
  // ----------------------------------------------------------
  portfolio:     [],
  propertyMarket:[],

  // ----------------------------------------------------------
  // P&L (reset each quarter)
  // ----------------------------------------------------------
  pnl: {
    grossPotentialRent: 0,
    vacancyLoss:        0,
    netRentalRevenue:   0,
    operatingExpenses:  0,
    noi:                0,
    interestExpense:    0,
    gAndA:              0,
    unusualItems:       0,
    netIncome:          0,
    depreciation:       0,
    ffo:                0,
    affo:               0,
    dividendsPaid:      0,
    retainedCash:       0,
  },

  // ----------------------------------------------------------
  // RATIOS
  // ----------------------------------------------------------
  ratios: {
    ffoPerShare:        0,
    affoPerShare:       0,
    dividendCoverage:   0,
    payoutRatio:        0,
    debtToAssets:       0,
    debtToEquity:       0,
    debtToEbitda:       0,
    interestCoverage:   0,
    occupancyPortfolio: 0,
    noiMargin:          0,
    impliedCapRate:     0,
    navPerShare:        0,
    pToFFO:             0,
    pToAFFO:            0,
    dividendYield:      0,
    ebitda:             0,
  },

  // ----------------------------------------------------------
  // BOARD
  // ----------------------------------------------------------
  board: {
    pressurePoints: 0,
    maxPressure:    8,
    thresholds: {
      dividendCoverage: 1.0,
      debtToAssets:     0.60,
      occupancy:        0.80,
      ffoGrowth:        0,
    },
    pressureLog: [],
    mood:        "neutral",

    // Year 1 silent scoring
    year1Score: {
      dividendMaintained: true,
      occupancyOk:        true,
      leverageOk:         true,
      cashOk:             true,
      noiGrowth:          true,
    },

    // Annual goals set by board each year
    currentGoals: [],
    lastYearGoals:[],
  },

  // ----------------------------------------------------------
  // HISTORY & LOGS
  // ----------------------------------------------------------
  history:  [],
  eventLog: [],

  // Pending acquisition offer from events.js
  _pendingOffer: null,

  // Annual snapshots (one per year end)
  annualSnapshots: [],

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------
  currentPeriodLabel() {
    return `Year ${this.meta.year}, Q${this.meta.quarter}`;
  },

  totalQuartersElapsed() {
    return (this.meta.year - 1) * 4 + this.meta.quarter;
  },

  quartersUntilMaturity(maturityYear, maturityQuarter) {
    const target  = (maturityYear - 1) * 4 + maturityQuarter;
    const current = (this.meta.year - 1) * 4 + this.meta.quarter;
    return target - current;
  },

  isYearEnd() {
    return this.meta.quarter === 4;
  },

  isTutorialYear() {
    return this.meta.year === 1;
  },
};
