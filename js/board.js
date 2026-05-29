// ============================================================
// board.js — Board pressure, win/lose conditions, earnings report
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file evaluates performance and manages board pressure
// - It reads GameState.ratios, pnl, market, company
// - It writes to GameState.board
// - It generates the CFO earnings report narrative
// - It never touches properties, debt, or P&L calculations
// - Call Board.evaluateQuarter() after Financials.runQuarter()
// ============================================================

const Board = (() => {

  // ----------------------------------------------------------
  // BOARD MOOD THRESHOLDS
  // Mood is determined by pressure points vs max
  // ----------------------------------------------------------
  const MOOD_LEVELS = [
    { maxPct: 0.00, mood: "pleased",  label: "Pleased",  color: "#22c55e" },
    { maxPct: 0.25, mood: "neutral",  label: "Neutral",  color: "#94a3b8" },
    { maxPct: 0.50, mood: "concerned",label: "Concerned",color: "#f59e0b" },
    { maxPct: 0.75, mood: "angry",    label: "Angry",    color: "#ef4444" },
    { maxPct: 1.00, mood: "furious",  label: "Furious",  color: "#7f1d1d" },
  ];

  // ----------------------------------------------------------
  // PRESSURE RULES
  // Each rule is evaluated every quarter
  // points: how many pressure points added if triggered
  // relief: how many points removed if condition is healthy
  // ----------------------------------------------------------
  const PRESSURE_RULES = [

    {
      id: "dividend_coverage",
      label: "Dividend Coverage",
      description: "FFO must cover dividends (threshold rises each year)",
      evaluate() {
        const coverage   = GameState.ratios.dividendCoverage;
        const threshold  = GameState.board.thresholds.dividendCoverage;
        if (coverage < 0.85) return { points: 3, reason: `Dividend coverage critically low at ${fmt(coverage)}x (minimum ${threshold}x)` };
        if (coverage < threshold) return { points: 1, reason: `Dividend coverage below threshold: ${fmt(coverage)}x vs ${threshold}x required` };
        if (coverage > 1.40) return { relief: 1, reason: `Strong dividend coverage of ${fmt(coverage)}x` };
        return null;
      },
    },

    {
      id: "debt_to_assets",
      label: "Leverage",
      description: "Debt/assets must stay below 60%",
      evaluate() {
        const d2a       = GameState.ratios.debtToAssets;
        const threshold = GameState.board.thresholds.debtToAssets;
        if (d2a > 0.65) return { points: 3, reason: `Leverage dangerously high at ${fmt(d2a*100)}% debt/assets` };
        if (d2a > threshold) return { points: 1, reason: `Leverage above threshold: ${fmt(d2a*100)}% vs ${fmt(threshold*100)}% limit` };
        if (d2a < 0.35) return { relief: 1, reason: `Conservative leverage at ${fmt(d2a*100)}% debt/assets` };
        return null;
      },
    },

    {
      id: "occupancy",
      label: "Portfolio Occupancy",
      description: "Portfolio occupancy must stay above threshold",
      evaluate() {
        const occ       = GameState.ratios.occupancyPortfolio;
        const threshold = GameState.board.thresholds.occupancy;
        if (occ < 0.72) return { points: 3, reason: `Portfolio occupancy critically low at ${fmt(occ*100)}%` };
        if (occ < threshold) return { points: 1, reason: `Occupancy below threshold: ${fmt(occ*100)}% vs ${fmt(threshold*100)}% required` };
        if (occ > 0.93) return { relief: 1, reason: `Excellent occupancy at ${fmt(occ*100)}%` };
        return null;
      },
    },

    {
      id: "ffo_growth",
      label: "FFO Growth",
      description: "Board expects year-over-year FFO growth",
      evaluate() {
        const history = GameState.history;
        if (history.length < 4) return null; // need at least one year of data

        const currentFFO  = GameState.pnl.ffo;
        const priorYearFFO = history[history.length - 4]?.ffo || currentFFO;
        const growth = priorYearFFO > 0
          ? (currentFFO - priorYearFFO) / priorYearFFO
          : 0;

        GameState.board.thresholds.ffoGrowth = growth;

        if (growth < -0.10) return { points: 2, reason: `FFO declined ${fmt(Math.abs(growth)*100)}% year-over-year` };
        if (growth < 0)     return { points: 1, reason: `FFO down ${fmt(Math.abs(growth)*100)}% year-over-year` };
        if (growth > 0.08)  return { relief: 1, reason: `Strong FFO growth of ${fmt(growth*100)}% year-over-year` };
        return null;
      },
    },

    {
      id: "interest_coverage",
      label: "Interest Coverage",
      description: "NOI must comfortably cover interest expense",
      evaluate() {
        const coverage = GameState.ratios.interestCoverage;
        if (coverage < 1.20) return { points: 3, reason: `Interest coverage dangerously thin at ${fmt(coverage)}x` };
        if (coverage < 1.50) return { points: 1, reason: `Interest coverage weak at ${fmt(coverage)}x` };
        return null;
      },
    },

    {
      id: "cash_position",
      label: "Cash Position",
      description: "Must maintain minimum liquidity",
      evaluate() {
        const cash   = GameState.balance.cash;
        const assets = GameState.balance.totalAssets;
        const cashPct = assets > 0 ? cash / assets : 0;
        if (cash < 5)         return { points: 2, reason: `Critical liquidity shortage — only $${fmt(cash)}M cash remaining` };
        if (cashPct < 0.02)   return { points: 1, reason: `Low liquidity: cash at ${fmt(cashPct*100)}% of assets` };
        return null;
      },
    },

    {
      id: "credit_rating",
      label: "Credit Rating",
      description: "Board monitors credit quality closely",
      evaluate() {
        const rating = GameState.credit.rating;
        const watch  = GameState.credit.watchNegative;
        if (rating === "CCC")       return { points: 3, reason: "Credit rating in distressed territory (CCC) — refinancing at risk" };
        if (rating === "B")         return { points: 2, reason: "Credit rating fallen to B — cost of debt is punishing" };
        if (rating === "BB" && watch) return { points: 1, reason: "Sub-investment grade (BB) and on negative watch" };
        if (rating === "BB")        return { points: 1, reason: "Credit rating below investment grade (BB)" };
        if (rating === "A" || rating === "AA" || rating === "AAA") {
          return { relief: 1, reason: `Strong credit rating of ${rating} — excellent access to capital markets` };
        }
        return null;
      },
    },

    {
      id: "negative_retained_cash",
      label: "Cash Flow Sustainability",
      description: "Dividends should be funded by AFFO, not capital",
      evaluate() {
        const retained = GameState.pnl.retainedCash;
        if (retained < -5)  return { points: 2, reason: `Paying $${fmt(Math.abs(retained))}M more in dividends than AFFO — unsustainable` };
        if (retained < 0)   return { points: 1, reason: `Dividend exceeds AFFO by $${fmt(Math.abs(retained))}M this quarter` };
        return null;
      },
    },

  ]; // end PRESSURE_RULES

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n) {
    return Math.round(n * 100) / 100;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ----------------------------------------------------------
  // EVALUATE QUARTER
  // Run all pressure rules, update board state
  // Returns evaluation summary for the earnings report
  // ----------------------------------------------------------
  function evaluateQuarter() {
    const pressureChanges = [];
    let totalDelta = 0;

    PRESSURE_RULES.forEach(rule => {
      const result = rule.evaluate();
      if (!result) return;

      if (result.points) {
        GameState.board.pressurePoints = Math.min(
          GameState.board.maxPressure,
          GameState.board.pressurePoints + result.points
        );
        totalDelta += result.points;
        pressureChanges.push({
          rule:   rule.label,
          type:   "pressure",
          points: result.points,
          reason: result.reason,
        });
        GameState.board.pressureLog.push({
          quarter: GameState.meta.quarter,
          year:    GameState.meta.year,
          reason:  result.reason,
          points:  result.points,
        });
      }

      if (result.relief) {
        GameState.board.pressurePoints = Math.max(
          0,
          GameState.board.pressurePoints - result.relief
        );
        totalDelta -= result.relief;
        pressureChanges.push({
          rule:   rule.label,
          type:   "relief",
          points: result.relief,
          reason: result.reason,
        });
      }
    });

    // Natural pressure escalation (world gets harder each year)
    const yearlyPressure = Math.floor(GameState.meta.year / 3);
    if (yearlyPressure > 0) {
      GameState.board.pressurePoints = Math.min(
        GameState.board.maxPressure,
        GameState.board.pressurePoints + yearlyPressure
      );
    }

    // Update board mood
    const pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    const moodLevel = MOOD_LEVELS.slice().reverse().find(m => pct > m.maxPct)
      || MOOD_LEVELS[0];
    GameState.board.mood = moodLevel.mood;

    // Check game over
    if (GameState.board.pressurePoints >= GameState.board.maxPressure) {
      GameState.meta.gameOver = true;
      GameState.meta.gameOverReason = generateTerminationLetter();
    }

    return {
      pressureChanges,
      totalDelta,
      currentPressure: GameState.board.pressurePoints,
      maxPressure:     GameState.board.maxPressure,
      mood:            GameState.board.mood,
      gameOver:        GameState.meta.gameOver,
    };
  }

  // ----------------------------------------------------------
  // GENERATE CFO EARNINGS REPORT
  // Called after each quarter — produces the narrative text
  // ----------------------------------------------------------
  function generateEarningsReport(quarterResult, boardResult) {
    const { pnl, ratios, marketResult, firedEvents, maturityMsgs } = quarterResult;
    const period   = GameState.currentPeriodLabel();
    const company  = GameState.company;
    const credit   = GameState.credit;
    const market   = GameState.market;

    // --- OPENING LINE ---
    const ffoGrowthVsPrior = GameState.history.length > 1
      ? GameState.history[GameState.history.length - 1].ffo -
        (GameState.history[GameState.history.length - 2]?.ffo || pnl.ffo)
      : 0;

    const openings = {
      pleased: [
        `${period} delivered strong results across the portfolio.`,
        `Management is pleased to report solid execution in ${period}.`,
        `${period} was a productive quarter for ${company.name}.`,
      ],
      neutral: [
        `${period} produced results broadly in line with internal expectations.`,
        `Management reports a steady quarter for ${period}.`,
        `${period} saw mixed performance across the portfolio.`,
      ],
      concerned: [
        `${period} presented meaningful challenges that management is actively addressing.`,
        `We must be candid with the board about a difficult ${period}.`,
        `${period} fell short of targets in several key areas.`,
      ],
      angry: [
        `${period} was a disappointing quarter requiring immediate corrective action.`,
        `The board should be aware that ${period} results are deeply concerning.`,
        `Management acknowledges that ${period} performance was unacceptable in key metrics.`,
      ],
      furious: [
        `${period} results represent a serious deterioration that demands urgent board intervention.`,
        `This is a critical juncture for ${company.name} following ${period}.`,
      ],
    };
    const opening = pick(openings[GameState.board.mood] || openings.neutral);

    // --- FINANCIAL SUMMARY ---
    const ffoLine = `FFO came in at $${fmt(pnl.ffo)}M ($${fmt(ratios.ffoPerShare)}/share) ` +
      `against a quarterly dividend commitment of $${fmt(pnl.dividendsPaid)}M ` +
      `($${company.dividendPerShare}/share), ` +
      `implying a coverage ratio of ${fmt(ratios.dividendCoverage)}x.`;

    const noiLine = `Net Operating Income was $${fmt(pnl.noi)}M on gross potential rent of ` +
      `$${fmt(pnl.grossPotentialRent)}M, with vacancy loss of $${fmt(pnl.vacancyLoss)}M ` +
      `reflecting portfolio occupancy of ${fmt(ratios.occupancyPortfolio * 100)}%.`;

    // --- MARKET COMMENTARY ---
    const marketLine = marketResult.commentary;

    // --- RATE / CREDIT LINE ---
    const rateLine = `Base rates stand at ${market.baseInterestRate}%. ` +
      `Our credit rating is ${credit.rating} ` +
      `(spread: +${credit.spread}%), ` +
      `giving a current all-in borrowing cost of ` +
      `${fmt(market.baseInterestRate + credit.spread)}%.` +
      (credit.watchNegative ? " We are on negative credit watch." : "");

    // --- LEVERAGE LINE ---
    const levLine = `The balance sheet carries $${fmt(GameState.balance.totalDebt)}M of debt ` +
      `against $${fmt(GameState.balance.totalAssets)}M of total assets ` +
      `(${fmt(ratios.debtToAssets * 100)}% loan-to-value). ` +
      `Interest coverage stands at ${fmt(ratios.interestCoverage)}x.`;

    // --- BOARD PRESSURE LINE ---
    const pressureLines = {
      pleased:   "The board is satisfied with management's execution.",
      neutral:   "The board notes performance is broadly on track.",
      concerned: `The board has flagged ${boardResult.pressureChanges.filter(p=>p.type==="pressure").length} areas of concern this quarter.`,
      angry:     `The board is registering serious dissatisfaction. Pressure is at ${boardResult.currentPressure}/${boardResult.maxPressure} points.`,
      furious:   `The board is considering management changes. Pressure critical at ${boardResult.currentPressure}/${boardResult.maxPressure}.`,
    };
    const pressureLine = pressureLines[GameState.board.mood];

    // --- EVENTS SUMMARY ---
    const eventLines = firedEvents.length > 0
      ? `Notable items this quarter: ${firedEvents.map(e => e.headline).join(", ")}.`
      : "No material unusual items were recorded this quarter.";

    // --- MATURITY LINE ---
    const maturityLine = maturityMsgs.length > 0
      ? maturityMsgs.join(" ")
      : "";

    // --- CYCLE CHANGE ---
    const cycleChangeLine = marketResult.cycleResult?.cycleChanged
      ? `⚠️ Market cycle shift: We are entering a ${marketResult.cycleResult.label} phase. ${marketResult.cycleResult.description}`
      : "";

    // Assemble full report
    const body = [
      opening,
      "",
      noiLine,
      ffoLine,
      "",
      marketLine,
      rateLine,
      levLine,
      "",
      eventLines,
      maturityLine,
      cycleChangeLine,
      "",
      pressureLine,
    ].filter(l => l !== undefined && l !== null && l !== "").join(" ").replace(/ {2,}/g, " ").trim();

    // Headline
    const headlines = {
      pleased:   `✅ ${period} — Strong Results`,
      neutral:   `📋 ${period} — Steady Quarter`,
      concerned: `⚠️ ${period} — Challenges Emerging`,
      angry:     `🔴 ${period} — Board Dissatisfied`,
      furious:   `🚨 ${period} — Crisis: Board Intervention Imminent`,
    };
    const headline = headlines[GameState.board.mood] || `📋 ${period} Earnings Report`;

    // Save to event log
    GameState.eventLog.push({
      quarter:  GameState.meta.quarter,
      year:     GameState.meta.year,
      headline,
      body,
      events:   firedEvents,
      pressure: boardResult,
    });

    return { headline, body, firedEvents, boardResult };
  }

  // ----------------------------------------------------------
  // TERMINATION LETTER — game over narrative
  // ----------------------------------------------------------
  function generateTerminationLetter() {
    const period  = GameState.currentPeriodLabel();
    const years   = GameState.meta.year;
    const quarters= GameState.meta.totalQuarters;
    const ratios  = GameState.ratios;
    const board   = GameState.board;

    const lastFailure = board.pressureLog.length > 0
      ? board.pressureLog[board.pressureLog.length - 1].reason
      : "sustained underperformance";

    const letters = [
      `After careful deliberation, the Board of Directors of ${GameState.company.name} has voted to remove the current management team effective immediately. The final straw was: ${lastFailure}. Over ${quarters} quarters (${years} years), the company failed to maintain the standards required of a publicly-traded REIT. The Board thanks management for their service.`,

      `It is with regret — and frustration — that the Board announces the termination of the current CEO and CFO. Despite repeated warnings, key metrics including dividend coverage (${fmt(ratios.dividendCoverage)}x), leverage (${fmt(ratios.debtToAssets*100)}% D/A), and occupancy (${fmt(ratios.occupancyPortfolio*100)}%) failed to meet required thresholds. The company survived ${quarters} quarters before this outcome.`,

      `NOTICE OF TERMINATION — ${period}: The Board has lost confidence in management's ability to execute. The accumulated pressure score reached the maximum threshold. A restructuring advisor has been engaged. Shareholders will be notified. The REIT operated for ${quarters} quarters under your leadership.`,
    ];

    return pick(letters);
  }

  // ----------------------------------------------------------
  // GET BOARD STATUS SUMMARY
  // For display in UI header
  // ----------------------------------------------------------
  function getBoardStatus() {
    const pressure = GameState.board.pressurePoints;
    const max      = GameState.board.maxPressure;
    const mood     = GameState.board.mood;
    const pct      = pressure / max;

    const moodLevel = MOOD_LEVELS.slice().reverse().find(m => pct > m.maxPct)
      || MOOD_LEVELS[0];

    return {
      pressure,
      max,
      pct: fmt(pct * 100),
      mood,
      moodLabel: moodLevel.label,
      color:     moodLevel.color,
      warningMsg: pct >= 0.75
        ? "⚠️ Board patience nearly exhausted. Immediate corrective action required."
        : pct >= 0.50
        ? "The board is watching closely. Address failing metrics this quarter."
        : null,
    };
  }

  // ----------------------------------------------------------
  // INITIALISE
  // ----------------------------------------------------------
  function init() {
    GameState.board.pressurePoints  = 0;
    GameState.board.maxPressure     = 8;
    GameState.board.mood            = "neutral";
    GameState.board.pressureLog     = [];
    GameState.board.thresholds = {
      dividendCoverage: 1.0,
      debtToAssets:     0.60,
      occupancy:        0.80,
      ffoGrowth:        0,
    };
    GameState.eventLog = [];
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    evaluateQuarter,
    generateEarningsReport,
    getBoardStatus,
    PRESSURE_RULES,
    MOOD_LEVELS,
  };

})();
