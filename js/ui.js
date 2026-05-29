// ============================================================
// ui.js — Game interface, rendering, player actions
// REIT Simulator Game
// ============================================================

window.UI = (() => {

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(decimals);
  }
  function fmtM(n)   { return `$${fmt(n, 1)}M`; }
  function fmtPct(n) { return `${fmt(n * 100, 1)}%`; }
  function fmtPS(n)  { return `$${fmt(n, 2)}`; }
  function el(id)    { return document.getElementById(id); }
  function setText(id, val) { const e = el(id); if (e) e.textContent = val; }
  function setHTML(id, val) { const e = el(id); if (e) e.innerHTML = val; }

  // ----------------------------------------------------------
  // MODAL
  // ----------------------------------------------------------
  function showModal(title, body, actions = []) {
    const overlay = el("modal-overlay");
    if (!overlay) return;
    el("modal-title").textContent = title;
    el("modal-body").innerHTML    = body.replace(/\n/g, "<br>");
    el("modal-actions").innerHTML = "";

    actions.forEach(({ label, style, onClick }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.className   = `btn ${style || "btn-secondary"}`;
      btn.onclick     = () => { onClick(); closeModal(); };
      el("modal-actions").appendChild(btn);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.className   = "btn btn-secondary";
    closeBtn.onclick     = closeModal;
    el("modal-actions").appendChild(closeBtn);
    overlay.classList.remove("hidden");
  }

  function closeModal() {
    const o = el("modal-overlay");
    if (o) o.classList.add("hidden");
  }

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------
  function showToast(message, type = "info") {
    const container = el("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className   = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("toast-visible"), 10);
    setTimeout(() => { toast.classList.remove("toast-visible"); setTimeout(() => toast.remove(), 400); }, 3500);
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
    setText("hdr-rate",      `${fmt(GameState.market.baseInterestRate, 2)}%`);
    setText("hdr-borrow",    `${fmt(GameState.market.baseInterestRate + GameState.credit.spread, 2)}%`);

    const pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    const bar = el("board-pressure-bar");
    const lbl = el("board-pressure-label");
    if (bar) {
      bar.style.width      = `${Math.min(100, pct * 100)}%`;
      bar.style.background = pct > 0.75 ? "#ef4444" : pct > 0.50 ? "#f59e0b" : "#22c55e";
    }
    if (lbl) {
      const tutorialTag = GameState.meta.tutorialYear ? " [ORIENTATION YEAR — Safe]" : "";
      lbl.textContent = `Board: ${GameState.board.mood.toUpperCase()}${tutorialTag} — ${GameState.board.pressurePoints}/${GameState.board.maxPressure} pressure points`;
    }
  }

  // ----------------------------------------------------------
  // P&L
  // ----------------------------------------------------------
  function renderPnL() {
    const p = GameState.pnl;
    setText("pnl-gpr",      fmtM(p.grossPotentialRent));
    setText("pnl-vacancy",  `(${fmtM(p.vacancyLoss)})`);
    setText("pnl-opex",     `(${fmtM(p.operatingExpenses)})`);
    setText("pnl-noi",      fmtM(p.noi));
    setText("pnl-ga",       `(${fmtM(p.gAndA)})`);
    setText("pnl-interest", `(${fmtM(p.interestExpense)})`);
    setText("pnl-depr",     `(${fmtM(p.depreciation)})`);
    setText("pnl-unusual",  fmtM(p.unusualItems));
    setText("pnl-netincome",fmtM(p.netIncome));
    setText("pnl-ffo",      fmtM(p.ffo));
    setText("pnl-affo",     fmtM(p.affo));
    setText("pnl-divpaid",  `(${fmtM(p.dividendsPaid)})`);
    setText("pnl-retained", fmtM(p.retainedCash));

    const retEl = el("pnl-retained");
    if (retEl) retEl.className = p.retainedCash >= 0 ? "text-green" : "text-red";
    const niEl = el("pnl-netincome");
    if (niEl)  niEl.className  = p.netIncome >= 0 ? "text-green" : "text-yellow";
  }

  // ----------------------------------------------------------
  // RATIOS
  // ----------------------------------------------------------
  function renderRatios() {
    const r = GameState.ratios;
    const rows = [
      { id: "ratio-ffo-ps",     val: fmtPS(r.ffoPerShare) },
      { id: "ratio-affo-ps",    val: fmtPS(r.affoPerShare) },
      { id: "ratio-div-cov",    val: `${fmt(r.dividendCoverage, 2)}x`,  good: r.dividendCoverage >= 1.2, bad: r.dividendCoverage < 1.0 },
      { id: "ratio-payout",     val: fmtPct(r.payoutRatio),             good: r.payoutRatio < 0.85,      bad: r.payoutRatio > 1.0 },
      { id: "ratio-d2a",        val: fmtPct(r.debtToAssets),            good: r.debtToAssets < 0.40,     bad: r.debtToAssets > 0.60 },
      { id: "ratio-d2e",        val: `${fmt(r.debtToEbitda, 1)}x`,      good: r.debtToEbitda < 5,        bad: r.debtToEbitda > 8 },
      { id: "ratio-int-cov",    val: `${fmt(r.interestCoverage, 1)}x`,  good: r.interestCoverage >= 2.5, bad: r.interestCoverage < 1.5 },
      { id: "ratio-occ",        val: fmtPct(r.occupancyPortfolio),      good: r.occupancyPortfolio >= 0.92, bad: r.occupancyPortfolio < 0.80 },
      { id: "ratio-noi-margin", val: fmtPct(r.noiMargin),               good: r.noiMargin >= 0.45,       bad: r.noiMargin < 0.30 },
      { id: "ratio-cap-rate",   val: `${fmt(r.impliedCapRate, 2)}%` },
      { id: "ratio-nav",        val: fmtPS(r.navPerShare) },
      { id: "ratio-pffo",       val: `${fmt(r.pToFFO, 1)}x` },
      { id: "ratio-paffo",      val: `${fmt(r.pToAFFO, 1)}x` },
      { id: "ratio-div-yield",  val: `${fmt(r.dividendYield, 2)}%`,     good: r.dividendYield > 4, bad: r.dividendYield < 2 },
    ];
    rows.forEach(({ id, val, good, bad }) => {
      const e = el(id);
      if (!e) return;
      e.textContent = val;
      if (good !== undefined) e.className = good ? "text-green" : bad ? "text-red" : "text-yellow";
    });
  }

  // ----------------------------------------------------------
  // BALANCE SHEET
  // ----------------------------------------------------------
  function renderBalanceSheet() {
    const b = GameState.balance;
    setText("bs-cash",   fmtM(b.cash));
    setText("bs-assets", fmtM(b.totalAssets));
    setText("bs-debt",   fmtM(b.totalDebt));
    setText("bs-equity", fmtM(b.totalEquity));
    setText("bs-shares", `${fmt(GameState.company.sharesOutstanding, 1)}M`);
    setText("bs-divps",  fmtPS(GameState.company.dividendPerShare));
    const cashEl = el("bs-cash");
    if (cashEl) cashEl.className = b.cash < 10 ? "text-red" : b.cash < 25 ? "text-yellow" : "text-green";
  }

  // ----------------------------------------------------------
  // DEBT PANEL
  // ----------------------------------------------------------
  function renderDebtPanel() {
    const container = el("debt-tranches-list");
    if (!container) return;
    if (GameState.debtTranches.length === 0) {
      container.innerHTML = `<p class="text-muted">No debt outstanding.</p>`; return;
    }
    container.innerHTML = GameState.debtTranches.map(t => {
      const urgency = t.quartersUntilMaturity <= 3 ? "tranche-red"
                    : t.quartersUntilMaturity <= 7 ? "tranche-yellow" : "tranche-green";
      return `<div class="tranche-row ${urgency}">
        <div class="tranche-info">
          <span class="tranche-label">${t.label}</span>
          <span class="tranche-meta">${t.quartersUntilMaturity}q remaining · ${t.rate}% · $${fmt(t.amount, 1)}M</span>
        </div>
        <div class="tranche-actions">
          <button class="btn btn-sm btn-danger" onclick="UI.confirmRetireDebt('${t.id}')">Retire Early</button>
        </div>
      </div>`;
    }).join("");
    const countEl = el("debt-tranche-count");
    if (countEl) {
      const count = GameState.debtTranches.length;
      countEl.textContent = `${count}/10 tranches`;
      countEl.className   = count >= 9 ? "text-red" : count >= 7 ? "text-yellow" : "text-green";
    }
  }

  // ----------------------------------------------------------
  // PORTFOLIO
  // ----------------------------------------------------------
  function renderPortfolio() {
    const container = el("portfolio-list");
    if (!container) return;
    if (GameState.portfolio.length === 0) {
      container.innerHTML = `<p class="text-muted">No properties owned. Buy from the market.</p>`; return;
    }
    container.innerHTML = GameState.portfolio.map(p => {
      const occColor = p.occupancy >= 0.90 ? "text-green" : p.occupancy >= 0.80 ? "text-yellow" : "text-red";
      const gainLoss = p.purchasePrice ? fmt(p.currentValue - p.purchasePrice, 1) : 0;
      const glColor  = gainLoss >= 0 ? "text-green" : "text-red";
      return `<div class="property-card">
        <div class="prop-header">
          <span class="prop-name">${p.name}</span>
          <span class="prop-tag tag-${p.sector}">${p.sector} · ${p.location}</span>
        </div>
        <div class="prop-stats">
          <span>Value: <strong>${fmtM(p.currentValue)}</strong></span>
          <span>NOI: <strong>${fmtM(p.annualNOI)}/yr</strong></span>
          <span>Occ: <strong class="${occColor}">${fmtPct(p.occupancy)}</strong></span>
          <span>G/L: <strong class="${glColor}">${gainLoss >= 0 ? "+" : ""}${gainLoss}M</strong></span>
        </div>
        <div class="prop-actions">
          <button class="btn btn-sm btn-danger" onclick="UI.confirmSellProperty('${p.id}')">Sell</button>
        </div>
      </div>`;
    }).join("");
  }

  // ----------------------------------------------------------
  // PROPERTY MARKET
  // ----------------------------------------------------------
  function renderPropertyMarket() {
    const container = el("market-list");
    if (!container) return;
    container.innerHTML = GameState.propertyMarket.map(p => {
      const capRate   = GameState.market.capRates[p.sector][p.location];
      const canAfford = GameState.balance.cash >= p.askingPrice;
      return `<div class="property-card ${canAfford ? "" : "prop-unaffordable"}">
        <div class="prop-header">
          <span class="prop-name">${p.name}</span>
          <span class="prop-tag tag-${p.sector}">${p.sector} · ${p.location}</span>
        </div>
        <div class="prop-stats">
          <span>Ask: <strong>${fmtM(p.askingPrice)}</strong></span>
          <span>NOI: <strong>${fmtM(p.annualNOI)}/yr</strong></span>
          <span>Occ: <strong>${fmtPct(p.occupancy)}</strong></span>
          <span>Cap Rate: <strong>${capRate}%</strong></span>
        </div>
        <div class="prop-actions">
          <button class="btn btn-sm btn-primary"
            onclick="UI.confirmBuyProperty('${p.id}')"
            ${canAfford ? "" : "disabled title='Insufficient cash'"}>
            Buy ${fmtM(p.askingPrice)}
          </button>
        </div>
      </div>`;
    }).join("");
  }

  // ----------------------------------------------------------
  // EARNINGS REPORT
  // ----------------------------------------------------------
  function renderEarningsReport(report) {
    if (!report) return;
    const container = el("earnings-report");
    if (!container) return;

    const isTutorial = GameState.meta.tutorialYear;
    const goalsHTML  = isTutorial && GameState.board.currentGoals.length > 0
      ? `<div class="goals-panel">
          <div class="goals-title">📋 Year 1 Orientation Targets (not enforced)</div>
          ${GameState.board.currentGoals.map(g =>
            `<div class="goal-item">▸ ${g.metric}: ${g.target}</div>`
          ).join("")}
        </div>` : "";

    const currentGoalsHTML = !isTutorial && GameState.board.currentGoals.length > 0
      ? `<div class="goals-panel">
          <div class="goals-title">🎯 Current Year Targets</div>
          ${GameState.board.currentGoals.map(g =>
            `<div class="goal-item">▸ ${g.metric}: ${g.target}</div>`
          ).join("")}
        </div>` : "";

    const eventsHTML = report.firedEvents.length > 0
      ? `<div class="events-list">${report.firedEvents.map(e =>
          `<div class="event-item">
            <strong>${e.headline}</strong>
            <p>${e.body}</p>
            <span class="event-impact">${e.impact}</span>
          </div>`).join("")}</div>` : "";

    const pressureHTML = report.boardResult.pressureChanges.length > 0
      ? `<div class="pressure-changes">${report.boardResult.pressureChanges.map(p =>
          `<div class="pressure-item ${p.type === "pressure" ? "pressure-bad" : p.type === "warning" ? "pressure-warn" : "pressure-good'}">
            <span>${p.type === "pressure" ? "▲" : p.type === "warning" ? "⚠" : "▼"} ${p.points}pt — ${p.reason}</span>
          </div>`).join("")}</div>` : "";

    container.innerHTML = `
      <div class="report-header"><h3>${report.headline}</h3></div>
      <div class="report-body"><p>${report.body.replace(/\n/g, "<br>")}</p></div>
      ${goalsHTML}${currentGoalsHTML}${eventsHTML}${pressureHTML}`;
  }

  // ----------------------------------------------------------
  // CAPITAL ACTIONS
  // ----------------------------------------------------------
  function renderCapitalActions() {
    setText("action-borrow-rate", `Current rate: ${fmt(Market.getCurrentBorrowingRate(), 2)}%`);
    setText("action-div-current", `Current: $${fmt(GameState.company.dividendPerShare, 2)}/share/quarter`);
    setText("action-shares-out",  `Shares outstanding: ${fmt(GameState.company.sharesOutstanding, 1)}M`);
    setText("action-cash-avail",  `Cash available: ${fmtM(GameState.balance.cash)}`);
  }

  // ----------------------------------------------------------
  // ANNUAL REPORT OVERLAY
  // ----------------------------------------------------------
  function showAnnualReport(snapshot) {
    if (!snapshot) return;
    const overlay = el("annual-report-overlay");
    const content = el("annual-report-content");
    if (!overlay || !content) return;

    const isYear1  = snapshot.year === 1;
    const arrow    = (a, b) => a < b ? `<span class="text-green">▲</span>` : a > b ? `<span class="text-red">▼</span>` : "→";
    const pctChg   = (a, b) => b !== 0 ? `${fmt((a - b) / b * 100, 1)}%` : "—";

    const ratingArrow = (() => {
      const order = ["CCC","B","BB","BBB","A","AA","AAA"];
      const si = order.indexOf(snapshot.startRating);
      const ei = order.indexOf(snapshot.endRating);
      return ei > si ? `<span class="text-green">▲</span>` : ei < si ? `<span class="text-red">▼</span>` : "→";
    })();

    const goalsHTML = snapshot.boardAssessment?.goalResults
      ? `<div class="ar-section">
          <div class="ar-section-title">Goal Performance</div>
          ${snapshot.boardAssessment.goalResults.map(g =>
            `<div class="ar-goal ${g.met ? "ar-goal-met" : "ar-goal-missed"}">
              ${g.met ? "✅" : "❌"} ${g.metric}: ${g.target}
            </div>`).join("")}
        </div>` : "";

    const nextGoalsHTML = snapshot.nextYearGoals?.length > 0
      ? `<div class="ar-section">
          <div class="ar-section-title">🎯 Year ${snapshot.year + 1} Board Targets</div>
          ${snapshot.nextYearGoals.map(g =>
            `<div class="ar-goal">▸ ${g.metric}: ${g.target}</div>`).join("")}
        </div>` : "";

    const eventsHTML = snapshot.yearEvents?.length > 0
      ? `<div class="ar-section">
          <div class="ar-section-title">Key Events</div>
          ${snapshot.yearEvents.map(e => `<div class="ar-event">▸ ${e.headline}</div>`).join("")}
        </div>` : "";

    content.innerHTML = `
      <div class="ar-header">
        <div class="ar-logo">${GameState.company.name}</div>
        <div class="ar-year">Annual Report — Year ${snapshot.year}</div>
        ${isYear1 ? '<div class="ar-badge">Orientation Year Complete</div>' : ""}
      </div>

      <div class="ar-grid">
        <div class="ar-section">
          <div class="ar-section-title">📈 Share Performance</div>
          <div class="ar-row"><span>Share Price</span><span>${arrow(snapshot.endPrice, snapshot.startPrice)} $${snapshot.startPrice} → $${snapshot.endPrice} (${snapshot.priceChg >= 0 ? "+" : ""}${snapshot.priceChg}%)</span></div>
        </div>

        <div class="ar-section">
          <div class="ar-section-title">💰 Full Year Financials</div>
          <div class="ar-row"><span>Total Revenue</span><span>${fmtM(snapshot.totalRevenue)}</span></div>
          <div class="ar-row"><span>Total NOI</span><span>${fmtM(snapshot.totalNOI)}</span></div>
          <div class="ar-row"><span>Total FFO</span><span class="text-green">${fmtM(snapshot.totalFFO)}</span></div>
          <div class="ar-row"><span>Total AFFO</span><span>${fmtM(snapshot.totalAFFO)}</span></div>
          <div class="ar-row"><span>Dividends Paid</span><span>${fmtM(snapshot.totalDividends)}</span></div>
          <div class="ar-row"><span>Avg Div Coverage</span><span class="${snapshot.avgCoverage >= 1.0 ? "text-green" : "text-red"}">${fmt(snapshot.avgCoverage, 2)}x</span></div>
          <div class="ar-row"><span>Retained Cash</span><span class="${snapshot.totalRetained >= 0 ? "text-green" : "text-red"}">${fmtM(snapshot.totalRetained)}</span></div>
        </div>

        <div class="ar-section">
          <div class="ar-section-title">🏦 Balance Sheet</div>
          <div class="ar-row"><span>Total Assets</span><span>${arrow(snapshot.endAssets, snapshot.startAssets)} ${fmtM(snapshot.startAssets)} → ${fmtM(snapshot.endAssets)}</span></div>
          <div class="ar-row"><span>Total Debt</span><span>${fmtM(snapshot.startDebt)} → ${fmtM(snapshot.endDebt)}</span></div>
          <div class="ar-row"><span>Credit Rating</span><span>${ratingArrow} ${snapshot.startRating} → ${snapshot.endRating}</span></div>
        </div>

        <div class="ar-section">
          <div class="ar-section-title">🏢 Portfolio</div>
          <div class="ar-row"><span>Properties</span><span>${snapshot.startProps} → ${snapshot.endProps}</span></div>
          <div class="ar-row"><span>Avg Occupancy</span><span class="${snapshot.avgOccupancy >= 0.85 ? "text-green" : "text-yellow"}">${fmtPct(snapshot.avgOccupancy)}</span></div>
          ${snapshot.bestProp  ? `<div class="ar-row"><span>Best Asset</span><span class="text-green">${snapshot.bestProp.name} (${snapshot.bestProp.occ}%)</span></div>` : ""}
          ${snapshot.worstProp ? `<div class="ar-row"><span>Needs Work</span><span class="text-red">${snapshot.worstProp.name} (${snapshot.worstProp.occ}%)</span></div>` : ""}
        </div>

        ${eventsHTML}
        ${goalsHTML}
      </div>

      <div class="ar-board-letter">
        <div class="ar-section-title">📜 Board Assessment</div>
        <p>${snapshot.boardAssessment?.letter || ""}</p>
        ${isYear1 ? `<p class="ar-pressure-note">Starting Year 2 with <strong>${snapshot.boardAssessment?.startingPressure || 0} pressure point(s)</strong> already on record.</p>` : ""}
      </div>

      ${nextGoalsHTML}

      <div class="ar-footer">
        <button class="btn btn-primary btn-lg" onclick="UI.closeAnnualReport()">
          Continue to Year ${snapshot.year + 1} →
        </button>
      </div>`;

    overlay.classList.remove("hidden");
  }

  function closeAnnualReport() {
    const o = el("annual-report-overlay");
    if (o) o.classList.add("hidden");

    // Check game over after closing annual report
    if (GameState.meta.gameOver) {
      setTimeout(showGameOver, 400);
    }
  }

  // ----------------------------------------------------------
  // HELP / F1 POPUP
  // ----------------------------------------------------------
  function showHelp() {
    const overlay = el("help-overlay");
    if (overlay) overlay.classList.remove("hidden");
  }

  function closeHelp() {
    const o = el("help-overlay");
    if (o) o.classList.add("hidden");
  }

  function switchHelpTab(tabId, btn) {
    document.querySelectorAll(".help-tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".help-tab-btn").forEach(b => b.classList.remove("active"));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add("active");
    if (btn) btn.classList.add("active");
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
  // PLAYER ACTIONS
  // ----------------------------------------------------------
  function confirmBuyProperty(propertyId) {
    const prop = GameState.propertyMarket.find(p => p.id === propertyId);
    if (!prop) return;
    showModal(
      `Acquire ${prop.name}`,
      `Sector: ${prop.sector} | Location: ${prop.location}\n` +
      `Asking Price: ${fmtM(prop.askingPrice)}\nAnnual NOI: ${fmtM(prop.annualNOI)}\n` +
      `Occupancy: ${fmtPct(prop.occupancy)}\nCap Rate: ${GameState.market.capRates[prop.sector][prop.location]}%\n\n` +
      `Your cash: ${fmtM(GameState.balance.cash)}\nCash after: ${fmtM(GameState.balance.cash - prop.askingPrice)}`,
      [{ label: `Buy for ${fmtM(prop.askingPrice)}`, style: "btn-primary", onClick: () => {
        const result = Properties.buyProperty(propertyId);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) renderAll();
      }}]
    );
  }

  function confirmSellProperty(propertyId) {
    const prop = GameState.portfolio.find(p => p.id === propertyId);
    if (!prop) return;
    const estPrice = fmt(prop.currentValue * (GameState.market.cycle === "recession" ? 0.95 : 1.00), 1);
    showModal(
      `Sell ${prop.name}`,
      `Current Value: ${fmtM(prop.currentValue)}\nPurchase Price: ${fmtM(prop.purchasePrice)}\n` +
      `Estimated Sale: ~$${estPrice}M\nMarket Cycle: ${GameState.market.cycle}\n\nAre you sure?`,
      [{ label: "Confirm Sale", style: "btn-danger", onClick: () => {
        const result = Properties.sellProperty(propertyId);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) renderAll();
      }}]
    );
  }

  function confirmRetireDebt(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return;
    const penalty   = tranche.quartersUntilMaturity > 4 ? fmt(tranche.amount * 0.01, 1) : 0;
    const totalCost = fmt(tranche.amount + parseFloat(penalty), 1);
    showModal(
      `Retire ${tranche.label}`,
      `Amount: ${fmtM(tranche.amount)}\nRate: ${tranche.rate}%\n` +
      `Quarters remaining: ${tranche.quartersUntilMaturity}\n` +
      `Prepayment penalty: ${penalty > 0 ? fmtM(parseFloat(penalty)) : "None"}\n` +
      `Total cost: ${fmtM(parseFloat(totalCost))}\nCash available: ${fmtM(GameState.balance.cash)}`,
      [{ label: "Retire Debt", style: "btn-danger", onClick: () => {
        const result = Financials.retireDebt(trancheId);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) renderAll();
      }}]
    );
  }

  function handleIssueDebt() {
    const amount = parseFloat(el("input-debt-amount")?.value);
    const years  = parseInt(el("input-debt-years")?.value);
    if (isNaN(amount) || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
    if (isNaN(years) || years < 1 || years > 30) { showToast("Enter a valid term (1–30 years)", "error"); return; }
    const rate = Market.getCurrentBorrowingRate();
    showModal("Issue New Debt",
      `Amount: ${fmtM(amount)}\nTerm: ${years} years\nRate: ${fmt(rate, 2)}%\n` +
      `Annual interest: ${fmtM(amount * rate / 100)}\nTranches used: ${GameState.debtTranches.length}/10`,
      [{ label: `Issue at ${fmt(rate, 2)}%`, style: "btn-primary", onClick: () => {
        const result = Financials.issueDebt(amount, years);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-debt-amount")) el("input-debt-amount").value = ""; renderAll(); }
      }}]
    );
  }

  function handleIssueEquity() {
    const shares = parseFloat(el("input-equity-shares")?.value);
    if (isNaN(shares) || shares <= 0) { showToast("Enter a valid number of shares", "error"); return; }
    const issueP   = GameState.company.sharePrice * 0.95;
    const proceeds = shares * issueP;
    showModal("Issue New Equity",
      `Shares: ${fmt(shares, 1)}M\nIssue price: ${fmtPS(issueP)} (5% discount)\n` +
      `Proceeds: ${fmtM(proceeds)}\nDilution: ~${fmt(shares / GameState.company.sharesOutstanding * 100, 1)}%`,
      [{ label: "Issue Shares", style: "btn-primary", onClick: () => {
        const result = Financials.issueEquity(shares);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-equity-shares")) el("input-equity-shares").value = ""; renderAll(); }
      }}]
    );
  }

  function handleBuyback() {
    const shares = parseFloat(el("input-buyback-shares")?.value);
    if (isNaN(shares) || shares <= 0) { showToast("Enter a valid number of shares", "error"); return; }
    const cost = shares * GameState.company.sharePrice;
    showModal("Share Buyback",
      `Shares: ${fmt(shares, 1)}M\nPrice: ${fmtPS(GameState.company.sharePrice)}\n` +
      `Total cost: ${fmtM(cost)}\nCash after: ${fmtM(GameState.balance.cash - cost)}`,
      [{ label: "Buy Back Shares", style: "btn-primary", onClick: () => {
        const result = Financials.buybackShares(shares);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-buyback-shares")) el("input-buyback-shares").value = ""; renderAll(); }
      }}]
    );
  }

  function handleSetDividend() {
    const newDiv = parseFloat(el("input-dividend")?.value);
    if (isNaN(newDiv) || newDiv < 0) { showToast("Enter a valid dividend amount", "error"); return; }
    const old    = GameState.company.dividendPerShare;
    const change = newDiv - old;
    const isCut  = change < -0.001;
    const warning = isCut
      ? `⚠️ WARNING: Cutting the dividend causes a significant share price drop and +2 board pressure points.`
      : change > 0.001 ? `Raising the dividend signals confidence but locks in a higher commitment.`
      : `No change from current dividend.`;
    showModal("Set Quarterly Dividend",
      `Current: ${fmtPS(old)}/share/quarter\nNew: ${fmtPS(newDiv)}/share/quarter\n` +
      `Quarterly cost: ${fmtM(newDiv * GameState.company.sharesOutstanding)}\n\n${warning}`,
      [{ label: isCut ? "⚠️ Cut Dividend" : "Set Dividend", style: isCut ? "btn-danger" : "btn-primary", onClick: () => {
        const result = Financials.setDividend(newDiv);
        showToast(result.message, result.success ? "success" : "error");
        if (result.success) { if (el("input-dividend")) el("input-dividend").value = ""; renderAll(); }
      }}]
    );
  }

  // ----------------------------------------------------------
  // ADVANCE QUARTER
  // ----------------------------------------------------------
  function advanceQuarter() {
    if (GameState.meta.gameOver) { showGameOver(); return; }

    if (GameState._pendingOffer) {
      const offer = GameState._pendingOffer;
      showModal(`⏰ Offer Expiring: ${offer.propertyName}`,
        `Acquisition offer of ${fmtM(offer.offerPrice)} (${offer.premium}% premium) expires this quarter.\nAccept or decline before advancing?`,
        [
          { label: `Accept ${fmtM(offer.offerPrice)}`, style: "btn-primary", onClick: () => {
            const result = Properties.sellProperty(offer.propertyId);
            if (result.success) {
              GameState.balance.cash = Math.round((GameState.balance.cash - result.salePrice + offer.offerPrice) * 100) / 100;
              showToast(`Accepted offer: ${fmtM(offer.offerPrice)}`, "success");
            }
            GameState._pendingOffer = null;
            doAdvanceQuarter();
          }},
          { label: "Decline Offer", style: "btn-secondary", onClick: () => { GameState._pendingOffer = null; doAdvanceQuarter(); }},
        ]
      );
      return;
    }
    doAdvanceQuarter();
  }

  function doAdvanceQuarter() {
    const quarterResult = Financials.runQuarter();
    const boardResult   = Board.evaluateQuarter();
    const report        = Board.generateEarningsReport(quarterResult, boardResult);

    // End of year — check tutorial flag and generate annual report
    const justEndedYear = GameState.meta.quarter === 1 && GameState.meta.totalQuarters > 1;
    if (justEndedYear) {
      // Turn off tutorial flag after Year 1
      if (GameState.meta.year === 2) {
        GameState.meta.tutorialYear = false;
      }
      const snapshot = Board.generateAnnualReport();
      renderAll(report);
      setTimeout(() => showAnnualReport(snapshot), 600);
    } else {
      renderAll(report);
    }

    const reportEl = el("earnings-report");
    if (reportEl) reportEl.scrollIntoView({ behavior: "smooth", block: "start" });

    if (GameState.meta.gameOver && !justEndedYear) {
      // Calculate and show score
      const scoreData = Leaderboard.calculateScore();
      setTimeout(() => {
        showGameOver();
        setTimeout(() => Leaderboard.showSubmitScreen(scoreData), 800);
      }, 1200);
    }

    if (quarterResult.marketResult?.cycleResult?.cycleChanged) {
      const cycle = quarterResult.marketResult.cycleResult;
      setTimeout(() => showToast(`Market shift: ${cycle.label} — ${cycle.description}`, "warning"), 800);
    }
  }

  // ----------------------------------------------------------
  // GAME OVER
  // ----------------------------------------------------------
  function showGameOver() {
    const overlay = el("gameover-overlay");
    if (!overlay) return;
    setText("gameover-reason",   GameState.meta.gameOverReason);
    setText("gameover-quarters", `You survived ${GameState.meta.totalQuarters} quarters (${GameState.meta.year} years)`);
    setText("gameover-ffo",      fmtPS(GameState.ratios.ffoPerShare));
    setText("gameover-occ",      fmtPct(GameState.ratios.occupancyPortfolio));
    setText("gameover-d2a",      fmtPct(GameState.ratios.debtToAssets));
    setText("gameover-props",    `${GameState.portfolio.length} properties`);
    overlay.classList.remove("hidden");
  }

  // ----------------------------------------------------------
  // NEW GAME
  // ----------------------------------------------------------
  function newGame() {
    // Get player name and REIT name from setup screen
    const nameInput = el("input-player-name");
    const reitInput = el("input-reit-name");
    const playerName = (nameInput?.value.trim()) || "CEO";
    const reitName   = (reitInput?.value.trim()) || "My";

    GameState.player.name     = playerName;
    GameState.player.reitName = reitName;
    GameState.company.name    = `${reitName} REIT`;

    // Reset meta
    GameState.meta.quarter        = 1;
    GameState.meta.year           = 1;
    GameState.meta.totalQuarters  = 0;
    GameState.meta.gameOver       = false;
    GameState.meta.gameOverReason = "";
    GameState.meta.started        = true;
    GameState.meta.tutorialYear   = true;

    // Reset company
    GameState.company.sharePrice          = 20.00;
    GameState.company.sharesOutstanding   = 50;
    GameState.company.marketCap           = 1000;
    GameState.company.dividendPerShare    = 0.10;
    GameState.company.dividendHistory     = [];
    GameState.company.dividendCutQuarters = 0;

    // Reset balance
    GameState.balance.cash = 100;

    // Reset debt
    GameState.debtTranches = [
      { id: "d001", amount: 130, rate: 5.0, maturityQuarter: 2, maturityYear: 4, quartersUntilMaturity: 13, label: "5.0% Sr Notes due Y4Q2" },
      { id: "d002", amount: 120, rate: 5.5, maturityQuarter: 4, maturityYear: 6, quartersUntilMaturity: 23, label: "5.5% Sr Notes due Y6Q4" },
    ];

    GameState.history          = [];
    GameState.eventLog         = [];
    GameState.annualSnapshots  = [];
    GameState._pendingOffer    = null;

    Market.init();
    Properties.init();
    Board.init();
    Events.init();
    Financials.init();
    Charts.init();

    // Hide all overlays
    ["gameover-overlay","start-overlay","annual-report-overlay","help-overlay"].forEach(id => {
      const o = el(id);
      if (o) o.classList.add("hidden");
    });

    renderAll();
    showToast(`Welcome, ${playerName}. Good luck running ${reitName} REIT.`, "success");

    // Refresh leaderboard in background
    Leaderboard.renderLeaderboard("leaderboard-container");
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
    // Buttons
    const btnMap = {
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
    Object.entries(btnMap).forEach(([id, fn]) => {
      const btn = el(id);
      if (btn) btn.addEventListener("click", fn);
    });

    // F1 key for help
    document.addEventListener("keydown", e => {
      if (e.key === "F1") { e.preventDefault(); showHelp(); }
      if (e.key === "Escape") { closeHelp(); closeModal(); }
    });

    // Modal close on overlay click
    const modalOverlay = el("modal-overlay");
    if (modalOverlay) modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });

    const helpOverlay = el("help-overlay");
    if (helpOverlay) helpOverlay.addEventListener("click", e => { if (e.target === helpOverlay) closeHelp(); });

    Charts.init();

    // Show start screen and load leaderboard
    const startOverlay = el("start-overlay");
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
