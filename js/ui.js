// ============================================================
// ui.js — Game interface, rendering, player actions
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file only renders and handles user input
// - It reads GameState but only writes through Financials/Properties
// - Never put calculation logic here — that belongs in other files
// - All DOM manipulation lives here and only here
// ============================================================

const UI = (() => {

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(decimals);
  }

  function fmtM(n) {
    return `$${fmt(n, 1)}M`;
  }

  function fmtPct(n) {
    return `${fmt(n * 100, 1)}%`;
  }

  function fmtPS(n) {
    return `$${fmt(n, 2)}`;
  }

  function colorClass(val, goodAbove, badBelow) {
    if (val >= goodAbove) return "text-green";
    if (val <= badBelow)  return "text-red";
    return "text-yellow";
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, val) {
    const e = el(id);
    if (e) e.textContent = val;
  }

  function setHTML(id, val) {
    const e = el(id);
    if (e) e.innerHTML = val;
  }

  function setClass(id, cls) {
    const e = el(id);
    if (e) e.className = cls;
  }

  // ----------------------------------------------------------
  // MODAL SYSTEM
  // ----------------------------------------------------------
  function showModal(title, body, actions = []) {
    const overlay = el("modal-overlay");
    const mtitle  = el("modal-title");
    const mbody   = el("modal-body");
    const macts   = el("modal-actions");

    if (!overlay) return;

    mtitle.textContent = title;
    mbody.innerHTML    = body.replace(/\n/g, "<br>");
    macts.innerHTML    = "";

    actions.forEach(({ label, style, onClick }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.className   = `btn ${style || "btn-secondary"}`;
      btn.onclick     = () => { onClick(); closeModal(); };
      macts.appendChild(btn);
    });

    // Always add close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.className   = "btn btn-secondary";
    closeBtn.onclick     = closeModal;
    macts.appendChild(closeBtn);

    overlay.classList.remove("hidden");
  }

  function closeModal() {
    const overlay = el("modal-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  // ----------------------------------------------------------
  // TOAST NOTIFICATIONS
  // ----------------------------------------------------------
  function showToast(message, type = "info") {
    const container = el("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("toast-visible"), 10);
    setTimeout(() => {
      toast.classList.remove("toast-visible");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ----------------------------------------------------------
  // HEADER — company name, period, share price
  // ----------------------------------------------------------
  function renderHeader() {
    setText("hdr-company",    GameState.company.name);
    setText("hdr-period",     GameState.currentPeriodLabel());
    setText("hdr-price",      fmtPS(GameState.company.sharePrice));
    setText("hdr-marketcap",  fmtM(GameState.company.marketCap));
    setText("hdr-rating",     GameState.credit.rating);
    setText("hdr-cycle",      GameState.market.cycle.charAt(0).toUpperCase() + GameState.market.cycle.slice(1));
    setText("hdr-rate",       `${fmt(GameState.market.baseInterestRate, 2)}%`);
    setText("hdr-borrow",     `${fmt(GameState.market.baseInterestRate + GameState.credit.spread, 2)}%`);

    // Board pressure bar
    const pct  = GameState.board.pressurePoints / GameState.board.maxPressure;
    const bar  = el("board-pressure-bar");
    const lbl  = el("board-pressure-label");
    if (bar) {
      bar.style.width = `${Math.min(100, pct * 100)}%`;
      bar.style.background = pct > 0.75 ? "#ef4444"
                           : pct > 0.50 ? "#f59e0b"
                           : "#22c55e";
    }
    if (lbl) {
      lbl.textContent =
        `Board: ${GameState.board.mood.toUpperCase()} — ` +
        `${GameState.board.pressurePoints}/${GameState.board.maxPressure} pressure points`;
    }
  }

  // ----------------------------------------------------------
  // P&L PANEL
  // ----------------------------------------------------------
  function renderPnL() {
    const p = GameState.pnl;
    setText("pnl-gpr",      fmtM(p.grossPotentialRent));
    setText("pnl-vacancy",  `(${fmtM(p.vacancyLoss)})`);
    setText("pnl-revenue",  fmtM(p.netRentalRevenue));
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

    // Color retained cash
    const retEl = el("pnl-retained");
    if (retEl) {
      retEl.className = p.retainedCash >= 0 ? "text-green" : "text-red";
    }
    const niEl = el("pnl-netincome");
    if (niEl) {
      niEl.className = p.netIncome >= 0 ? "text-green" : "text-yellow";
    }
  }

  // ----------------------------------------------------------
  // RATIOS PANEL
  // ----------------------------------------------------------
  function renderRatios() {
    const r = GameState.ratios;
    const rows = [
      { id: "ratio-ffo-ps",     val: fmtPS(r.ffoPerShare),                label: "FFO/Share" },
      { id: "ratio-affo-ps",    val: fmtPS(r.affoPerShare),               label: "AFFO/Share" },
      { id: "ratio-div-cov",    val: `${fmt(r.dividendCoverage, 2)}x`,    good: r.dividendCoverage >= 1.2, bad: r.dividendCoverage < 1.0 },
      { id: "ratio-payout",     val: fmtPct(r.payoutRatio),               good: r.payoutRatio < 0.85, bad: r.payoutRatio > 1.0 },
      { id: "ratio-d2a",        val: fmtPct(r.debtToAssets),              good: r.debtToAssets < 0.40, bad: r.debtToAssets > 0.60 },
      { id: "ratio-d2e",        val: `${fmt(r.debtToEbitda, 1)}x`,        good: r.debtToEbitda < 5, bad: r.debtToEbitda > 8 },
      { id: "ratio-int-cov",    val: `${fmt(r.interestCoverage, 1)}x`,    good: r.interestCoverage >= 2.5, bad: r.interestCoverage < 1.5 },
      { id: "ratio-occ",        val: fmtPct(r.occupancyPortfolio),        good: r.occupancyPortfolio >= 0.92, bad: r.occupancyPortfolio < 0.80 },
      { id: "ratio-noi-margin", val: fmtPct(r.noiMargin),                 good: r.noiMargin >= 0.45, bad: r.noiMargin < 0.30 },
      { id: "ratio-cap-rate",   val: `${fmt(r.impliedCapRate, 2)}%`,      label: "Implied Cap Rate" },
      { id: "ratio-nav",        val: fmtPS(r.navPerShare),                label: "NAV/Share" },
      { id: "ratio-pffo",       val: `${fmt(r.pToFFO, 1)}x`,             label: "P/FFO" },
      { id: "ratio-paffo",      val: `${fmt(r.pToAFFO, 1)}x`,            label: "P/AFFO" },
      { id: "ratio-div-yield",  val: `${fmt(r.dividendYield, 2)}%`,       good: r.dividendYield > 4, bad: r.dividendYield < 2 },
    ];

    rows.forEach(({ id, val, good, bad }) => {
      const e = el(id);
      if (!e) return;
      e.textContent = val;
      if (good !== undefined) {
        e.className = good ? "text-green" : bad ? "text-red" : "text-yellow";
      }
    });
  }

  // ----------------------------------------------------------
  // BALANCE SHEET PANEL
  // ----------------------------------------------------------
  function renderBalanceSheet() {
    const b = GameState.balance;
    setText("bs-cash",   fmtM(b.cash));
    setText("bs-assets", fmtM(b.totalAssets));
    setText("bs-debt",   fmtM(b.totalDebt));
    setText("bs-equity", fmtM(b.totalEquity));
    setText("bs-shares", `${fmt(GameState.company.sharesOutstanding, 1)}M`);
    setText("bs-divps",  fmtPS(GameState.company.dividendPerShare));
    setText("bs-annual-div", fmtPS(GameState.company.dividendPerShare * 4));

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
      container.innerHTML = `<p class="text-muted">No debt outstanding. Debt-free REIT!</p>`;
      return;
    }

    container.innerHTML = GameState.debtTranches.map(t => {
      const urgency = t.quartersUntilMaturity <= 3  ? "tranche-red"
                    : t.quartersUntilMaturity <= 7  ? "tranche-yellow"
                    : "tranche-green";
      return `
        <div class="tranche-row ${urgency}">
          <div class="tranche-info">
            <span class="tranche-label">${t.label}</span>
            <span class="tranche-meta">${t.quartersUntilMaturity}q remaining · ${t.rate}% · $${fmt(t.amount, 1)}M</span>
          </div>
          <div class="tranche-actions">
            <button class="btn btn-sm btn-danger" onclick="UI.confirmRetireDebt('${t.id}')">
              Retire Early
            </button>
          </div>
        </div>`;
    }).join("");

    // Tranche count warning
    const countEl = el("debt-tranche-count");
    if (countEl) {
      const count = GameState.debtTranches.length;
      countEl.textContent = `${count}/10 tranches`;
      countEl.className   = count >= 9 ? "text-red" : count >= 7 ? "text-yellow" : "text-green";
    }
  }

  // ----------------------------------------------------------
  // PORTFOLIO PANEL
  // ----------------------------------------------------------
  function renderPortfolio() {
    const container = el("portfolio-list");
    if (!container) return;

    if (GameState.portfolio.length === 0) {
      container.innerHTML = `<p class="text-muted">No properties owned. Buy from the market.</p>`;
      return;
    }

    container.innerHTML = GameState.portfolio.map(p => {
      const occColor = p.occupancy >= 0.90 ? "text-green"
                     : p.occupancy >= 0.80 ? "text-yellow"
                     : "text-red";
      const gainLoss = p.purchasePrice
        ? fmt(p.currentValue - p.purchasePrice, 1)
        : 0;
      const glColor  = gainLoss >= 0 ? "text-green" : "text-red";

      return `
        <div class="property-card">
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
            <button class="btn btn-sm btn-danger" onclick="UI.confirmSellProperty('${p.id}')">
              Sell
            </button>
          </div>
        </div>`;
    }).join("");
  }

  // ----------------------------------------------------------
  // PROPERTY MARKET PANEL
  // ----------------------------------------------------------
  function renderPropertyMarket() {
    const container = el("market-list");
    if (!container) return;

    container.innerHTML = GameState.propertyMarket.map(p => {
      const capRate = GameState.market.capRates[p.sector][p.location];
      const canAfford = GameState.balance.cash >= p.askingPrice;

      return `
        <div class="property-card ${canAfford ? "" : "prop-unaffordable"}">
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
  // EARNINGS REPORT PANEL
  // ----------------------------------------------------------
  function renderEarningsReport(report) {
    if (!report) return;
    const container = el("earnings-report");
    if (!container) return;

    const eventsHTML = report.firedEvents.length > 0
      ? `<div class="events-list">
          ${report.firedEvents.map(e =>
            `<div class="event-item">
              <strong>${e.headline}</strong>
              <p>${e.body}</p>
              <span class="event-impact">${e.impact}</span>
            </div>`
          ).join("")}
        </div>`
      : "";

    const pressureHTML = report.boardResult.pressureChanges.length > 0
      ? `<div class="pressure-changes">
          ${report.boardResult.pressureChanges.map(p =>
            `<div class="pressure-item ${p.type === "pressure" ? "pressure-bad" : "pressure-good"}">
              <span>${p.type === "pressure" ? "▲" : "▼"} ${p.points}pt — ${p.reason}</span>
            </div>`
          ).join("")}
        </div>`
      : "";

    container.innerHTML = `
      <div class="report-header">
        <h3>${report.headline}</h3>
      </div>
      <div class="report-body">
        <p>${report.body}</p>
      </div>
      ${eventsHTML}
      ${pressureHTML}
    `;
  }

  // ----------------------------------------------------------
  // CAPITAL ACTIONS PANEL
  // ----------------------------------------------------------
  function renderCapitalActions() {
    // Update borrow rate display
    const borrowRate = Market.getCurrentBorrowingRate();
    setText("action-borrow-rate", `Current rate: ${fmt(borrowRate, 2)}%`);
    setText("action-div-current", `Current: $${fmt(GameState.company.dividendPerShare, 2)}/share/quarter`);
    setText("action-shares-out",  `Shares outstanding: ${fmt(GameState.company.sharesOutstanding, 1)}M`);
    setText("action-cash-avail",  `Cash available: ${fmtM(GameState.balance.cash)}`);
  }

  // ----------------------------------------------------------
  // FULL RENDER — call after every quarter advance
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
  // PLAYER ACTIONS — Buy/Sell Property
  // ----------------------------------------------------------
  function confirmBuyProperty(propertyId) {
    const prop = GameState.propertyMarket.find(p => p.id === propertyId);
    if (!prop) return;

    showModal(
      `Acquire ${prop.name}`,
      `Sector: ${prop.sector} | Location: ${prop.location}\n` +
      `Asking Price: ${fmtM(prop.askingPrice)}\n` +
      `Annual NOI: ${fmtM(prop.annualNOI)}\n` +
      `Occupancy: ${fmtPct(prop.occupancy)}\n` +
      `Cap Rate: ${GameState.market.capRates[prop.sector][prop.location]}%\n\n` +
      `Your cash: ${fmtM(GameState.balance.cash)}\n` +
      `Cash after purchase: ${fmtM(GameState.balance.cash - prop.askingPrice)}`,
      [{
        label:   `Buy for ${fmtM(prop.askingPrice)}`,
        style:   "btn-primary",
        onClick: () => {
          const result = Properties.buyProperty(propertyId);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) renderAll();
        },
      }]
    );
  }

  function confirmSellProperty(propertyId) {
    const prop = GameState.portfolio.find(p => p.id === propertyId);
    if (!prop) return;

    const estPrice = fmt(prop.currentValue * (GameState.market.cycle === "recession" ? 0.95 : 1.00), 1);

    showModal(
      `Sell ${prop.name}`,
      `Current Value: ${fmtM(prop.currentValue)}\n` +
      `Purchase Price: ${fmtM(prop.purchasePrice)}\n` +
      `Estimated Sale: ~$${estPrice}M\n` +
      `Market Cycle: ${GameState.market.cycle} (affects sale price)\n\n` +
      `Are you sure? This cannot be undone.`,
      [{
        label:   "Confirm Sale",
        style:   "btn-danger",
        onClick: () => {
          const result = Properties.sellProperty(propertyId);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) renderAll();
        },
      }]
    );
  }

  // ----------------------------------------------------------
  // PLAYER ACTIONS — Debt
  // ----------------------------------------------------------
  function confirmRetireDebt(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return;

    const penalty = tranche.quartersUntilMaturity > 4
      ? fmt(tranche.amount * 0.01, 1)
      : 0;

    showModal(
      `Retire ${tranche.label}`,
      `Amount: ${fmtM(tranche.amount)}\n` +
      `Rate: ${tranche.rate}%\n` +
      `Quarters remaining: ${tranche.quartersUntilMaturity}\n` +
      `Prepayment penalty: ${penalty > 0 ? fmtM(parseFloat(penalty)) : "None"}\n` +
      `Total cost: ${fmtM(tranche.amount + parseFloat(penalty))}\n\n` +
      `Cash available: ${fmtM(GameState.balance.cash)}`,
      [{
        label:   "Retire Debt",
        style:   "btn-danger",
        onClick: () => {
          const result = Financials.retireDebt(trancheId);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) renderAll();
        },
      }]
    );
  }

  function handleIssueDebt() {
    const amountEl = el("input-debt-amount");
    const yearsEl  = el("input-debt-years");
    if (!amountEl || !yearsEl) return;

    const amount = parseFloat(amountEl.value);
    const years  = parseInt(yearsEl.value);

    if (isNaN(amount) || amount <= 0) {
      showToast("Enter a valid amount", "error"); return;
    }
    if (isNaN(years) || years < 1 || years > 30) {
      showToast("Enter a valid term (1–30 years)", "error"); return;
    }

    const rate = Market.getCurrentBorrowingRate();
    showModal(
      "Issue New Debt",
      `Amount: ${fmtM(amount)}\n` +
      `Term: ${years} years\n` +
      `Rate: ${fmt(rate, 2)}% (base ${fmt(GameState.market.baseInterestRate, 2)}% + spread ${fmt(GameState.credit.spread, 2)}%)\n` +
      `Annual interest cost: ${fmtM(amount * rate / 100)}\n` +
      `Tranches used: ${GameState.debtTranches.length}/10`,
      [{
        label:   `Issue at ${fmt(rate, 2)}%`,
        style:   "btn-primary",
        onClick: () => {
          const result = Financials.issueDebt(amount, years);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) { amountEl.value = ""; renderAll(); }
        },
      }]
    );
  }

  // ----------------------------------------------------------
  // PLAYER ACTIONS — Equity
  // ----------------------------------------------------------
  function handleIssueEquity() {
    const sharesEl = el("input-equity-shares");
    if (!sharesEl) return;
    const shares = parseFloat(sharesEl.value);
    if (isNaN(shares) || shares <= 0) {
      showToast("Enter a valid number of shares", "error"); return;
    }

    const price    = GameState.company.sharePrice;
    const discount = 0.05;
    const issueP   = price * (1 - discount);
    const proceeds = shares * issueP;

    showModal(
      "Issue New Equity",
      `Shares: ${fmt(shares, 1)}M\n` +
      `Issue price: ${fmtPS(issueP)} (5% discount to ${fmtPS(price)})\n` +
      `Gross proceeds: ${fmtM(proceeds)}\n` +
      `Dilution: existing shareholders diluted ~${fmt(shares / GameState.company.sharesOutstanding * 100, 1)}%\n\n` +
      `New shares outstanding: ${fmt(GameState.company.sharesOutstanding + shares, 1)}M`,
      [{
        label:   "Issue Shares",
        style:   "btn-primary",
        onClick: () => {
          const result = Financials.issueEquity(shares);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) { sharesEl.value = ""; renderAll(); }
        },
      }]
    );
  }

  function handleBuyback() {
    const sharesEl = el("input-buyback-shares");
    if (!sharesEl) return;
    const shares = parseFloat(sharesEl.value);
    if (isNaN(shares) || shares <= 0) {
      showToast("Enter a valid number of shares", "error"); return;
    }
    const cost = shares * GameState.company.sharePrice;
    showModal(
      "Share Buyback",
      `Shares: ${fmt(shares, 1)}M\n` +
      `Price: ${fmtPS(GameState.company.sharePrice)}\n` +
      `Total cost: ${fmtM(cost)}\n` +
      `Cash after: ${fmtM(GameState.balance.cash - cost)}\n\n` +
      `FFO/share improves as share count decreases.`,
      [{
        label:   "Buy Back Shares",
        style:   "btn-primary",
        onClick: () => {
          const result = Financials.buybackShares(shares);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) { sharesEl.value = ""; renderAll(); }
        },
      }]
    );
  }

  // ----------------------------------------------------------
  // PLAYER ACTIONS — Dividend
  // ----------------------------------------------------------
  function handleSetDividend() {
    const divEl = el("input-dividend");
    if (!divEl) return;
    const newDiv = parseFloat(divEl.value);
    if (isNaN(newDiv) || newDiv < 0) {
      showToast("Enter a valid dividend amount", "error"); return;
    }

    const old     = GameState.company.dividendPerShare;
    const change  = newDiv - old;
    const isCut   = change < -0.001;
    const isRaise = change >  0.001;

    const warning = isCut
      ? `⚠️ WARNING: Cutting the dividend will cause a significant share price drop and board pressure (+2 points).`
      : isRaise
      ? `Raising the dividend signals confidence but locks in a higher commitment.`
      : `No change from current dividend.`;

    showModal(
      "Set Quarterly Dividend",
      `Current: ${fmtPS(old)}/share/quarter ($${fmt(old * 4, 2)}/yr)\n` +
      `New: ${fmtPS(newDiv)}/share/quarter ($${fmt(newDiv * 4, 2)}/yr)\n` +
      `Change: ${change >= 0 ? "+" : ""}${fmt(change, 3)}\n` +
      `Quarterly cost: ${fmtM(newDiv * GameState.company.sharesOutstanding)}\n\n` +
      warning,
      [{
        label:   isCut ? "⚠️ Cut Dividend" : isRaise ? "Raise Dividend" : "Maintain Dividend",
        style:   isCut ? "btn-danger" : "btn-primary",
        onClick: () => {
          const result = Financials.setDividend(newDiv);
          showToast(result.message, result.success ? "success" : "error");
          if (result.success) { divEl.value = ""; renderAll(); }
        },
      }]
    );
  }

  // ----------------------------------------------------------
  // ADVANCE QUARTER — the big red button
  // ----------------------------------------------------------
  function advanceQuarter() {
    if (GameState.meta.gameOver) {
      showGameOver();
      return;
    }

    // Check for pending acquisition offer
    if (GameState._pendingOffer) {
      const offer = GameState._pendingOffer;
      showModal(
        `⏰ Offer Expiring: ${offer.propertyName}`,
        `The acquisition offer of ${fmtM(offer.offerPrice)} (${offer.premium}% premium) expires this quarter.\n\nAccept or decline before advancing?`,
        [
          {
            label:   `Accept ${fmtM(offer.offerPrice)}`,
            style:   "btn-primary",
            onClick: () => {
              const result = Properties.sellProperty(offer.propertyId);
              if (result.success) {
                // Override with offer price
                GameState.balance.cash = fmt(
                  GameState.balance.cash - result.salePrice + offer.offerPrice
                );
                showToast(`Accepted offer: ${fmtM(offer.offerPrice)}`, "success");
              }
              GameState._pendingOffer = null;
              doAdvanceQuarter();
            },
          },
          {
            label:   "Decline Offer",
            style:   "btn-secondary",
            onClick: () => {
              GameState._pendingOffer = null;
              doAdvanceQuarter();
            },
          },
        ]
      );
      return;
    }

    doAdvanceQuarter();
  }

  function doAdvanceQuarter() {
    // Run the quarter
    const quarterResult = Financials.runQuarter();
    const boardResult   = Board.evaluateQuarter();
    const report        = Board.generateEarningsReport(quarterResult, boardResult);

    // Render everything
    renderAll(report);

    // Scroll to earnings report
    const reportEl = el("earnings-report");
    if (reportEl) reportEl.scrollIntoView({ behavior: "smooth", block: "start" });

    // Check game over
    if (GameState.meta.gameOver) {
      setTimeout(showGameOver, 1200);
    }

    // Show market cycle change if it happened
    if (quarterResult.marketResult?.cycleResult?.cycleChanged) {
      const cycle = quarterResult.marketResult.cycleResult;
      setTimeout(() => {
        showToast(`Market shift: ${cycle.label} — ${cycle.description}`, "warning");
      }, 800);
    }
  }

  // ----------------------------------------------------------
  // GAME OVER SCREEN
  // ----------------------------------------------------------
  function showGameOver() {
    const overlay = el("gameover-overlay");
    if (!overlay) return;

    setText("gameover-reason", GameState.meta.gameOverReason);
    setText("gameover-quarters", `You survived ${GameState.meta.totalQuarters} quarters (${GameState.meta.year} years)`);
    setText("gameover-ffo",   fmtPS(GameState.ratios.ffoPerShare));
    setText("gameover-occ",   fmtPct(GameState.ratios.occupancyPortfolio));
    setText("gameover-d2a",   fmtPct(GameState.ratios.debtToAssets));
    setText("gameover-props", `${GameState.portfolio.length} properties`);

    overlay.classList.remove("hidden");
  }

  // ----------------------------------------------------------
  // NEW GAME
  // ----------------------------------------------------------
  function newGame() {
    // Reset meta
    GameState.meta.quarter       = 1;
    GameState.meta.year          = 1;
    GameState.meta.totalQuarters = 0;
    GameState.meta.gameOver      = false;
    GameState.meta.gameOverReason= "";
    GameState.meta.started       = true;

    // Reset company
    GameState.company.sharePrice         = 20.00;
    GameState.company.sharesOutstanding  = 50;
    GameState.company.marketCap          = 1000;
    GameState.company.dividendPerShare   = 0.30;
    GameState.company.dividendHistory    = [];
    GameState.company.dividendCutQuarters= 0;

    // Reset balance
    GameState.balance.cash = 50;

    // Reset debt
    GameState.debtTranches = [
      { id: "d001", amount: 200, rate: 5.0, maturityQuarter: 2, maturityYear: 4, quartersUntilMaturity: 13, label: "5.0% Sr Notes due Y4Q2" },
      { id: "d002", amount: 200, rate: 5.5, maturityQuarter: 4, maturityYear: 6, quartersUntilMaturity: 23, label: "5.5% Sr Notes due Y6Q4" },
    ];

    // Reset history and logs
    GameState.history  = [];
    GameState.eventLog = [];
    GameState._pendingOffer = null;

    // Re-initialise all modules
    Market.init();
    Properties.init();
    Board.init();
    Events.init();
    Financials.init();
    Charts.init();

    // Hide overlays
    const go = el("gameover-overlay");
    const st = el("start-overlay");
    if (go) go.classList.add("hidden");
    if (st) st.classList.add("hidden");

    // Initial render
    renderAll();
    showToast("New game started. Good luck, CEO.", "success");
  }

  // ----------------------------------------------------------
  // INITIALISE UI
  // ----------------------------------------------------------
  function init() {
    // Wire up advance quarter button
    const advBtn = el("btn-advance-quarter");
    if (advBtn) advBtn.addEventListener("click", advanceQuarter);

    // Wire up new game button
    const ngBtn = el("btn-new-game");
    if (ngBtn) ngBtn.addEventListener("click", newGame);

    const ngBtn2 = el("btn-new-game-go");
    if (ngBtn2) ngBtn2.addEventListener("click", newGame);

    // Wire up capital action buttons
    const debtBtn = el("btn-issue-debt");
    if (debtBtn) debtBtn.addEventListener("click", handleIssueDebt);

    const eqBtn = el("btn-issue-equity");
    if (eqBtn) eqBtn.addEventListener("click", handleIssueEquity);

    const bbBtn = el("btn-buyback");
    if (bbBtn) bbBtn.addEventListener("click", handleBuyback);

    const divBtn = el("btn-set-dividend");
    if (divBtn) divBtn.addEventListener("click", handleSetDividend);

    // Modal close on overlay click
    const overlay = el("modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Show start screen
    const startOverlay = el("start-overlay");
    if (startOverlay) startOverlay.classList.remove("hidden");

    Charts.init();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    newGame,
    renderAll,
    showModal,
    closeModal,
    showToast,
    showGameOver,
    advanceQuarter,
    confirmBuyProperty,
    confirmSellProperty,
    confirmRetireDebt,
    handleIssueDebt,
    handleIssueEquity,
    handleBuyback,
    handleSetDividend,
  };

})();

// Boot when DOM is ready
document.addEventListener("DOMContentLoaded", UI.init);
