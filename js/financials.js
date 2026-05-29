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
  const CAPEX_RESERVE_PCT = 0.010; // Annual normalized capex reserve as % of asset value

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
    return fmt(GA_BASE + portfolioValue * GA_PORTFOLIO_PCT);
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
    const cashFlow = fmt(
      pnl.noi
      - pnl.gAndA
      - pnl.interestExpense
      + pnl.unusualItems
      - pnl.dividendsPaid
    );

    GameState.balance.cash = fmt(
      Math.max(0, GameState.balance.cash + cashFlow)
    );

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

    // Apply and floor at $1
    GameState.company.sharePrice = fmt(
      Math.max(1.0, GameState.company.sharePrice * priceMod)
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
  function issueDebt(amount, years) {
    if (GameState.debtTranches.length >= 10) {
      return { success: false, message: "Maximum 10 debt tranches reached. Retire existing debt first." };
    }
    if (amount <= 0) {
      return { success: false, message: "Amount must be greater than zero." };
    }

    const rate      = Market.getCurrentBorrowingRate();
    const matYear   = GameState.meta.year + years;
    const matQ      = GameState.meta.quarter;
    const id        = "d" + Date.now();
    const label     = `${rate}% Sr Notes due Y${matYear}Q${matQ}`;

    GameState.debtTranches.push({
      id,
      amount: fmt(amount),
      rate,
      maturityQuarter: matQ,
      maturityYear:    matYear,
      quartersUntilMaturity: years * 4,
      label,
    });

    GameState.balance.cash = fmt(GameState.balance.cash + amount);

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
  function issueEquity(shares, priceDiscount = 0.05) {
    if (shares <= 0) return { success: false, message: "Shares must be greater than zero." };

    // New shares issued at a discount to current price (realistic)
    const issuePrice = fmt(GameState.company.sharePrice * (1 - priceDiscount));
    const proceeds   = fmt(shares * issuePrice);

    GameState.company.sharesOutstanding = fmt(
      GameState.company.sharesOutstanding + shares
    );
    GameState.balance.cash = fmt(GameState.balance.cash + proceeds);

    // Dilution pushes share price down slightly
    GameState.company.sharePrice = fmt(
      GameState.company.sharePrice * (1 - priceDiscount * 0.5)
    );

    return {
      success: true,
      message: `Issued ${shares}M shares at $${issuePrice}/share. Raised $${proceeds}M. Existing shareholders diluted.`,
    };
  }

  // Buy back shares
  function buybackShares(shares) {
    if (shares <= 0) return { success: false, message: "Shares must be greater than zero." };

    const cost = fmt(shares * GameState.company.sharePrice);
    if (GameState.balance.cash < cost) {
      return { success: false, message: `Insufficient cash. Buyback costs $${cost}M.` };
    }

    GameState.company.sharesOutstanding = fmt(
      Math.max(1, GameState.company.sharesOutstanding - shares)
    );
    GameState.balance.cash = fmt(GameState.balance.cash - cost);

    // Buyback slightly boosts share price
    GameState.company.sharePrice = fmt(
      GameState.company.sharePrice * 1.01
    );

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

    // Cutting the dividend
    if (change < -0.001) {
      GameState.company.sharePrice = fmt(
        GameState.company.sharePrice * (1 - Math.min(0.20, Math.abs(pct / 100) * 1.5))
      );
      GameState.board.dividendCutQuarters = 0;
      GameState.board.pressurePoints = Math.min(
        GameState.board.maxPressure,
        GameState.board.pressurePoints + 2
      );
      GameState.board.pressureLog.push({
        quarter: GameState.meta.quarter,
        year:    GameState.meta.year,
        reason:  `Dividend cut from $${old} to $${newDividendPerShare}/share`,
        points:  2,
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
    }

    // Reset unusual items (events.js will populate this before we run)
    GameState.pnl.unusualItems = 0;

    // 1. Roll random events (they modify portfolio and unusualItems)
    const firedEvents = Events.rollEvents();

    // 2. Update market conditions and property values
    const marketResult = Market.quarterlyUpdate();
    Properties.recalculatePropertyValues();
    Properties.quarterlyUpdate();

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
    GameState.company.marketCap = fmt(
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
  };

})();
