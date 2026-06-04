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
  const OPEX_RATIO        = 0.35;  // Operating expenses as % of GPR (property level)
  const DEPRECIATION_RATE = 0.025; // Annual depreciation as % of asset value
  const GA_BASE           = 0.5;   // Fixed G&A per quarter $M
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

      // Quarterly GPR = annual NOI potential ÷ 4
      const propGPR      = fmt(prop.annualNOI / 4);
      const propVacancy  = fmt(propGPR * (1 - prop.occupancy));
      const propRevenue  = fmt(propGPR - propVacancy);
      const propOpex     = fmt(propGPR * OPEX_RATIO);
      const propNOI      = fmt(propRevenue - propOpex);

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

    // Dividends
    const dividendsPaid = fmt(
      GameState.company.dividendPerShare *
      GameState.company.sharesOutstanding
    );

    // Retained cash (can be negative — danger signal)
    const retainedCash = fmt(affo - dividendsPaid);

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

    // Total equity (residual)
    GameState.balance.totalEquity = fmt(
      GameState.balance.totalAssets - GameState.balance.totalDebt
    );

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

    // Dividend coverage (FFO / dividends) — board threshold
    const dividendCoverage = pnl.dividendsPaid > 0
      ? fmt(pnl.ffo / pnl.dividendsPaid)
      : 99;

    // Payout ratio (dividends / AFFO) — >1.0 is danger
    const payoutRatio = pnl.affo > 0
      ? fmt(pnl.dividendsPaid / pnl.affo)
      : 99;

    // Leverage ratios
    const debtToAssets  = assets > 0  ? fmt(debt / assets)  : 0;
    const debtToEquity  = equity > 0  ? fmt(debt / equity)  : 99;

    // EBITDA approx = NOI - G&A (no tax for REITs)
    const ebitda        = fmt(pnl.noi - pnl.gAndA);
    const annualEbitda  = fmt(ebitda * 4);
    const debtToEbitda  = annualEbitda > 0 ? fmt(debt / annualEbitda) : 99;

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

    // P/FFO (annualized)
    const pToFFO = annualFFOPS > 0 ? fmt(price / annualFFOPS) : 99;

    // P/AFFO (annualized)
    const annualAFFOPS = fmt(affoPerShare * 4);
    const pToAFFO = annualAFFOPS > 0 ? fmt(price / annualAFFOPS) : 99;

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
  function updateSharePrice(pnl) {
    const prev = GameState.history.length > 0
      ? GameState.history[GameState.history.length - 1]
      : null;

    let priceMod = 1.0;

    // FFO per share vs last quarter
    if (prev) {
      const ffoGrowth = prev.ffoPerShare > 0
        ? (GameState.ratios.ffoPerShare - prev.ffoPerShare) / prev.ffoPerShare
        : 0;
      priceMod += ffoGrowth * 0.5; // share price partially reflects FFO growth
    }

    // Dividend coverage signal
    const coverage = GameState.ratios.dividendCoverage;
    if (coverage < 0.90)       priceMod -= 0.04;
    else if (coverage < 1.00)  priceMod -= 0.02;
    else if (coverage > 1.50)  priceMod += 0.01;

    // Leverage signal
    const d2a = GameState.ratios.debtToAssets;
    if (d2a > 0.58)      priceMod -= 0.03;
    else if (d2a > 0.52) priceMod -= 0.01;
    else if (d2a < 0.35) priceMod += 0.01;

    // Market cycle signal
    const cycle = GameState.market.cycle;
    if (cycle === "expanding")   priceMod += 0.01;
    if (cycle === "contracting") priceMod -= 0.01;
    if (cycle === "recession")   priceMod -= 0.02;

    // Credit watch negative
    if (GameState.credit.watchNegative) priceMod -= 0.02;

    // Random market noise (±1%)
    priceMod += (Math.random() - 0.5) * 0.02;

    // ---- VALUATION ANCHORS (blend, with a real floor) ----
    // 1. P/FFO fair value (earnings-based)
    var annualFFOPS = GameState.ratios.annualFFOPS || 0;
    var ffoFair = annualFFOPS > 0 ? annualFFOPS * 15 : 0;

    // 2. NAV per share (asset-based) — the structural floor.
    //    Even a troubled REIT owns real buildings; price shouldn't fall
    //    far below its net asset value.
    var navPS = GameState.ratios.navPerShare || 0;

    // 3. Dividend-yield pull. When yield gets high, income buyers step in
    //    and support the price (the missing upward force that caused the
    //    collapse to $1).
    var divYield = GameState.ratios.dividendYield || 0;
    if (divYield > 12)      priceMod += 0.06;   // deeply oversold on yield
    else if (divYield > 8)  priceMod += 0.04;
    else if (divYield > 6)  priceMod += 0.02;
    else if (divYield < 1.5) priceMod -= 0.02;  // expensive / unattractive income

    // Blend fair value: weight NAV and FFO. NAV dominates so assets anchor price.
    var fairValue = 0, weight = 0;
    if (navPS > 0)   { fairValue += navPS * 0.6;  weight += 0.6; }
    if (ffoFair > 0) { fairValue += ffoFair * 0.4; weight += 0.4; }
    if (weight > 0)  { fairValue = fairValue / weight; }

    // Mean-revert gently toward fair value (12% pull per quarter)
    if (fairValue > 0 && GameState.company.sharePrice > 0) {
      priceMod = priceMod * 0.88 + (fairValue / GameState.company.sharePrice) * 0.12;
    }

    // Suppress positive drift for 2 quarters after equity issuance
    if (GameState.company.equitySuppressQuarters > 0) {
      GameState.company.equitySuppressQuarters--;
      priceMod = Math.min(priceMod, 0.99);
    }

    // Structural floor: never fall below 55% of NAV per share (asset backing),
    // and an absolute floor of $1 as a backstop.
    var navFloor = navPS > 0 ? navPS * 0.55 : 1.0;
    var floor = Math.max(1.0, navFloor);
    GameState.company.sharePrice = fmt(
      Math.max(floor, GameState.company.sharePrice * priceMod)
    );
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
  // STEP 11 — HANDLE MATURED DEBT
  // Auto-refinance if possible, else force cash repayment
  // ----------------------------------------------------------
  function handleMaturedDebt(maturedTranches) {
    const messages = [];
    maturedTranches.forEach(tranche => {
      if (GameState.balance.cash >= tranche.amount) {
        // Pay off with cash
        GameState.balance.cash = fmt(GameState.balance.cash - tranche.amount);
        GameState.debtTranches = GameState.debtTranches.filter(
          t => t.id !== tranche.id
        );
        messages.push(
          `${tranche.label} matured and was retired with $${tranche.amount}M cash.`
        );
      } else {
        // Auto-refinance at current rate (punitive: 110% of amount)
        const newRate = Market.getCurrentBorrowingRate();
        const newAmount = fmt(tranche.amount * 1.02); // small penalty
        const yearsToAdd = 5;
        const newMaturityYear = GameState.meta.year + yearsToAdd;
        const newMaturityQuarter = GameState.meta.quarter;

        tranche.rate = newRate;
        tranche.amount = newAmount;
        tranche.maturityYear = newMaturityYear;
        tranche.maturityQuarter = newMaturityQuarter;
        tranche.quartersUntilMaturity = yearsToAdd * 4;
        tranche.label = `${newRate}% Sr Notes due Y${newMaturityYear}Q${newMaturityQuarter}`;

        messages.push(
          `⚠️ ${tranche.label} matured but insufficient cash. Auto-refinanced at ${newRate}% for 5 years — $${newAmount}M outstanding.`
        );
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

    // Cap per issuance at 20% of total assets
    var maxIssuance = fmt(GameState.balance.totalAssets * 0.20);
    if (amount > maxIssuance) {
      return { success: false, message: "Maximum single issuance is $" + maxIssuance + "M (20% of total assets). Your current capacity: $" + maxIssuance + "M." };
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

    return {
      success: true,
      message: `Issued $${amount}M of ${rate}% notes due Y${matYear}Q${matQ}. Cash increased by $${amount}M.`,
      rate,
    };
  }

  // Retire debt tranche early
  function retireDebt(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return { success: false, message: "Tranche not found." };

    // Early repayment penalty if > 4 quarters remaining
    const penalty = tranche.quartersUntilMaturity > 4
      ? fmt(tranche.amount * 0.01)
      : 0;
    const totalCost = fmt(tranche.amount + penalty);

    if (GameState.balance.cash < totalCost) {
      return {
        success: false,
        message: `Insufficient cash. Need $${totalCost}M (including $${penalty}M prepayment penalty).`,
      };
    }

    GameState.balance.cash = fmt(GameState.balance.cash - totalCost);
    GameState.debtTranches = GameState.debtTranches.filter(t => t.id !== trancheId);

    return {
      success: true,
      message: `Retired ${tranche.label}. Cash decreased by $${totalCost}M${penalty > 0 ? ` (incl. $${penalty}M penalty)` : ""}.`,
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
    issueEquity,
    buybackShares,
    setDividend,
    calcRatios,
    getCurrentBorrowingRateForTerm,
    getTermPremium,
  };

})();
