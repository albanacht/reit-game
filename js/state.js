// ============================================================
// state.js — Single source of truth for all game data
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - All game data lives here and ONLY here
// - Other files READ from GameState, they do not store their own copies
// - To add a new data field, add it here first, then use it elsewhere
// - Never import from other game files into this file
// ============================================================

const GameState = {

  // ----------------------------------------------------------
  // META
  // ----------------------------------------------------------
  meta: {
    version: "0.1.0",
    quarter: 1,          // 1–4
    year: 1,             // starts at Year 1
    totalQuarters: 0,    // running count since game start
    gameOver: false,
    gameOverReason: "",
    started: false,
  },

  // ----------------------------------------------------------
  // COMPANY
  // ----------------------------------------------------------
  company: {
    name: "Albanacht REIT",   // can be renamed later
    sharePrice: 20.00,        // $ per share
    sharesOutstanding: 50,    // millions of shares
    marketCap: 1000,          // $ millions (sharePrice × shares)
    dividendPerShare: 0.30,   // $ per share per quarter
    dividendHistory: [],      // { quarter, year, amount }
    dividendCutQuarters: 0,   // how many quarters since last cut (board memory)
  },

  // ----------------------------------------------------------
  // BALANCE SHEET
  // ----------------------------------------------------------
  balance: {
    cash: 50,             // $ millions
    totalAssets: 1050,    // cash + property values
    totalDebt: 400,       // $ millions (sum of all debt tranches)
    totalEquity: 650,     // totalAssets - totalDebt
  },

  // ----------------------------------------------------------
  // DEBT TRANCHES (max 10)
  // Each tranche = one bond issue
  // ----------------------------------------------------------
  // Structure of each tranche:
  // {
  //   id: unique string,
  //   amount: $ millions,
  //   rate: % annual interest (e.g. 5.5),
  //   maturityQuarter: quarter number (1–4),
  //   maturityYear: year number,
  //   quartersUntilMaturity: computed each quarter,
  //   label: human-readable e.g. "5.5% Sr Notes due Y3Q2"
  // }
  debtTranches: [
    {
      id: "d001",
      amount: 200,
      rate: 5.0,
      maturityQuarter: 2,
      maturityYear: 4,
      quartersUntilMaturity: 13,
      label: "5.0% Sr Notes due Y4Q2"
    },
    {
      id: "d002",
      amount: 200,
      rate: 5.5,
      maturityQuarter: 4,
      maturityYear: 6,
      quartersUntilMaturity: 23,
      label: "5.5% Sr Notes due Y6Q4"
    }
  ],

  // ----------------------------------------------------------
  // CREDIT RATING
  // Computed each quarter from debt ratios
  // ----------------------------------------------------------
  credit: {
    rating: "BBB",          // AAA, AA, A, BBB, BB, B, CCC
    spread: 1.5,            // % added to base rate when borrowing
    watchNegative: false,   // on negative watch (deteriorating fast)
  },

  // ----------------------------------------------------------
  // MARKET CONDITIONS
  // Shift slowly over time, drive property values and borrowing cost
  // ----------------------------------------------------------
  market: {
    baseInterestRate: 5.0,      // % — the risk-free rate environment
    capRates: {
      office:       { tier1: 5.5, tier2: 6.5, suburban: 7.5 },
      industrial:   { tier1: 4.5, tier2: 5.5, suburban: 6.5 },
      multifamily:  { tier1: 5.0, tier2: 6.0, suburban: 7.0 },
      retail:       { tier1: 6.0, tier2: 7.0, suburban: 8.5 },
    },
    cycle: "stable",            // "expanding", "stable", "contracting", "recession"
    cycleQuartersRemaining: 8,  // how long current cycle lasts
    rateDirection: "flat",      // "rising", "flat", "falling"
  },

  // ----------------------------------------------------------
  // PORTFOLIO — properties you OWN
  // ----------------------------------------------------------
  // Structure of each property:
  // {
  //   id: unique string,
  //   name: string,
  //   sector: "office" | "industrial" | "multifamily" | "retail",
  //   location: "tier1" | "tier2" | "suburban",
  //   purchasePrice: $ millions,
  //   currentValue: $ millions (recalculated each quarter),
  //   annualNOI: $ millions (before vacancy),
  //   occupancy: 0.0–1.0,
  //   age: years (increases each year),
  //   capexReserve: $ millions (set aside for repairs),
  //   quarterOwned: total quarters in portfolio,
  //   encumbered: false,   // true if property-level debt attached (future feature)
  // }
  portfolio: [],

  // ----------------------------------------------------------
  // PROPERTY MARKET — available to buy (pool of 20)
  // Same structure as portfolio properties, plus:
  //   askingPrice: $ millions
  //   daysOnMarket: quarters listed
  // ----------------------------------------------------------
  propertyMarket: [],

  // ----------------------------------------------------------
  // P&L — current quarter (reset each quarter)
  // ----------------------------------------------------------
  pnl: {
    grossRentalRevenue: 0,    // $ millions
    vacancyLoss: 0,
    netRentalRevenue: 0,
    interestExpense: 0,
    gAndA: 0,                 // base G&A + portfolio scale factor
    unusualItems: 0,          // random events (negative = expense, positive = gain)
    netIncome: 0,
    depreciation: 0,          // fixed % of asset value (non-cash, adds back to FFO)
    ffo: 0,                   // Funds From Operations = Net Income + Depreciation
    affo: 0,                  // Adjusted FFO = FFO - normalized capex
    dividendsPaid: 0,
    retainedCash: 0,          // FFO - dividends (what's left)
  },

  // ----------------------------------------------------------
  // RATIOS — computed each quarter for display & board checks
  // ----------------------------------------------------------
  ratios: {
    ffoPerShare: 0,
    affoPerShare: 0,
    dividendCoverage: 0,      // FFO / Dividends Paid
    debtToAssets: 0,          // Total Debt / Total Assets
    debtToEbitda: 0,
    interestCoverage: 0,      // NOI / Interest Expense
    occupancyPortfolio: 0,    // weighted average across portfolio
    noiMargin: 0,
    impliedCapRate: 0,        // Portfolio NOI / Portfolio Value
  },

  // ----------------------------------------------------------
  // BOARD PRESSURE
  // ----------------------------------------------------------
  board: {
    pressurePoints: 0,        // accumulates; 8 = game over
    maxPressure: 8,
    thresholds: {
      dividendCoverage: 1.0,  // FFO / dividends must be above this
      debtToAssets: 0.60,     // must stay below this
      occupancy: 0.80,        // portfolio occupancy must stay above this
      ffoGrowth: 0,           // YoY FFO growth; negative triggers pressure
    },
    pressureLog: [],          // { quarter, year, reason, points }
    mood: "neutral",          // "pleased", "neutral", "concerned", "angry", "furious"
  },

  // ----------------------------------------------------------
  // HISTORY — one entry per quarter for charts and trend lines
  // ----------------------------------------------------------
  history: [],
  // Each entry: {
  //   quarter, year, totalQuarters,
  //   ffo, ffoPerShare, dividendPerShare,
  //   totalDebt, totalAssets, debtToAssets,
  //   sharePrice, marketCap,
  //   occupancy, pressurePoints,
  //   netIncome, revenue,
  // }

  // ----------------------------------------------------------
  // EVENT LOG — narrative log of what happened each quarter
  // ----------------------------------------------------------
  eventLog: [],
  // Each entry: {
  //   quarter, year,
  //   headline: string,
  //   body: string (the CFO earnings report paragraph),
  //   events: [ { type, description, impact } ]
  // }

  // ----------------------------------------------------------
  // HELPER: current period label
  // ----------------------------------------------------------
  currentPeriodLabel() {
    return `Year ${this.meta.year}, Q${this.meta.quarter}`;
  },

  // ----------------------------------------------------------
  // HELPER: total quarters elapsed (for maturity calculations)
  // ----------------------------------------------------------
  totalQuartersElapsed() {
    return (this.meta.year - 1) * 4 + this.meta.quarter;
  },

  // ----------------------------------------------------------
  // HELPER: quarters until a given maturity
  // ----------------------------------------------------------
  quartersUntilMaturity(maturityYear, maturityQuarter) {
    const target = (maturityYear - 1) * 4 + maturityQuarter;
    return target - this.totalQuartersElapsed();
  },

};

// Freeze the structure (not the values) in development to catch typos
// Remove this line if you need to add top-level keys dynamically
// Object.seal(GameState);
