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
    dividendPerShare:     0.05,        // $ per share per quarter (sustainable start ~55% payout)
    dividendHistory:      [],
    dividendCutQuarters:  0,
    equityIssuanceCount:  0,   // tracks number of equity issuances
    equityIssuanceYear:   0,   // year of last equity issuance
    debtIssuanceQuarter:  0,   // total quarter number of last debt issuance
    lastBuybackYear:      0,   // year of last share buyback (once per year)
  },

  // ----------------------------------------------------------
  // BALANCE SHEET (rebalanced starting position)
  // ----------------------------------------------------------
  balance: {
    cash:         30,     // dry powder for early moves, while still incentivizing debt
    totalAssets:  0,      // calculated on init
    totalDebt:    70,     // two tranches of $35M each (lower starting leverage)
    totalEquity:  0,      // calculated on init (common equity)
    preferredEquity: 0,   // preferred stock outstanding (mezzanine)
  },

  // Preferred stock — a redeemable lifeline (issued via CFO). Not debt.
  preferred: {
    outstanding: 0,       // $M par value outstanding
    shares:      0,       // millions of preferred shares
    parValue:    25,      // $ per preferred share
    dividendRate: 0.05,   // annual rate on par
    issued:      false,   // once-per-game offer guard
  },

  // ----------------------------------------------------------
  // DEBT TRANCHES
  // ----------------------------------------------------------
  debtTranches: [
    {
      id:                   "d001",
      amount:               35,
      rate:                 5.0,
      maturityQuarter:      2,
      maturityYear:         4,
      quartersUntilMaturity:13,
      label:                "5.0% Sr Notes due Y4Q2",
    },
    {
      id:                   "d002",
      amount:               35,
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
    baseInterestRate: 2.0,
    capRates: {
      office:      { tier1: 7.8, tier2: 8.4, suburban: 9.25 },
      industrial:  { tier1: 6.7, tier2: 7.3, suburban: 8.15 },
      multifamily: { tier1: 7.3, tier2: 7.9, suburban: 8.75 },
      retail:      { tier1: 8.4, tier2: 9.0, suburban: 10.35 },
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
    // Legacy pressure display fields
    pressurePoints: 0,
    maxPressure:    8,
    mood:           "neutral",
    pressureLog:    [],
    thresholds:     { dividendCoverage: 1.0, debtToAssets: 0.60, occupancy: 0.80, ffoGrowth: 0 },
    year1Score:     { dividendMaintained: true, occupancyOk: true, leverageOk: true, cashOk: true, noiGrowth: true },
    currentGoals:   [],
    lastYearGoals:  [],

    // New director system
    directors:            [],   // populated by Board.init()
    politicalCapital:     2,
    maxCapital:           5,
    activeMandates:       [],
    year1Safe:            true,

    // Year tracking
    acquisitionsThisYear: 0,
    leaseUpsThisYear:     0,
    noOverdraftBroken:    false,
    noEquityBroken:       false,
    startYearSharePrice:  0,
    startYearFFO:         0,
    startYearDividend:    0,
  },

  // ----------------------------------------------------------
  // HISTORY & LOGS
  // ----------------------------------------------------------
  history:  [],
  eventLog: [],

  // ----------------------------------------------------------
  // STAFF — hired executives, each unlocks a function
  // ----------------------------------------------------------
  staff: [],   // array of hired staff objects, populated as you hire

  // Pending acquisition offer from events.js
  _pendingOffer: null,

  // Pending board meeting after annual report
  _pendingBoardMeeting: false,

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
