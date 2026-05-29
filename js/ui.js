// ============================================================
// ui.js — Game interface, rendering, player actions
// REIT Simulator Game
// ============================================================

window.UI = (() => {

  function fmt(n, d) { d = d === undefined ? 2 : d; if (n === null || n === undefined || isNaN(n)) return "—"; return Number(n).toFixed(d); }
  function fmtM(n)   { return "$" + fmt(n, 1) + "M"; }
  function fmtPct(n) { return fmt(n * 100, 1) + "%"; }
  function fmtPS(n)  { return "$" + fmt(n, 2); }
  function el(id)    { return document.getElementById(id); }
  function setText(id, val) { var e = el(id); if (e) e.textContent = val; }

  // ----------------------------------------------------------
  // MODAL
  // ----------------------------------------------------------
  function showModal(title, body, actions) {
    actions = actions || [];
    var overlay = el("modal-overlay");
    if (!overlay) return;
    el("modal-title").textContent = title;
    el("modal-body").innerHTML = body.replace(/\n/g, "<br>");
    el("modal-actions").innerHTML = "";
    actions.forEach(function(a) {
      var btn = document.createElement("button");
      btn.textContent = a.label;
      btn.className = "btn " + (a.style || "btn-secondary");
      btn.onclick = function() { a.onClick(); closeModal(); };
      el("modal-actions").appendChild(btn);
    });
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.className = "btn btn-secondary";
    closeBtn.onclick = closeModal;
    el("modal-actions").appendChild(closeBtn);
    overlay.classList.remove("hidden");
  }

  function closeModal() {
    var o = el("modal-overlay");
    if (o) o.classList.add("hidden");
  }

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------
  function showToast(message, type) {
    type = type || "info";
    var container = el("toast-container");
    if (!container) return;
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.classList.add("toast-visible"); }, 10);
    setTimeout(function() {
      toast.classList.remove("toast-visible");
      setTimeout(function() { toast.remove(); }, 400);
    }, 3500);
  }

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------
  function renderHeader() {
    setText("hdr-company",   GameState.company.name);
    setText("hdr-period",    GameState.currentPeriodLabel());
    setText("hdr-price",     fmtPS(GameState.company.sharePrice));
    setText("hdr-marketcap", fmtM(GameState.company.marketCap));
    setText("hdr-rating",    GameState.credit.rating);
    setText("hdr-cycle",     GameState.market.cycle.charAt(0).toUpperCase() + GameState.market.cycle.slice(1));
    setText("hdr-rate",      fmt(GameState.market.baseInterestRate, 2) + "%");
    setText("hdr-borrow",    fmt(GameState.market.baseInterestRate + GameState.credit.spread, 2) + "%");
    var pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    var bar = el("board-pressure-bar");
    var lbl = el("board-pressure-label");
    if (bar) {
      bar.style.width = Math.min(100, pct * 100) + "%";
      bar.style.background = pct > 0.75 ? "#ef4444" : pct > 0.50 ? "#f59e0b" : "#22c55e";
    }
    if (lbl) {
      var tag = GameState.meta.tutorialYear ? " [ORIENTATION — Safe]" : "";
      lbl.textContent = "Board: " + GameState.board.mood.toUpperCase() + tag + " — " + GameState.board.pressurePoints + "/" + GameState.board.maxPressure + " pressure points";
    }
  }

  // ----------------------------------------------------------
  // P&L
  // ----------------------------------------------------------
  function renderPnL() {
    var p = GameState.pnl;
    setText("pnl-gpr",       fmtM(p.grossPotentialRent));
    setText("pnl-vacancy",   "(" + fmtM(p.vacancyLoss) + ")");
    setText("pnl-opex",      "(" + fmtM(p.operatingExpenses) + ")");
    setText("pnl-noi",       fmtM(p.noi));
    setText("pnl-ga",        "(" + fmtM(p.gAndA) + ")");
    setText("pnl-interest",  "(" + fmtM(p.interestExpense) + ")");
    setText("pnl-depr",      "(" + fmtM(p.depreciation) + ")");
    setText("pnl-unusual",   fmtM(p.unusualItems));
    setText("pnl-netincome", fmtM(p.netIncome));
    setText("pnl-ffo",       fmtM(p.ffo));
    setText("pnl-affo",      fmtM(p.affo));
    setText("pnl-divpaid",   "(" + fmtM(p.dividendsPaid) + ")");
    setText("pnl-retained",  fmtM(p.retainedCash));
    var retEl = el("pnl-retained");
    if (retEl) retEl.className = p.retainedCash >= 0 ? "text-green" : "text-red";
    var niEl = el("pnl-netincome");
    if (niEl) niEl.className = p.netIncome >= 0 ? "text-green" : "text-yellow";
  }

  // ----------------------------------------------------------
  // RATIOS
  // ----------------------------------------------------------
  function renderRatios() {
    var r = GameState.ratios;
    function setRatio(id, val, good, bad) {
      var e = el(id);
      if (!e) return;
      e.textContent = val;
      if (good !== undefined) e.className = good ? "text-green" : bad ? "text-red" : "text-yellow";
    }
    setRatio("ratio-ffo-ps",     fmtPS(r.ffoPerShare));
    setRatio("ratio-affo-ps",    fmtPS(r.affoPerShare));
    setRatio("ratio-div-cov",    fmt(r.dividendCoverage, 2) + "x",  r.dividendCoverage >= 1.2, r.dividendCoverage < 1.0);
    setRatio("ratio-payout",     fmtPct(r.payoutRatio),             r.payoutRatio < 0.85,      r.payoutRatio > 1.0);
    setRatio("ratio-d2a",        fmtPct(r.debtToAssets),            r.debtToAssets < 0.40,     r.debtToAssets > 0.60);
    setRatio("ratio-d2e",        fmt(r.debtToEbitda, 1) + "x",      r.debtToEbitda < 5,        r.debtToEbitda > 8);
    setRatio("ratio-int-cov",    fmt(r.interestCoverage, 1) + "x",  r.interestCoverage >= 2.5, r.interestCoverage < 1.5);
    setRatio("ratio-occ",        fmtPct(r.occupancyPortfolio),      r.occupancyPortfolio >= 0.92, r.occupancyPortfolio < 0.80);
    setRatio("ratio-noi-margin", fmtPct(r.noiMargin),               r.noiMargin >= 0.45,       r.noiMargin < 0.30);
    setRatio("ratio-cap-rate",   fmt(r.impliedCapRate, 2) + "%");
    setRatio("ratio-nav",        fmtPS(r.navPerShare));
    setRatio("ratio-pffo",       fmt(r.pToFFO, 1) + "x");
    setRatio("ratio-paffo",      fmt(r.pToAFFO, 1) + "x");
    setRatio("ratio-div-yield",  fmt(r.dividendYield, 2) + "%",     r.dividendYield > 4,       r.dividendYield < 2);
  }

  // ----------------------------------------------------------
  // BALANCE SHEET
  // ----------------------------------------------------------
  function renderBalanceSheet() {
    var b = GameState.balance;
    setText("bs-cash",   fmtM(b.cash));
    setText("bs-assets", fmtM(b.totalAssets));
    setText("bs-debt",   fmtM(b.totalDebt));
    setText("bs-equity", fmtM(b.totalEquity));
    setText("bs-shares", fmt(GameState.company.sharesOutstanding, 1) + "M");
    setText("bs-divps",  fmtPS(GameState.company.dividendPerShare));
    var cashEl = el("bs-cash");
    if (cashEl) cashEl.className = b.cash < 10 ? "text-red" : b.cash < 25 ? "text-yellow" : "text-green";
  }

  // ----------------------------------------------------------
  // DEBT PANEL
  // ----------------------------------------------------------
  function renderDebtPanel() {
    var container = el("debt-tranches-list");
    if (!container) return;
    if (GameState.debtTranches.length === 0) {
      container.innerHTML = '<p class="text-muted">No debt outstanding.</p>'; return;
    }
    var html = "";
    GameState.debtTranches.forEach(function(t) {
      var urgency = t.quartersUntilMaturity <= 3 ? "tranche-red" : t.quartersUntilMaturity <= 7 ? "tranche-yellow" : "tranche-green";
      html += '<div class="tranche-row ' + urgency + '">' +
        '<div class="tranche-info">' +
        '<span class="tranche-label">' + t.label + '</span>' +
        '<span class="tranche-meta">' + t.quartersUntilMaturity + 'q remaining · ' + t.rate + '% · $' + fmt(t.amount, 1) + 'M</span>' +
        '</div>' +
        '<div class="tranche-actions">' +
        '<button class="btn btn-sm btn-danger" onclick="UI.confirmRetireDebt(\'' + t.id + '\')">Retire Early</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
    var countEl = el("debt-tranche-count");
    if (countEl) {
      var count = GameState.debtTranches.length;
      countEl.textContent = count + "/10 tranches";
      countEl.className = count >= 9 ? "text-red" : count >= 7 ? "text-yellow" : "text-green";
    }
  }

  // ----------------------------------------------------------
  // PORTFOLIO
  // ----------------------------------------------------------
  function renderPortfolio() {
    var container = el("portfolio-list");
    if (!container) return;
    if (GameState.portfolio.length === 0) {
      container.innerHTML = '<p class="text-muted">No properties owned. Buy from the market.</p>'; return;
    }
    var html = "";
    GameState.portfolio.forEach(function(p) {
      var occColor = p.occupancy >= 0.90 ? "text-green" : p.occupancy >= 0.80 ? "text-yellow" : "text-red";
      var gainLoss = p.purchasePrice ? fmt(p.currentValue - p.purchasePrice, 1) : 0;
      var glColor  = gainLoss >= 0 ? "text-green" : "text-red";
      html += '<div class="property-card">' +
        '<div class="prop-header">' +
        '<span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span>' +
        '</div>' +
        '<div class="prop-stats">' +
        '<span>Value: <strong>' + fmtM(p.currentValue) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong class="' + occColor + '">' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>G/L: <strong class="' + glColor + '">' + (gainLoss >= 0 ? "+" : "") + gainLoss + 'M</strong></span>' +
        '</div>' +
        '<div class="prop-actions">' +
        '<button class="btn btn-sm btn-danger" onclick="UI.confirmSellProperty(\'' + p.id + '\')">Sell</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  // ----------------------------------------------------------
  // PROPERTY MARKET
  // ----------------------------------------------------------
  function renderPropertyMarket() {
    var container = el("market-list");
    if (!container) return;
    var html = "";
    GameState.propertyMarket.forEach(function(p) {
      var capRate   = GameState.market.capRates[p.sector][p.location];
      var canAfford = GameState.balance.cash >= p.askingPrice;
      html += '<div class="property-card ' + (canAfford ? "" : "prop-unaffordable") + '">' +
        '<div class="prop-header">' +
        '<span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span>' +
        '</div>' +
        '<div class="prop-stats">' +
        '<span>Ask: <strong>' + fmtM(p.askingPrice) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong>' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>Cap Rate: <strong>' + capRate + '%</strong></span>' +
        '</div>' +
        '<div class="prop-actions">' +
        '<button class="btn btn-sm btn-primary" onclick="UI.confirmBuyProperty(\'' + p.id + '\')" ' + (canAfford ? "" : 'disabled title="Insufficient cash"') + '>Buy ' + fmtM(p.askingPrice) + '</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  // ----------------------------------------------------------
  // EARNINGS REPORT
  // ----------------------------------------------------------
  function renderEarningsReport(report) {
    if (!report) return;
    var container = el("earnings-report");
    if (!container) return;
    var isTutorial = GameState.meta.tutorialYear;

    var goalsHTML = "";
    if (isTutorial && GameState.board.currentGoals.length > 0) {
      goalsHTML = '<div class="goals-panel"><div class="goals-title">Year 1 Orientation Targets (not enforced)</div>';
      GameState.board.currentGoals.forEach(function(g) { goalsHTML += '<div class="goal-item">▸ ' + g.metric + ': ' + g.target + '</div>'; });
      goalsHTML += '</div>';
    } else if (!isTutorial && GameState.board.currentGoals.length > 0) {
      goalsHTML = '<div class="goals-panel"><div class="goals-title">Current Year Targets</div>';
      GameState.board.currentGoals.forEach(function(g) { goalsHTML += '<div class="goal-item">▸ ' + g.metric + ': ' + g.target + '</div>'; });
      goalsHTML += '</div>';
    }

    var eventsHTML = "";
    if (report.firedEvents.length > 0) {
      eventsHTML = '<div class="events-list">';
      report.firedEvents.forEach(function(e) {
        eventsHTML += '<div class="event-item"><strong>' + e.headline + '</strong><p>' + e.body + '</p><span class="event-impact">' + e.impact + '</span></div>';
      });
      eventsHTML += '</div>';
    }

    var pressureHTML = "";
    if (report.boardResult.pressureChanges.length > 0) {
      pressureHTML = '<div class="pressure-changes">';
      report.boardResult.pressureChanges.forEach(function(p) {
        var cls = p.type === "pressure" ? "pressure-bad" : p.type === "warning" ? "pressure-warn" : "pressure-good";
        var arrow = p.type === "pressure" ? "▲" : p.type === "warning" ? "⚠" : "▼";
        pressureHTML += '<div class="pressure-item ' + cls + '"><span>' + arrow + ' ' + p.points + 'pt — ' + p.reason + '</span></div>';
      });
      pressureHTML += '</div>';
    }

    container.innerHTML =
      '<div class="panel-header"><span class="panel-title">CFO Earnings Report</span></div>' +
      '<div class="panel-body">' +
      '<div class="report-header"><h3>' + report.headline + '</h3></div>' +
      '<div class="report-body"><p>' + report.body.replace(/\n/g, "<br>") + '</p></div>' +
      goalsHTML + eventsHTML + pressureHTML +
      '</div>';
  }

  // ----------------------------------------------------------
  // CAPITAL ACTIONS
  // ----------------------------------------------------------
  function renderCapitalActions() {
    setText("action-borrow-rate", "Current rate: " + fmt(Market.getCurrentBorrowingRate(), 2) + "%");
    setText("action-div-current", "Current: $" + fmt(GameState.company.dividendPerShare, 2) + "/share/quarter");
    setText("action-shares-out",  "Shares outstanding: " + fmt(GameState.company.sharesOutstanding, 1) + "M");
    setText("action-cash-avail",  "Cash available: " + fmtM(GameState.balance.cash));
  }

  // ----------------------------------------------------------
  // RENDER ALL
  // ----------------------------------------------------------
  function renderAll(report) {
    renderHeader();
    renderPnL();
    renderRatios();
    renderBalanceSheet();
    renderDebtPanel();
    renderPortfolio();
    renderPropertyMarket();
    renderCapitalActions();
    if (report) renderEarningsReport(report);
    Charts.renderAll();
  }

  // ----------------------------------------------------------
  // ANNUAL REPORT
  // ----------------------------------------------------------
  function showAnnualReport(snapshot) {
    if (!snapshot) return;
    var overlay = el("annual-report-overlay");
    var content = el("annual-report-content");
    if (!overlay || !content) return;

    var isYear1 = snapshot.year === 1;

    function arw(a, b) { return a < b ? '<span class="text-green">▲</span>' : a > b ? '<span class="text-red">▼</span>' : "→"; }

    var ratingOrder = ["CCC","B","BB","BBB","A","AA","AAA"];
    var si = ratingOrder.indexOf(snapshot.startRating);
    var ei = ratingOrder.indexOf(snapshot.endRating);
    var ratingArrow = ei > si ? '<span class="text-green">▲</span>' : ei < si ? '<span class="text-red">▼</span>' : "→";

    var goalsHTML = "";
    if (snapshot.boardAssessment && snapshot.boardAssessment.goalResults) {
      goalsHTML = '<div class="ar-section"><div class="ar-section-title">Goal Performance</div>';
      snapshot.boardAssessment.goalResults.forEach(function(g) {
        goalsHTML += '<div class="ar-goal ' + (g.met ? "ar-goal-met" : "ar-goal-missed") + '">' + (g.met ? "✅" : "❌") + ' ' + g.metric + ': ' + g.target + '</div>';
      });
      goalsHTML += '</div>';
    }

    var nextGoalsHTML = "";
    if (snapshot.nextYearGoals && snapshot.nextYearGoals.length > 0) {
      nextGoalsHTML = '<div class="ar-section"><div class="ar-section-title">Year ' + (snapshot.year + 1) + ' Board Targets</div>';
      snapshot.nextYearGoals.forEach(function(g) { nextGoalsHTML += '<div class="ar-goal">▸ ' + g.metric + ': ' + g.target + '</div>'; });
      nextGoalsHTML += '</div>';
    }

    var eventsHTML = "";
    if (snapshot.yearEvents && snapshot.yearEvents.length > 0) {
      eventsHTML = '<div class="ar-section"><div class="ar-section-title">Key Events</div>';
      snapshot.yearEvents.forEach(function(e) { eventsHTML += '<div class="ar-event">▸ ' + e.headline + '</div>'; });
      eventsHTML += '</div>';
    }

    var pressureNote = isYear1
      ? '<p class="ar-pressure-note">Starting Year 2 with <strong>' + (snapshot.boardAssessment ? snapshot.boardAssessment.startingPressure || 0 : 0) + ' pressure point(s)</strong> already on record.</p>'
      : "";

    content.innerHTML =
      '<div class="ar-header">' +
      '<div class="ar-logo">' + GameState.company.name + '</div>' +
      '<div class="ar-year">Annual Report — Year ' + snapshot.year + '</div>' +
      (isYear1 ? '<div class="ar-badge">Orientation Year Complete</div>' : '') +
      '</div>' +
      '<div class="ar-grid">' +
      '<div class="ar-section"><div class="ar-section-title">Share Performance</div>' +
      '<div class="ar-row"><span>Share Price</span><span>' + arw(snapshot.endPrice, snapshot.startPrice) + ' $' + snapshot.startPrice + ' → $' + snapshot.endPrice + ' (' + (snapshot.priceChg >= 0 ? "+" : "") + snapshot.priceChg + '%)</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Full Year Financials</div>' +
      '<div class="ar-row"><span>Total Revenue</span><span>' + fmtM(snapshot.totalRevenue) + '</span></div>' +
      '<div class="ar-row"><span>Total NOI</span><span>' + fmtM(snapshot.totalNOI) + '</span></div>' +
      '<div class="ar-row"><span>Total FFO</span><span class="text-green">' + fmtM(snapshot.totalFFO) + '</span></div>' +
      '<div class="ar-row"><span>Total AFFO</span><span>' + fmtM(snapshot.totalAFFO) + '</span></div>' +
      '<div class="ar-row"><span>Dividends Paid</span><span>' + fmtM(snapshot.totalDividends) + '</span></div>' +
      '<div class="ar-row"><span>Avg Coverage</span><span class="' + (snapshot.avgCoverage >= 1.0 ? "text-green" : "text-red") + '">' + fmt(snapshot.avgCoverage, 2) + 'x</span></div>' +
      '<div class="ar-row"><span>Retained Cash</span><span class="' + (snapshot.totalRetained >= 0 ? "text-green" : "text-red") + '">' + fmtM(snapshot.totalRetained) + '</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Balance Sheet</div>' +
      '<div class="ar-row"><span>Total Assets</span><span>' + arw(snapshot.endAssets, snapshot.startAssets) + ' ' + fmtM(snapshot.startAssets) + ' → ' + fmtM(snapshot.endAssets) + '</span></div>' +
      '<div class="ar-row"><span>Total Debt</span><span>' + fmtM(snapshot.startDebt) + ' → ' + fmtM(snapshot.endDebt) + '</span></div>' +
      '<div class="ar-row"><span>Credit Rating</span><span>' + ratingArrow + ' ' + snapshot.startRating + ' → ' + snapshot.endRating + '</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Portfolio</div>' +
      '<div class="ar-row"><span>Properties</span><span>' + snapshot.startProps + ' → ' + snapshot.endProps + '</span></div>' +
      '<div class="ar-row"><span>Avg Occupancy</span><span class="' + (snapshot.avgOccupancy >= 0.85 ? "text-green" : "text-yellow") + '">' + fmtPct(snapshot.avgOccupancy) + '</span></div>' +
      (snapshot.bestProp  ? '<div class="ar-row"><span>Best Asset</span><span class="text-green">'  + snapshot.bestProp.name  + ' (' + snapshot.bestProp.occ  + '%)</span></div>' : '') +
      (snapshot.worstProp ? '<div class="ar-row"><span>Needs Work</span><span class="text-red">'    + snapshot.worstProp.name + ' (' + snapshot.worstProp.occ + '%)</span></div>' : '') +
      '</div>' +
      eventsHTML + goalsHTML +
      '</div>' +
      '<div class="ar-board-letter"><div class="ar-section-title">Board Assessment</div>' +
      '<p>' + (snapshot.boardAssessment ? snapshot.boardAssessment.letter || "" : "") + '</p>' +
      pressureNote +
      '</div>' +
      nextGoalsHTML +
      '<div class="ar-footer"><button class="btn btn-primary btn-lg" onclick="UI.closeAnnualReport()">Continue to Year ' + (snapshot.year + 1) + ' →</button></div>';

    overlay.classList.remove("hidden");
  }

  function closeAnnualReport() {
    var o = el("annual-report-overlay");
    if (o) o.classList.add("hidden");
    if (GameState.meta.gameOver) setTimeout(showGameOver, 400);
  }

  // ----------------------------------------------------------
  // HELP
  // ----------------------------------------------------------
  function showHelp() { var o = el("help-overlay"); if (o) o.classList.remove("hidden"); }
  function closeHelp() { var o = el("help-overlay"); if (o) o.classList.add("hidden"); }
  function switchHelpTab(tabId, btn) {
    document.querySelectorAll(".help-tab-content").forEach(function(t) { t.classList.remove("active"); });
    document.querySelectorAll(".help-tab-btn").forEach(function(b) { b.classList.remove("active"); });
    var tab = document.getElementById(tabId);
    if (tab) tab.classList.add("active");
    if (btn) btn.classList.add("active");
  }

  // ----------------------------------------------------------
  // PLAYER ACTIONS
  // ----------------------------------------------------------
  function confirmBuyProperty(propertyId) {
    var prop = GameState.propertyMarket.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    showModal("Acquire " + prop.name,
      "Sector: " + prop.sector + " | Location: " + prop.location + "\n" +
      "Asking Price: " + fmtM(prop.askingPrice) + "\nAnnual NOI: " + fmtM(prop.annualNOI) + "\n" +
      "Occupancy: " + fmtPct(prop.occupancy) + "\nCap Rate: " + GameState.market.capRates[prop.sector][prop.location] + "%\n\n" +
      "Your cash: " + fmtM(GameState.balance.cash) + "\nCash after: " + fmtM(GameState.balance.cash - prop.askingPrice),
      [{ label: "Buy for " + fmtM(prop.askingPrice), style: "btn-primary", onClick: function() {
        var result = Properties.buyProperty(propertyId);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) renderAll();
      }}]);
  }

  function confirmSellProperty(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    showModal("Sell " + prop.name,
      "Current Value: " + fmtM(prop.currentValue) + "\nPurchase Price: " + fmtM(prop.purchasePrice) + "\n" +
      "Market Cycle: " + GameState.market.cycle + "\n\nAre you sure? This cannot be undone.",
      [{ label: "Confirm Sale", style: "btn-danger", onClick: function() {
        var result = Properties.sellProperty(propertyId);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) renderAll();
      }}]);
  }

  function confirmRetireDebt(trancheId) {
    var tranche = GameState.debtTranches.find(function(t) { return t.id === trancheId; });
    if (!tranche) return;
    var penalty   = tranche.quartersUntilMaturity > 4 ? Math.round(tranche.amount * 0.01 * 10) / 10 : 0;
    var totalCost = Math.round((tranche.amount + penalty) * 10) / 10;
    showModal("Retire " + tranche.label,
      "Amount: " + fmtM(tranche.amount) + "\nRate: " + tranche.rate + "%\n" +
      "Quarters remaining: " + tranche.quartersUntilMaturity + "\n" +
      "Prepayment penalty: " + (penalty > 0 ? fmtM(penalty) : "None") + "\n" +
      "Total cost: " + fmtM(totalCost) + "\nCash available: " + fmtM(GameState.balance.cash),
      [{ label: "Retire Debt", style: "btn-danger", onClick: function() {
        var result = Financials.retireDebt(trancheId);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) renderAll();
      }}]);
  }

  function handleIssueDebt() {
    var amount = parseFloat(el("input-debt-amount") ? el("input-debt-amount").value : 0);
    var years  = parseInt(el("input-debt-years") ? el("input-debt-years").value : 0);
    if (isNaN(amount) || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
    if (isNaN(years) || years < 1 || years > 30) { showToast("Enter a valid term (1-30 years)", "error"); return; }
    var rate = Market.getCurrentBorrowingRate();
    showModal("Issue New Debt",
      "Amount: " + fmtM(amount) + "\nTerm: " + years + " years\nRate: " + fmt(rate, 2) + "%\n" +
      "Annual interest: " + fmtM(amount * rate / 100) + "\nTranches used: " + GameState.debtTranches.length + "/10",
      [{ label: "Issue at " + fmt(rate, 2) + "%", style: "btn-primary", onClick: function() {
        var result = Financials.issueDebt(amount, years);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-debt-amount")) el("input-debt-amount").value = ""; renderAll(); }
      }}]);
  }

  function handleIssueEquity() {
    var shares = parseFloat(el("input-equity-shares") ? el("input-equity-shares").value : 0);
    if (isNaN(shares) || shares <= 0) { showToast("Enter a valid number of shares", "error"); return; }
    var issueP   = GameState.company.sharePrice * 0.95;
    var proceeds = shares * issueP;
    showModal("Issue New Equity",
      "Shares: " + fmt(shares, 1) + "M\nIssue price: " + fmtPS(issueP) + " (5% discount)\n" +
      "Proceeds: " + fmtM(proceeds) + "\nDilution: ~" + fmt(shares / GameState.company.sharesOutstanding * 100, 1) + "%",
      [{ label: "Issue Shares", style: "btn-primary", onClick: function() {
        var result = Financials.issueEquity(shares);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-equity-shares")) el("input-equity-shares").value = ""; renderAll(); }
      }}]);
  }

  function handleBuyback() {
    var shares = parseFloat(el("input-buyback-shares") ? el("input-buyback-shares").value : 0);
    if (isNaN(shares) || shares <= 0) { showToast("Enter a valid number of shares", "error"); return; }
    var cost = shares * GameState.company.sharePrice;
    showModal("Share Buyback",
      "Shares: " + fmt(shares, 1) + "M\nPrice: " + fmtPS(GameState.company.sharePrice) + "\n" +
      "Total cost: " + fmtM(cost) + "\nCash after: " + fmtM(GameState.balance.cash - cost),
      [{ label: "Buy Back Shares", style: "btn-primary", onClick: function() {
        var result = Financials.buybackShares(shares);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-buyback-shares")) el("input-buyback-shares").value = ""; renderAll(); }
      }}]);
  }

  function handleSetDividend() {
    var newDiv = parseFloat(el("input-dividend") ? el("input-dividend").value : -1);
    if (isNaN(newDiv) || newDiv < 0) { showToast("Enter a valid dividend amount", "error"); return; }
    var old    = GameState.company.dividendPerShare;
    var change = newDiv - old;
    var isCut  = change < -0.001;
    var warning = isCut
      ? "WARNING: Cutting the dividend causes a significant share price drop and +2 board pressure points."
      : change > 0.001 ? "Raising the dividend signals confidence but locks in a higher commitment."
      : "No change from current dividend.";
    showModal("Set Quarterly Dividend",
      "Current: " + fmtPS(old) + "/share/quarter\nNew: " + fmtPS(newDiv) + "/share/quarter\n" +
      "Quarterly cost: " + fmtM(newDiv * GameState.company.sharesOutstanding) + "\n\n" + warning,
      [{ label: isCut ? "Cut Dividend" : "Set Dividend", style: isCut ? "btn-danger" : "btn-primary", onClick: function() {
        var result = Financials.setDividend(newDiv);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-dividend")) el("input-dividend").value = ""; renderAll(); }
      }}]);
  }

  // ----------------------------------------------------------
  // ADVANCE QUARTER
  // ----------------------------------------------------------
  function advanceQuarter() {
    if (GameState.meta.gameOver) { showGameOver(); return; }
    if (GameState._pendingOffer) {
      var offer = GameState._pendingOffer;
      showModal("Offer Expiring: " + offer.propertyName,
        "Acquisition offer of " + fmtM(offer.offerPrice) + " (" + offer.premium + "% premium) expires this quarter.\nAccept or decline?",
        [
          { label: "Accept " + fmtM(offer.offerPrice), style: "btn-primary", onClick: function() {
            var result = Properties.sellProperty(offer.propertyId);
            if (result.success) {
              GameState.balance.cash = Math.round((GameState.balance.cash - result.salePrice + offer.offerPrice) * 100) / 100;
              showToast("Accepted offer: " + fmtM(offer.offerPrice), "success");
            }
            GameState._pendingOffer = null;
            doAdvanceQuarter();
          }},
          { label: "Decline Offer", style: "btn-secondary", onClick: function() { GameState._pendingOffer = null; doAdvanceQuarter(); }}
        ]);
      return;
    }
    doAdvanceQuarter();
  }

  function doAdvanceQuarter() {
    var quarterResult = Financials.runQuarter();
    var boardResult   = Board.evaluateQuarter();
    var report        = Board.generateEarningsReport(quarterResult, boardResult);

    var justEndedYear = GameState.meta.quarter === 1 && GameState.meta.totalQuarters > 1;
    if (justEndedYear) {
      if (GameState.meta.year === 2) GameState.meta.tutorialYear = false;
      var snapshot = Board.generateAnnualReport();
      renderAll(report);
      setTimeout(function() { showAnnualReport(snapshot); }, 600);
    } else {
      renderAll(report);
    }

    var reportEl = el("earnings-report");
    if (reportEl) reportEl.scrollIntoView({ behavior: "smooth", block: "start" });

    if (GameState.meta.gameOver && !justEndedYear) {
      var scoreData = Leaderboard.calculateScore();
      setTimeout(function() {
        showGameOver();
        setTimeout(function() { Leaderboard.showSubmitScreen(scoreData); }, 800);
      }, 1200);
    }

    if (quarterResult.marketResult && quarterResult.marketResult.cycleResult && quarterResult.marketResult.cycleResult.cycleChanged) {
      var cycle = quarterResult.marketResult.cycleResult;
      setTimeout(function() { showToast("Market shift: " + cycle.label + " — " + cycle.description, "warning"); }, 800);
    }
  }

  // ----------------------------------------------------------
  // GAME OVER
  // ----------------------------------------------------------
  function showGameOver() {
    var overlay = el("gameover-overlay");
    if (!overlay) return;
    setText("gameover-reason",   GameState.meta.gameOverReason);
    setText("gameover-quarters", "You survived " + GameState.meta.totalQuarters + " quarters (" + GameState.meta.year + " years)");
    setText("gameover-ffo",      fmtPS(GameState.ratios.ffoPerShare));
    setText("gameover-occ",      fmtPct(GameState.ratios.occupancyPortfolio));
    setText("gameover-d2a",      fmtPct(GameState.ratios.debtToAssets));
    setText("gameover-props",    GameState.portfolio.length + " properties");
    overlay.classList.remove("hidden");
  }

  // ----------------------------------------------------------
  // NEW GAME
  // ----------------------------------------------------------
  function newGame() {
    var nameInput = el("input-player-name");
    var reitInput = el("input-reit-name");
    var playerName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "CEO";
    var reitName   = reitInput && reitInput.value.trim() ? reitInput.value.trim() : "My";

    GameState.player.name     = playerName;
    GameState.player.reitName = reitName;
    GameState.company.name    = reitName + " REIT";

    GameState.meta.quarter        = 1;
    GameState.meta.year           = 1;
    GameState.meta.totalQuarters  = 0;
    GameState.meta.gameOver       = false;
    GameState.meta.gameOverReason = "";
    GameState.meta.started        = true;
    GameState.meta.tutorialYear   = true;

    GameState.company.sharePrice          = 20.00;
    GameState.company.sharesOutstanding   = 50;
    GameState.company.marketCap           = 1000;
    GameState.company.dividendPerShare    = 0.10;
    GameState.company.dividendHistory     = [];
    GameState.company.dividendCutQuarters = 0;

    GameState.balance.cash = 100;

    GameState.debtTranches = [
      { id: "d001", amount: 130, rate: 5.0, maturityQuarter: 2, maturityYear: 4, quartersUntilMaturity: 13, label: "5.0% Sr Notes due Y4Q2" },
      { id: "d002", amount: 120, rate: 5.5, maturityQuarter: 4, maturityYear: 6, quartersUntilMaturity: 23, label: "5.5% Sr Notes due Y6Q4" },
    ];

    GameState.history         = [];
    GameState.eventLog        = [];
    GameState.annualSnapshots = [];
    GameState._pendingOffer   = null;

    Market.init();
    Properties.init();
    Board.init();
    Events.init();
    Financials.init();
    Charts.init();

    ["gameover-overlay","start-overlay","annual-report-overlay","help-overlay"].forEach(function(id) {
      var o = el(id); if (o) o.classList.add("hidden");
    });

    renderAll();
    showToast("Welcome, " + playerName + ". Good luck running " + reitName + " REIT.", "success");
    Leaderboard.renderLeaderboard("leaderboard-container");
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
    var btnMap = {
      "btn-advance-quarter": advanceQuarter,
      "btn-new-game":        newGame,
      "btn-new-game-go":     newGame,
      "btn-issue-debt":      handleIssueDebt,
      "btn-issue-equity":    handleIssueEquity,
      "btn-buyback":         handleBuyback,
      "btn-set-dividend":    handleSetDividend,
      "btn-help":            showHelp,
      "btn-help-close":      closeHelp,
    };
    Object.keys(btnMap).forEach(function(id) {
      var btn = el(id);
      if (btn) btn.addEventListener("click", btnMap[id]);
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "F1") { e.preventDefault(); showHelp(); }
      if (e.key === "Escape") { closeHelp(); closeModal(); }
    });

    var modalOverlay = el("modal-overlay");
    if (modalOverlay) modalOverlay.addEventListener("click", function(e) { if (e.target === modalOverlay) closeModal(); });
    var helpOverlay = el("help-overlay");
    if (helpOverlay) helpOverlay.addEventListener("click", function(e) { if (e.target === helpOverlay) closeHelp(); });

    Charts.init();

    var startOverlay = el("start-overlay");
    if (startOverlay) startOverlay.classList.remove("hidden");
    Leaderboard.renderLeaderboard("leaderboard-container");
  }

  return {
    init, newGame, renderAll, showModal, closeModal, showToast,
    showGameOver, advanceQuarter, showAnnualReport, closeAnnualReport,
    showHelp, closeHelp, switchHelpTab,
    confirmBuyProperty, confirmSellProperty, confirmRetireDebt,
    handleIssueDebt, handleIssueEquity, handleBuyback, handleSetDividend,
  };

})();

document.addEventListener("DOMContentLoaded", UI.init);
