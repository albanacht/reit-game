// ============================================================
// ui.js — Game interface, rendering, player actions
// REIT Simulator Game
// ============================================================

window.UI = (function() {

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
    if (cashEl) {
      if (b.cash < 0)  cashEl.className = "text-red";
      else if (b.cash < 10) cashEl.className = "text-red";
      else if (b.cash < 25) cashEl.className = "text-yellow";
      else cashEl.className = "text-green";
      // Show overdraft warning
      if (b.cash < 0) {
        cashEl.textContent = fmtM(b.cash) + " ⚠ OVERDRAFT";
      }
    }
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

  // BOARD ATTITUDES PANEL
  // STAFF ROSTER + TALENT MARKET
  function renderStaff() {
    var roster = el("staff-roster");
    var market = el("talent-market");
    if (!roster || !market) return;

    // Roster of hired staff — court-style cards with portrait
    if (GameState.staff.length === 0) {
      roster.innerHTML = '<p class="text-muted" style="font-size:12px">No staff hired yet. Browse the talent market below.</p>';
    } else {
      var rh = "";
      GameState.staff.forEach(function(s) {
        var traitClass = Staff.traitColor(s);
        var traitTxt   = Staff.traitLabel(s);
        var traitDesc  = Staff.traitDesc(s);
        rh += '<div class="staff-row">' +
          '<img class="staff-portrait" src="assets/staff/' + (s.portrait || "port1.png") + '" alt="' + s.name + '">' +
          '<div class="staff-info">' +
            '<div class="staff-name-row"><span class="staff-name">' + s.name + '</span><span class="staff-stars">' + (s.stars || "") + '</span></div>' +
            '<div class="staff-title">' + s.title + '</div>' +
            '<div class="staff-trait ' + traitClass + '">' + traitTxt + (traitDesc ? ' — <span class="text-muted">' + traitDesc + '</span>' : '') + '</div>' +
          '</div>' +
          '<div class="staff-right">' +
            '<div class="staff-cost">$' + fmt(s.salary, 2) + 'M/q</div>' +
            '<button class="btn btn-sm btn-danger" onclick="UI.fireStaff(\'' + s.roleId + '\')">Fire</button>' +
          '</div>' +
          '</div>';
      });
      roster.innerHTML = rh;
    }

    // Talent market — grouped by role, 3 candidates each
    var tm = GameState._talentMarket || [];
    if (tm.length === 0) {
      market.innerHTML = '<p class="text-muted" style="font-size:12px">All roles filled. Fire someone to see new candidates next year.</p>';
      return;
    }
    // Group candidates by role, preserving global index for hire()
    var byRole = {};
    tm.forEach(function(c, i) {
      (byRole[c.roleId] = byRole[c.roleId] || []).push({ c: c, i: i });
    });
    var mh = "";
    Object.keys(byRole).forEach(function(roleId) {
      var role = Staff.ROLES[roleId];
      mh += '<div class="talent-role-header">' + role.title + ' <span class="text-muted">— ' + role.unlocks + '</span></div>';
      byRole[roleId].forEach(function(entry) {
        var c = entry.c, i = entry.i;
        mh += '<div class="candidate-card">' +
          '<img class="candidate-portrait" src="assets/staff/' + (c.portrait || "port1.png") + '" alt="' + c.name + '">' +
          '<div class="candidate-body">' +
            '<div class="candidate-head">' +
              '<span class="candidate-title">' + c.name + ' <span class="staff-stars">' + (c.stars || "") + '</span></span>' +
              '<span class="candidate-salary">$' + fmt(c.salary, 2) + 'M/q</span>' +
            '</div>' +
            '<div class="candidate-hint">"' + c.hint + '"</div>' +
            '<button class="btn btn-sm btn-primary" onclick="UI.hireStaff(' + i + ')">Hire — $' + fmt(c.salary,2) + 'M/q</button>' +
          '</div>' +
          '</div>';
      });
    });
    market.innerHTML = mh;
  }

  function hireStaff(marketIndex) {
    var tm = GameState._talentMarket || [];
    var candidate = tm[marketIndex];
    if (!candidate) return;
    var r = Staff.hire(candidate);
    showToast(r.message, r.success ? "success" : "error");
    if (r.success) renderAll();
  }

  function fireStaff(roleId) {
    var s = Staff.getStaff(roleId);
    if (!s) return;
    showModal("Dismiss " + s.name + "?",
      "Role: " + s.title + "\n" +
      "Severance: $" + fmt(s.salary, 2) + "M (one quarter)\n\n" +
      "WARNING: Firing removes all functions this role unlocks. " +
      "Any in-progress benefits will stop.",
      [{ label: "Confirm Dismissal", style: "btn-danger", onClick: function() {
        var r = Staff.fire(roleId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function renderBoardAttitudes() {
    var container = el("board-attitudes-list");
    var capEl     = el("ba-capital-display");
    if (!container) return;

    var directors = GameState.board.directors;
    if (!directors || directors.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:11px">Start game to see board.</p>';
      return;
    }

    var names = { williams:"Williams", chen:"Chen", okafor:"Okafor", petrova:"Petrova", hassan:"Hassan" };
    var html = "";
    directors.forEach(function(d) {
      var att      = Math.round(d.attitude * 10) / 10;
      var pct      = (d.attitude / 10) * 100;
      var color    = d.attitude < 3 ? "#ef4444" : d.attitude >= 7 ? "#22c55e" : "#f59e0b";
      var hostile  = d.attitude < 3 ? " 🔴" : "";
      html += '<div class="ba-row">' +
        '<span class="ba-name">' + (names[d.id] || d.id) + hostile + '</span>' +
        '<div class="ba-bar"><div class="ba-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<span class="ba-score" style="color:' + color + '">' + fmt(att, 1) + '</span>' +
        '</div>';
    });
    container.innerHTML = html;

    if (capEl) {
      var cap = GameState.board.politicalCapital || 0;
      var max = GameState.board.maxCapital || 5;
      var dots = "";
      for (var i = 0; i < max; i++) dots += i < cap ? "●" : "○";
      capEl.textContent = dots + " (" + cap + "/" + max + ")";
    }
  }

  // Jenkins maturity warning: fires when a tranche matures within 2 quarters
  // and current cash can't cover it.
  function getJenkinsMaturityWarning() {
    if (!GameState.debtTranches || GameState.debtTranches.length === 0) return null;
    var soon = GameState.debtTranches.filter(function(t) {
      return t.quartersUntilMaturity > 0 && t.quartersUntilMaturity <= 2;
    });
    if (soon.length === 0) return null;
    var totalDue = soon.reduce(function(sum, t) { return sum + t.amount; }, 0);
    if (GameState.balance.cash >= totalDue) return null;
    var shortfall = fmt(totalDue - GameState.balance.cash);
    var q = soon[0].quartersUntilMaturity;
    return "$" + fmt(totalDue) + "M of debt matures within " + q + " quarter" + (q === 1 ? "" : "s") +
           " and we're $" + shortfall + "M short. Issue debt now while our rating holds, or sell an asset before we're forced to at fire-sale prices.";
  }

  // MARKET CONDITIONS PANEL
  function renderMarketConditions() {
    var container = el("market-conditions-list");
    if (!container) return;

    var capRates  = GameState.market.capRates;
    // Use stored baseline or current rates as baseline if no history
    var baselines = GameState.market.baselineCapRates || {
      office: 6.1, industrial: 5.0, multifamily: 5.5, retail: 6.6
    };
    var sectors   = ["office", "industrial", "multifamily", "retail"];
    var labels    = { office:"Office", industrial:"Industrial", multifamily:"Multifamily", retail:"Retail" };

    var html = "";

    // Jenkins advisory — maturity shortfall warning (1-2 quarters out)
    var jenkinsWarning = getJenkinsMaturityWarning();
    if (jenkinsWarning) {
      html += '<div class="jenkins-warning">⚠ <strong>Jenkins:</strong> ' + jenkinsWarning + '</div>';
    }

    sectors.forEach(function(s) {
      // Average cap rate across locations for this sector
      var avg = (capRates[s].tier1 + capRates[s].tier2 + capRates[s].suburban) / 3;
      avg = Math.round(avg * 100) / 100;
      var base = baselines[s];
      var diff = avg - base;

      var icon, signal;
      if (diff > 1.5)       { icon = "🔴"; signal = "Distressed — buy opportunity"; }
      else if (diff > 0.5)  { icon = "🟡"; signal = "Weakening — values falling"; }
      else if (diff > -0.5) { icon = "🔵"; signal = "Stable"; }
      else                   { icon = "🟢"; signal = "Booming — values rising"; }

      var arrow = diff > 0.1 ? "↑" : diff < -0.1 ? "↓" : "≈";
      var rateColor = diff > 0.5 ? "text-red" : diff < -0.5 ? "text-green" : "";

      html += '<div class="mc-row">' +
        '<span class="mc-icon">' + icon + '</span>' +
        '<span class="mc-sector">' + labels[s] + '</span>' +
        '<span class="mc-rate ' + rateColor + '">' + fmt(avg, 1) + '% ' + arrow + '</span>' +
        '<span class="mc-signal">' + signal + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  // NEW: Goals panel — live green/red indicators
  function renderGoalsPanel() {
    var container = el("goals-list");
    var yearLabel = el("goals-year-label");
    if (!container) return;
    var goals = GameState.board.currentGoals;
    if (!goals || goals.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:12px">Goals set after Year 1.</p>';
      return;
    }
    if (yearLabel) yearLabel.textContent = "Year " + GameState.meta.year + " Targets";
    var html = "";
    goals.forEach(function(g) {
      var met = false;
      var r = GameState.ratios;
      var c = GameState.company;
      if (g.key === "dividendCoverage")   met = r.dividendCoverage >= g.threshold;
      if (g.key === "dividendPerShare")   met = c.dividendPerShare >= g.threshold;
      if (g.key === "occupancyPortfolio") met = r.occupancyPortfolio >= g.threshold;
      if (g.key === "debtToAssets")       met = r.debtToAssets <= g.threshold;
      if (g.key === "ffoGrowth")          met = (GameState.board.thresholds.ffoGrowth || 0) >= g.threshold;
      if (g.key === "interestCoverage")   met = r.interestCoverage >= g.threshold;
      if (g.key === "creditRating") {
        var order = ["CCC","B","BB","BBB","A","AA","AAA"];
        met = order.indexOf(GameState.credit.rating) >= order.indexOf(g.threshold);
      }
      var color = met ? "text-green" : "text-red";
      var icon  = met ? "✅" : "❌";
      html += '<div class="goal-row">' +
        '<span class="goal-icon">' + icon + '</span>' +
        '<span class="goal-metric">' + g.metric + '</span>' +
        '<span class="goal-target ' + color + '">' + g.target + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function getPropertyIndicator(p) {
    if (p.underConstruction) {
      var label = p.constructionType === "renovation" ? "Renovating" : "Repositioning";
      return { icon: "🔨", tip: label + " — " + p.constructionQuartersLeft + " quarter(s) remaining" };
    }
    if (p.occupancy < 0.70)  return { icon: "🔴", tip: "Critical — occupancy below 70%" };
    if (p.occupancy < 0.80)  return { icon: "🟡", tip: "Needs attention — below 80%" };
    if (p.occupancy < 0.90)  return { icon: "🔵", tip: "Stable — 80-90% occupied" };
    return { icon: "🟢", tip: "Performing well — above 90%" };
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
      // Lease Up button — requires Asset Manager, grey/disabled if used this year
      var leaseUpBtn = "";
      if (p.occupancy < 0.90 && !p.underConstruction && Staff.hasRole("asset")) {
        var usedThisYear = p.leaseUpYear === GameState.meta.year;
        leaseUpBtn = usedThisYear
          ? '<button class="btn btn-sm btn-secondary" disabled style="opacity:0.4;cursor:not-allowed" title="Already leased up this year — available Year ' + (GameState.meta.year + 1) + '">✓ Leased Up</button>'
          : '<button class="btn btn-sm btn-primary" onclick="UI.leaseUp(\'' + p.id + '\')">Lease Up</button>';
      }

      // Upgrade buttons
      var upgradeHTML = "";
      if (p.underConstruction) {
        var constructionLabel = p.constructionType === "renovation" ? "🔨 Renovating" : "🔄 Repositioning";
        upgradeHTML = '<span class="upgrade-badge">' + constructionLabel + ' — ' + p.constructionQuartersLeft + 'q left</span>';
      } else {
        var canRen = Properties.canRenovate(p);
        var canRepo = Properties.canReposition(p);
        if (canRen.ok) {
          var renCost = fmt(p.currentValue * 0.10, 1);
          upgradeHTML += '<button class="btn btn-sm btn-upgrade" onclick="UI.confirmRenovate(\'' + p.id + '\')">🔨 Renovate $' + renCost + 'M</button>';
        } else if (p.renovated) {
          upgradeHTML += '<span class="upgrade-badge upgrade-done">✓ Renovated</span>';
        }
        if (canRepo.ok) {
          var repoCost = fmt(p.currentValue * 0.15, 1);
          upgradeHTML += '<button class="btn btn-sm btn-upgrade-repo" onclick="UI.confirmReposition(\'' + p.id + '\')">🔄 Reposition $' + repoCost + 'M</button>';
        } else if (p.repositioned) {
          upgradeHTML += '<span class="upgrade-badge upgrade-done">✓ Repositioned</span>';
        }
      }
      var indicator = getPropertyIndicator(p);
      html += '<div class="property-card">' +
        '<div class="prop-header">' +
        '<span class="prop-indicator" title="' + indicator.tip + '">' + indicator.icon + '</span>' +
        '<span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span></div>' +
        '<div class="prop-stats">' +
        '<span>Value: <strong>' + fmtM(p.currentValue) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong class="' + oc + '">' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>G/L: <strong class="' + gc + '">' + (gl >= 0 ? "+" : "") + gl + 'M</strong></span>' +
        '</div><div class="prop-actions">' +
        leaseUpBtn +
        upgradeHTML +
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
      var megaTag = p.isMega
        ? '<div class="mega-flag">★ Off-market mega-asset · single tenant: ' + (p.megaTenant || "anchor") + '</div>'
        : '';
      html += '<div class="property-card ' + (ca ? "" : "prop-unaffordable") + (p.isMega ? " prop-mega" : "") + '">' +
        '<div class="prop-header"><span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span></div>' +
        megaTag +
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

  // NEW: Updated to show term-adjusted rates
  function renderCapitalActions() {
    var baseRate = Market.getCurrentBorrowingRate();
    var getRateStr = function(y) { return Financials.getCurrentBorrowingRateForTerm ? fmt(Financials.getCurrentBorrowingRateForTerm(y), 2) : fmt(baseRate, 2); };
    setText("action-borrow-rate",
      "1yr: " + getRateStr(1) + "% | " +
      "3yr: " + getRateStr(3) + "% | " +
      "5yr: " + getRateStr(5) + "% | " +
      "7yr: " + getRateStr(7) + "% | " +
      "10yr: " + getRateStr(10) + "%"
    );
    // Update dropdown to show rates next to each option
    var sel = el("input-debt-years");
    if (sel) {
      [[1,"1yr"],[2,"2yr"],[3,"3yr"],[5,"5yr"],[7,"7yr"],[10,"10yr"]].forEach(function(t, i) {
        if (sel.options[i]) {
          sel.options[i].text = t[1] + " — " + getRateStr(t[0]) + "%";
        }
      });
    }
    setText("action-div-current", "Current: $" + fmt(GameState.company.dividendPerShare, 2) + "/share/qtr");
    var equityUsedThisYear = GameState.company.equityIssuanceYear === GameState.meta.year;
    var debtCooldown = GameState.company.debtIssuanceQuarter > 0 ?
      Math.max(0, 2 - (GameState.meta.totalQuarters - GameState.company.debtIssuanceQuarter)) : 0;
    setText("action-shares-out", "Shares: " + fmt(GameState.company.sharesOutstanding, 1) + "M" +
      (equityUsedThisYear ? " ⚠ Equity used this year — available Year " + (GameState.meta.year + 1) : ""));
    setText("action-debt-cooldown", debtCooldown > 0 ?
      "⚠ Debt on cooldown — available in " + debtCooldown + " quarter(s)" : "");
    setText("action-cash-avail",  "Cash available: " + fmtM(GameState.balance.cash));
  }

  function renderAll(report) {
    renderHeader();
    renderPnL();
    renderRatios();
    renderBalanceSheet();
    renderDebtPanel();
    renderGoalsPanel();
    renderBoardAttitudes();
    renderMarketConditions();
    renderStaff();
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
    if (GameState.meta.gameOver) {
      setTimeout(showGameOver, 400);
    } else if (GameState._pendingBoardMeeting) {
      GameState._pendingBoardMeeting = false;
      setTimeout(showBoardMeeting, 400);
    }
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
        if (r.success) {
          GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear || 0) + 1;
          renderAll();
        }
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

  // NEW: Lease Up action
  function confirmRenovate(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    var cost = fmt(prop.currentValue * 0.10, 1);
    showModal("Renovate: " + prop.name,
      "Cost: $" + cost + "M (10% of value)\n" +
      "Duration: 1 quarter offline (zero NOI)\n" +
      "Effect: NOI +15% permanently | Occupancy +" + fmt(Math.min(8, (0.97 - prop.occupancy) * 100), 0) + "% on completion\n\n" +
      "Cash available: " + fmtM(GameState.balance.cash) + "\n" +
      "Current NOI: " + fmtM(prop.annualNOI) + "/yr — After: " + fmtM(prop.annualNOI * 1.15) + "/yr\n\n" +
      "Payback: ~2.5-3 years from NOI gain + value appreciation.",
      [{ label: "Start Renovation — $" + cost + "M", style: "btn-primary", onClick: function() {
        var r = Properties.startRenovation(propertyId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function confirmReposition(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    var targets = Properties.getRepositionTargets(prop);
    if (targets.length === 0) { showToast("No repositioning options available.", "error"); return; }
    var cost = fmt(prop.currentValue * 0.15, 1);

    var targetText = targets.map(function(t) {
      var newCapRate = GameState.market.capRates[t][prop.location];
      var newNOI = fmt(prop.currentValue * newCapRate / 100, 1);
      return t + " (projected NOI: $" + newNOI + "M/yr @ " + newCapRate + "% cap rate)";
    }).join("\n");

    showModal("Reposition: " + prop.name,
      "Current: " + prop.sector + " · " + prop.location + " | NOI: " + fmtM(prop.annualNOI) + "/yr\n\n" +
      "Available targets:\n" + targetText + "\n\n" +
      "Cost: $" + cost + "M (15% of value)\n" +
      "Duration: 2 quarters offline\n" +
      "Cash available: " + fmtM(GameState.balance.cash),
      targets.map(function(t) {
        return {
          label: "Reposition to " + t.charAt(0).toUpperCase() + t.slice(1),
          style: "btn-primary",
          onClick: function() {
            var r = Properties.startRepositioning(propertyId, t);
            showToast(r.message, r.success ? "success" : "error");
            if (r.success) renderAll();
          }
        };
      })
    );
  }

  function leaseUp(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    if (prop.occupancy >= 0.90) { showToast("Occupancy already above 90% — no lease up needed.", "info"); return; }
    // Once per property per year
    if (prop.leaseUpYear === GameState.meta.year) {
      showToast("Already leased up " + prop.name + " this year. Wait until next year.", "error"); return;
    }
    var cost = Math.round(prop.annualNOI * 0.12 * 10) / 10;
    var boost = prop.occupancy < 0.65 ? 0.08 : prop.occupancy < 0.75 ? 0.06 : prop.occupancy < 0.85 ? 0.05 : 0.03;
    showModal("Lease Up: " + prop.name,
      "Current occupancy: " + fmtPct(prop.occupancy) + "\n" +
      "Expected boost: +" + fmt(boost * 100, 0) + "% immediately\n" +
      "Cost: $" + cost + "M (12% of annual NOI)\n" +
      "Cash available: " + fmtM(GameState.balance.cash) + "\n\n" +
      "Covers broker commissions, tenant improvements and free rent periods.",
      [{ label: "Lease Up — $" + cost + "M", style: "btn-primary", onClick: function() {
        if (GameState.balance.cash < cost) { showToast("Insufficient cash.", "error"); return; }
        GameState.balance.cash = Math.round((GameState.balance.cash - cost) * 100) / 100;
        prop.occupancy = Math.min(0.97, Math.round((prop.occupancy + boost) * 1000) / 1000);
        showToast(prop.name + " occupancy boosted to " + fmtPct(prop.occupancy), "success");
        GameState.board.leaseUpsThisYear = (GameState.board.leaseUpsThisYear || 0) + 1;
        prop.leaseUpYear = GameState.meta.year;
        renderAll();
      }}]);
  }

  function handleIssueDebt() {
    var amtEl = el("input-debt-amount"), yrEl = el("input-debt-years");
    var amount = amtEl ? parseFloat(amtEl.value) : NaN;
    var years  = yrEl  ? parseInt(yrEl.value)    : NaN;
    if (isNaN(amount) || amount <= 0)            { showToast("Enter a valid amount", "error"); return; }
    if (isNaN(years) || years < 1 || years > 10) { showToast("Select a valid term.", "error"); return; }
    // NEW: term-adjusted rate
    var rate = Financials.getCurrentBorrowingRateForTerm ? Financials.getCurrentBorrowingRateForTerm(years) : Market.getCurrentBorrowingRate();
    var maxIssuance = Math.round(GameState.balance.totalAssets * 0.20 * 10) / 10;
    showModal("Issue New Debt",
      "Amount: " + fmtM(amount) + "  |  Term: " + years + " yrs  |  Rate: " + fmt(rate, 2) + "%\n" +
      "Annual interest: " + fmtM(amount * rate / 100) + "  |  Tranches: " + GameState.debtTranches.length + "/10\n" +
      "Max single issuance: " + fmtM(maxIssuance) + " (20% of assets)",
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
    var maxShares = fmt(GameState.company.sharesOutstanding * 0.05, 2);
    var cost = shares * GameState.company.sharePrice;
    var alreadyDone = GameState.company.lastBuybackYear === GameState.meta.year;
    showModal("Share Buyback",
      "Shares: " + fmt(shares, 1) + "M  |  Cost: " + fmtM(cost) + "\n" +
      "Cash after: " + fmtM(GameState.balance.cash - cost) + "\n\n" +
      "Limit: max 5% of float per year (" + maxShares + "M shares).\n" +
      (alreadyDone ? "⚠ Already used this year — next available Year " + (GameState.meta.year + 1) + "." : "Available this year."),
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
    var isCut    = newDiv < old - 0.001;
    var startDiv = GameState.board.startYearDividend || 0.10;
    var minDiv   = GameState.meta.year <= 1 ? fmt(old, 2) : fmt(startDiv * 0.50, 2);
    var floorNote = GameState.meta.year <= 1
      ? "\n⚠ Year 1: dividend is locked — no cuts allowed."
      : "\nFloor this year: $" + minDiv + "/share (50% of year-start $" + fmt(startDiv,2) + ")";
    var warn = isCut
      ? "WARNING: Cutting dividend causes share price drop and board pressure." + floorNote
      : newDiv > old + 0.001 ? "Raising dividend signals confidence." : "No change.";
    showModal("Set Quarterly Dividend",
      "Current: " + fmtPS(old) + "  →  New: " + fmtPS(newDiv) + "\nQuarterly cost: " + fmtM(newDiv * GameState.company.sharesOutstanding) + "\n\n" + warn,
      [{ label: isCut ? "Cut Dividend" : "Set Dividend", style: isCut ? "btn-danger" : "btn-primary", onClick: function() {
        var r = Financials.setDividend(newDiv);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (divEl) divEl.value = ""; renderAll(); }
      }}]);
  }

  // ----------------------------------------------------------
  // BOARD MEETING SYSTEM
  // ----------------------------------------------------------

  var _boardMeetingState = {
    mandates:       [],
    currentIndex:   0,
    voteResult:     null,
    earnedCapital:  [],
    mandateResults: [],
    typingTimer:    null,
  };

  function showBoardMeeting() {
    // Generate mandates and evaluate last year
    var capital = Board.earnPoliticalCapital();
    var mandates = Board.generateMandates();
    var mandateResults = Board.evaluateMandates();

    _boardMeetingState.mandates       = mandates;
    _boardMeetingState.currentIndex   = 0;
    _boardMeetingState.earnedCapital  = capital;
    _boardMeetingState.mandateResults = mandateResults;

    var overlay = el("board-meeting-overlay");
    if (overlay) overlay.classList.remove("hidden");

    renderBoardMeetingHeader();
    showCurrentMandate();
  }

  function renderBoardMeetingHeader() {
    var dirs = Board.DIRECTORS;
    var headerEl = el("bm-directors-row");
    if (!headerEl) return;

    headerEl.innerHTML = dirs.map(function(d) {
      var ds   = Board.getDirectorState(d.id);
      var att  = ds ? ds.attitude : 5;
      var expr = Board.getExpression(att);
      var stars = "";
      for (var i = 0; i < 10; i++) {
        stars += i < Math.round(att) ? "★" : "☆";
      }
      var isCurrent = _boardMeetingState.mandates[_boardMeetingState.currentIndex] &&
        _boardMeetingState.mandates[_boardMeetingState.currentIndex].directorId === d.id;

      return '<div class="bm-director ' + (isCurrent ? "bm-director-active" : "") + '" id="bm-dir-' + d.id + '">' +
        '<div class="bm-portrait-wrap">' +
        (function() {
          var dims = { williams:{w:987,h:253}, chen:{w:949,h:263}, okafor:{w:938,h:266}, petrova:{w:950,h:262}, hassan:{w:949,h:263} };
          var dim  = dims[d.id] || {w:949,h:263};
          var containerH = 130;
          var scale = containerH / dim.h;
          var scaledW = Math.round(dim.w * scale);
          var xPos = expr === "neutral" ? "0%" : expr === "happy" ? "33.33%" : expr === "angry" ? "66.66%" : "100%";
          return '<div class="bm-portrait" id="bm-sprite-' + d.id + '" style="background-image:url(\'' + d.image + '\');background-size:' + scaledW + 'px ' + containerH + 'px;background-position:' + xPos + ' 0%;background-repeat:no-repeat;"></div>';
        })() +
        '</div>' +
        '<div class="bm-dir-name">' + d.name.split(" ")[1] + '</div>' +
        '<div class="bm-dir-stars ' + (att < 3 ? "text-red" : att >= 7 ? "text-green" : "text-yellow") + '">' + fmt(att, 1) + '/10</div>' +
        '</div>';
    }).join("");
  }

  function showCurrentMandate() {
    var mandates = _boardMeetingState.mandates;
    var idx      = _boardMeetingState.currentIndex;

    if (idx >= mandates.length) {
      showBoardVote();
      return;
    }

    var mandate = mandates[idx];
    var director = Board.DIRECTORS.find(function(d) { return d.id === mandate.directorId; });
    var ds       = Board.getDirectorState(mandate.directorId);
    var attitude = ds ? ds.attitude : 5;

    // Update header — highlight speaking director
    renderBoardMeetingHeader();

    // Set speaking director info
    setText("bm-speaker-name", director ? director.name : "");
    setText("bm-speaker-title", director ? director.title : "");
    setText("bm-mandate-counter", "Mandate " + (idx + 1) + " of " + mandates.length);
    setText("bm-capital-display", "Political Capital: " + GameState.board.politicalCapital + "/" + GameState.board.maxCapital);

    // Generate and type speech
    var speech = Board.generateSpeech(mandate.directorId, mandate, attitude);
    typeText("bm-speech-text", speech);

    // Clear previous state
    var speechEl2 = el("bm-speech-text");
    if (speechEl2) speechEl2.textContent = "";
    var voteBox = document.querySelector(".bm-vote-box");
    if (voteBox) voteBox.remove();

    // Update buttons
    var btnArea = el("bm-response-buttons");
    if (btnArea) {
      btnArea.innerHTML = "";
      var bmButtons = [
      {r:"accept",    cls:"btn-primary",   label:"Accept",       icon:"Accept",    cost:""},
      {r:"negotiate", cls:"btn-secondary",  label:"Negotiate Down",icon:"Negotiate", cost:" (1 capital)"},
      {r:"doubledown",cls:"btn-secondary",  label:"Double Down",  icon:"Double",    cost:""},
      {r:"reject",    cls:"btn-danger",     label:"Reject",       icon:"Reject",    cost:" (2 capital)"},
    ];
    var html = "";
    bmButtons.forEach(function(b) {
      var btn = document.createElement("button");
      btn.className = "btn " + b.cls + " bm-btn";
      btn.textContent = b.label + b.cost;
      btn.setAttribute("data-response", b.r);
      btn.onclick = function() { UI.boardResponse(b.r); };
      btnArea.appendChild(btn);
    });
    }

    // Update speaking director portrait to speaking expression
    var portraitDiv = el("bm-sprite-" + mandate.directorId);
    if (portraitDiv) portraitDiv.style.backgroundPosition = "100% 0%";
  }

  function boardResponse(response) {
    var mandates = _boardMeetingState.mandates;
    var idx      = _boardMeetingState.currentIndex;
    if (idx >= mandates.length) return;

    var mandate = mandates[idx];
    var capital = GameState.board.politicalCapital;

    // Check capital cost
    if (response === "negotiate" && capital < 1) {
      showToast("Insufficient political capital. Need 1.", "error"); return;
    }
    if (response === "reject" && capital < 2) {
      showToast("Insufficient political capital. Need 2.", "error"); return;
    }

    // Spend capital
    if (response === "negotiate") GameState.board.politicalCapital--;
    if (response === "reject")    GameState.board.politicalCapital -= 2;

    // Handle negotiate roll
    if (response === "negotiate") {
      var director = Board.DIRECTORS.find(function(d) { return d.id === mandate.directorId; });
      var successRate = director ? director.negotiateSuccessRate : 0.5;
      var success = Math.random() < successRate;

      if (success) {
        mandate.response = "negotiate";
        mandate.target   = mandate.target * 0.55;
        showToast("Negotiation successful! Target reduced by 45%.", "success");
      } else {
        var ds = Board.getDirectorState(mandate.directorId);
        if (ds) ds.attitude = Math.max(0, ds.attitude - 0.5);
        mandate.response = "accept"; // falls back to accept at original target
        showToast("Negotiation failed. Director is not pleased. Target unchanged.", "error");
      }
    } else {
      mandate.response = response;
    }

    // Show result feedback
    var feedback = {
      accept:     "You have accepted the mandate. Deliver on your promise.",
      negotiate:  "",
      doubledown: "Bold commitment. The director is watching closely.",
      reject:     "Mandate rejected. The director is displeased but it is removed.",
    };
    if (feedback[response]) showToast(feedback[response], "info");

    // Advance to next mandate
    _boardMeetingState.currentIndex++;
    setTimeout(function() {
      showCurrentMandate();
      renderBoardMeetingHeader();
      setText("bm-capital-display", "Political Capital: " + GameState.board.politicalCapital + "/" + GameState.board.maxCapital);
    }, 800);
  }

  function showBoardVote() {
    var voteResult = Board.conductVote();
    _boardMeetingState.voteResult = voteResult;

    var btnArea = el("bm-response-buttons");
    if (btnArea) btnArea.innerHTML = "";
    var speechEl3 = el("bm-speech-text");
    if (speechEl3) speechEl3.textContent = "";

    // Show backroom deal option if any hostile and have capital
    var hostileDirs = voteResult.votes.filter(function(v) { return v.hostile; });
    var canDeal = hostileDirs.length > 0 && GameState.board.politicalCapital >= 3;

    var voteHTML = '<div class="bm-vote-header">BOARD VOTE — Year ' + (GameState.meta.year - 1) + '</div>' +
      '<div class="bm-vote-grid">' +
      voteResult.votes.map(function(v) {
        return '<div class="bm-vote-item">' +
          '<div class="bm-vote-name">' + v.name + '</div>' +
          '<div class="bm-vote-att">' + fmt(v.attitude, 1) + '/10</div>' +
          '<div class="bm-vote-result ' + (v.hostile ? "text-red" : "text-green") + '">' +
          (v.hostile ? "⚑ HOSTILE" : "✓ CONFIDENCE") +
          (v.veto ? " (VETO)" : "") + '</div>' +
          '</div>';
      }).join("") +
      '</div>' +
      '<div class="bm-vote-summary">' +
      'Confidence: ' + voteResult.confidenceCount + ' | Hostile: ' + voteResult.hostileCount +
      (voteResult.williamsVeto ? ' | Williams VETO active — need 4 confidence' : ' | Need 3 confidence') +
      '</div>';

    typeText("bm-speech-text", voteResult.fired
      ? "The motion to remove management has passed. " + voteResult.hostileCount + " directors have lost confidence."
      : "Management retains the board's confidence. " + voteResult.confidenceCount + " votes in favour.");

    var speechEl = el("bm-speech-text");
    if (speechEl) speechEl.insertAdjacentHTML("afterend", '<div class="bm-vote-box">' + voteHTML + '</div>');

    setText("bm-speaker-name", "BOARD VOTE");
    setText("bm-speaker-title", voteResult.fired ? "Vote to remove — PASSED" : "Vote of confidence — PASSED");

    // Backroom deal button
    if (canDeal) {
      if (btnArea) btnArea.innerHTML =
        '<button class="btn btn-danger bm-btn" onclick="UI.backroomDeal()">' +
        '🤝 Backroom Deal — Reset 1 hostile director to 3 (costs 3 capital)</button>' +
        '<button class="btn btn-primary bm-btn" onclick="UI.closeBoardMeeting()">' +
        (voteResult.fired ? "Accept Termination" : "Continue to Year " + GameState.meta.year) + '</button>';
    } else {
      if (btnArea) btnArea.innerHTML =
        '<button class="btn btn-primary bm-btn" onclick="UI.closeBoardMeeting()">' +
        (voteResult.fired ? "Accept Termination" : "Continue to Year " + GameState.meta.year) + '</button>';
    }

    renderBoardMeetingHeader();
  }

  function backroomDeal() {
    var voteResult = _boardMeetingState.voteResult;
    if (!voteResult) return;
    if (GameState.board.politicalCapital < 3) { showToast("Need 3 political capital.", "error"); return; }

    // Find most hostile director (lowest attitude)
    var hostile = voteResult.votes.filter(function(v) { return v.hostile; });
    if (hostile.length === 0) return;

    hostile.sort(function(a, b) { return a.attitude - b.attitude; });
    var target = hostile[0];
    var ds = Board.getDirectorState(target.id);
    if (ds) ds.attitude = 3;
    target.hostile = false;
    target.attitude = 3;

    GameState.board.politicalCapital -= 3;
    showToast("Backroom deal done. " + target.name + " reset to 3/10.", "success");

    // Re-run vote
    var newResult = Board.conductVote();
    _boardMeetingState.voteResult = newResult;

    var voteBox = document.querySelector(".bm-vote-box");
    if (voteBox) voteBox.remove();

    showBoardVote();
  }

  function closeBoardMeeting() {
    var overlay = el("board-meeting-overlay");
    if (overlay) overlay.classList.add("hidden");

    var voteResult = _boardMeetingState.voteResult;
    if (voteResult && voteResult.fired) {
      GameState.meta.gameOver = true;
      GameState.meta.gameOverReason = "The board voted " + voteResult.hostileCount + "-" + voteResult.confidenceCount +
        " to remove you as CEO of " + GameState.company.name + " after Year " + (GameState.meta.year - 1) + ".";
      setTimeout(function() {
        showGameOver();
        var scoreData = Leaderboard.calculateScore();
        setTimeout(function() { Leaderboard.showSubmitScreen(scoreData); }, 800);
      }, 400);
    } else {
      // Reset year tracking for new year
      Board.resetYearTracking();
      // Refresh the talent market with new candidates for unfilled roles
      Staff.refreshTalentMarket();
    }
  }

  function typeText(elementId, text) {
    var e = el(elementId);
    if (!e) return;
    if (_boardMeetingState.typingTimer) clearInterval(_boardMeetingState.typingTimer);
    e.textContent = "";
    var i = 0;
    _boardMeetingState.typingTimer = setInterval(function() {
      if (i < text.length) {
        e.textContent += text[i];
        i++;
      } else {
        clearInterval(_boardMeetingState.typingTimer);
      }
    }, 18);
  }

  // ----------------------------------------------------------
  // DECISION EVENT MODAL
  // ----------------------------------------------------------
  var _currentDecision = null;

  function showDecisionEvent(evt) {
    _currentDecision = evt;
    var html = '<div class="decision-header">' + evt.headline + '</div>' +
      '<div class="decision-body">' + evt.body.replace(/\n/g,"<br>") + '</div>' +
      '<div class="decision-choices">';

    evt.choices.forEach(function(c, i) {
      var costBadge = c.costType === "capital"
        ? '<span class="cost-badge cost-capital">💡 ' + (c.cost||1) + ' Capital</span>'
        : c.costType === "cash"
        ? '<span class="cost-badge cost-cash">💰 Cash</span>'
        : '<span class="cost-badge cost-income">📉 Income</span>';

      html += '<div class="decision-choice" onclick="UI.makeDecision(' + i + ')">' +
        '<div class="choice-label">' + c.label + costBadge + '</div>' +
        '<div class="choice-detail">' + c.detail.replace(/\n/g,"<br>") + '</div>' +
        '</div>';
    });

    html += '</div>' +
      '<div class="decision-capital">💡 Political Capital: ' +
      (GameState.board.politicalCapital||0) + '/' + (GameState.board.maxCapital||5) + '</div>';

    showModal(evt.headline, "", []);
    var body = el("modal-body");
    if (body) body.innerHTML = html;
    var actions = el("modal-actions");
    if (actions) actions.innerHTML = "";
  }

  function makeDecision(choiceIndex) {
    if (!_currentDecision) return;
    var result = Decisions.applyChoice(_currentDecision, choiceIndex);
    _currentDecision = null;
    closeModal();
    if (!result.success) {
      showToast(result.message, "error");
      return;
    }
    showToast(result.message, "success");
    // Now run the quarter
    setTimeout(runQuarterAndReport, 400);
  }

  // ----------------------------------------------------------
  // MACRO EVENT POPUP — shows before earnings report for major events
  // ----------------------------------------------------------
  function showMacroEventPopup(firedEvents, callback) {
    var macroEvents = firedEvents.filter(function(e) { return e.isMacro === true; });
    if (macroEvents.length === 0) { callback(); return; }
    var body = macroEvents.map(function(e) {
      return e.headline + "\n" + e.body + "\n\nImpact: " + e.impact;
    }).join("\n\n─────────────────\n\n");
    showModal("⚡ Major Market Event — " + GameState.currentPeriodLabel(), body,
      [{ label: "Understood — Continue", style: "btn-primary", onClick: callback }]
    );
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
    // Check for decision event BEFORE quarter runs
    var decisionEvt = Decisions.checkForEvent();
    if (decisionEvt) {
      showDecisionEvent(decisionEvt);
      // Quarter will run after player closes modal via makeDecision
      // Store pending advance
      GameState._pendingAdvance = true;
      return;
    }
    runQuarterAndReport();
  }

  function runQuarterAndReport() {
    GameState._pendingAdvance = false;
    var qr = Financials.runQuarter();
    // Turn off tutorial BEFORE generating report
    if (GameState.meta.year === 2 && GameState.meta.quarter === 1) {
      GameState.meta.tutorialYear = false;
    }
    var br = Board.evaluateQuarter();
    var rp = Board.generateEarningsReport(qr, br);
    var justEndedYear = GameState.meta.quarter === 1 && GameState.meta.totalQuarters > 1;

    // NEW: Show macro event popup if any fired, then continue
    function continueAfterEvents() {
      if (justEndedYear) {
        var snap = Board.generateAnnualReport();
        renderAll(rp);
        if (GameState.meta.year === 2) {
          // Just ended Year 1 — safe year, show annual report only
          setTimeout(function() { showAnnualReport(snap); }, 600);
        } else {
          // Ended Year 2+ — show annual report, then board meeting
          GameState._pendingBoardMeeting = true;
          setTimeout(function() { showAnnualReport(snap); }, 600);
        }
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

    showMacroEventPopup(qr.firedEvents, continueAfterEvents);
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
  // NEW GAME
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

    GameState.company.sharePrice          = 10.00;
    GameState.company.sharesOutstanding   = 10;
    GameState.company.marketCap           = 100;
    GameState.company.dividendPerShare    = 0.10;
    GameState.company.dividendHistory     = [];
    GameState.company.dividendCutQuarters = 0;
    GameState.company.equityIssuanceCount    = 0;
    GameState.company.equityIssuanceYear     = 0;
    GameState.company.equitySuppressQuarters = 0;
    GameState.company.debtIssuanceQuarter    = 0;
    GameState.board.acquisitionsThisYear     = 0;
    GameState.board.leaseUpsThisYear         = 0;
    GameState.board.noOverdraftBroken        = false;
    GameState.board.noEquityBroken           = false;
    GameState.board.politicalCapital         = 2;
    GameState.board.activeMandates           = [];
    Decisions.init();
    GameState._lastTenantDistressYear = 0;
    GameState.balance.cash                = 5;

    GameState.debtTranches = [
      { id: "d001", amount: 50, rate: 5.0, maturityQuarter: 2, maturityYear: 4, quartersUntilMaturity: 13, label: "5.0% Sr Notes due Y4Q2" },
      { id: "d002", amount: 50, rate: 5.5, maturityQuarter: 4, maturityYear: 6, quartersUntilMaturity: 23, label: "5.5% Sr Notes due Y6Q4" },
    ];

    GameState.history         = [];
    GameState.eventLog        = [];
    GameState.annualSnapshots = [];
    GameState._pendingOffer   = null;

    Market.init();
    // Store baseline cap rates for market conditions indicator
    GameState.market.baselineCapRates = {
      office:      (GameState.market.capRates.office.tier1 + GameState.market.capRates.office.tier2 + GameState.market.capRates.office.suburban) / 3,
      industrial:  (GameState.market.capRates.industrial.tier1 + GameState.market.capRates.industrial.tier2 + GameState.market.capRates.industrial.suburban) / 3,
      multifamily: (GameState.market.capRates.multifamily.tier1 + GameState.market.capRates.multifamily.tier2 + GameState.market.capRates.multifamily.suburban) / 3,
      retail:      (GameState.market.capRates.retail.tier1 + GameState.market.capRates.retail.tier2 + GameState.market.capRates.retail.suburban) / 3,
    };
    Properties.init();
    Board.init();
    Staff.init();
    Events.init();
    Financials.init();
    Charts.init();

    var overlayIds = ["gameover-overlay", "start-overlay", "annual-report-overlay", "help-overlay"];
    overlayIds.forEach(function(id) {
      var o = el(id); if (o) o.classList.add("hidden");
    });

    renderAll();
    Leaderboard.renderLeaderboard("leaderboard-container");
    setTimeout(function() {
      showModal(
        "Letter from the Board of Directors",
        "Dear " + playerName + ",\n\n" +
        "The Board of Directors is pleased to appoint you as Chief Executive Officer of " + reitName + " REIT.\n\n" +
        "YEAR 1 — ORIENTATION PERIOD\n" +
        "You cannot be fired this year. However the board is scoring you silently. Failures carry forward as pressure into Year 2.\n\n" +
        "YOUR STARTING POSITION\n" +
        "▸ Cash: $5M — almost nothing. Use it wisely.\n" +
        "▸ Four properties already owned\n" +
        "▸ Debt: $100M across two tranches\n" +
        "▸ Dividend: $0.10/share/quarter\n\n" +
        "THE BOARD'S EXPECTATIONS\n" +
        "▸ USE DEBT — a REIT that avoids leverage is a savings account\n" +
        "▸ We expect debt/assets between 30-50% within two years\n" +
        "▸ Grow the portfolio aggressively — acquire properties\n" +
        "▸ Raise dividends as FFO grows — share the earnings\n" +
        "▸ Keep occupancy above 80% across all properties\n\n" +
        "You have a $1B credit facility available. Deploy it. Borrow, acquire, grow. " +
        "The board does not reward caution — it rewards results.\n\n" +
        "Press F1 anytime for help on ratios and mechanics.\n\n" +
        "— The Board of Directors",
        []
      );
    }, 400);
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
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

    document.addEventListener("keydown", function(e) {
      if (e.key === "F1")     { e.preventDefault(); showHelp(); }
      if (e.key === "Escape") { closeHelp(); closeModal(); }
    });

    var mo = el("modal-overlay");
    if (mo) mo.addEventListener("click", function(e) { if (e.target === mo) closeModal(); });
    var ho = el("help-overlay");
    if (ho) ho.addEventListener("click", function(e) { if (e.target === ho) closeHelp(); });

    Charts.init();

    var so = el("start-overlay");
    if (so) so.classList.remove("hidden");

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
    leaseUp:             leaseUp,
    confirmRenovate:     confirmRenovate,
    confirmReposition:   confirmReposition,
    hireStaff:           hireStaff,
    fireStaff:           fireStaff,
    makeDecision:        makeDecision,
    showBoardMeeting:    showBoardMeeting,
    boardResponse:       boardResponse,
    backroomDeal:        backroomDeal,
    closeBoardMeeting:   closeBoardMeeting,
  };

}());

document.addEventListener("DOMContentLoaded", UI.init);
