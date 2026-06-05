// ============================================================
// market.js — Interest rate cycles, cap rates, credit rating
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file manages macro market conditions only
// - It writes to GameState.market and GameState.credit
// - It never touches properties directly — properties.js does that
// - It never touches P&L — financials.js does that
// - Call Market.quarterlyUpdate() once per quarter advance
// ============================================================

window.Market = (() => {

  // ----------------------------------------------------------
  // CYCLE DEFINITIONS
  // Each cycle has: duration range, rate direction, cap rate pressure
  // capRateDelta: how much cap rates shift per quarter (positive = rising = lower values)
  // ----------------------------------------------------------
  const CYCLES = {
    expanding: {
      label: "Expanding",
      description: "Economy growing, demand strong, values rising.",
      durationRange: [6, 12],
      rateDirection: "rising",      // rates rise as economy heats up
      baseRateDelta: +0.10,         // rates drift up 0.10% per quarter
      capRateDelta: -0.05,          // cap rates compress (values rise)
      occupancyBoost: +0.005,       // slight occupancy tailwind
      next: ["stable", "stable"],   // weighted toward stable next
    },
    stable: {
      label: "Stable",
      description: "Steady environment, predictable cash flows.",
      durationRange: [4, 8],
      rateDirection: "flat",
      baseRateDelta: 0,
      capRateDelta: 0,
      occupancyBoost: 0,
      next: ["expanding", "contracting"],
    },
    contracting: {
      label: "Contracting",
      description: "Growth slowing, vacancies rising, values under pressure.",
      durationRange: [4, 8],
      rateDirection: "falling",     // central bank starts cutting
      baseRateDelta: -0.10,
      capRateDelta: +0.08,          // cap rates widen (values fall)
      occupancyBoost: -0.008,
      next: ["recession", "stable"],
    },
    recession: {
      label: "Recession",
      description: "Severe downturn. Vacancies spike, values drop, credit tightens.",
      durationRange: [3, 6],
      rateDirection: "falling",
      baseRateDelta: -0.20,
      capRateDelta: +0.15,
      occupancyBoost: -0.015,
      next: ["contracting", "stable"],
    },
  };

  // ----------------------------------------------------------
  // CREDIT RATING TABLE
  // Maps debt/asset and coverage ratios to a rating and spread
  // ----------------------------------------------------------
  const CREDIT_RATINGS = [
    { rating: "AAA", spread: 0.50, maxDebtToAssets: 0.25, minCoverage: 5.0 },
    { rating: "AA",  spread: 0.80, maxDebtToAssets: 0.30, minCoverage: 4.0 },
    { rating: "A",   spread: 1.20, maxDebtToAssets: 0.38, minCoverage: 3.0 },
    { rating: "BBB", spread: 1.80, maxDebtToAssets: 0.45, minCoverage: 2.2 },
    { rating: "BB",  spread: 3.00, maxDebtToAssets: 0.52, minCoverage: 1.6 },
    { rating: "B",   spread: 4.50, maxDebtToAssets: 0.60, minCoverage: 1.1 },
    { rating: "CCC", spread: 7.00, maxDebtToAssets: 1.00, minCoverage: 0.0 },
  ];

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(randBetween(min, max + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ----------------------------------------------------------
  // COMPUTE CREDIT RATING
  // Based on debt/assets and interest coverage
  // Rating is sticky: can only move one notch per quarter
  // ----------------------------------------------------------
  function computeCreditRating() {
    const debtToAssets = GameState.ratios.debtToAssets;
    const coverage = GameState.ratios.interestCoverage;

    // Find the best rating the company qualifies for
    let qualifiedRating = "CCC";
    let qualifiedSpread = 6.00;

    for (const tier of CREDIT_RATINGS) {
      if (debtToAssets <= tier.maxDebtToAssets && coverage >= tier.minCoverage) {
        qualifiedRating = tier.rating;
        qualifiedSpread = tier.spread;
        break; // CREDIT_RATINGS is ordered best to worst
      }
    }

    // Stickiness: only move one notch per quarter
    const ratingOrder = CREDIT_RATINGS.map(r => r.rating);
    const currentIdx = ratingOrder.indexOf(GameState.credit.rating);
    const targetIdx = ratingOrder.indexOf(qualifiedRating);

    let newIdx;
    if (targetIdx > currentIdx) {
      newIdx = currentIdx + 1; // deteriorating: move one notch worse
    } else if (targetIdx < currentIdx) {
      newIdx = currentIdx - 1; // improving: move one notch better
    } else {
      newIdx = currentIdx;     // no change
    }

    newIdx = clamp(newIdx, 0, CREDIT_RATINGS.length - 1);
    const newRating = CREDIT_RATINGS[newIdx];

    // Negative watch: if moving worse two quarters in a row
    const watchNegative = targetIdx > newIdx;

    var oldRating = GameState.credit.rating;
    GameState.credit.rating = newRating.rating;
    GameState.credit.spread = newRating.spread;
    GameState.credit.watchNegative = watchNegative;

    if (oldRating !== newRating.rating && typeof News !== "undefined" && News.ratingChanged) {
      News.ratingChanged(oldRating, newRating.rating, newIdx > currentIdx);
    }

    return {
      rating: newRating.rating,
      spread: newRating.spread,
      watchNegative,
    };
  }

  // ----------------------------------------------------------
  // CURRENT BORROWING RATE
  // What you'd pay today on new debt
  // ----------------------------------------------------------
  function getCurrentBorrowingRate() {
    return Math.round(
      (GameState.market.baseInterestRate + GameState.credit.spread) * 100
    ) / 100;
  }

  // ----------------------------------------------------------
  // ADVANCE MARKET CYCLE
  // Called each quarter — shifts rates and cap rates
  // ----------------------------------------------------------
  function advanceCycle() {
    const market = GameState.market;
    const cycleDef = CYCLES[market.cycle];

    // Tick down remaining quarters in this cycle
    market.cycleQuartersRemaining -= 1;

    // Apply rate drift (with small noise)
    const rateDelta = cycleDef.baseRateDelta + randBetween(-0.05, 0.05);
    market.baseInterestRate = Math.round(
      clamp(market.baseInterestRate + rateDelta, 2.0, 12.0) * 100
    ) / 100;
    market.rateDirection = cycleDef.rateDirection;

    // Apply cap rate drift to all sector/location combos
    const capDelta = cycleDef.capRateDelta + randBetween(-0.02, 0.02);
    const sectors = ["office", "industrial", "multifamily", "retail"];
    const locations = ["tier1", "tier2", "suburban"];

    // Sector-specific sensitivity (retail and office more volatile)
    const sectorSensitivity = {
      office: 1.2,
      industrial: 0.7,
      multifamily: 0.9,
      retail: 1.3,
    };

    sectors.forEach(sector => {
      locations.forEach(location => {
        const sensitivity = sectorSensitivity[sector];
        const locNoise = randBetween(-0.03, 0.03);
        const delta = (capDelta * sensitivity) + locNoise;
        market.capRates[sector][location] = Math.round(
          clamp(market.capRates[sector][location] + delta, 3.0, 12.0) * 100
        ) / 100;
      });
    });

    // Transition to next cycle if time is up
    if (market.cycleQuartersRemaining <= 0) {
      const nextCycle = pick(cycleDef.next);
      const nextDef = CYCLES[nextCycle];
      market.cycle = nextCycle;
      market.cycleQuartersRemaining = randInt(...nextDef.durationRange);

      return {
        cycleChanged: true,
        newCycle: nextCycle,
        label: nextDef.label,
        description: nextDef.description,
      };
    }

    return { cycleChanged: false };
  }

  // ----------------------------------------------------------
  // YEAR-OVER-YEAR DIFFICULTY ESCALATION
  // Board thresholds tighten each year, making survival harder
  // ----------------------------------------------------------
  function applyYearlyEscalation() {
    const year = GameState.meta.year;

    // Board gets more demanding every year
    // Dividend coverage threshold rises slightly
    GameState.board.thresholds.dividendCoverage =
      Math.round((1.0 + (year - 1) * 0.03) * 100) / 100;

    // Occupancy threshold rises
    GameState.board.thresholds.occupancy =
      Math.round((0.80 + (year - 1) * 0.01) * 100) / 100;

    // Max pressure before firing drops (board patience shrinks)
    GameState.board.maxPressure = Math.max(4, 8 - Math.floor(year / 2));
  }

  // ----------------------------------------------------------
  // GENERATE NARRATIVE MARKET COMMENTARY
  // Short string for the earnings report
  // ----------------------------------------------------------
  function getMarketCommentary() {
    const market = GameState.market;
    const rate = market.baseInterestRate;
    const cycle = market.cycle;
    const direction = market.rateDirection;

    const cycleComment = {
      expanding:   "Market fundamentals remain strong with healthy demand across most sectors.",
      stable:      "Market conditions are broadly stable with few macro surprises this quarter.",
      contracting: "Economic momentum is fading, and we are seeing early signs of tenant stress.",
      recession:   "Recessionary conditions are weighing heavily on occupancy and valuations.",
    }[cycle];

    const rateComment = direction === "rising"
      ? `Base rates ticked up to ${rate.toFixed(2)}%, increasing refinancing costs.`
      : direction === "falling"
      ? `Base rates eased to ${rate.toFixed(2)}%, providing some relief on new issuances.`
      : `Base rates held steady at ${rate.toFixed(2)}%.`;

    return `${cycleComment} ${rateComment}`;
  }

  // ----------------------------------------------------------
  // QUARTERLY UPDATE — master function called each quarter
  // ----------------------------------------------------------
  function quarterlyUpdate() {
    const cycleResult = advanceCycle();
    const creditResult = computeCreditRating();

    return {
      cycleResult,
      creditResult,
      borrowingRate: getCurrentBorrowingRate(),
      commentary: getMarketCommentary(),
    };
  }

  // ----------------------------------------------------------
  // INITIALISE — call once at game start
  // ----------------------------------------------------------
  function init() {
    GameState.market.baseInterestRate = 3.5;
    GameState.market.cycle = "stable";
    GameState.market.cycleQuartersRemaining = randInt(4, 8);
    GameState.market.rateDirection = "flat";

    // Reset cap rates to defaults
    GameState.market.capRates = {
      office:      { tier1: 6.1, tier2: 7.2, suburban: 8.3 },
      industrial:  { tier1: 5.0, tier2: 6.1, suburban: 7.2 },
      multifamily: { tier1: 5.5, tier2: 6.6, suburban: 7.7 },
      retail:      { tier1: 6.6, tier2: 7.7, suburban: 9.4 },
    };

    GameState.credit.rating = "BBB";
    GameState.credit.spread = 1.80;
    GameState.credit.watchNegative = false;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    quarterlyUpdate,
    computeCreditRating,
    getCurrentBorrowingRate,
    applyYearlyEscalation,
    getMarketCommentary,
    CYCLES,
    CREDIT_RATINGS,
  };

})();
