// ============================================================
// ui.js — Game interface, rendering, player actions
// REIT Simulator Game
// ============================================================

window.UI = (function() {

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n, d) {
    if (d === undefined) d = 2;
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(d);
  }
  function fmtM(n)   { return "$" + fmt(n, 1) + "M"; }
  function fmtPct(n) { return fmt(n * 100, 1) + "%"; }
  function fmtPS(n)  { return "$" + fmt(n, 2); }
  function el(id)    { return document.getElementById(id); }
  function setText(id, val) { var e = el(id); if (e) e.textContent = val; }

  // ----------------------------------------------------------
  // MODAL
  // ----------------------------------------------------------
  function showModal(title, body, actions) {
    if (!actions) actions = [];
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
    if (!type) type = "info";
    var container = el("toast-container");
    if (!container) return;
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.classList.add("toast-visible"); }, 10);
    setTimeout(function() {
      toast.classList.remove("toast-visible");
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
    }, 3500);
  }

  // ----------------------------------------------------------
  // RENDER FUNCTIONS
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

  function renderRatios() {
    var r = GameState.ratios;
    function sr(id, val, good, bad) {
      var e = el(id);
      if (!e) return;
      e.textContent = val;
      if (good !== undefined) e.className = good ? "text-green" : bad ? "text-red" : "text-yellow";
    }
    sr("ratio-ffo-ps",     fmtPS(r.ffoPerShare));
    sr("ratio-affo-ps",    fmtPS(r.affoPerShare));
    sr("ratio-div-cov",    fmt(r.dividendCoverage, 2) + "x",  r.dividendCoverage >= 1.2,    r.dividendCoverage < 1.0);
    sr("ratio-payout",     fmtPct(r.payoutRatio),             r.payoutRatio < 0.85,         r.payoutRatio > 1.0);
    sr("ratio-d2a",        fmtPct(r.debtToAssets),            r.debtToAssets < 0.40,        r.debtToAssets > 0.60);
    sr("ratio-d2e",        fmt(r.debtToEbitda, 1) + "x",      r.debtToEbitda < 5,           r.debtToEbitda > 8);
    sr("ratio-int-cov",    fmt(r.interestCoverage, 1) + "x",  r.interestCoverage >= 2.5,    r.interestCoverage < 1.5);
    sr("ratio-occ",        fmtPct(r.occupancyPortfolio),      r.occupancyPortfolio >= 0.92, r.occupancyPortfolio < 0.80);
    sr("ratio-noi-margin", fmtPct(r.noiMargin),               r.noiMargin >= 0.45,          r.noiMargin < 0.30);
    sr("ratio-cap-rate",   fmt(r.impliedCapRate, 2) + "%");
    sr("ratio-nav",        fmtPS(r.navPerShare));
    sr("ratio-pffo",       fmt(r.pToFFO, 1) + "x");
    sr("ratio-paffo",      fmt(r.pToAFFO, 1) + "x");
    sr("ratio-div-yield",  fmt(r.dividendYield, 2) + "%",     r.dividendYield > 4,          r.dividendYield < 2);
  }

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

  function renderDebtPanel() {
    var container = el("debt-tranches-list");
    if (!container) return;
    if (GameState.debtTranches.length === 0) {
      container.innerHTML = '<p class="text-muted">No debt outstanding.</p>';
      return;
    }
    var html = "";
    GameState.debtTranches.forEach(function(t) {
      var u = t.quartersUntilMaturity <= 3 ? "tranche-red" : t.quartersUntilMaturity <= 7 ? "tranche-yellow" : "tranche-green";
      html += '<div class="tranche-row ' + u + '">' +
        '<div class="tranche-info">' +
        '<span class="tranche-label">' + t.label + '</span>' +
        '<span class="tranche-meta">' + t.quartersUntilMaturity + 'q · ' + t.rate + '% · $' + fmt(t.amount, 1) + 'M</span>' +
        '</div><div class="tranche-actions">' +
        '<button class="btn btn-sm btn-danger" onclick="UI.confirmRetireDebt(\'' + t.id + '\')">Retire</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
    var countEl = el("debt-tranche-count");
    if (countEl) {
      var c = GameState.debtTranches.length;
      countEl.textContent = c + "/10 tranches";
      countEl.className = c >= 9 ? "text-red" : c >= 7 ? "text-yellow" : "text-green";
    }
  }

  function renderPortfolio() {
    var container = el("portfolio-list");
    if (!container) return;
    if (GameState.portfolio.length === 0) {
      container.innerHTML = '<p class="text-muted">No properties owned. Buy from the market.</p>';
      return;
    }
    var html = "";
    GameState.portfolio.forEach(function(p) {
      var oc = p.occupancy >= 0.90 ? "text-green" : p.occupancy >= 0.80 ? "text-yellow" : "text-red";
      var gl = p.purchasePrice ? fmt(p.currentValue - p.purchasePrice, 1) : 0;
      var gc = gl >= 0 ? "text-green" : "text-red";
      html += '<div class="property-card">' +
        '<div class="prop-header"><span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span></div>' +
        '<div class="prop-stats">' +
        '<span>Value: <strong>' + fmtM(p.currentValue) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong class="' + oc + '">' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>G/L: <strong class="' + gc + '">' + (gl >= 0 ? "+" : "") + gl + 'M</strong></span>' +
        '</div><div class="prop-actions">' +
        '<button class="btn btn-sm btn-danger" onclick="UI.confirmSellProperty(\'' + p.id + '\')">Sell</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  function renderPropertyMarket() {
    var container = el("market-list");
    if (!container) return;
    var html = "";
    GameState.propertyMarket.forEach(function(p) {
      var cr = GameState.market.capRates[p.sector][p.location];
      var ca = GameState.balance.cash >= p.askingPrice;
      html += '<div class="property-card ' + (ca ? "" : "prop-unaffordable") + '">' +
        '<div class="prop-header"><span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span></div>' +
        '<div class="prop-stats">' +
        '<span>Ask: <strong>' + fmtM(p.askingPrice) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong>' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>Cap: <strong>' + cr + '%</strong></span>' +
        '</div><div class="prop-actions">' +
        '<button class="btn btn-sm btn-primary" onclick="UI.confirmBuyProperty(\'' + p.id + '\')" ' +
        (ca ? "" : 'disabled') + '>Buy ' + fmtM(p.askingPrice) + '</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  function renderEarningsReport(report) {
    if (!report) return;
    var container = el("earnings-report");
    if (!container) return;
    var isTut = GameState.meta.tutorialYear;
    var goalsHTML = "";
    if (GameState.board.currentGoals.length > 0) {
      var title = isTut ? "Year 1 Orientation Targets (not enforced)" : "Current Year Targets";
      goalsHTML = '<div class="goals-panel"><div class="goals-title">' + title + '</div>';
      GameState.board.currentGoals.forEach(function(g) {
        goalsHTML += '<div class="goal-item">▸ ' + g.metric + ': ' + g.target + '</div>';
      });
      goalsHTML += '</div>';
    }
    var evHTML = "";
    if (report.firedEvents && report.firedEvents.length > 0) {
      evHTML = '<div class="events-list">';
      report.firedEvents.forEach(function(e) {
        evHTML += '<div class="event-item"><strong>' + e.headline + '</strong><p>' + e.body + '</p><span class="event-impact">' + e.impact + '</span></div>';
      });
      evHTML += '</div>';
    }
    var prHTML = "";
    if (report.boardResult && report.boardResult.pressureChanges && report.boardResult.pressureChanges.length > 0) {
      prHTML = '<div class="pressure-changes">';
      report.boardResult.pressureChanges.forEach(function(p) {
        var cls = p.type === "pressure" ? "pressure-bad" : p.type === "warning" ? "pressure-warn" : "pressure-good";
        var ar  = p.type === "pressure" ? "▲" : p.type === "warning" ? "⚠" : "▼";
        prHTML += '<div class="pressure-item ' + cls + '">' + ar + ' ' + p.points + 'pt — ' + p.reason + '</div>';
      });
      prHTML += '</div>';
    }
    container.innerHTML =
      '<div class="panel-header"><span class="panel-title">CFO Earnings Report</span></div>' +
      '<div class="panel-body">' +
      '<h3 style="margin-bottom:10px">' + report.headline + '</h3>' +
      '<p style="color:var(--text-muted);line-height:1.7;margin-bottom:12px">' + report.body.replace(/\n/g, "<br>") + '</p>' +
      goalsHTML + evHTML + prHTML +
      '</div>';
  }

  function renderCapitalActions() {
    setText("action-borrow-rate", "Current rate: " + fmt(Market.getCurrentBorrowingRate(), 2) + "%");
    setText("action-div-current", "Current: $" + fmt(GameState.company.dividendPerShare, 2) + "/share/qtr");
    setText("action-shares-out",  "Shares: " + fmt(GameState.company.sharesOutstanding, 1) + "M outstanding");
    setText("action-cash-avail",  "Cash available: " + fmtM(GameState.balance.cash));
  }

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
    var isY1 = snapshot.year === 1;
    function arw(a, b) { return a < b ? '<span class="text-green">▲</span>' : a > b ? '<span class="text-red">▼</span>' : "→"; }
    var ratingOrder = ["CCC","B","BB","BBB","A","AA","AAA"];
    var si = ratingOrder.indexOf(snapshot.startRating);
    var ei = ratingOrder.indexOf(snapshot.endRating);
    var ra = ei > si ? '<span class="text-green">▲</span>' : ei < si ? '<span class="text-red">▼</span>' : "→";
    var goalsHTML = "";
    if (snapshot.boardAssessment && snapshot.boardAssessment.goalResults) {
      goalsHTML = '<div class="ar-section"><div class="ar-section-title">Goal Performance</div>';
      snapshot.boardAssessment.goalResults.forEach(function(g) {
        goalsHTML += '<div class="ar-goal ' + (g.met ? "ar-goal-met" : "ar-goal-missed") + '">' + (g.met ? "✅" : "❌") + ' ' + g.metric + ': ' + g.target + '</div>';
      });
      goalsHTML += '</div>';
    }
    var ngHTML = "";
    if (snapshot.nextYearGoals && snapshot.nextYearGoals.length > 0) {
      ngHTML = '<div class="ar-section"><div class="ar-section-title">Year ' + (snapshot.year + 1) + ' Board Targets</div>';
      snapshot.nextYearGoals.forEach(function(g) { ngHTML += '<div class="ar-goal">▸ ' + g.metric + ': ' + g.target + '</div>'; });
      ngHTML += '</div>';
    }
    var evHTML = "";
    if (snapshot.yearEvents && snapshot.yearEvents.length > 0) {
      evHTML = '<div class="ar-section"><div class="ar-section-title">Key Events</div>';
      snapshot.yearEvents.forEach(function(e) { evHTML += '<div class="ar-event">▸ ' + e.headline + '</div>'; });
      evHTML += '</div>';
    }
    var sp = snapshot.boardAssessment ? (snapshot.boardAssessment.startingPressure || 0) : 0;
    var pnote = isY1 ? '<p class="ar-pressure-note">Starting Year 2 with <strong>' + sp + ' pressure point(s)</strong> on record.</p>' : "";
    content.innerHTML =
      '<div class="ar-header">' +
      '<div class="ar-logo">' + GameState.company.name + '</div>' +
      '<div class="ar-year">Annual Report — Year ' + snapshot.year + '</div>' +
      (isY1 ? '<div class="ar-badge">Orientation Year Complete</div>' : '') +
      '</div>' +
      '<div class="ar-grid">' +
      '<div class="ar-section"><div class="ar-section-title">Share Performance</div>' +
      '<div class="ar-row"><span>Share Price</span><span>' + arw(snapshot.endPrice, snapshot.startPrice) + ' $' + snapshot.startPrice + ' → $' + snapshot.endPrice + ' (' + (snapshot.priceChg >= 0 ? "+" : "") + snapshot.priceChg + '%)</span></div></div>' +
      '<div class="ar-section"><div class="ar-section-title">Full Year Financials</div>' +
      '<div class="ar-row"><span>Total Revenue</span><span>' + fmtM(snapshot.totalRevenue) + '</span></div>' +
      '<div class="ar-row"><span>Total NOI</span><span>' + fmtM(snapshot.totalNOI) + '</span></div>' +
      '<div class="ar-row"><span>Total FFO</span><span class="text-green">' + fmtM(snapshot.totalFFO) + '</span></div>' +
      '<div class="ar-row"><span>Dividends Paid</span><span>' + fmtM(snapshot.totalDividends) + '</span></div>' +
      '<div class="ar-row"><span>Avg Coverage</span><span class="' + (snapshot.avgCoverage >= 1.0 ? "text-green" : "text-red") + '">' + fmt(snapshot.avgCoverage, 2) + 'x</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Balance Sheet</div>' +
      '<div class="ar-row"><span>Total Assets</span><span>' + arw(snapshot.endAssets, snapshot.startAssets) + ' ' + fmtM(snapshot.startAssets) + ' → ' + fmtM(snapshot.endAssets) + '</span></div>' +
      '<div class="ar-row"><span>Total Debt</span><span>' + fmtM(snapshot.startDebt) + ' → ' + fmtM(snapshot.endDebt) + '</span></div>' +
      '<div class="ar-row"><span>Credit Rating</span><span>' + ra + ' ' + snapshot.startRating + ' → ' + snapshot.endRating + '</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Portfolio</div>' +
      '<div class="ar-row"><span>Properties</span><span>' + snapshot.startProps + ' → ' + snapshot.endProps + '</span></div>' +
      '<div class="ar-row"><span>Avg Occupancy</span><span class="' + (snapshot.avgOccupancy >= 0.85 ? "text-green" : "text-yellow") + '">' + fmtPct(snapshot.avgOccupancy) + '</span></div>' +
      (snapshot.bestProp  ? '<div class="ar-row"><span>Best</span><span class="text-green">'  + snapshot.bestProp.name  + ' (' + snapshot.bestProp.occ  + '%)</span></div>' : '') +
      (snapshot.worstProp ? '<div class="ar-row"><span>Worst</span><span class="text-red">'   + snapshot.worstProp.name + ' (' + snapshot.worstProp.occ + '%)</span></div>' : '') +
      '</div>' +
      evHTML + goalsHTML +
      '</div>' +
      '<div class="ar-board-letter"><div class="ar-section-title">Board Assessment</div>' +
      '<p>' + (snapshot.boardAssessment ? (snapshot.boardAssessment.letter || "") : "") + '</p>' +
      pnote + '</div>' +
      ngHTML +
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
      "Asking: " + fmtM(prop.askingPrice) + "  |  NOI: " + fmtM(prop.annualNOI) + "/yr\n" +
      "Occupancy: " + fmtPct(prop.occupancy) + "  |  Cap Rate: " + GameState.market.capRates[prop.sector][prop.location] + "%\n\n" +
      "Cash now: " + fmtM(GameState.balance.cash) + "  →  after: " + fmtM(GameState.balance.cash - prop.askingPrice),
      [{ label: "Buy for " + fmtM(prop.askingPrice), style: "btn-primary", onClick: function() {
        var r = Properties.buyProperty(propertyId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function confirmSellProperty(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    showModal("Sell " + prop.name,
      "Current Value: " + fmtM(prop.currentValue) + "\nPurchase Price: " + fmtM(prop.purchasePrice) + "\nCycle: " + GameState.market.cycle + "\n\nConfirm sale?",
      [{ label: "Confirm Sale", style: "btn-danger", onClick: function() {
        var r = Properties.sellProperty(propertyId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function confirmRetireDebt(trancheId) {
    var t = GameState.debtTranches.find(function(x) { return x.id === trancheId; });
    if (!t) return;
    var pen  = t.quartersUntilMaturity > 4 ? Math.round(t.amount * 0.01 * 10) / 10 : 0;
    var cost = Math.round((t.amount + pen) * 10) / 10;
    showModal("Retire " + t.label,
      "Amount: " + fmtM(t.amount) + "  |  Rate: " + t.rate + "%\n" +
      "Quarters left: " + t.quartersUntilMaturity + "\nPenalty: " + (pen > 0 ? fmtM(pen) : "None") + "\nTotal cost: " + fmtM(cost) + "\nCash: " + fmtM(GameState.balance.cash),
      [{ label: "Retire Debt", style: "btn-danger", onClick: function() {
        var r = Financials.retireDebt(trancheId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function handleIssueDebt() {
    var amtEl = el("input-debt-amount"), yrEl = el("input-debt-years");
    var amount = amtEl ? parseFloat(amtEl.value) : NaN;
    var years  = yrEl  ? parseInt(yrEl.value)    : NaN;
    if (isNaN(amount) || amount <= 0)            { showToast("Enter a valid amount", "error"); return; }
    if (isNaN(years) || years < 1 || years > 30) { showToast("Enter term 1-30 years", "error"); return; }
    var rate = Market.getCurrentBorrowingRate();
    showModal("Issue New Debt",
      "Amount: " + fmtM(amount) + "  |  Term: " + years + " yrs  |  Rate: " + fmt(rate, 2) + "%\n" +
      "Annual interest: " + fmtM(amount * rate / 100) + "  |  Tranches: " + GameState.debtTranches.length + "/10",
      [{ label: "Issue at " + fmt(rate, 2) + "%", style: "btn-primary", onClick: function() {
        var r = Financials.issueDebt(amount, years);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (amtEl) amtEl.value = ""; renderAll(); }
      }}]);
  }

  function handleIssueEquity() {
    var sharesEl = el("input-equity-shares");
    var shares = sharesEl ? parseFloat(sharesEl.value) : NaN;
    if (isNaN(shares) || shares <= 0) { showToast("Enter valid shares", "error"); return; }
    var ip = GameState.company.sharePrice * 0.95;
    showModal("Issue Equity",
      "Shares: " + fmt(shares, 1) + "M  |  Price: " + fmtPS(ip) + " (5% disc)\n" +
      "Proceeds: " + fmtM(shares * ip) + "  |  Dilution: " + fmt(shares / GameState.company.sharesOutstanding * 100, 1) + "%",
      [{ label: "Issue Shares", style: "btn-primary", onClick: function() {
        var r = Financials.issueEquity(shares);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (sharesEl) sharesEl.value = ""; renderAll(); }
      }}]);
  }

  function handleBuyback() {
    var sharesEl = el("input-buyback-shares");
    var shares = sharesEl ? parseFloat(sharesEl.value) : NaN;
    if (isNaN(shares) || shares <= 0) { showToast("Enter valid shares", "error"); return; }
    var cost = shares * GameState.company.sharePrice;
    showModal("Share Buyback",
      "Shares: " + fmt(shares, 1) + "M  |  Cost: " + fmtM(cost) + "\nCash after: " + fmtM(GameState.balance.cash - cost),
      [{ label: "Buy Back", style: "btn-primary", onClick: function() {
        var r = Financials.buybackShares(shares);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (sharesEl) sharesEl.value = ""; renderAll(); }
      }}]);
  }

  function handleSetDividend() {
    var divEl = el("input-dividend");
    var newDiv = divEl ? parseFloat(divEl.value) : NaN;
    if (isNaN(newDiv) || newDiv < 0) { showToast("Enter valid dividend", "error"); return; }
    var old   = GameState.company.dividendPerShare;
    var isCut = newDiv < old - 0.001;
    var warn  = isCut ? "WARNING: Cutting dividend causes share price drop and +2 board pressure." : newDiv > old + 0.001 ? "Raising dividend signals confidence." : "No change.";
    showModal("Set Quarterly Dividend",
      "Current: " + fmtPS(old) + "  →  New: " + fmtPS(newDiv) + "\nQuarterly cost: " + fmtM(newDiv * GameState.company.sharesOutstanding) + "\n\n" + warn,
      [{ label: isCut ? "Cut Dividend" : "Set Dividend", style: isCut ? "btn-danger" : "btn-primary", onClick: function() {
        var r = Financials.setDividend(newDiv);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (divEl) divEl.value = ""; renderAll(); }
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
        "Offer: " + fmtM(offer.offerPrice) + " (" + offer.premium + "% premium)\nExpires this quarter — accept or decline?",
        [
          { label: "Accept " + fmtM(offer.offerPrice), style: "btn-primary", onClick: function() {
            var r = Properties.sellProperty(offer.propertyId);
            if (r.success) {
              GameState.balance.cash = Math.round((GameState.balance.cash - r.salePrice + offer.offerPrice) * 100) / 100;
              showToast("Accepted: " + fmtM(offer.offerPrice), "success");
            }
            GameState._pendingOffer = null;
            doAdvance();
          }},
          { label: "Decline", style: "btn-secondary", onClick: function() { GameState._pendingOffer = null; doAdvance(); }}
        ]);
      return;
    }
    doAdvance();
  }

  function doAdvance() {
    var qr = Financials.runQuarter();
    var br = Board.evaluateQuarter();
    var rp = Board.generateEarningsReport(qr, br);
    var justEndedYear = GameState.meta.quarter === 1 && GameState.meta.totalQuarters > 1;
    if (justEndedYear) {
      if (GameState.meta.year === 2) GameState.meta.tutorialYear = false;
      var snap = Board.generateAnnualReport();
      renderAll(rp);
      setTimeout(function() { showAnnualReport(snap); }, 600);
    } else {
      renderAll(rp);
    }
    var re = el("earnings-report");
    if (re) re.scrollIntoView({ behavior: "smooth", block: "start" });
    if (GameState.meta.gameOver && !justEndedYear) {
      var sd = Leaderboard.calculateScore();
      setTimeout(function() {
        showGameOver();
        setTimeout(function() { Leaderboard.showSubmitScreen(sd); }, 800);
      }, 1200);
    }
    if (qr.marketResult && qr.marketResult.cycleResult && qr.marketResult.cycleResult.cycleChanged) {
      var cy = qr.marketResult.cycleResult;
      setTimeout(function() { showToast("Market shift: " + cy.label, "warning"); }, 800);
    }
  }

  // ----------------------------------------------------------
  // GAME OVER
  // ----------------------------------------------------------
  function showGameOver() {
    var o = el("gameover-overlay");
    if (!o) return;
    setText("gameover-reason",   GameState.meta.gameOverReason);
    setText("gameover-quarters", "Survived " + GameState.meta.totalQuarters + " quarters (" + GameState.meta.year + " years)");
    setText("gameover-ffo",      fmtPS(GameState.ratios.ffoPerShare));
    setText("gameover-occ",      fmtPct(GameState.ratios.occupancyPortfolio));
    setText("gameover-d2a",      fmtPct(GameState.ratios.debtToAssets));
    setText("gameover-props",    GameState.portfolio.length + " properties");
    o.classList.remove("hidden");
  }

  // ----------------------------------------------------------
  // NEW GAME — called ONLY when Start Game button is clicked
  // ----------------------------------------------------------
  function newGame() {
    var ni = el("input-player-name");
    var ri = el("input-reit-name");
    var playerName = (ni && ni.value.trim()) ? ni.value.trim() : "CEO";
    var reitName   = (ri && ri.value.trim()) ? ri.value.trim() : "My";

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
    GameState.balance.cash                = 50;

    GameState.debtTranches = [
      { id: "d001", amount: 35, rate: 5.0, maturityQuarter: 2, maturityYear: 4, quartersUntilMaturity: 13, label: "5.0% Sr Notes due Y4Q2" },
      { id: "d002", amount: 35, rate: 5.5, maturityQuarter: 4, maturityYear: 6, quartersUntilMaturity: 23, label: "5.5% Sr Notes due Y6Q4" },
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

    // Hide all overlays
    var overlayIds = ["gameover-overlay", "start-overlay", "annual-report-overlay", "help-overlay"];
    overlayIds.forEach(function(id) {
      var o = el(id);
      if (o) o.classList.add("hidden");
    });

    renderAll();
    Leaderboard.renderLeaderboard("leaderboard-container");
    setTimeout(function() {
      showModal(
        "Letter from the Board of Directors",
        "Dear " + playerName + ",\n\n" +
        "The Board of Directors is pleased to appoint you as Chief Executive Officer of " + reitName + " REIT.\n\n" +
        "YEAR 1 — ORIENTATION PERIOD\n" +
        "You cannot be fired this year. However the board is scoring you silently and any failures carry forward as pressure points into Year 2. A bad Year 1 puts you immediately in danger when full scrutiny begins.\n\n" +
        "YOUR STARTING POSITION\n" +
        "▸ Cash: $100M\n" +
        "▸ Two properties already owned\n" +
        "▸ Debt: $250M across two tranches\n" +
        "▸ Dividend: $0.10/share/quarter\n\n" +
        "WHAT THE BOARD WATCHES\n" +
        "▸ Dividend coverage above 1.0x (FFO must cover dividends)\n" +
        "▸ Leverage below 60% debt/assets\n" +
        "▸ Portfolio occupancy above 80%\n" +
        "▸ FFO growing year over year\n\n" +
        "Use Year 1 to acquire properties, grow your NOI, and make sure your dividend is covered before Year 2 begins. Press F1 at any time for help.\n\n" +
        "— The Board of Directors",
        []
      );
    }, 400);
  }

  // ----------------------------------------------------------
  // INIT — called once on page load, shows start screen only
  // ----------------------------------------------------------
  function init() {
    // Wire up buttons
    var buttons = {
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
    Object.keys(buttons).forEach(function(id) {
      var btn = el(id);
      if (btn) btn.addEventListener("click", buttons[id]);
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", function(e) {
      if (e.key === "F1")     { e.preventDefault(); showHelp(); }
      if (e.key === "Escape") { closeHelp(); closeModal(); }
    });

    // Close overlays on background click
    var mo = el("modal-overlay");
    if (mo) mo.addEventListener("click", function(e) { if (e.target === mo) closeModal(); });
    var ho = el("help-overlay");
    if (ho) ho.addEventListener("click", function(e) { if (e.target === ho) closeHelp(); });

    // Init charts
    Charts.init();

    // Show start screen — THIS IS ALL INIT DOES
    var so = el("start-overlay");
    if (so) so.classList.remove("hidden");

    // Load leaderboard in background
    Leaderboard.renderLeaderboard("leaderboard-container");
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init:                init,
    newGame:             newGame,
    renderAll:           renderAll,
    showModal:           showModal,
    closeModal:          closeModal,
    showToast:           showToast,
    showGameOver:        showGameOver,
    advanceQuarter:      advanceQuarter,
    showAnnualReport:    showAnnualReport,
    closeAnnualReport:   closeAnnualReport,
    showHelp:            showHelp,
    closeHelp:           closeHelp,
    switchHelpTab:       switchHelpTab,
    confirmBuyProperty:  confirmBuyProperty,
    confirmSellProperty: confirmSellProperty,
    confirmRetireDebt:   confirmRetireDebt,
    handleIssueDebt:     handleIssueDebt,
    handleIssueEquity:   handleIssueEquity,
    handleBuyback:       handleBuyback,
    handleSetDividend:   handleSetDividend,
  };

}());

document.addEventListener("DOMContentLoaded", UI.init);
