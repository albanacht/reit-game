// ============================================================
// board.js — Board pressure, win/lose, annual report, tutorial
// REIT Simulator Game
// ============================================================

window.Board = (() => {

  const MOOD_LEVELS = [
    { maxPct: 0.00, mood: "pleased",  label: "Pleased",  color: "#22c55e" },
    { maxPct: 0.25, mood: "neutral",  label: "Neutral",  color: "#94a3b8" },
    { maxPct: 0.50, mood: "concerned",label: "Concerned",color: "#f59e0b" },
    { maxPct: 0.75, mood: "angry",    label: "Angry",    color: "#ef4444" },
    { maxPct: 1.00, mood: "furious",  label: "Furious",  color: "#7f1d1d" },
  ];

  const PRESSURE_RULES = [
    {
      id: "dividend_coverage", label: "Dividend Coverage",
      evaluate() {
        const coverage  = GameState.ratios.dividendCoverage;
        const threshold = GameState.board.thresholds.dividendCoverage;
        if (coverage < 0.85) return { points: 3, reason: `Dividend coverage critically low at ${fmt(coverage)}x (min ${threshold}x)` };
        if (coverage < threshold) return { points: 1, reason: `Dividend coverage below threshold: ${fmt(coverage)}x vs ${threshold}x` };
        if (coverage > 1.40) return { relief: 1, reason: `Strong dividend coverage of ${fmt(coverage)}x` };
        return null;
      },
    },
    {
      id: "debt_to_assets", label: "Leverage",
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
      id: "occupancy", label: "Portfolio Occupancy",
      evaluate() {
        const occ       = GameState.ratios.occupancyPortfolio;
        const threshold = GameState.board.thresholds.occupancy;
        if (occ < 0.72) return { points: 3, reason: `Portfolio occupancy critically low at ${fmt(occ*100)}%` };
        if (occ < threshold) return { points: 1, reason: `Occupancy below threshold: ${fmt(occ*100)}% vs ${fmt(threshold*100)}%` };
        if (occ > 0.93) return { relief: 1, reason: `Excellent occupancy at ${fmt(occ*100)}%` };
        return null;
      },
    },
    {
      id: "ffo_growth", label: "FFO Growth",
      evaluate() {
        const history = GameState.history;
        if (history.length < 4) return null;
        const currentFFO   = GameState.pnl.ffo;
        const priorYearFFO = history[history.length - 4]?.ffo || currentFFO;
        const growth = priorYearFFO > 0 ? (currentFFO - priorYearFFO) / priorYearFFO : 0;
        GameState.board.thresholds.ffoGrowth = growth;
        if (growth < -0.10) return { points: 2, reason: `FFO declined ${fmt(Math.abs(growth)*100)}% year-over-year` };
        if (growth < 0)     return { points: 1, reason: `FFO down ${fmt(Math.abs(growth)*100)}% year-over-year` };
        if (growth > 0.08)  return { relief: 1, reason: `Strong FFO growth of ${fmt(growth*100)}% year-over-year` };
        return null;
      },
    },
    {
      id: "interest_coverage", label: "Interest Coverage",
      evaluate() {
        const coverage = GameState.ratios.interestCoverage;
        if (coverage < 1.20) return { points: 3, reason: `Interest coverage dangerously thin at ${fmt(coverage)}x` };
        if (coverage < 1.50) return { points: 1, reason: `Interest coverage weak at ${fmt(coverage)}x` };
        return null;
      },
    },
    {
      id: "cash_position", label: "Cash Position",
      evaluate() {
        const cash    = GameState.balance.cash;
        const assets  = GameState.balance.totalAssets;
        const cashPct = assets > 0 ? cash / assets : 0;
        if (cash < 5)       return { points: 2, reason: `Critical liquidity — only $${fmt(cash)}M cash` };
        if (cashPct < 0.02) return { points: 1, reason: `Low liquidity: cash at ${fmt(cashPct*100)}% of assets` };
        return null;
      },
    },
    {
      id: "credit_rating", label: "Credit Rating",
      evaluate() {
        const rating = GameState.credit.rating;
        const watch  = GameState.credit.watchNegative;
        if (rating === "CCC")          return { points: 3, reason: "Credit rating in distressed territory (CCC)" };
        if (rating === "B")            return { points: 2, reason: "Credit rating fallen to B — cost of debt is punishing" };
        if (rating === "BB" && watch)  return { points: 1, reason: "Sub-investment grade (BB) on negative watch" };
        if (rating === "BB")           return { points: 1, reason: "Credit rating below investment grade (BB)" };
        if (["A","AA","AAA"].includes(rating)) return { relief: 1, reason: `Strong credit rating of ${rating}` };
        return null;
      },
    },
    {
      id: "negative_retained_cash", label: "Cash Flow Sustainability",
      evaluate() {
        const retained = GameState.pnl.retainedCash;
        if (retained < -5) return { points: 2, reason: "Paying $" + fmt(Math.abs(retained)) + "M more in dividends than AFFO" };
        if (retained < 0)  return { points: 1, reason: "Dividend exceeds AFFO by $" + fmt(Math.abs(retained)) + "M" };
        return null;
      },
    },
    {
      id: "minimum_payout", label: "Minimum Payout",
      evaluate() {
        // REITs must distribute at least 60% of AFFO
        var affo = GameState.pnl.affo || 0;
        var divPaid = GameState.pnl.dividendsPaid || 0;
        if (affo <= 0) return null;
        var payoutRatio = divPaid / affo;
        if (payoutRatio < 0.40) return { points: 3, reason: "Payout ratio critically low at " + fmt(payoutRatio * 100, 0) + "% — board expects minimum 60% of AFFO distributed" };
        if (payoutRatio < 0.60) return { points: 2, reason: "Payout ratio below 60% threshold: " + fmt(payoutRatio * 100, 0) + "% — board expects REIT to distribute earnings" };
        if (payoutRatio >= 0.85) return { relief: 1, reason: "Strong payout ratio of " + fmt(payoutRatio * 100, 0) + "% — board pleased with distributions" };
        return null;
      },
    },
    {
      id: "dividend_growth", label: "Dividend Growth",
      evaluate() {
        // Only evaluate from Year 2 onwards, at year end (Q4)
        if (GameState.meta.year < 2) return null;
        if (GameState.meta.quarter !== 4) return null;

        // Find the dividend target goal
        var divGoal = GameState.board.currentGoals.find(function(g) { return g.key === "dividendPerShare"; });
        if (!divGoal) return null;

        var current = GameState.company.dividendPerShare;
        var target  = divGoal.threshold;

        if (current < target * 0.85) {
          return { points: 3, reason: "Dividend $" + current + "/share far below board target of $" + target + "/share" };
        }
        if (current < target) {
          return { points: 2, reason: "Dividend $" + current + "/share below board target of $" + target + "/share" };
        }
        if (current >= target * 1.05) {
          return { relief: 1, reason: "Dividend exceeded board growth target at $" + current + "/share" };
        }
        return null;
      },
    },
  ];

  function fmt(n) { return Math.round(n * 100) / 100; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ----------------------------------------------------------
  // YEAR 1 SILENT SCORING
  // Track how well player did without applying pressure
  // ----------------------------------------------------------
  function updateYear1Score() {
    const s = GameState.board.year1Score;
    if (GameState.ratios.dividendCoverage < 0.90) s.dividendMaintained = false;
    if (GameState.ratios.occupancyPortfolio < 0.75) s.occupancyOk = false;
    if (GameState.ratios.debtToAssets > 0.60) s.leverageOk = false;
    if (GameState.balance.cash < 10) s.cashOk = false;
    if (GameState.history.length >= 2) {
      const curr = GameState.pnl.noi;
      const prev = GameState.history[GameState.history.length - 2]?.noi || curr;
      if (curr < prev) s.noiGrowth = false;
    }
  }

  // ----------------------------------------------------------
  // YEAR 1 END ASSESSMENT
  // Returns starting pressure for Year 2 and board message
  // ----------------------------------------------------------
  function assessYear1() {
    const s = GameState.board.year1Score;
    let startingPressure = 0;
    const failures = [];
    const successes = [];

    if (!s.dividendMaintained) { startingPressure += 2; failures.push("dividend coverage was repeatedly insufficient"); }
    else successes.push("dividend was maintained throughout the year");

    if (!s.occupancyOk)  { startingPressure += 1; failures.push("portfolio occupancy fell below 75%"); }
    else successes.push("occupancy remained healthy");

    if (!s.leverageOk)   { startingPressure += 1; failures.push("leverage exceeded our 60% limit"); }
    else successes.push("leverage was kept within limits");

    if (!s.cashOk)       { startingPressure += 1; failures.push("liquidity fell to dangerously low levels"); }
    else successes.push("adequate liquidity was maintained");

    if (!s.noiGrowth)    { startingPressure += 1; failures.push("NOI failed to grow during the orientation year"); }
    else successes.push("NOI showed positive momentum");

    // Apply starting pressure to Year 2
    GameState.board.pressurePoints = Math.min(GameState.board.maxPressure - 1, startingPressure);

    const performance = startingPressure === 0 ? "excellent"
                      : startingPressure <= 2  ? "acceptable"
                      : startingPressure <= 4  ? "disappointing"
                      : "deeply concerning";

    const successText = successes.length > 0
      ? `On the positive side: ${successes.join("; ")}.`
      : "";
    const failureText = failures.length > 0
      ? `However, the board is troubled that ${failures.join("; ")}.`
      : "";

    const letter = `Dear ${GameState.player.name},\n\n` +
      `The board has completed its Year 1 orientation assessment of your tenure as CEO of ${GameState.company.name}.\n\n` +
      `Your overall performance during the orientation year was ${performance}. ${successText} ${failureText}\n\n` +
      `Effective Year 2, the board will apply full scrutiny. You are entering Year 2 with ${startingPressure} pressure point${startingPressure !== 1 ? "s" : ""} already on the record. ` +
      `${startingPressure >= 5 ? "We strongly advise immediate corrective action — your position is already precarious." : startingPressure >= 3 ? "The board will be watching closely from the first quarter." : "We wish you continued success."}`;

    return { letter, startingPressure, performance };
  }

  // ----------------------------------------------------------
  // SET ANNUAL GOALS
  // Board sets explicit targets for the coming year
  // ----------------------------------------------------------
  function setAnnualGoals(year) {
    const goals = [];

    // Goals tighten each year
    const coverageTarget  = Math.round((1.05 + (year - 1) * 0.05) * 100) / 100;
    const occupancyTarget = Math.round((0.82 + (year - 1) * 0.01) * 100) / 100;
    const leverageTarget  = Math.round((0.55 - (year - 2) * 0.01) * 100) / 100;

    // Dynamic dividend growth target based on prior year FFO growth
    var divGrowthTarget = 0.05; // default 5%
    if (GameState.history.length >= 4) {
      var h = GameState.history;
      var currFFO = h[h.length - 1].ffo || 0;
      var prevFFO = h.length >= 8 ? h[h.length - 5].ffo || currFFO : currFFO;
      var ffoGrowth = prevFFO > 0 ? (currFFO - prevFFO) / prevFFO : 0;
      if (ffoGrowth >= 0.15)      divGrowthTarget = 0.25;  // great year: 25% raise expected
      else if (ffoGrowth >= 0.08) divGrowthTarget = 0.12;  // good year: 12% raise
      else if (ffoGrowth >= 0.03) divGrowthTarget = 0.07;  // decent year: 7% raise
      else if (ffoGrowth > 0)     divGrowthTarget = 0.03;  // modest year: 3% raise
      else                        divGrowthTarget = 0;      // decline: just maintain
    }
    var currentDiv    = GameState.company.dividendPerShare;
    var targetDiv     = Math.round(currentDiv * (1 + divGrowthTarget) * 100) / 100;
    var divGrowthPct  = Math.round(divGrowthTarget * 100);

    goals.push({ metric: "Dividend Coverage",    target: ">" + coverageTarget + "x",           key: "dividendCoverage",   threshold: coverageTarget });
    goals.push({ metric: "Dividend per Share",   target: ">$" + targetDiv + " (+" + divGrowthPct + "%)", key: "dividendPerShare", threshold: targetDiv, divTarget: true });
    goals.push({ metric: "Portfolio Occupancy",  target: ">" + fmt(occupancyTarget*100) + "%",  key: "occupancyPortfolio", threshold: occupancyTarget });
    goals.push({ metric: "Debt / Assets",        target: "<" + fmt(leverageTarget*100) + "%",   key: "debtToAssets",       threshold: leverageTarget, inverse: true });
    goals.push({ metric: "FFO Growth (YoY)",     target: ">0%",                                 key: "ffoGrowth",          threshold: 0 });

    if (year >= 3) goals.push({ metric: "Interest Coverage", target: ">1.8x", key: "interestCoverage", threshold: 1.8 });
    if (year >= 4) goals.push({ metric: "Credit Rating",     target: "BBB+",  key: "creditRating",     threshold: "BBB" });

    GameState.board.lastYearGoals = GameState.board.currentGoals;
    GameState.board.currentGoals  = goals;
    return goals;
  }

  // ----------------------------------------------------------
  // EVALUATE GOALS vs LAST YEAR
  // ----------------------------------------------------------
  function evaluateGoals() {
    const goals   = GameState.board.lastYearGoals;
    const history = GameState.history;
    if (goals.length === 0 || history.length < 4) return [];

    const lastYearHistory = history.slice(-4);
    return goals.map(goal => {
      let met = false;
      if (goal.key === "dividendCoverage") {
        const avg = lastYearHistory.reduce((s, h) => s + (h.dividendCoverage || 0), 0) / lastYearHistory.length;
        met = avg >= goal.threshold;
      } else if (goal.key === "occupancyPortfolio") {
        const avg = lastYearHistory.reduce((s, h) => s + (h.occupancy || 0), 0) / lastYearHistory.length;
        met = avg >= goal.threshold;
      } else if (goal.key === "debtToAssets") {
        const avg = lastYearHistory.reduce((s, h) => s + (h.debtToAssets || 0), 0) / lastYearHistory.length;
        met = avg <= goal.threshold;
      } else if (goal.key === "dividendPerShare") {
        met = GameState.company.dividendPerShare >= goal.threshold;
      } else if (goal.key === "ffoGrowth") {
        met = (GameState.board.thresholds.ffoGrowth || 0) >= goal.threshold;
      } else if (goal.key === "interestCoverage") {
        const avg = lastYearHistory.reduce((s, h) => s + (h.interestCoverage || 0), 0) / lastYearHistory.length;
        met = avg >= goal.threshold;
      } else if (goal.key === "creditRating") {
        const order = ["CCC","B","BB","BBB","A","AA","AAA"];
        met = order.indexOf(GameState.credit.rating) >= order.indexOf(goal.threshold);
      }
      return { ...goal, met };
    });
  }

  // ----------------------------------------------------------
  // GENERATE ANNUAL REPORT
  // Called at end of Q4 each year
  // ----------------------------------------------------------
  function generateAnnualReport() {
    const year    = GameState.meta.year - 1;  // year just completed
    const history = GameState.history;
    const isYear1 = year === 1;

    // Pull this year's 4 quarters
    const yearHistory = history.slice(-4);
    if (yearHistory.length === 0) return null;

    // Prior year snapshot for comparison
    const priorSnapshot = GameState.annualSnapshots.length > 0
      ? GameState.annualSnapshots[GameState.annualSnapshots.length - 1]
      : null;

    // Full year aggregates
    const totalRevenue     = yearHistory.reduce((s, h) => s + (h.grossPotentialRent || 0), 0);
    const totalNOI         = yearHistory.reduce((s, h) => s + (h.noi || 0), 0);
    const totalFFO         = yearHistory.reduce((s, h) => s + (h.ffo || 0), 0);
    const totalAFFO        = yearHistory.reduce((s, h) => s + (h.affo || 0), 0);
    const totalDividends   = yearHistory.reduce((s, h) => s + (h.dividendsPaid || 0), 0);
    const totalRetained    = yearHistory.reduce((s, h) => s + (h.retainedCash || 0), 0);
    const avgOccupancy     = yearHistory.reduce((s, h) => s + (h.occupancy || 0), 0) / yearHistory.length;
    const avgCoverage      = yearHistory.reduce((s, h) => s + (h.dividendCoverage || 0), 0) / yearHistory.length;

    // Share stats
    const startPrice = priorSnapshot?.endSharePrice || yearHistory[0].sharePrice;
    const endPrice   = yearHistory[yearHistory.length - 1].sharePrice;
    const priceChg   = startPrice > 0 ? ((endPrice - startPrice) / startPrice * 100) : 0;

    // Balance sheet
    const startAssets = priorSnapshot?.endAssets || yearHistory[0].totalAssets;
    const endAssets   = yearHistory[yearHistory.length - 1].totalAssets;
    const startDebt   = priorSnapshot?.endDebt   || yearHistory[0].totalDebt;
    const endDebt     = yearHistory[yearHistory.length - 1].totalDebt;
    const startRating = priorSnapshot?.endRating  || yearHistory[0].creditRating;
    const endRating   = yearHistory[yearHistory.length - 1].creditRating;

    // Portfolio
    const startProps  = priorSnapshot?.endProps   || 0;
    const endProps    = yearHistory[yearHistory.length - 1].portfolioSize;

    // Best/worst property
    let bestProp = null, worstProp = null;
    if (GameState.portfolio.length > 0) {
      const sorted = [...GameState.portfolio].sort((a, b) => b.occupancy - a.occupancy);
      bestProp  = sorted[0];
      worstProp = sorted[sorted.length - 1];
    }

    // Key events this year
    const yearEvents = GameState.eventLog
      .filter(e => e.year === year)
      .flatMap(e => e.events || [])
      .slice(0, 6);

    // Year 1 assessment or goal evaluation
    let boardAssessment = null;
    let nextYearGoals   = [];

    if (isYear1) {
      boardAssessment = assessYear1();
      nextYearGoals   = setAnnualGoals(2);
    } else {
      const goalResults = evaluateGoals();
      const metCount    = goalResults.filter(g => g.met).length;
      const totalGoals  = goalResults.length;
      nextYearGoals     = setAnnualGoals(year + 1);

      const perf = metCount === totalGoals ? "all targets"
                 : metCount >= totalGoals * 0.7 ? "most targets"
                 : metCount >= totalGoals * 0.4 ? "some targets"
                 : "few targets";

      boardAssessment = {
        goalResults,
        metCount,
        totalGoals,
        performance: perf,
        letter: `${GameState.player.name}, you met ${metCount} of ${totalGoals} board targets for Year ${year}. ` +
          (metCount === totalGoals
            ? "Excellent execution. The board is pleased with management's performance."
            : metCount >= totalGoals * 0.7
            ? "A solid year overall, though some areas need attention going forward."
            : metCount >= totalGoals * 0.4
            ? "Mixed results. Several key metrics fell short of board expectations."
            : "A disappointing year. The board expects significant improvement in Year " + (year + 1) + "."),
      };

      // Apply pressure adjustments based on goal performance
      if (metCount < totalGoals * 0.4) {
        GameState.board.pressurePoints = Math.min(
          GameState.board.maxPressure,
          GameState.board.pressurePoints + 1
        );
      } else if (metCount === totalGoals) {
        GameState.board.pressurePoints = Math.max(0, GameState.board.pressurePoints - 1);
      }
    }

    // Save annual snapshot
    const snapshot = {
      year,
      totalRevenue:   fmt(totalRevenue),
      totalNOI:       fmt(totalNOI),
      totalFFO:       fmt(totalFFO),
      totalAFFO:      fmt(totalAFFO),
      totalDividends: fmt(totalDividends),
      totalRetained:  fmt(totalRetained),
      avgOccupancy:   fmt(avgOccupancy),
      avgCoverage:    fmt(avgCoverage),
      startPrice:     fmt(startPrice),
      endPrice:       fmt(endPrice),
      priceChg:       fmt(priceChg),
      startAssets:    fmt(startAssets),
      endAssets:      fmt(endAssets),
      startDebt:      fmt(startDebt),
      endDebt:        fmt(endDebt),
      startRating,
      endRating,
      startProps,
      endProps,
      bestProp:       bestProp  ? { name: bestProp.name,  occ: fmt(bestProp.occupancy * 100)  } : null,
      worstProp:      worstProp ? { name: worstProp.name, occ: fmt(worstProp.occupancy * 100) } : null,
      yearEvents,
      boardAssessment,
      nextYearGoals,
    };

    GameState.annualSnapshots.push(snapshot);
    return snapshot;
  }

  // ----------------------------------------------------------
  // EVALUATE QUARTER (regular pressure evaluation)
  // ----------------------------------------------------------
  function evaluateQuarter() {
    const isTutorial = GameState.meta.tutorialYear;

    // Update Year 1 silent scoring
    if (isTutorial) updateYear1Score();

    const pressureChanges = [];
    let totalDelta = 0;

    // In tutorial year — evaluate but don't apply pressure or fire
    PRESSURE_RULES.forEach(rule => {
      const result = rule.evaluate();
      if (!result) return;

      if (!isTutorial) {
        if (result.points) {
          GameState.board.pressurePoints = Math.min(
            GameState.board.maxPressure,
            GameState.board.pressurePoints + result.points
          );
          totalDelta += result.points;
          pressureChanges.push({ rule: rule.label, type: "pressure", points: result.points, reason: result.reason });
          GameState.board.pressureLog.push({ quarter: GameState.meta.quarter, year: GameState.meta.year, reason: result.reason, points: result.points });
        }
        if (result.relief) {
          GameState.board.pressurePoints = Math.max(0, GameState.board.pressurePoints - result.relief);
          totalDelta -= result.relief;
          pressureChanges.push({ rule: rule.label, type: "relief", points: result.relief, reason: result.reason });
        }
      } else {
        // In tutorial: show what WOULD have happened
        if (result.points) pressureChanges.push({ rule: rule.label, type: "warning", points: result.points, reason: `[Year 1 — no penalty yet] ${result.reason}` });
        if (result.relief) pressureChanges.push({ rule: rule.label, type: "relief",  points: result.relief, reason: result.reason });
      }
    });

    // Yearly escalation (not in tutorial)
    if (!isTutorial) {
      const yearlyPressure = Math.floor(GameState.meta.year / 3);
      if (yearlyPressure > 0) {
        GameState.board.pressurePoints = Math.min(GameState.board.maxPressure, GameState.board.pressurePoints + yearlyPressure);
      }
    }

    // Update mood
    const pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    const moodLevel = MOOD_LEVELS.slice().reverse().find(m => pct > m.maxPct) || MOOD_LEVELS[0];
    GameState.board.mood = isTutorial
      ? (pressureChanges.some(p => p.type === "warning") ? "concerned" : "neutral")
      : moodLevel.mood;

    // Game over check (never in tutorial year)
    if (!isTutorial && GameState.board.pressurePoints >= GameState.board.maxPressure) {
      GameState.meta.gameOver      = true;
      GameState.meta.gameOverReason = generateTerminationLetter();
    }

    return { pressureChanges, totalDelta, currentPressure: GameState.board.pressurePoints, maxPressure: GameState.board.maxPressure, mood: GameState.board.mood, gameOver: GameState.meta.gameOver, isTutorial };
  }

  // ----------------------------------------------------------
  // TUTORIAL COACHING MESSAGES
  // One per quarter in Year 1
  // ----------------------------------------------------------
  function getTutorialMessage() {
    const q = GameState.meta.quarter;
    const msgs = {
      1: `Welcome, ${GameState.player.name}. This is your orientation year — the board will not fire you in Year 1, but we are watching and scoring you silently. Focus on growing your NOI base by acquiring 1–2 properties this quarter. Check the Property Market tab.`,
      2: `Q2 already. Your interest coverage ratio is important — make sure your NOI comfortably exceeds your quarterly interest expense. If it's below 1.5x, consider either acquiring more properties or reducing debt. Check the Ratios panel on the left.`,
      3: `You're halfway through Year 1. Now is a good time to review your debt maturity ladder — click any bar on the chart to see which tranches are coming due. You don't want multiple large maturities arriving in the same quarter.`,
      4: `Final quarter of Year 1. The board will issue its orientation assessment after this quarter and set targets for Year 2. Make sure your dividend coverage is above 1.0x and occupancy above 75% — these carry the most weight in our assessment.`,
    };
    return msgs[q] || "";
  }

  // ----------------------------------------------------------
  // CFO EARNINGS REPORT
  // ----------------------------------------------------------
  function generateEarningsReport(quarterResult, boardResult) {
    const { pnl, ratios, marketResult, firedEvents, maturityMsgs } = quarterResult;
    const period  = GameState.currentPeriodLabel();
    const company = GameState.company;
    const credit  = GameState.credit;
    const market  = GameState.market;
    const isTutorial = GameState.meta.tutorialYear;

    const openings = {
      pleased:   [`${period} delivered strong results across the portfolio.`, `Management is pleased to report solid execution in ${period}.`],
      neutral:   [`${period} produced results broadly in line with expectations.`, `${period} saw mixed performance across the portfolio.`],
      concerned: [`${period} presented meaningful challenges management is addressing.`, `We must be candid with the board about a difficult ${period}.`],
      angry:     [`${period} was a disappointing quarter requiring immediate action.`, `The board should be aware that ${period} results are deeply concerning.`],
      furious:   [`${period} results represent a serious deterioration requiring urgent intervention.`],
    };
    const opening = pick(openings[GameState.board.mood] || openings.neutral);

    const tutorialNote = isTutorial
      ? `\n\n[ORIENTATION YEAR: Board pressure suspended. ${getTutorialMessage()}]`
      : "";

    const ffoLine = `FFO came in at $${fmt(pnl.ffo)}M ($${fmt(ratios.ffoPerShare)}/share) against a quarterly dividend of $${fmt(pnl.dividendsPaid)}M ($${company.dividendPerShare}/share), implying coverage of ${fmt(ratios.dividendCoverage)}x.`;
    const noiLine = `Net Operating Income was $${fmt(pnl.noi)}M on gross potential rent of $${fmt(pnl.grossPotentialRent)}M, with vacancy loss of $${fmt(pnl.vacancyLoss)}M reflecting portfolio occupancy of ${fmt(ratios.occupancyPortfolio * 100)}%.`;
    const rateLine = `Base rates stand at ${market.baseInterestRate}%. Our credit rating is ${credit.rating} (spread: +${credit.spread}%), giving an all-in borrowing cost of ${fmt(market.baseInterestRate + credit.spread)}%.${credit.watchNegative ? " We are on negative credit watch." : ""}`;
    const levLine  = `The balance sheet carries $${fmt(GameState.balance.totalDebt)}M of debt against $${fmt(GameState.balance.totalAssets)}M of assets (${fmt(ratios.debtToAssets * 100)}% LTV). Interest coverage: ${fmt(ratios.interestCoverage)}x.`;

    const pressureLines = {
      pleased:   "The board is satisfied with management's execution.",
      neutral:   "The board notes performance is broadly on track.",
      concerned: `The board has flagged ${boardResult.pressureChanges.filter(p => p.type === "pressure").length} areas of concern.`,
      angry:     `The board is registering serious dissatisfaction. Pressure at ${boardResult.currentPressure}/${boardResult.maxPressure}.`,
      furious:   `The board is considering management changes. Pressure critical at ${boardResult.currentPressure}/${boardResult.maxPressure}.`,
    };
    const pressureLine = isTutorial
      ? "The board is monitoring your progress during the orientation year."
      : (pressureLines[GameState.board.mood] || "");

    const eventLines    = firedEvents.length > 0 ? `Notable items: ${firedEvents.map(e => e.headline).join(", ")}.` : "No material unusual items this quarter.";
    const maturityLine  = maturityMsgs.length > 0 ? maturityMsgs.join(" ") : "";
    const cycleChangeLine = marketResult.cycleResult?.cycleChanged ? `⚠️ Market cycle shift: Entering a ${marketResult.cycleResult.label} phase. ${marketResult.cycleResult.description}` : "";

    const marketLine = marketResult.commentary;

    const body = [opening, tutorialNote, "", noiLine, ffoLine, "", marketLine, rateLine, levLine, "", eventLines, maturityLine, cycleChangeLine, "", pressureLine]
      .filter(l => l !== undefined && l !== null)
      .join(" ").replace(/ {2,}/g, " ").trim();

    const headlines = {
      pleased:   `✅ ${period} — Strong Results`,
      neutral:   `📋 ${period} — Steady Quarter`,
      concerned: `⚠️ ${period} — Challenges Emerging`,
      angry:     `🔴 ${period} — Board Dissatisfied`,
      furious:   `🚨 ${period} — Crisis: Board Intervention Imminent`,
    };
    const tutorialHeadline = `📚 ${period} — Orientation Year`;
    const headline = isTutorial ? tutorialHeadline : (headlines[GameState.board.mood] || `📋 ${period} Earnings Report`);

    GameState.eventLog.push({ quarter: GameState.meta.quarter, year: GameState.meta.year, headline, body, events: firedEvents, pressure: boardResult });

    return { headline, body, firedEvents, boardResult };
  }

  // ----------------------------------------------------------
  // TERMINATION LETTER
  // ----------------------------------------------------------
  function generateTerminationLetter() {
    const quarters = GameState.meta.totalQuarters;
    const years    = GameState.meta.year;
    const lastFail = GameState.board.pressureLog.length > 0
      ? GameState.board.pressureLog[GameState.board.pressureLog.length - 1].reason
      : "sustained underperformance";

    return pick([
      `After careful deliberation, the Board of ${GameState.company.name} has voted to remove ${GameState.player.name} as CEO, effective immediately. The final issue: ${lastFail}. The company operated for ${quarters} quarters (${years} years) under your leadership.`,
      `${GameState.player.name}, the Board has lost confidence in your ability to manage ${GameState.company.name}. Accumulated pressure reached the maximum threshold. The final straw was: ${lastFail}. You survived ${quarters} quarters.`,
      `NOTICE OF TERMINATION: Following ${quarters} quarters of leadership, the Board of ${GameState.company.name} has exercised its right to replace management. Key metrics including dividend coverage (${fmt(GameState.ratios.dividendCoverage)}x), leverage (${fmt(GameState.ratios.debtToAssets*100)}%), and occupancy (${fmt(GameState.ratios.occupancyPortfolio*100)}%) failed to meet required standards.`,
    ]);
  }

  // ----------------------------------------------------------
  // BOARD STATUS
  // ----------------------------------------------------------
  function getBoardStatus() {
    const pressure = GameState.board.pressurePoints;
    const max      = GameState.board.maxPressure;
    const mood     = GameState.board.mood;
    const pct      = pressure / max;
    const moodLevel = MOOD_LEVELS.slice().reverse().find(m => pct > m.maxPct) || MOOD_LEVELS[0];

    return {
      pressure, max, pct: fmt(pct * 100), mood,
      moodLabel:  moodLevel.label,
      color:      moodLevel.color,
      isTutorial: GameState.meta.tutorialYear,
      warningMsg: pct >= 0.75 ? "⚠️ Board patience nearly exhausted." : pct >= 0.50 ? "The board is watching closely." : null,
    };
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
    GameState.board.pressurePoints = 0;
    GameState.board.maxPressure    = 8;
    GameState.board.mood           = "neutral";
    GameState.board.pressureLog    = [];
    GameState.board.currentGoals   = [];
    GameState.board.lastYearGoals  = [];
    GameState.board.year1Score     = { dividendMaintained: true, occupancyOk: true, leverageOk: true, cashOk: true, noiGrowth: true };
    GameState.board.thresholds     = { dividendCoverage: 1.0, debtToAssets: 0.60, occupancy: 0.80, ffoGrowth: 0 };
    GameState.eventLog             = [];
    GameState.annualSnapshots      = [];
    GameState.meta.tutorialYear    = true;

    // Set initial Year 1 goals (coaching targets, not enforced)
    GameState.board.currentGoals = [
      { metric: "Dividend Coverage",   target: ">0.90x",  threshold: 0.90 },
      { metric: "Portfolio Occupancy", target: ">75%",    threshold: 0.75 },
      { metric: "Debt / Assets",       target: "<60%",    threshold: 0.60, inverse: true },
      { metric: "Cash",                target: ">$10M",   threshold: 10 },
    ];
  }

  return {
    init, evaluateQuarter, generateEarningsReport,
    generateAnnualReport, getBoardStatus, assessYear1,
    setAnnualGoals, getTutorialMessage,
    PRESSURE_RULES, MOOD_LEVELS,
  };

})();
