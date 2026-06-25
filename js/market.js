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
  // COMPUTE CREDIT RATING — BLENDED SCORE
  // Leverage and coverage each contribute to a 0-100 score, so a strong
  // balance sheet cushions weak coverage (and vice versa). No more crashing
  // to CCC just because early FFO is thin. Downgrades are slow (a notch every
  // 2-3 quarters); upgrades can move a notch per quarter.
  // ----------------------------------------------------------
  function computeCreditRating() {
    var debtToAssets = GameState.ratios.debtToAssets;   // 0..1+
    var coverage     = GameState.ratios.interestCoverage; // x

    // --- Leverage sub-score (0-50): lower leverage = more points ---
    // 25% D/A → ~50pts (excellent); 70%+ → ~0pts (stretched)
    var levScore = clamp((0.75 - debtToAssets) / (0.75 - 0.25), 0, 1) * 50;

    // --- Coverage sub-score (0-50): higher coverage = more points ---
    // 5x+ → 50pts; 1x → ~12pts; below 1x tapers toward 0 but never instantly junk
    var covScore;
    if (coverage >= 5)      covScore = 50;
    else if (coverage >= 1) covScore = 12 + (coverage - 1) / (5 - 1) * 38;
    else                    covScore = clamp(coverage, 0, 1) * 12; // 0..12 for sub-1x
    covScore = clamp(covScore, 0, 50);

    var score = levScore + covScore; // 0-100

    // Map blended score to rating band
    var qualifiedRating, qualifiedSpread;
    if      (score >= 90) { qualifiedRating = "AAA"; qualifiedSpread = 0.50; }
    else if (score >= 80) { qualifiedRating = "AA";  qualifiedSpread = 0.80; }
    else if (score >= 68) { qualifiedRating = "A";   qualifiedSpread = 1.20; }
    else if (score >= 54) { qualifiedRating = "BBB"; qualifiedSpread = 1.80; }
    else if (score >= 38) { qualifiedRating = "BB";  qualifiedSpread = 3.00; }
    else if (score >= 22) { qualifiedRating = "B";   qualifiedSpread = 4.50; }
    else                  { qualifiedRating = "CCC"; qualifiedSpread = 7.00; }

    var ratingOrder = ["AAA","AA","A","BBB","BB","B","CCC"];
    var spreads     = { AAA:0.50, AA:0.80, A:1.20, BBB:1.80, BB:3.00, B:4.50, CCC:7.00 };
    var currentIdx  = ratingOrder.indexOf(GameState.credit.rating);
    if (currentIdx < 0) currentIdx = 3; // default BBB
    var targetIdx   = ratingOrder.indexOf(qualifiedRating);

    // Downgrade stickiness: only allow a downgrade every 2-3 quarters, so a
    // bad patch can't cascade to CCC in three turns.
    if (GameState.credit.downgradeCooldown === undefined) GameState.credit.downgradeCooldown = 0;

    var newIdx = currentIdx;
    if (targetIdx > currentIdx) {
      // deteriorating
      if (GameState.credit.downgradeCooldown <= 0) {
        newIdx = currentIdx + 1;                 // one notch worse
        GameState.credit.downgradeCooldown = 2;  // wait 2 quarters before next downgrade
      }
    } else if (targetIdx < currentIdx) {
      newIdx = currentIdx - 1;                    // improving: one notch better
    }
    if (GameState.credit.downgradeCooldown > 0) GameState.credit.downgradeCooldown -= 1;

    newIdx = clamp(newIdx, 0, ratingOrder.length - 1);
    var newRatingName = ratingOrder[newIdx];

    var watchNegative = targetIdx > newIdx;

    var oldRating = GameState.credit.rating;
    GameState.credit.rating = newRatingName;
    GameState.credit.spread = spreads[newRatingName];
    GameState.credit.watchNegative = watchNegative;
    GameState.credit.score = Math.round(score);

    if (oldRating !== newRatingName && typeof News !== "undefined" && News.ratingChanged) {
      News.ratingChanged(oldRating, newRatingName, newIdx < currentIdx);
    }

    return {
      rating: newRatingName,
      spread: spreads[newRatingName],
      watchNegative: watchNegative,
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

    // ---- INTEREST RATE MODEL ----
    // The Fed moves in discrete 0.25% steps, not every quarter (every 2-3
    // quarters typically), upward-biased to make long games progressively
    // harder — with rare surprise shocks and occasional relief cuts.
    var prevBaseRate = market.baseInterestRate; // snapshot for cap-rate linkage
    if (market.rateHoldQuarters === undefined) market.rateHoldQuarters = 2;
    market.rateHoldQuarters -= 1;

    var rateMsg = null;
    if (market.rateHoldQuarters <= 0) {
      var roll = Math.random();
      var delta = 0;
      if (roll < 0.06) {
        // Surprise inflation shock: +0.75 to +1.00
        delta = Math.random() < 0.5 ? 0.75 : 1.00;
        rateMsg = "shock_up";
      } else if (roll < 0.66) {
        // Typical hike: +0.25 (sometimes +0.50)
        delta = Math.random() < 0.75 ? 0.25 : 0.50;
        rateMsg = "hike";
      } else if (roll < 0.84) {
        // Hold — no change
        delta = 0;
      } else {
        // Relief cut: -0.25 (a breather)
        delta = -0.25;
        rateMsg = "cut";
      }
      market.baseInterestRate = Math.round(
        clamp(market.baseInterestRate + delta, 0.5, 9.0) * 100
      ) / 100;
      market.lastRateMove = rateMsg;
      // Next change in 2-3 quarters (rarely back-to-back)
      market.rateHoldQuarters = Math.random() < 0.25 ? 1 : (Math.random() < 0.6 ? 2 : 3);

      // News headline for rate moves
      if (rateMsg && typeof News !== "undefined" && News.add) {
        if (rateMsg === "shock_up") News.add("Inflation surprise: the Fed hikes rates sharply to " + market.baseInterestRate.toFixed(2) + "% — REIT valuations under pressure.", "rating");
        else if (rateMsg === "hike") News.add("Fed raises its benchmark rate to " + market.baseInterestRate.toFixed(2) + "%.", "rating");
        else if (rateMsg === "cut") News.add("Fed trims rates to " + market.baseInterestRate.toFixed(2) + "% — modest relief for property owners.", "rating");
      }
    }
    market.rateDirection = cycleDef.rateDirection;

    // ── Cap rates now FOLLOW the base rate (the real-world relationship) ──
    // When the central bank raises rates, investors demand higher yields on
    // property too → cap rates rise → values fall. When rates fall, cap rates
    // compress → values rise. The base-rate move this quarter is the dominant
    // driver; a small cycle component + noise keeps some independent texture.
    var baseRateMove = market.baseInterestRate - prevBaseRate; // + = rates rose
    var ratePass     = baseRateMove * 0.6;        // ~60% of the rate move passes into cap rates
    var cycleComponent = cycleDef.capRateDelta * 0.35; // small residual cycle mood
    const capDelta = ratePass + cycleComponent + randBetween(-0.02, 0.02);
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
          clamp(market.capRates[sector][location] + delta, 4.5, 13.0) * 100
        ) / 100;
      });
    });

    // Explanatory note when rates moved meaningfully — teaches the player that
    // rate changes ripple into property values.
    if (typeof News !== "undefined" && News.add && Math.abs(baseRateMove) >= 0.15) {
      if (baseRateMove > 0) {
        News.add("Higher rates lift cap rates across the market — property values come under pressure.", "rating", "bad");
      } else {
        News.add("Falling rates compress cap rates — property values get a tailwind.", "rating", "good");
      }
    }

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
    GameState.market.baseInterestRate = 2.0;
    GameState.market.cycle = "stable";
    GameState.market.cycleQuartersRemaining = randInt(4, 8);
    GameState.market.rateDirection = "flat";
    GameState.market.rateHoldQuarters = 3;   // no rate move for the first few quarters

    // Reset cap rates to defaults (raised for positive carry vs borrowing costs)
    GameState.market.capRates = {
      office:      { tier1: 7.8, tier2: 8.4, suburban: 9.25 },
      industrial:  { tier1: 6.7, tier2: 7.3, suburban: 8.15 },
      multifamily: { tier1: 7.3, tier2: 7.9, suburban: 8.75 },
      retail:      { tier1: 8.4, tier2: 9.0, suburban: 10.35 },
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
