// ============================================================
// financials.js — Quarterly P&L engine, ratios, balance sheet
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This is the master calculation engine for each quarter
// - Call Financials.runQuarter() once per quarter advance
// - It reads from GameState.portfolio, market, debt, company
// - It writes to GameState.pnl, ratios, balance, history
// - It never generates events — events.js does that
// - It never renders anything — ui.js does that
// ============================================================

window.Financials = (() => {

  // ----------------------------------------------------------
  // CONSTANTS
  // ----------------------------------------------------------
  const OPEX_RATIO        = 0.31;  // Operating expenses as % of GPR (trimmed for breathing room)
  const DEPRECIATION_RATE = 0.025; // Annual depreciation as % of asset value
  const GA_BASE           = 0.0;   // Fixed G&A per quarter $M (trimmed)
  const GA_PORTFOLIO_PCT  = 0.003; // Additional G&A per $M of portfolio value
  const CAPEX_RESERVE_PCT = 0.005; // Annual normalized capex reserve as % of asset value

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n) {
    return Math.round(n * 100) / 100;
  }

  // ----------------------------------------------------------
  // STEP 1 — CALCULATE PORTFOLIO NOI
  // Gross Potential Rent → Vacancy Loss → Net Revenue → NOI
  // ----------------------------------------------------------
  function calcPortfolioNOI() {
    let grossPotentialRent  = 0;
    let vacancyLoss         = 0;
    let netRentalRevenue    = 0;
    let operatingExpenses   = 0;
    let noi                 = 0;

    GameState.portfolio.forEach(prop => {
      // Properties under construction generate zero NOI
      if (prop.underConstruction) return;

      // prop.annualNOI is ALREADY net operating income (clean profit, after
      // operating expenses). We must NOT subtract opex again. Instead we work
      // BACKWARDS from NOI to show a realistic Gross Rent → Vacancy → Opex
      // breakdown that sums correctly and matches the property list.
      //
      // Quarterly clean NOI at full occupancy:
      const fullNOIq = prop.annualNOI / 4;

      // Gross it up for display: if opex is OPEX_RATIO of gross rent, then
      // NOI (at full occ) = grossRent * (1 - OPEX_RATIO). So gross rent is:
      const propGPR     = fmt(fullNOIq / (1 - OPEX_RATIO));
      const propOpex    = fmt(propGPR * OPEX_RATIO);
      // Vacancy is the only real haircut applied to NOI (occupancy):
      const propVacancy = fmt(propGPR * (1 - prop.occupancy));
      const propRevenue = fmt(propGPR - propVacancy);
      // Final NOI = gross - vacancy - opex  (lands at fullNOIq * occupancy)
      const propNOI     = fmt(propRevenue - propOpex);

      grossPotentialRent += propGPR;
      vacancyLoss        += propVacancy;
      netRentalRevenue   += propRevenue;
      operatingExpenses  += propOpex;
      noi                += propNOI;
    });

    return {
      grossPotentialRent: fmt(grossPotentialRent),
      vacancyLoss:        fmt(vacancyLoss),
      netRentalRevenue:   fmt(netRentalRevenue),
      operatingExpenses:  fmt(operatingExpenses),
      noi:                fmt(noi),
    };
  }

  // ----------------------------------------------------------
  // STEP 2 — CALCULATE G&A EXPENSE
  // Fixed base + scales with portfolio size
  // ----------------------------------------------------------
  function calcGA() {
    const portfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    let ga = GA_BASE + portfolioValue * GA_PORTFOLIO_PCT;

    // Operations head reduces base G&A by up to 20% (scaled by skill)
    if (typeof Staff !== "undefined" && Staff.hasRole("operations")) {
      const reduction = 0.10 + Staff.skillFactor("operations") * 0.10; // 10-20%
      ga = ga * (1 - reduction);
    }

    // Add staff salaries (shown as subline inside G&A)
    if (typeof Staff !== "undefined") {
      ga += Staff.totalSalary();
    }

    return fmt(ga);
  }

  // ----------------------------------------------------------
  // STEP 3 — CALCULATE INTEREST EXPENSE
  // Sum across all debt tranches (quarterly = annual rate ÷ 4)
  // ----------------------------------------------------------
  function calcInterestExpense() {
    return fmt(
      GameState.debtTranches.reduce((sum, tranche) => {
        return sum + (tranche.amount * (tranche.rate / 100) / 4);
      }, 0)
    );
  }

  // ----------------------------------------------------------
  // STEP 4 — CALCULATE DEPRECIATION
  // Non-cash charge; adds back to get FFO
  // Annual rate applied quarterly
  // ----------------------------------------------------------
  function calcDepreciation() {
    const totalAssetValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    return fmt(totalAssetValue * (DEPRECIATION_RATE / 4));
  }

  // ----------------------------------------------------------
  // STEP 5 — CALCULATE NORMALIZED CAPEX RESERVE
  // Not paid out in cash necessarily, but subtracted for AFFO
  // ----------------------------------------------------------
  function calcCapexReserve() {
    const totalAssetValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    return fmt(totalAssetValue * (CAPEX_RESERVE_PCT / 4));
  }

  // ----------------------------------------------------------
  // STEP 6 — ASSEMBLE FULL P&L
  // ----------------------------------------------------------
  function assemblePnL(noComponents, ga, interest, depreciation, capex) {
    const unusualItems = GameState.pnl.unusualItems; // already set by events.js

    // Net Income (GAAP)
    const netIncome = fmt(
      noComponents.noi
      - ga
      - interest
      - depreciation
      + unusualItems
    );

    // FFO = Net Income + Depreciation (add back non-cash)
    const ffo = fmt(netIncome + depreciation);

    // AFFO = FFO - Normalized Capex Reserve
    const affo = fmt(ffo - capex);

    // Preferred dividend — a fixed charge paid BEFORE common dividends.
    const preferredDiv = fmt(
      (GameState.preferred ? GameState.preferred.outstanding : 0) *
      (GameState.preferred ? GameState.preferred.dividendRate : 0) / 4
    );

    // Common dividends
    const dividendsPaid = fmt(
      GameState.company.dividendPerShare *
      GameState.company.sharesOutstanding
    );

    // Retained cash (can be negative — danger signal). Preferred dividend
    // comes out of cash flow too.
    const retainedCash = fmt(affo - preferredDiv - dividendsPaid);

    return {
      grossPotentialRent:  noComponents.grossPotentialRent,
      vacancyLoss:         noComponents.vacancyLoss,
      netRentalRevenue:    noComponents.netRentalRevenue,
      operatingExpenses:   noComponents.operatingExpenses,
      noi:                 noComponents.noi,
      gAndA:               ga,
      interestExpense:     interest,
      depreciation:        depreciation,
      unusualItems:        unusualItems,
      netIncome:           netIncome,
      ffo:                 ffo,
      affo:                affo,
      capexReserve:        capex,
      preferredDiv:        preferredDiv,
      dividendsPaid:       dividendsPaid,
      retainedCash:        retainedCash,
    };
  }

  // ----------------------------------------------------------
  // STEP 7 — UPDATE BALANCE SHEET
  // Cash moves based on actual cash flows (not depreciation)
  // ----------------------------------------------------------
  function updateBalanceSheet(pnl) {
    // Cash P&L: only real cash flows
    // Overdraft interest on negative cash balance
    var overdraftInterest = 0;
    if (GameState.balance.cash < 0) {
      var overdraftRate = (GameState.market.baseInterestRate + 8) / 100 / 4;
      overdraftInterest = fmt(Math.abs(GameState.balance.cash) * overdraftRate);
    }

    const cashFlow = fmt(
      pnl.noi
      - pnl.gAndA
      - pnl.interestExpense
      + pnl.unusualItems
      - (pnl.preferredDiv || 0)
      - pnl.dividendsPaid
      - overdraftInterest
    );

    // No floor — cash can go negative (overdraft)
    GameState.balance.cash = fmt(GameState.balance.cash + cashFlow);
    GameState.pnl.overdraftInterest = overdraftInterest;

    // Game over if overdraft exceeds $50M
    if (GameState.balance.cash < -50) {
      GameState.meta.gameOver = true;
      GameState.meta.gameOverReason = GameState.player.name + ", your company has defaulted. The overdraft reached $" + fmt(Math.abs(GameState.balance.cash), 1) + "M and lenders have called their loans. " + GameState.company.name + " is placed into administration after " + GameState.meta.totalQuarters + " quarters.";
    }

    // Total portfolio value (recalculated by properties.js each quarter)
    const portfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );

    // Total assets
    GameState.balance.totalAssets = fmt(
      GameState.balance.cash + portfolioValue
    );

    // Total debt (sum of tranches)
    GameState.balance.totalDebt = fmt(
      GameState.debtTranches.reduce((sum, t) => sum + t.amount, 0)
    );

    // Total equity (residual = assets − debt). This includes preferred.
    var totalEq = fmt(GameState.balance.totalAssets - GameState.balance.totalDebt);
    GameState.balance.preferredEquity = GameState.preferred ? GameState.preferred.outstanding : 0;
    // Common equity is what's left after preferred's claim.
    GameState.balance.totalEquity = fmt(totalEq - GameState.balance.preferredEquity);

    // Market cap
    GameState.company.marketCap = fmt(
      GameState.company.sharePrice *
      GameState.company.sharesOutstanding
    );
  }

  // ----------------------------------------------------------
  // STEP 8 — CALCULATE ALL RATIOS
  // ----------------------------------------------------------
  function calcRatios(pnl) {
    const shares     = GameState.company.sharesOutstanding;
    const price      = GameState.company.sharePrice;
    const debt       = GameState.balance.totalDebt;
    const assets     = GameState.balance.totalAssets;
    const equity     = GameState.balance.totalEquity;

    // FFO & AFFO per share
    const ffoPerShare  = shares > 0 ? fmt(pnl.ffo / shares)  : 0;
    const affoPerShare = shares > 0 ? fmt(pnl.affo / shares) : 0;

    // Annualised FFO for valuation ratios
    const annualFFO    = fmt(pnl.ffo * 4);
    const annualAFFO   = fmt(pnl.affo * 4);
    const annualFFOPS  = fmt(ffoPerShare * 4);

    // Dividend coverage (FFO / dividends) — board threshold. null when no div.
    const dividendCoverage = pnl.dividendsPaid > 0
      ? fmt(pnl.ffo / pnl.dividendsPaid)
      : null;

    // Payout ratio (dividends / AFFO) — >1.0 is danger. null when AFFO ≤ 0
    // (a payout ratio against negative AFFO is meaningless, not "9900%").
    const payoutRatio = pnl.affo > 0
      ? fmt(pnl.dividendsPaid / pnl.affo)
      : null;

    // Leverage ratios
    const debtToAssets  = assets > 0  ? fmt(debt / assets)  : null;
    const debtToEquity  = equity > 0  ? fmt(debt / equity)  : null;

    // EBITDA approx = NOI - G&A (no tax for REITs)
    const ebitda        = fmt(pnl.noi - pnl.gAndA);
    const annualEbitda  = fmt(ebitda * 4);
    const debtToEbitda  = annualEbitda > 0 ? fmt(debt / annualEbitda) : null;

    // Interest coverage = NOI / Interest (quarterly)
    const interestCoverage = pnl.interestExpense > 0
      ? fmt(pnl.noi / pnl.interestExpense)
      : 99;

    // Portfolio occupancy (weighted by property value)
    const totalPortfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    const weightedOccupancy = totalPortfolioValue > 0
      ? fmt(GameState.portfolio.reduce(
          (sum, p) => sum + (p.occupancy * p.currentValue), 0
        ) / totalPortfolioValue)
      : 0;

    // NOI margin = NOI / GPR
    const noiMargin = pnl.grossPotentialRent > 0
      ? fmt(pnl.noi / pnl.grossPotentialRent)
      : 0;

    // Implied cap rate = annualized NOI / portfolio value
    const impliedCapRate = totalPortfolioValue > 0
      ? fmt((pnl.noi * 4) / totalPortfolioValue * 100)
      : 0;

    // NAV per share
    const navPerShare = shares > 0 ? fmt(equity / shares) : 0;

    // P/FFO (annualized) — N/A when FFO is non-positive (negative multiple is meaningless)
    const pToFFO = annualFFOPS > 0 ? fmt(price / annualFFOPS) : null;

    // P/AFFO (annualized)
    const annualAFFOPS = fmt(affoPerShare * 4);
    const pToAFFO = annualAFFOPS > 0 ? fmt(price / annualAFFOPS) : null;

    // Dividend yield
    const annualDividend = fmt(GameState.company.dividendPerShare * 4);
    const dividendYield  = price > 0 ? fmt((annualDividend / price) * 100) : 0;

    // Write to GameState
    GameState.ratios = {
      ffoPerShare,
      affoPerShare,
      annualFFOPS,
      annualAFFOPS,
      dividendCoverage,
      payoutRatio,
      debtToAssets,
      debtToEquity,
      debtToEbitda,
      interestCoverage,
      occupancyPortfolio: weightedOccupancy,
      noiMargin,
      impliedCapRate,
      navPerShare,
      pToFFO,
      pToAFFO,
      dividendYield,
      ebitda,
    };

    return GameState.ratios;
  }

  // ----------------------------------------------------------
  // STEP 9 — UPDATE SHARE PRICE
  // Driven by: FFO growth, dividend changes, board mood,
  // market cycle, leverage signals
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // SHARE PRICE — BOND-PROXY MODEL
  // A REIT is priced off its dividend yield. price = annualDividend / targetYield.
  // Target yield sits in a band: healthy REITs command a low yield (premium
  // price), distressed ones are pushed to a high yield (cheap price). The whole
  // band shifts UP with interest rates — when bonds pay more, REITs must too.
  // NAV provides a sanity backstop. Operational quality moves you within the band.
  // ----------------------------------------------------------
  function updateSharePrice(pnl) {
    var annualDiv = GameState.company.dividendPerShare * 4;
    var navPS     = GameState.ratios.navPerShare || 0;
    var rate      = GameState.market.baseInterestRate || 2.5;

    // Base band shifts with rates: the healthy (low) end tracks risk-free + a
    // REIT risk premium. At 2.5% rates, healthy ~5%; at 6% rates, healthy ~8.5%.
    var healthyYield   = rate + 2.5;   // premium end of the band
    var distressYield  = rate + 7.0;   // distressed end of the band

    // Position within the band (0 = healthy/premium, 1 = distressed) driven by
    // operational quality: AFFO, dividend coverage, leverage, credit rating.
    var stress = 0;

    // AFFO health — the dominant driver
    var affo = pnl ? pnl.affo : 0;
    if (affo < 0)        stress += 0.45;        // bleeding cash → distressed
    else if (affo < GameState.company.dividendPerShare * GameState.company.sharesOutstanding) stress += 0.20; // not covering dividend

    // Dividend coverage
    var cov = GameState.ratios.dividendCoverage || 0;
    if (cov < 0.8)       stress += 0.20;
    else if (cov < 1.1)  stress += 0.10;
    else if (cov > 1.8)  stress -= 0.05;

    // Leverage
    var d2a = GameState.ratios.debtToAssets || 0;
    if (d2a > 0.60)      stress += 0.15;
    else if (d2a > 0.50) stress += 0.07;

    // Credit rating
    var ratingStress = { AAA:-0.10, AA:-0.07, A:-0.04, BBB:0, BB:0.10, B:0.20, CCC:0.35 };
    stress += (ratingStress[GameState.credit.rating] || 0);

    // Market cycle mood
    var cycle = GameState.market.cycle;
    if (cycle === "recession")   stress += 0.10;
    else if (cycle === "contracting") stress += 0.05;
    else if (cycle === "expanding")   stress -= 0.05;

    stress = Math.max(0, Math.min(1, stress));

    // Target yield within the band
    var targetYield = healthyYield + (distressYield - healthyYield) * stress;

    // Fair price from the dividend (bond proxy). If no dividend, fall back to
    // a steep discount to NAV (a REIT that pays nothing is worth little as income).
    var fairPrice;
    if (annualDiv > 0.001) {
      fairPrice = annualDiv / (targetYield / 100);
    } else {
      fairPrice = navPS * 0.35;
    }

    // NAV sanity backstop: price shouldn't stray absurdly far from asset value.
    if (navPS > 0) {
      var ceiling = navPS * 1.6;   // rarely trade far above NAV
      var floorNAV = navPS * 0.30; // or far below it
      fairPrice = Math.max(floorNAV, Math.min(ceiling, fairPrice));
    }

    // Equity-issuance suppression: dampen for 2 quarters after dilution
    if (GameState.company.equitySuppressQuarters > 0) {
      GameState.company.equitySuppressQuarters--;
      fairPrice *= 0.97;
    }

    // Mean-revert toward fair price (35%/quarter) plus small noise, so moves
    // feel gradual rather than instant snaps.
    var cur = GameState.company.sharePrice || fairPrice;
    var noise = 1 + (Math.random() - 0.5) * 0.02;
    var newPrice = (cur * 0.65 + fairPrice * 0.35) * noise;

    GameState.company.sharePrice = fmt(Math.max(0.5, newPrice));
  }

  // ----------------------------------------------------------
  // STEP 10 — DEBT MATURITY TICK
  // Reduce quartersUntilMaturity on all tranches
  // Flag any tranches maturing this quarter
  // ----------------------------------------------------------
  function tickDebtMaturities() {
    const matured = [];
    GameState.debtTranches.forEach(tranche => {
      tranche.quartersUntilMaturity =
        GameState.quartersUntilMaturity(
          tranche.maturityYear,
          tranche.maturityQuarter
        );
      if (tranche.quartersUntilMaturity <= 0) {
        matured.push(tranche);
      }
    });
    return matured;
  }

  // ----------------------------------------------------------
  // STEP 11 — HANDLE MATURED DEBT — escalation ladder:
  // 1. Pay with cash if possible
  // 2. Else refinance IF credit allows (distress rate) — needs tranche slot
  // 3. Else forced asset sale at fire-sale discount to raise cash
  // 4. Else fall into overdraft (cash goes negative)
  // 5. Default fires elsewhere if overdraft breaches -$50M
  // ----------------------------------------------------------
  function handleMaturedDebt(maturedTranches) {
    const messages = [];
    maturedTranches.forEach(tranche => {

      // ---- 1. Pay with cash ----
      if (GameState.balance.cash >= tranche.amount) {
        GameState.balance.cash = fmt(GameState.balance.cash - tranche.amount);
        GameState.debtTranches = GameState.debtTranches.filter(t => t.id !== tranche.id);
        messages.push(`${tranche.label} matured — retired with $${tranche.amount}M cash.`);
        if (typeof News !== "undefined" && News.add) {
          News.add(GameState.company.name + " repaid $" + tranche.amount + "M of maturing debt on schedule.", "debt");
        }
        return;
      }

      // ---- 2. Refinance if credit allows ----
      // Junk-rated (CCC) or already at max tranches => refinancing market is shut.
      var ratingOrder = ["CCC","B","BB","BBB","A","AA","AAA"];
      var canRefinance = ratingOrder.indexOf(GameState.credit.rating) >= ratingOrder.indexOf("B")
                         && GameState.debtTranches.length <= 10;

      if (canRefinance) {
        const distressRate = fmt(Market.getCurrentBorrowingRate() + 1.5); // distress premium
        const newAmount    = fmt(tranche.amount * 1.03);                  // 3% rollover cost
        tranche.rate                  = distressRate;
        tranche.amount                = newAmount;
        tranche.maturityYear          = GameState.meta.year + 3;          // shorter, punitive
        tranche.maturityQuarter       = GameState.meta.quarter;
        tranche.quartersUntilMaturity = 12;
        tranche.label                 = `${distressRate}% Refinanced Notes due Y${tranche.maturityYear}Q${tranche.maturityQuarter}`;
        messages.push(`⚠️ Could not repay ${tranche.amount}M maturing debt — refinanced at a distress rate of ${distressRate}% for 3 years ($${newAmount}M outstanding). This hurts coverage.`);
        if (typeof News !== "undefined" && News.add) {
          News.add(GameState.company.name + " forced to refinance maturing debt at a distressed " + distressRate + "% — analysts note rising funding stress.", "debt");
        }
        return;
      }

      // ---- 3. Forced asset sale (refinancing shut) ----
      var raised = 0;
      var sold   = [];
      // Sell weakest assets (lowest occupancy first) at a 15% fire-sale discount
      var sellable = GameState.portfolio.slice().sort(function(a, b) { return a.occupancy - b.occupancy; });
      while (raised < tranche.amount && sellable.length > 0) {
        var victim = sellable.shift();
        var firePrice = fmt(victim.currentValue * 0.85);
        raised += firePrice;
        GameState.balance.cash = fmt(GameState.balance.cash + firePrice);
        GameState.portfolio = GameState.portfolio.filter(function(p) { return p.id !== victim.id; });
        sold.push(victim.name + " ($" + firePrice + "M)");
      }

      if (sold.length > 0) {
        messages.push(`🔻 Refinancing markets shut. To cover $${tranche.amount}M maturing debt, assets were sold at fire-sale prices: ${sold.join(", ")}.`);
        if (typeof News !== "undefined" && News.add) {
          News.add(GameState.company.name + " dumped " + sold.length + " propert" + (sold.length === 1 ? "y" : "ies") + " at distressed prices to meet debt maturity.", "debt");
        }
      }

      // ---- 4. Pay what we can; remainder hits cash (overdraft) ----
      GameState.balance.cash = fmt(GameState.balance.cash - tranche.amount);
      GameState.debtTranches = GameState.debtTranches.filter(t => t.id !== tranche.id);
      if (GameState.balance.cash < 0) {
        messages.push(`⚠️ ${tranche.label} cleared but cash is now negative ($${fmt(GameState.balance.cash)}M overdraft). Restore it before the -$50M default line.`);
      }
    });
    return messages;
  }

  // ----------------------------------------------------------
  // STEP 12 — SAVE TO HISTORY
  // One entry per quarter for charts and trend analysis
  // ----------------------------------------------------------
  function saveToHistory(pnl) {
    GameState.history.push({
      quarter:        GameState.meta.quarter,
      year:           GameState.meta.year,
      totalQuarters:  GameState.meta.totalQuarters,
      label:          GameState.currentPeriodLabel(),

      // P&L
      grossPotentialRent: pnl.grossPotentialRent,
      noi:                pnl.noi,
      interestExpense:    pnl.interestExpense,
      gAndA:              pnl.gAndA,
      unusualItems:       pnl.unusualItems,
      netIncome:          pnl.netIncome,
      ffo:                pnl.ffo,
      affo:               pnl.affo,
      dividendsPaid:      pnl.dividendsPaid,
      retainedCash:       pnl.retainedCash,

      // Ratios
      ffoPerShare:        GameState.ratios.ffoPerShare,
      affoPerShare:       GameState.ratios.affoPerShare,
      dividendPerShare:   GameState.company.dividendPerShare,
      dividendCoverage:   GameState.ratios.dividendCoverage,
      debtToAssets:       GameState.ratios.debtToAssets,
      interestCoverage:   GameState.ratios.interestCoverage,
      occupancy:          GameState.ratios.occupancyPortfolio,

      // Balance sheet
      cash:               GameState.balance.cash,
      totalAssets:        GameState.balance.totalAssets,
      totalDebt:          GameState.balance.totalDebt,
      totalEquity:        GameState.balance.totalEquity,

      // Market
      sharePrice:         GameState.company.sharePrice,
      marketCap:          GameState.company.marketCap,
      baseInterestRate:   GameState.market.baseInterestRate,
      creditRating:       GameState.credit.rating,
      marketCycle:        GameState.market.cycle,

      // Portfolio
      portfolioSize:      GameState.portfolio.length,
      pressurePoints:     GameState.board.pressurePoints,
    });
  }

  // ----------------------------------------------------------
  // CAPITAL ACTIONS
  // These are called by the player before advancing the quarter
  // ----------------------------------------------------------

  // Issue new debt tranche
  function getTermPremium(years) {
    if (years <= 1)  return 0.00;  // 1yr: no premium
    if (years <= 2)  return 0.15;  // 2yr: small premium
    if (years <= 3)  return 0.30;  // 3yr: medium
    if (years <= 5)  return 0.50;  // 5yr: standard
    if (years <= 7)  return 0.75;  // 7yr: long term
    return 1.00;                   // 10yr: maximum
  }

  function getCurrentBorrowingRateForTerm(years) {
    return fmt(Market.getCurrentBorrowingRate() + getTermPremium(years));
  }

  function issueDebt(amount, years) {
    if (GameState.debtTranches.length >= 10) {
      return { success: false, message: "Maximum 10 debt tranches reached. Retire existing debt first." };
    }
    if (amount <= 0) {
      return { success: false, message: "Amount must be greater than zero." };
    }

    // Debt can only be issued once every 2 quarters
    var lastDebtQ    = GameState.company.debtIssuanceQuarter || 0;
    var currentQ     = GameState.meta.totalQuarters;
    var quartersSince = currentQ - lastDebtQ;
    if (lastDebtQ > 0 && quartersSince < 2) {
      return { success: false, message: "Debt markets need time to absorb issuances. You must wait " + (2 - quartersSince) + " more quarter(s) before issuing new debt." };
    }

    // Leverage cap: total debt may not exceed 70% of total assets.
    // (Real REITs lever to 60-70%.) Capacity = headroom under that ceiling.
    var currentDebt = GameState.debtTranches.reduce(function(s, t) { return s + t.amount; }, 0);
    var maxTotalDebt = fmt(GameState.balance.totalAssets * 0.70);
    var headroom = fmt(maxTotalDebt - currentDebt);
    if (headroom <= 0) {
      return { success: false, message: "You're at the 70% leverage ceiling (debt vs assets). Acquire more assets or retire debt before borrowing more." };
    }
    if (amount > headroom) {
      return { success: false, message: "That would breach the 70% leverage ceiling. Your remaining borrowing capacity is $" + headroom + "M." };
    }

    var rate    = getCurrentBorrowingRateForTerm(years);
    var matYear = GameState.meta.year + years;
    var matQ    = GameState.meta.quarter;
    var id      = "d" + Date.now();
    var label   = rate + "% Sr Notes due Y" + matYear + "Q" + matQ;

    GameState.debtTranches.push({
      id:                   id,
      amount:               fmt(amount),
      rate:                 rate,
      maturityQuarter:      matQ,
      maturityYear:         matYear,
      quartersUntilMaturity:years * 4,
      label:                label,
    });

    GameState.balance.cash = fmt(GameState.balance.cash + amount);
    GameState.company.debtIssuanceQuarter = GameState.meta.totalQuarters;

    if (typeof News !== "undefined" && News.debtIssued) {
      News.debtIssued(amount, rate, years);
    }

    return {
      success: true,
      message: `Issued $${amount}M of ${rate}% notes due Y${matYear}Q${matQ}. Cash increased by $${amount}M.`,
      rate,
    };
  }

  // Retire debt tranche early
  // Call premium: 2.5% of principal per the bond indenture (issuer's early
  // redemption right). Flat rate for simplicity.
  const CALL_PREMIUM_PCT = 0.025;

  function getCallInfo(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return null;
    const premium = fmt(tranche.amount * CALL_PREMIUM_PCT);
    return {
      principal: fmt(tranche.amount),
      premium:   premium,
      total:     fmt(tranche.amount + premium),
      label:     tranche.label,
    };
  }

  function retireDebt(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return { success: false, message: "Tranche not found." };

    // Call premium per indenture: 2.5% of principal
    const premium   = fmt(tranche.amount * CALL_PREMIUM_PCT);
    const totalCost = fmt(tranche.amount + premium);

    if (GameState.balance.cash < totalCost) {
      return {
        success: false,
        message: `Insufficient cash to call this bond. Need $${totalCost}M (principal $${tranche.amount}M + $${premium}M call premium).`,
      };
    }

    GameState.balance.cash = fmt(GameState.balance.cash - totalCost);
    GameState.debtTranches = GameState.debtTranches.filter(t => t.id !== trancheId);

    if (typeof News !== "undefined" && News.add) {
      News.add(GameState.company.name + " called $" + tranche.amount + "M of notes early, paying a " + (CALL_PREMIUM_PCT*100) + "% premium.", "debt");
    }

    return {
      success: true,
      message: `Called ${tranche.label}. Paid $${totalCost}M (principal + $${premium}M call premium).`,
    };
  }

  // ----------------------------------------------------------
  // PREFERRED STOCK — a redeemable lifeline (issued via the CFO).
  // Raises cash as mezzanine equity (NOT debt, so leverage stays clean),
  // but carries a fixed preferred dividend paid before common.
  // ----------------------------------------------------------
  function issuePreferred(shares, parValue, annualRate) {
    if (GameState.preferred.issued) {
      return { success: false, message: "Preferred stock has already been issued. Redeem the existing series first." };
    }
    var proceeds = fmt(shares * parValue);
    GameState.preferred.outstanding  = proceeds;
    GameState.preferred.shares       = shares;
    GameState.preferred.parValue     = parValue;
    GameState.preferred.dividendRate = annualRate;
    GameState.preferred.issued       = true;
    GameState.balance.cash = fmt(GameState.balance.cash + proceeds);

    if (typeof News !== "undefined" && News.add) {
      News.add(GameState.company.name + " issues $" + proceeds + "M of " + (annualRate*100) + "% preferred stock to institutional buyers — balance-sheet relief without new debt.", "capital");
    }
    return {
      success: true,
      message: "Issued " + shares + "M preferred shares at $" + parValue + " par. Raised $" + proceeds + "M. A " + (annualRate*100) + "% preferred dividend ($" + fmt(proceeds*annualRate/4) + "M/quarter) now applies before common dividends.",
    };
  }

  function redeemPreferred() {
    if (!GameState.preferred.issued || GameState.preferred.outstanding <= 0) {
      return { success: false, message: "No preferred stock outstanding to redeem." };
    }
    var cost = fmt(GameState.preferred.outstanding);
    if (GameState.balance.cash < cost) {
      return { success: false, message: "Insufficient cash to redeem. Need $" + cost + "M to buy back the preferred at par." };
    }
    GameState.balance.cash = fmt(GameState.balance.cash - cost);
    GameState.preferred.outstanding  = 0;
    GameState.preferred.shares       = 0;
    GameState.preferred.issued       = false;

    if (typeof News !== "undefined" && News.add) {
      News.add(GameState.company.name + " redeems its preferred stock at par for $" + cost + "M — the fixed dividend burden is lifted.", "capital");
    }
    return {
      success: true,
      message: "Redeemed all preferred stock for $" + cost + "M at par. The preferred dividend obligation is gone.",
    };
  }

  // Issue new equity
  function issueEquity(shares) {
    if (shares <= 0) return { success: false, message: "Shares must be greater than zero." };

    // Cap at 20% of existing shares per issuance
    var maxShares = fmt(GameState.company.sharesOutstanding * 0.20);
    if (shares > maxShares) {
      return { success: false, message: "Maximum issuance is " + maxShares + "M shares (20% of float)." };
    }

    // Equity can only be issued ONCE per year
    var lastEquityYear = GameState.company.equityIssuanceYear || 0;
    if (lastEquityYear === GameState.meta.year) {
      return { success: false, message: "Equity can only be issued once per year. Markets need time to absorb dilution. Wait until Year " + (GameState.meta.year + 1) + "." };
    }

    // Price drop scales with issuance history and size — larger drops to prevent abuse
    var count     = GameState.company.equityIssuanceCount || 0;
    var sizeRatio = shares / GameState.company.sharesOutstanding;
    var baseDrop  = count === 0 ? 0.08 : count === 1 ? 0.15 : count === 2 ? 0.22 : 0.30;
    var totalDrop = Math.min(0.40, baseDrop + sizeRatio * 0.15);

    var issuePrice = fmt(GameState.company.sharePrice * (1 - baseDrop));
    var proceeds   = fmt(shares * issuePrice);

    GameState.company.sharesOutstanding   = fmt(GameState.company.sharesOutstanding + shares);
    GameState.balance.cash                = fmt(GameState.balance.cash + proceeds);
    GameState.company.sharePrice          = fmt(GameState.company.sharePrice * (1 - totalDrop));
    GameState.company.equityIssuanceCount = count + 1;
    GameState.company.equityIssuanceYear  = GameState.meta.year;
    // Suppress positive share price drift for 2 quarters
    GameState.company.equitySuppressQuarters = 2;

    // Board pressure for repeated issuances
    if (count >= 1) {
      GameState.board.pressurePoints = Math.min(
        GameState.board.maxPressure,
        GameState.board.pressurePoints + 1
      );
    }

    if (typeof News !== "undefined" && News.equityIssued) {
      News.equityIssued(fmt(sizeRatio * 100), fmt(totalDrop * 100));
    }

    return {
      success: true,
      message: `Issued ${shares}M shares at $${issuePrice}/share. Raised $${proceeds}M. Existing shareholders diluted.`,
    };
  }

  // Buy back shares — capped at 5% of float per action, once per year
  function buybackShares(shares) {
    if (shares <= 0) return { success: false, message: "Shares must be greater than zero." };

    // Frequency limit: once per year
    if (GameState.company.lastBuybackYear === GameState.meta.year) {
      return { success: false, message: "You can only conduct one buyback per year. Next available Year " + (GameState.meta.year + 1) + "." };
    }

    // Per-action cap: max 5% of shares outstanding
    const maxShares = fmt(GameState.company.sharesOutstanding * 0.05);
    if (shares > maxShares) {
      return { success: false, message: "Buyback capped at 5% of float per year — maximum " + maxShares + "M shares ($" + fmt(maxShares * GameState.company.sharePrice) + "M)." };
    }

    const cost = fmt(shares * GameState.company.sharePrice);
    if (GameState.balance.cash < cost) {
      return { success: false, message: `Insufficient cash. Buyback costs $${cost}M.` };
    }

    GameState.company.sharesOutstanding = fmt(
      Math.max(1, GameState.company.sharesOutstanding - shares)
    );
    GameState.balance.cash = fmt(GameState.balance.cash - cost);
    GameState.company.lastBuybackYear = GameState.meta.year;

    // Buyback slightly boosts share price
    GameState.company.sharePrice = fmt(
      GameState.company.sharePrice * 1.01
    );

    // Newsfeed
    if (typeof News !== "undefined" && News.add) {
      News.add(GameState.company.name + " repurchased " + shares + "M shares for $" + cost + "M — earnings per share to improve.", "capital");
    }

    return {
      success: true,
      message: `Bought back ${shares}M shares for $${cost}M. FFO per share will improve next quarter.`,
    };
  }

  // Set quarterly dividend per share
  function setDividend(newDividendPerShare) {
    const old = GameState.company.dividendPerShare;
    const change = newDividendPerShare - old;
    const pct = old > 0 ? (change / old) * 100 : 0;

    if (newDividendPerShare < 0) {
      return { success: false, message: "Dividend cannot be negative." };
    }

    // DIVIDEND FLOOR MECHANIC
    // Year 1: completely locked — cannot cut at all
    if (GameState.meta.year <= 1 && change < -0.001) {
      return { success: false, message: "Dividend is locked in Year 1. You cannot cut during the orientation year. Focus on growing NOI instead." };
    }
    // Year 2+: cannot cut below 50% of the year-start dividend
    if (GameState.meta.year >= 2 && change < -0.001) {
      var startDiv = GameState.board.startYearDividend || 0.10;
      var minAllowed = fmt(startDiv * 0.50, 2);
      if (newDividendPerShare < minAllowed) {
        return { success: false, message: "Cannot cut dividend below $" + minAllowed + "/share (50% of year-start $" + fmt(startDiv,2) + "). This floor protects shareholder trust." };
      }
    }

    // Cutting the dividend — punishment scales with size of cut
    if (change < -0.001) {
      var cutPct     = Math.abs(pct);
      var pressurePts = cutPct > 60 ? 4 : cutPct > 30 ? 3 : cutPct > 10 ? 2 : 1;
      var priceHit    = cutPct > 60 ? 0.25 : cutPct > 30 ? 0.18 : cutPct > 10 ? 0.12 : 0.06;
      GameState.company.sharePrice = fmt(
        GameState.company.sharePrice * (1 - priceHit)
      );
      GameState.board.dividendCutQuarters = 0;
      GameState.board.pressurePoints = Math.min(
        GameState.board.maxPressure,
        GameState.board.pressurePoints + pressurePts
      );
      GameState.board.pressureLog.push({
        quarter: GameState.meta.quarter,
        year:    GameState.meta.year,
        reason:  "Dividend cut " + fmt(cutPct, 0) + "% from $" + old + " to $" + newDividendPerShare + "/share",
        points:  pressurePts,
      });
    }

    // Raising the dividend
    if (change > 0.001) {
      GameState.company.sharePrice = fmt(
        GameState.company.sharePrice * (1 + Math.min(0.05, pct / 100 * 0.5))
      );
    }

    if (typeof News !== "undefined" && News.dividendChanged) {
      News.dividendChanged(old, fmt(newDividendPerShare));
    }

    GameState.company.dividendPerShare = fmt(newDividendPerShare);

    const direction = change > 0.001 ? "raised" : change < -0.001 ? "cut" : "maintained";
    return {
      success: true,
      message: `Dividend ${direction} to $${newDividendPerShare}/share per quarter ($${fmt(newDividendPerShare * 4)}/share annualized). ${change < -0.001 ? "Share price declined on the news." : ""}`,
      direction,
      pctChange: fmt(pct),
    };
  }

  // ----------------------------------------------------------
  // MASTER QUARTERLY RUN
  // Call this once per quarter — runs all steps in order
  // ----------------------------------------------------------
  function runQuarter() {
    // Increment counters
    GameState.meta.totalQuarters += 1;
    GameState.meta.quarter += 1;
    if (GameState.meta.quarter > 4) {
      GameState.meta.quarter = 1;
      GameState.meta.year   += 1;
      Market.applyYearlyEscalation();
      Properties.applyAnnualDecay();
      if (typeof Staff !== "undefined" && Staff.processYearEnd) Staff.processYearEnd();
    }

    // Reset unusual items (events.js will populate this before we run)
    GameState.pnl.unusualItems = 0;

    // 1. Roll random events (they modify portfolio and unusualItems)
    const firedEvents = Events.rollEvents();

    // 2. Update market conditions and property values
    const marketResult = Market.quarterlyUpdate();
    Properties.recalculatePropertyValues();
    Properties.quarterlyUpdate();
    Properties.processConstructionProgress();
    if (typeof Staff !== "undefined") Staff.processQuarter();
    if (typeof News !== "undefined" && News.rollAmbient) News.rollAmbient();

    // 3. Run P&L calculations
    const noComponents   = calcPortfolioNOI();
    const ga             = calcGA();
    const interest       = calcInterestExpense();
    const depreciation   = calcDepreciation();
    const capex          = calcCapexReserve();
    const pnl            = assemblePnL(noComponents, ga, interest, depreciation, capex);

    // Write P&L to GameState
    GameState.pnl = { ...GameState.pnl, ...pnl };

    // 4. Update balance sheet
    updateBalanceSheet(pnl);

    // 5. Calculate ratios
    const ratios = calcRatios(pnl);

    // 6. Update credit rating (uses freshly computed ratios)
    const creditResult = Market.computeCreditRating();

    // 7. Update share price
    updateSharePrice(pnl);

    // 8. Handle debt maturities
    const matured      = tickDebtMaturities();
    const maturityMsgs = handleMaturedDebt(matured);

    // 9. Save quarter to history
    saveToHistory(pnl);

    // 10. Return full summary for board.js and ui.js to consume
    return {
      pnl,
      ratios,
      marketResult,
      creditResult,
      firedEvents,
      maturityMsgs,
      period: GameState.currentPeriodLabel(),
    };
  }

  // ----------------------------------------------------------
  // INITIALISE — set starting financials
  // ----------------------------------------------------------
  function init() {
    // Run initial property valuation
    Properties.recalculatePropertyValues();

    // Set starting balance sheet from initial portfolio
    const portfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    GameState.balance.totalAssets = fmt(GameState.balance.cash + portfolioValue);
    GameState.balance.totalDebt   = fmt(
      GameState.debtTranches.reduce((sum, t) => sum + t.amount, 0)
    );
    GameState.balance.totalEquity = fmt(
      GameState.balance.totalAssets - GameState.balance.totalDebt
    );
    // Set share price dynamically at 95% of NAV per share
    var navPerShare = fmt(
      GameState.balance.totalEquity / GameState.company.sharesOutstanding
    );
    GameState.company.sharePrice = fmt(navPerShare * 0.95);
    GameState.company.marketCap  = fmt(
      GameState.company.sharePrice * GameState.company.sharesOutstanding
    );
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    runQuarter,
    issueDebt,
    retireDebt,
    getCallInfo,
    issuePreferred,
    redeemPreferred,
    issueEquity,
    buybackShares,
    setDividend,
    calcRatios,
    getCurrentBorrowingRateForTerm,
    getTermPremium,
  };

})();
