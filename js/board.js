// ============================================================
// board.js — Board of Directors system
// REIT Simulator Game v0.6
// ============================================================

window.Board = (() => {

  // ----------------------------------------------------------
  // DIRECTOR DEFINITIONS
  // ----------------------------------------------------------
  const DIRECTORS = [
    {
      id:        "williams",
      name:      "Chairman Williams",
      title:     "Board Chairman",
      image:     "assets/board/williams.png",
      watches:   "Dividends & Coverage",
      personality: "Conservative. Obsessed with dividend reliability. Hard to negotiate with.",
      negotiateSuccessRate: 0.35,
    },
    {
      id:        "chen",
      name:      "Director Chen",
      title:     "Growth Director",
      image:     "assets/board/chen.png",
      watches:   "FFO Growth & Acquisitions",
      personality: "Aggressive. Wants growth at all costs. Responds well to ambition.",
      negotiateSuccessRate: 0.65,
    },
    {
      id:        "okafor",
      name:      "Director Okafor",
      title:     "Risk Officer",
      image:     "assets/board/okafor.png",
      watches:   "Leverage & Coverage",
      personality: "Cautious. Cares about balance sheet discipline. Respects financial arguments.",
      negotiateSuccessRate: 0.55,
    },
    {
      id:        "petrova",
      name:      "Director Petrova",
      title:     "Investor Relations",
      image:     "assets/board/petrova.png",
      watches:   "Share Price & Yield",
      personality: "Shareholder-focused. Hates dilution. Responds to market performance.",
      negotiateSuccessRate: 0.60,
    },
    {
      id:        "hassan",
      name:      "Director Hassan",
      title:     "Operations",
      image:     "assets/board/hassan.png",
      watches:   "Occupancy & Property Quality",
      personality: "Practical. Cares about what he can see and touch. Easiest to negotiate with.",
      negotiateSuccessRate: 0.75,
    },
  ];

  // ----------------------------------------------------------
  // MANDATE CATALOGUE
  // Each director has a pool of possible mandates
  // ----------------------------------------------------------
  const MANDATE_POOL = {
    williams: [
      { id: "div_raise",    text: (t) => `Raise the quarterly dividend by at least ${t}% this year.`, metric: "dividendGrowthPct", target: (y) => 8 + y * 3,      higher: true  },
      { id: "div_raise2",   text: (t) => `Deliver dividend growth of ${t}% — shareholders expect rising income.`, metric: "dividendGrowthPct", target: (y) => 8 + y * 3, higher: true  },
      { id: "div_nocut",    text: () => `Do not cut the dividend at any point this year.`,         metric: "noDividendCut",       target: () => 1,               higher: true  },
    ],
    chen: [
      { id: "acquisitions", text: (t) => `Acquire at least ${t} properties this year.`,           metric: "acquisitionsThisYear",target: (y) => 1 + Math.floor(y/2), higher: true },
      { id: "ffo_growth",   text: (t) => `FFO must grow at least ${t}% year over year.`,          metric: "ffoGrowthPct",        target: (y) => 10 + y * 3,     higher: true  },
      { id: "portfolio_sz", text: (t) => `Portfolio assets must exceed $${t}M by year end.`,      metric: "totalAssets",         target: (y) => 200 + y * 150,  higher: true  },
    ],
    okafor: [
      { id: "leverage",     text: (t) => `Debt/assets must not exceed ${t}%.`,                    metric: "debtToAssets",        target: (y) => 0.72,           higher: false },
      { id: "int_coverage", text: (t) => `Interest coverage must exceed ${t}x.`,                  metric: "interestCoverage",    target: (y) => 1.5 + y * 0.1,  higher: true  },
      { id: "no_overdraft", text: () => `No overdraft at any point this year.`,                    metric: "noOverdraft",         target: () => 1,               higher: true  },
      { id: "no_debt_grow", text: () => `Do not grow total debt this year — refinance, don't expand it.`, metric: "noDebtIncrease", target: () => 1,            higher: true  },
    ],
    petrova: [
      { id: "share_price",  text: () => `Share price must not fall below current level.`,          metric: "sharePriceHeld",      target: () => 1,               higher: true  },
      { id: "no_equity",    text: () => `No equity issuance this year — shareholders hate dilution.`, metric: "noEquityIssued",   target: () => 1,               higher: true  },
      { id: "price_growth", text: (t) => `Grow the share price by at least ${t}% this year.`,       metric: "sharePriceGrowthPct", target: (y) => 5 + y,          higher: true  },
    ],
    hassan: [
      { id: "occupancy",    text: (t) => `Portfolio occupancy must exceed ${t}%.`,                metric: "occupancyPortfolio",  target: (y) => 0.82 + y * 0.01,higher: true  },
      { id: "no_bad_prop",  text: (t) => `No property below ${t}% occupancy at year end.`,        metric: "worstOccupancy",      target: (y) => 0.65 + y * 0.01,higher: true  },
      { id: "lease_ups",    text: (t) => `Use the lease-up action at least ${t} times this year.`,metric: "leaseUpsThisYear",    target: () => 2,               higher: true  },
    ],
  };

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n, d) { d = d === undefined ? 2 : d; return Math.round(n * Math.pow(10, d)) / Math.pow(10, d); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function getDirectorState(id) {
    return GameState.board.directors.find(function(d) { return d.id === id; });
  }

  function getExpression(attitude) {
    if (attitude >= 8) return "happy";
    if (attitude >= 5) return "neutral";
    if (attitude >= 3) return "neutral";
    return "angry";
  }

  // ----------------------------------------------------------
  // INITIALISE
  // ----------------------------------------------------------
  function init() {
    GameState.board.directors = DIRECTORS.map(function(d) {
      return {
        id:       d.id,
        attitude: 5,
        mandates: [],
      };
    });

    GameState.board.politicalCapital  = 2;
    GameState.board.maxCapital        = 5;
    GameState.board.year1Safe         = true;
    GameState.board.activeMandates    = [];
    GameState.board.mandateTracking   = {};
    GameState.board.acquisitionsThisYear = 0;
    GameState.board.leaseUpsThisYear  = 0;
    GameState.board.noOverdraftBroken = false;
    GameState.board.noEquityBroken    = false;
    GameState.board.startYearSharePrice = GameState.company.sharePrice;
    GameState.board.startYearFFO      = 0;
    GameState.board.startYearDividend = GameState.company.dividendPerShare;
    GameState.board.startYearDebt     = GameState.balance.totalDebt;
    GameState.board.debtIncreasedThisYear = false;

    // Legacy pressure fields — kept for UI compatibility
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
  }

  // ----------------------------------------------------------
  // QUARTERLY ATTITUDE UPDATE
  // Called silently every quarter — no UI shown
  // ----------------------------------------------------------
  function updateAttitudes() {
    var r  = GameState.ratios;
    var p  = GameState.pnl;
    var co = GameState.company;
    var b  = GameState.balance;
    var h  = GameState.history;

    // Coalesce nullable ratios to safe numbers so comparisons behave.
    // (null coverage/payout/leverage means "undefined this quarter".)
    var covSafe = (r.dividendCoverage === null || r.dividendCoverage === undefined) ? 1.0 : r.dividendCoverage;
    var d2aSafe = (r.debtToAssets === null || r.debtToAssets === undefined) ? 0.40 : r.debtToAssets;

    // Williams — DIVIDENDS. Dividend GROWTH is his overwhelming concern.
    // Coverage is near-cosmetic: it barely nudges him, and only bites if
    // truly catastrophic — so the early-game solvency struggle doesn't
    // unfairly enrage him. The real pressure is to keep raising the payout.
    var w = getDirectorState("williams");
    if (w) {
      var startDiv = GameState.board.startYearDividend || co.dividendPerShare;
      // Williams demands ESCALATING dividend growth. The required annual growth
      // rate ratchets up over time (8% early, climbing ~1.5%/yr), so the player
      // must keep raising the payout faster and faster — the primary late-game
      // pressure and the main brake on cash hoarding.
      var requiredGrowth = 0.08 + (GameState.meta.year - 1) * 0.015;  // 8% Y1 → ~21% Y10
      GameState.board.williamsTargetGrowth = requiredGrowth;
      var actualGrowth = startDiv > 0 ? (co.dividendPerShare - startDiv) / startDiv : 0;

      if (co.dividendPerShare < startDiv - 0.001) {
        // Cut the dividend — Williams is furious
        w.attitude = clamp(w.attitude - 1.2, 0, 10);
      } else if (actualGrowth >= requiredGrowth) {
        // Met or beat his escalating target — pleased
        w.attitude = clamp(w.attitude + 0.6, 0, 10);
      } else if (co.dividendPerShare > startDiv * 1.02) {
        // Raised, but short of his (rising) demand — partial credit, mild unease
        w.attitude = clamp(w.attitude - 0.2, 0, 10);
      } else {
        // Flat dividend — he's increasingly impatient (penalty grows with years)
        w.attitude = clamp(w.attitude - (0.4 + GameState.meta.year * 0.03), 0, 10);
      }
      // Coverage stays near-cosmetic.
      if (covSafe > 1.8)      w.attitude = clamp(w.attitude + 0.1, 0, 10);
      else if (covSafe < 0.5) w.attitude = clamp(w.attitude - 0.15, 0, 10);
    }

    // Chen — growth
    var ch = getDirectorState("chen");
    if (ch) {
      if (h.length >= 4) {
        var currFFO = p.ffo;
        var prevFFO = h[h.length - 4] ? h[h.length - 4].ffo : currFFO;
        var growth  = prevFFO > 0 ? (currFFO - prevFFO) / prevFFO : 0;
        if (growth > 0.08)  ch.attitude = clamp(ch.attitude + 0.5, 0, 10);
        if (growth < 0)     ch.attitude = clamp(ch.attitude - 0.6, 0, 10);
      }
      if (GameState.board.acquisitionsThisYear > 0)
        ch.attitude = clamp(ch.attitude + 0.3, 0, 10);
    }

    // Okafor — balance sheet
    var ok = getDirectorState("okafor");
    if (ok) {
      var d2a = d2aSafe;
      if (d2a >= 0.30 && d2a <= 0.55) ok.attitude = clamp(ok.attitude + 0.5, 0, 10);
      if (d2a < 0.20 && GameState.meta.year >= 2) ok.attitude = clamp(ok.attitude - 0.5, 0, 10);
      if (d2a > 0.70)                 ok.attitude = clamp(ok.attitude - 0.6, 0, 10);
      if (r.interestCoverage > 2.0)   ok.attitude = clamp(ok.attitude + 0.3, 0, 10);
      if (b.cash < 0) {
        ok.attitude = clamp(ok.attitude - 0.6, 0, 10);
        GameState.board.noOverdraftBroken = true;
      }
    }

    // Petrova — SHAREHOLDERS. She cares purely about the share price rising
    // and hates dilution. No yield concern (that contradicted price).
    var pe = getDirectorState("petrova");
    if (pe) {
      if (h.length > 0) {
        var lastPrice = h[h.length - 1].sharePrice || co.sharePrice;
        if (co.sharePrice > lastPrice * 1.04)      pe.attitude = clamp(pe.attitude + 0.5, 0, 10);
        else if (co.sharePrice < lastPrice * 0.96) pe.attitude = clamp(pe.attitude - 0.5, 0, 10);
        else                                       pe.attitude = clamp(pe.attitude - 0.1, 0, 10); // flat = mild impatience
      }
      if (co.equityIssuanceYear === GameState.meta.year) {
        pe.attitude = clamp(pe.attitude - 0.6, 0, 10);
        GameState.board.noEquityBroken = true;
      }
    }

    // Hassan — operations
    var ha = getDirectorState("hassan");
    if (ha) {
      // Hassan is a demanding operator — he expects HIGH occupancy and is
      // unimpressed by merely "okay" numbers.
      if (r.occupancyPortfolio >= 0.93)      ha.attitude = clamp(ha.attitude + 0.5, 0, 10);  // excellent
      else if (r.occupancyPortfolio >= 0.88) ha.attitude = clamp(ha.attitude + 0.1, 0, 10);  // fine, barely
      else if (r.occupancyPortfolio >= 0.83) ha.attitude = clamp(ha.attitude - 0.4, 0, 10);  // mediocre — displeased
      else                                    ha.attitude = clamp(ha.attitude - 0.8, 0, 10);  // poor — angry
      var worstOcc = GameState.portfolio.length > 0
        ? Math.min.apply(null, GameState.portfolio.map(function(p) { return p.occupancy; }))
        : 1;
      if (worstOcc < 0.70) ha.attitude = clamp(ha.attitude - 0.5, 0, 10);   // a weak property irritates him
      if (GameState.board.leaseUpsThisYear > 0) ha.attitude = clamp(ha.attitude + 0.2, 0, 10);
    }

    // Gentle mean-reversion: directors slowly drift back toward neutral (5)
    // when not being actively failed, so one rough patch doesn't permanently
    // doom you. Only nudges those below neutral upward, by a small amount.
    GameState.board.directors.forEach(function(d) {
      if (d.attitude < 5) d.attitude = clamp(d.attitude + 0.15, 0, 5);
    });
  }

  // ----------------------------------------------------------
  // GENERATE MANDATES for annual meeting
  // ----------------------------------------------------------
  function generateMandates() {
    var year = GameState.meta.year;
    var mandates = [];

    // Pick 3 directors weighted toward lower attitude
    var dirStates = GameState.board.directors.slice().sort(function(a, b) {
      return a.attitude - b.attitude;
    });

    // Always include the two most dissatisfied, plus one random
    var speakers = [dirStates[0], dirStates[1]];
    var remaining = dirStates.slice(2);
    speakers.push(remaining[Math.floor(Math.random() * remaining.length)]);

    speakers.forEach(function(ds) {
      var pool = MANDATE_POOL[ds.id];
      if (!pool) return;
      var mandate = pick(pool);
      var target  = mandate.target(year);
      mandates.push({
        directorId: ds.id,
        mandateId:  mandate.id,
        text:       mandate.text(
          mandate.metric === "debtToAssets" || mandate.metric === "minDebtToAssets" || mandate.metric === "occupancyPortfolio" || mandate.metric === "worstOccupancy"
            ? fmt(target * 100, 0)
            : fmt(target, 1)
        ),
        metric:     mandate.metric,
        target:     target,
        higher:     mandate.higher,
        response:   null,
        achieved:   null,
      });
    });

    GameState.board.activeMandates = mandates;
    return mandates;
  }

  // ----------------------------------------------------------
  // EVALUATE MANDATES at year end
  // ----------------------------------------------------------
  function evaluateMandates() {
    var r   = GameState.ratios;
    var co  = GameState.company;
    var b   = GameState.board;
    var h   = GameState.history;

    var results = [];

    // Calculate year metrics
    var ffoGrowthPct = 0;
    if (h.length >= 4) {
      var currFFO = GameState.pnl.ffo * 4;
      var prevFFO = h.length >= 8 ? h[h.length - 5].ffo * 4 : currFFO;
      ffoGrowthPct = prevFFO > 0 ? ((currFFO - prevFFO) / prevFFO) * 100 : 0;
    }

    var divGrowthPct = b.startYearDividend > 0
      ? ((co.dividendPerShare - b.startYearDividend) / b.startYearDividend) * 100
      : 0;

    var worstOcc = GameState.portfolio.length > 0
      ? Math.min.apply(null, GameState.portfolio.map(function(p) { return p.occupancy; }))
      : 1;

    var startYearSharePrice = b.startYearSharePrice || co.sharePrice;

    var metricValues = {
      dividendYield:       r.dividendYield,
      dividendGrowthPct:   divGrowthPct,
      dividendCoverage:    r.dividendCoverage,
      acquisitionsThisYear:b.acquisitionsThisYear,
      ffoGrowthPct:        ffoGrowthPct,
      totalAssets:         GameState.balance.totalAssets,
      debtToAssets:        r.debtToAssets,
      minDebtToAssets:     r.debtToAssets,
      interestCoverage:    r.interestCoverage,
      noOverdraft:         b.noOverdraftBroken ? 0 : 1,
      noDividendCut:       (GameState.company.dividendCutQuarters || 0) > 0 ? 0 : 1,
      sharePriceHeld:      co.sharePrice >= startYearSharePrice ? 1 : 0,
      sharePriceGrowthPct: startYearSharePrice > 0 ? ((co.sharePrice - startYearSharePrice) / startYearSharePrice) * 100 : 0,
      noEquityIssued:      b.noEquityBroken ? 0 : 1,
      noDebtIncrease:      GameState.balance.totalDebt <= (b.startYearDebt || GameState.balance.totalDebt) + 0.5 ? 1 : 0,
      occupancyPortfolio:  r.occupancyPortfolio,
      worstOccupancy:      worstOcc,
      leaseUpsThisYear:    b.leaseUpsThisYear,
    };

    b.activeMandates.forEach(function(mandate) {
      if (mandate.response === "reject") {
        results.push({ mandate: mandate, achieved: null, skipped: true });
        return;
      }

      var actual  = metricValues[mandate.metric] || 0;
      var target  = mandate.target;

      // Negotiate down reduces target by 45%
      if (mandate.response === "negotiate") target = target * 0.55;
      // Double down increases target by 50%
      if (mandate.response === "doubledown") target = target * 1.50;

      var achieved = mandate.higher ? actual >= target : actual <= target;
      mandate.achieved = achieved;

      var dir = getDirectorState(mandate.directorId);
      if (dir) {
        if (achieved) {
          var gain = mandate.response === "doubledown" ? 4 : mandate.response === "accept" ? 2 : 1;
          dir.attitude = clamp(dir.attitude + gain, 0, 10);
          // Earn political capital for achieving mandate
          b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
        } else {
          var loss = mandate.response === "doubledown" ? 6 : mandate.response === "accept" ? 4 : 2;
          dir.attitude = clamp(dir.attitude - loss, 0, 10);
        }
      }

      results.push({ mandate: mandate, achieved: achieved, actual: actual });
    });

    return results;
  }

  // ----------------------------------------------------------
  // EARN POLITICAL CAPITAL from exceptional performance
  // ----------------------------------------------------------
  function earnPoliticalCapital() {
    var b   = GameState.board;
    var co  = GameState.company;
    var r   = GameState.ratios;
    var h   = GameState.history;
    var earned = [];

    // Dividend raised >25%
    var divGrowth = b.startYearDividend > 0
      ? (co.dividendPerShare - b.startYearDividend) / b.startYearDividend
      : 0;
    if (divGrowth >= 0.25) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 2);
      earned.push("Dividend raised >" + fmt(divGrowth * 100, 0) + "% — +2 political capital");
    } else if (divGrowth >= 0.10) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Dividend raised " + fmt(divGrowth * 100, 0) + "% — +1 political capital");
    }

    // Share price up >15%
    var startPrice = b.startYearSharePrice || co.sharePrice;
    if (co.sharePrice >= startPrice * 1.15) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Share price up >" + fmt(((co.sharePrice / startPrice) - 1) * 100, 0) + "% — +1 political capital");
    }

    // Credit rating improved
    var ratingOrder = ["CCC","B","BB","BBB","A","AA","AAA"];
    var startRating = h.length >= 4 ? h[h.length - 4].creditRating : GameState.credit.rating;
    if (ratingOrder.indexOf(GameState.credit.rating) > ratingOrder.indexOf(startRating)) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Credit rating upgraded to " + GameState.credit.rating + " — +1 political capital");
    }

    // FFO growth >20%
    if (h.length >= 4) {
      var currFFO = GameState.pnl.ffo;
      var prevFFO = h[h.length - 4].ffo || currFFO;
      if (prevFFO > 0 && (currFFO - prevFFO) / prevFFO >= 0.20) {
        b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
        earned.push("FFO grew >20% — +1 political capital");
      }
    }

    return earned;
  }

  // ----------------------------------------------------------
  // CONDUCT VOTE
  // ----------------------------------------------------------
  function conductVote() {
    var votes = GameState.board.directors.map(function(d) {
      var hostile = d.attitude < 3;
      return {
        id:      d.id,
        name:    DIRECTORS.find(function(x) { return x.id === d.id; }).name,
        attitude:d.attitude,
        hostile: hostile,
        veto:    d.id === "williams" && hostile,
      };
    });

    var hostileCount = votes.filter(function(v) { return v.hostile; }).length;
    var williamsVeto = votes.find(function(v) { return v.id === "williams"; }).veto;

    // Williams veto: need 4 confidence votes if he's hostile
    var threshold = williamsVeto ? 4 : 3;
    var confidenceCount = votes.filter(function(v) { return !v.hostile; }).length;
    var fired = confidenceCount < threshold;

    return { votes: votes, fired: fired, hostileCount: hostileCount, confidenceCount: confidenceCount, williamsVeto: williamsVeto };
  }

  // ----------------------------------------------------------
  // RESET YEAR TRACKING
  // ----------------------------------------------------------
  function resetYearTracking() {
    GameState.board.acquisitionsThisYear  = 0;
    GameState.board.leaseUpsThisYear      = 0;
    GameState.board.noOverdraftBroken     = false;
    GameState.board.noEquityBroken        = false;
    GameState.board.startYearSharePrice   = GameState.company.sharePrice;
    GameState.board.startYearFFO          = GameState.pnl.ffo;
    GameState.board.startYearDividend     = GameState.company.dividendPerShare;
    GameState.board.startYearDebt         = GameState.balance.totalDebt;
    GameState.board.debtIncreasedThisYear = false;
  }

  // ----------------------------------------------------------
  // GENERATE DIRECTOR SPEECH
  // Context-aware dialogue based on metrics and attitude
  // ----------------------------------------------------------
  function generateSpeech(directorId, mandate, attitude) {
    var r  = GameState.ratios;
    var co = GameState.company;
    var b  = GameState.balance;

    var speeches = {
      williams: {
        happy:   ["The dividend programme has been exemplary. Shareholders are well served.", "I am pleased with how you have managed distributions. Keep it up."],
        neutral: ["The board expects continued commitment to shareholder distributions.", "Dividend discipline remains our top priority."],
        angry:   ["I am deeply concerned about our dividend policy. This cannot continue.", "Shareholders are not being adequately rewarded. This must change."],
      },
      chen: {
        happy:   ["Excellent growth momentum. The portfolio is moving in the right direction.", "This is the kind of aggressive expansion I expect. Well done."],
        neutral: ["Growth is acceptable but we can do more. The market has opportunities.", "I want to see bolder acquisition strategy going forward."],
        angry:   ["We are standing still while competitors grow. This is unacceptable.", "Where are the deals? I see cash sitting idle while properties go unsold."],
      },
      okafor: {
        happy:   ["The balance sheet is in excellent shape. Well managed.", "Risk metrics are within acceptable parameters. I am satisfied."],
        neutral: ["I am monitoring our leverage closely. Stay disciplined.", "The balance sheet requires careful attention going forward."],
        angry:   ["Our financial position concerns me greatly.", "I cannot support continued mismanagement of our capital structure."],
      },
      petrova: {
        happy:   ["Shareholders are being rewarded. The market is responding positively.", "Share price performance has been strong. Investors are pleased."],
        neutral: ["I expect continued focus on shareholder value creation.", "The market is watching. Do not disappoint investors."],
        angry:   ["Shareholders are losing patience. The stock performance is embarrassing.", "I am fielding calls from institutional investors. They are not happy."],
      },
      hassan: {
        happy:   ["The portfolio is operationally strong. Occupancy is excellent.", "Properties are performing well. The team has done good work."],
        neutral: ["I want to see continued attention to occupancy levels.", "Some properties need work. Do not let standards slip."],
        angry:   ["Occupancy levels are a disgrace. This is a management failure.", "I visited our properties personally. What I saw was not acceptable."],
      },
    };

    var tone = attitude >= 7 ? "happy" : attitude >= 4 ? "neutral" : "angry";
    var pool = speeches[directorId] ? speeches[directorId][tone] : ["No comment."];
    var intro = pick(pool);

    // Add mandate text
    return intro + " My mandate for Year " + (GameState.meta.year + 1) + ": " + mandate.text;
  }

  // ----------------------------------------------------------
  // EVALUATE QUARTER (called each quarter for attitude updates)
  // Replaces old pressure system
  // ----------------------------------------------------------
  function evaluateQuarter() {
    if (GameState.meta.year >= 1) updateAttitudes();

    // Update legacy pressure display from average attitude
    var avgAttitude = GameState.board.directors.reduce(function(s, d) { return s + d.attitude; }, 0) / 5;
    var inversePressure = Math.round((10 - avgAttitude) / 10 * GameState.board.maxPressure);
    GameState.board.pressurePoints = Math.max(0, Math.min(GameState.board.maxPressure, inversePressure));

    var mood = avgAttitude >= 8 ? "pleased" : avgAttitude >= 6 ? "neutral" : avgAttitude >= 4 ? "concerned" : avgAttitude >= 2 ? "angry" : "furious";
    GameState.board.mood = mood;

    // No game over from quarterly check — only from annual vote
    return { pressureChanges: [], totalDelta: 0, currentPressure: GameState.board.pressurePoints, maxPressure: GameState.board.maxPressure, mood: mood, gameOver: false, isTutorial: GameState.meta.tutorialYear };
  }

  // ----------------------------------------------------------
  // GENERATE EARNINGS REPORT (simplified — board meeting replaces detail)
  // ----------------------------------------------------------
  function generateEarningsReport(quarterResult, boardResult) {
    var period  = GameState.currentPeriodLabel();
    var pnl     = quarterResult.pnl;
    var ratios  = quarterResult.ratios;
    var market  = GameState.market;
    var credit  = GameState.credit;
    var isTut   = GameState.meta.tutorialYear;

    var moodHeadlines = {
      pleased:   "✅ " + period + " — Strong Results",
      neutral:   "📋 " + period + " — Steady Quarter",
      concerned: "⚠️ " + period + " — Challenges Emerging",
      angry:     "🔴 " + period + " — Board Dissatisfied",
      furious:   "🚨 " + period + " — Crisis Situation",
    };
    var headline = isTut ? "📚 " + period + " — Orientation Year" : (moodHeadlines[boardResult.mood] || "📋 " + period);

    var body = "NOI: $" + fmt(pnl.noi, 1) + "M | FFO: $" + fmt(pnl.ffo, 1) + "M ($" + fmt(ratios.ffoPerShare, 2) + "/share) | Coverage: " + fmt(ratios.dividendCoverage, 2) + "x\n" +
      "Occupancy: " + fmt(ratios.occupancyPortfolio * 100, 1) + "% | Debt/Assets: " + fmt(ratios.debtToAssets * 100, 1) + "% | Rating: " + credit.rating + "\n" +
      "Base rate: " + fmt(market.baseInterestRate, 2) + "% | Borrow at: " + fmt(market.baseInterestRate + credit.spread, 2) + "% | Cycle: " + market.cycle + "\n" +
      (quarterResult.maturityMsgs && quarterResult.maturityMsgs.length ? quarterResult.maturityMsgs.join(" ") + "\n" : "") +
      (isTut ? "\n[ORIENTATION YEAR — Board is watching silently. No firing until Year 2.]" : "");

    var events = quarterResult.firedEvents || [];
    GameState.eventLog.push({ quarter: GameState.meta.quarter, year: GameState.meta.year, headline: headline, body: body, events: events, pressure: boardResult });

    return { headline: headline, body: body, firedEvents: events, boardResult: boardResult };
  }

  // ----------------------------------------------------------
  // GENERATE ANNUAL REPORT SNAPSHOT (for annual report overlay)
  // ----------------------------------------------------------
  function generateAnnualReport() {
    var year    = GameState.meta.year - 1;
    var history = GameState.history;
    var yearHistory = history.slice(-4);
    if (yearHistory.length === 0) return null;

    var priorSnapshot = GameState.annualSnapshots.length > 0
      ? GameState.annualSnapshots[GameState.annualSnapshots.length - 1] : null;

    var snapshot = {
      year:           year,
      totalRevenue:   fmt(yearHistory.reduce(function(s,h) { return s + (h.grossPotentialRent||0); }, 0), 1),
      totalNOI:       fmt(yearHistory.reduce(function(s,h) { return s + (h.noi||0); }, 0), 1),
      totalFFO:       fmt(yearHistory.reduce(function(s,h) { return s + (h.ffo||0); }, 0), 1),
      totalAFFO:      fmt(yearHistory.reduce(function(s,h) { return s + (h.affo||0); }, 0), 1),
      totalDividends: fmt(yearHistory.reduce(function(s,h) { return s + (h.dividendsPaid||0); }, 0), 1),
      totalRetained:  fmt(yearHistory.reduce(function(s,h) { return s + (h.retainedCash||0); }, 0), 1),
      avgOccupancy:   fmt(yearHistory.reduce(function(s,h) { return s + (h.occupancy||0); }, 0) / yearHistory.length, 3),
      avgCoverage:    fmt(yearHistory.reduce(function(s,h) { return s + (h.dividendCoverage||0); }, 0) / yearHistory.length, 2),
      startPrice:     fmt(priorSnapshot ? priorSnapshot.endPrice : yearHistory[0].sharePrice, 2),
      endPrice:       fmt(yearHistory[yearHistory.length-1].sharePrice, 2),
      priceChg:       fmt(priorSnapshot ? ((yearHistory[yearHistory.length-1].sharePrice - priorSnapshot.endPrice) / priorSnapshot.endPrice * 100) : 0, 1),
      startAssets:    fmt(priorSnapshot ? priorSnapshot.endAssets : yearHistory[0].totalAssets, 1),
      endAssets:      fmt(yearHistory[yearHistory.length-1].totalAssets, 1),
      startDebt:      fmt(priorSnapshot ? priorSnapshot.endDebt : yearHistory[0].totalDebt, 1),
      endDebt:        fmt(yearHistory[yearHistory.length-1].totalDebt, 1),
      startRating:    priorSnapshot ? priorSnapshot.endRating : (yearHistory[0].creditRating || "BBB"),
      endRating:      yearHistory[yearHistory.length-1].creditRating || GameState.credit.rating,
      startProps:     priorSnapshot ? priorSnapshot.endProps : 0,
      endProps:       yearHistory[yearHistory.length-1].portfolioSize,
      yearEvents:     GameState.eventLog.filter(function(e) { return e.year === year; }).flatMap(function(e) { return e.events || []; }).slice(0, 5),
      boardAssessment:{ letter: "The board will convene at the annual meeting to review Year " + year + " performance and issue mandates for Year " + (year+1) + "." },
      nextYearGoals:  [],
    };

    snapshot.bestProp  = GameState.portfolio.length > 0 ? { name: GameState.portfolio.reduce(function(a,b) { return a.occupancy > b.occupancy ? a : b; }).name, occ: fmt(Math.max.apply(null, GameState.portfolio.map(function(p){return p.occupancy;}))*100,1) } : null;
    snapshot.worstProp = GameState.portfolio.length > 0 ? { name: GameState.portfolio.reduce(function(a,b) { return a.occupancy < b.occupancy ? a : b; }).name, occ: fmt(Math.min.apply(null, GameState.portfolio.map(function(p){return p.occupancy;}))*100,1) } : null;

    GameState.annualSnapshots.push(snapshot);
    return snapshot;
  }

  // ----------------------------------------------------------
  // GET BOARD STATUS (for header display)
  // ----------------------------------------------------------
  function getBoardStatus() {
    var dirs = GameState.board.directors || [];
    var hostileCount = dirs.filter(function(d) { return d.attitude < 3; }).length;
    var pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    return {
      pressure:   GameState.board.pressurePoints,
      max:        GameState.board.maxPressure,
      pct:        fmt(pct * 100),
      mood:       GameState.board.mood,
      moodLabel:  GameState.board.mood,
      color:      pct > 0.75 ? "#ef4444" : pct > 0.50 ? "#f59e0b" : "#22c55e",
      isTutorial: GameState.meta.tutorialYear,
      hostileCount: hostileCount,
    };
  }

  // ----------------------------------------------------------
  // STUBS for compatibility
  // ----------------------------------------------------------
  function assessYear1() { return { letter: "Year 1 orientation complete.", startingPressure: 0, performance: "acceptable" }; }
  function setAnnualGoals() { return []; }
  function getTutorialMessage() {
    var msgs = {
      1: "Welcome. Focus on growing your portfolio this year. Buy properties, issue some debt.",
      2: "Your interest coverage needs attention. Check NOI vs interest expense.",
      3: "Review your debt maturity ladder. Avoid clustering maturities.",
      4: "Final quarter of Year 1. The annual board meeting happens at year end from Year 2.",
    };
    return msgs[GameState.meta.quarter] || "";
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    evaluateQuarter,
    generateEarningsReport,
    generateAnnualReport,
    getBoardStatus,
    updateAttitudes,
    generateMandates,
    evaluateMandates,
    earnPoliticalCapital,
    conductVote,
    resetYearTracking,
    generateSpeech,
    getDirectorState,
    getExpression,
    DIRECTORS,
  };

})();
