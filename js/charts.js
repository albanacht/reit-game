// ============================================================
// charts.js — All charts and visualizations
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file only draws charts, it never modifies GameState
// - All charts are drawn on <canvas> elements in index.html
// - Call Charts.renderAll() after each quarter to refresh
// - Each chart function is independent — safe to call individually
// - Uses vanilla Canvas API only, no external libraries needed
// ============================================================

window.Charts = (() => {

  // ----------------------------------------------------------
  // DESIGN TOKENS
  // Change colors here, they flow to all charts
  // ----------------------------------------------------------
  const COLORS = {
    green:       "#22c55e",
    yellow:      "#f59e0b",
    red:         "#ef4444",
    darkRed:     "#7f1d1d",
    blue:        "#3b82f6",
    purple:      "#8b5cf6",
    teal:        "#14b8a6",
    orange:      "#f97316",
    gray:        "#94a3b8",
    lightGray:   "#e2e8f0",
    darkGray:    "#334155",
    background:  "#0f172a",
    surface:     "#1e293b",
    text:        "#f1f5f9",
    textMuted:   "#94a3b8",
    gridLine:    "rgba(148,163,184,0.15)",
  };

  const SECTOR_COLORS = {
    office:      "#3b82f6",
    industrial:  "#f59e0b",
    multifamily: "#22c55e",
    retail:      "#ef4444",
  };

  const LOCATION_COLORS = {
    tier1:    "#8b5cf6",
    tier2:    "#14b8a6",
    suburban: "#f97316",
  };

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n, decimals = 1) {
    return Number(n).toFixed(decimals);
  }

  function getCanvas(id) {
    return document.getElementById(id);
  }

  function getCtx(id) {
    const canvas = getCanvas(id);
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  // Clear and set up a canvas
  function prepareCanvas(id) {
    const canvas = getCanvas(id);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    // Retina support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, w: rect.width, h: rect.height };
  }

  // Draw grid lines and y-axis labels
  function drawGrid(ctx, x0, y0, w, h, minVal, maxVal, steps, prefix = "$", suffix = "M") {
    ctx.strokeStyle = COLORS.gridLine;
    ctx.fillStyle   = COLORS.textMuted;
    ctx.font        = "11px monospace";
    ctx.textAlign   = "right";
    ctx.lineWidth   = 1;

    for (let i = 0; i <= steps; i++) {
      const val = minVal + (maxVal - minVal) * (i / steps);
      const y   = y0 + h - (h * i / steps);

      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();

      ctx.fillText(`${prefix}${fmt(val, 0)}${suffix}`, x0 - 6, y + 4);
    }
  }

  // Draw a legend
  function drawLegend(ctx, x, y, items, boxSize = 12) {
    ctx.font      = "11px sans-serif";
    ctx.textAlign = "left";
    let cx = x;
    items.forEach(({ color, label }) => {
      ctx.fillStyle = color;
      ctx.fillRect(cx, y - boxSize + 2, boxSize, boxSize);
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(label, cx + boxSize + 4, y);
      cx += ctx.measureText(label).width + boxSize + 20;
    });
  }

  // ----------------------------------------------------------
  // CHART 1: DEBT MATURITY LADDER
  // X-axis: quarters into the future (0–20)
  // Y-axis: $ amount maturing
  // Color: green (>8q), yellow (4–8q), red (<4q)
  // ----------------------------------------------------------
  function renderDebtMaturity() {
    const c = prepareCanvas("chart-debt-maturity");
    if (!c) return;
    const { ctx, w, h } = c;

    const PAD = { top: 30, right: 20, bottom: 60, left: 70 };
    const gw  = w - PAD.left - PAD.right;
    const gh  = h - PAD.top  - PAD.bottom;
    const x0  = PAD.left;
    const y0  = PAD.top;

    // Title
    ctx.fillStyle = COLORS.text;
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Debt Maturity Profile", x0, y0 - 10);

    if (GameState.debtTranches.length === 0) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.font      = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No debt outstanding", x0 + gw / 2, y0 + gh / 2);
      return;
    }

    // Build 20-quarter buckets
    const BUCKETS = 28;
    const buckets = Array(BUCKETS).fill(0);
    const bucketTranches = Array.from({ length: BUCKETS }, () => []);

    GameState.debtTranches.forEach(tranche => {
      const q = tranche.quartersUntilMaturity;
      if (q >= 1 && q <= BUCKETS) {
        buckets[q - 1] += tranche.amount;
        bucketTranches[q - 1].push(tranche);
      } else if (q <= 0) {
        // Overdue — bucket 0
        buckets[0] += tranche.amount;
        bucketTranches[0].push(tranche);
      }
    });

    const maxAmount = Math.max(...buckets, 10);
    const barW      = gw / BUCKETS;

    // Grid
    drawGrid(ctx, x0, y0, gw, gh, 0, maxAmount, 4, "$", "M");

    // Bars
    buckets.forEach((amount, i) => {
      if (amount === 0) return;

      const qtrsAway = i + 1;
      const barColor = qtrsAway <= 3   ? COLORS.red
                     : qtrsAway <= 7   ? COLORS.yellow
                     : COLORS.green;

      const bx = x0 + i * barW + barW * 0.1;
      const bw = barW * 0.8;
      const bh = (amount / maxAmount) * gh;
      const by = y0 + gh - bh;

      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by, bw, bh);

      // Amount label on bar
      if (bh > 20) {
        ctx.fillStyle = COLORS.background;
        ctx.font      = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`$${fmt(amount, 0)}`, bx + bw / 2, by + 14);
      }
    });

    // X-axis labels
    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = "10px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < BUCKETS; i++) {
      if ((i + 1) % 4 === 0 || i === 0) {
        const lx = x0 + i * barW + barW / 2;
        ctx.fillText(`Q${i + 1}`, lx, y0 + gh + 16);
      }
    }

    // X-axis title
    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Quarters Until Maturity", x0 + gw / 2, y0 + gh + 36);

    // Legend
    drawLegend(ctx, x0, y0 + gh + 56, [
      { color: COLORS.green,  label: ">8 quarters" },
      { color: COLORS.yellow, label: "4–8 quarters" },
      { color: COLORS.red,    label: "<4 quarters" },
    ]);

    // Store bucket data for click detection
    Charts._maturityBuckets = buckets.map((amount, i) => ({
      amount,
      tranches: bucketTranches[i],
      x: x0 + i * barW,
      w: barW,
      y: y0,
      h: gh,
      quarter: i + 1,
    }));
  }

  // ----------------------------------------------------------
  // CHART 2: FFO TREND
  // Bar chart: FFO and dividends per share over time
  // ----------------------------------------------------------
  function renderFFOTrend() {
    const c = prepareCanvas("chart-ffo-trend");
    if (!c) return;
    const { ctx, w, h } = c;

    const history = GameState.history.slice(-12); // last 12 quarters
    if (history.length === 0) return;

    const PAD = { top: 30, right: 20, bottom: 55, left: 65 };
    const gw  = w - PAD.left - PAD.right;
    const gh  = h - PAD.top  - PAD.bottom;
    const x0  = PAD.left;
    const y0  = PAD.top;

    const ffoValues = history.map(h => h.ffoPerShare || 0);
    const divValues = history.map(h => h.dividendPerShare || 0);
    const allValues = [...ffoValues, ...divValues];
    const maxVal    = Math.max(...allValues, 0.01) * 1.2;
    const minVal    = Math.min(...allValues, 0) * 1.2;

    ctx.fillStyle = COLORS.text;
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("FFO vs Dividend per Share", x0, y0 - 10);

    drawGrid(ctx, x0, y0, gw, gh, minVal, maxVal, 4, "$", "");

    const barGroupW = gw / history.length;
    const barW      = barGroupW * 0.35;

    history.forEach((entry, i) => {
      const ffo = entry.ffoPerShare || 0;
      const div = entry.dividendPerShare || 0;
      const bx  = x0 + i * barGroupW + barGroupW * 0.1;

      // FFO bar
      const ffoH  = Math.abs(ffo / maxVal) * gh;
      const ffoY  = ffo >= 0 ? y0 + gh - ffoH : y0 + gh;
      ctx.fillStyle = ffo >= div ? COLORS.teal : COLORS.orange;
      ctx.fillRect(bx, ffoY, barW, ffoH);

      // Dividend bar
      const divH = (div / maxVal) * gh;
      const divY = y0 + gh - divH;
      ctx.fillStyle = COLORS.purple;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(bx + barW + 2, divY, barW, divH);
      ctx.globalAlpha = 1.0;

      // X label
      if (i % 2 === 0 || history.length <= 6) {
        ctx.fillStyle = COLORS.textMuted;
        ctx.font      = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(entry.label || `Q${entry.quarter}`, bx + barW, y0 + gh + 14);
      }
    });

    drawLegend(ctx, x0, y0 + gh + 46, [
      { color: COLORS.teal,   label: "FFO/share (covered)" },
      { color: COLORS.orange, label: "FFO/share (uncovered)" },
      { color: COLORS.purple, label: "Dividend/share" },
    ]);
  }

  // ----------------------------------------------------------
  // CHART 3: DEBT TO ASSETS TREND
  // Line chart over time with danger zone shading
  // ----------------------------------------------------------
  function renderLeverageTrend() {
    const c = prepareCanvas("chart-leverage");
    if (!c) return;
    const { ctx, w, h } = c;

    const history = GameState.history.slice(-12);
    if (history.length < 2) return;

    const PAD = { top: 30, right: 20, bottom: 45, left: 55 };
    const gw  = w - PAD.left - PAD.right;
    const gh  = h - PAD.top  - PAD.bottom;
    const x0  = PAD.left;
    const y0  = PAD.top;

    const values  = history.map(h => (h.debtToAssets || 0) * 100);
    const maxVal  = Math.max(70, ...values);
    const minVal  = 0;

    ctx.fillStyle = COLORS.text;
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Leverage (Debt / Assets %)", x0, y0 - 10);

    // Danger zone shading (>60%)
    const dangerY = y0 + gh - ((60 - minVal) / (maxVal - minVal)) * gh;
    ctx.fillStyle = "rgba(239,68,68,0.08)";
    ctx.fillRect(x0, y0, gw, dangerY - y0);

    // Threshold line
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, dangerY);
    ctx.lineTo(x0 + gw, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.red;
    ctx.font      = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("60% limit", x0 + gw - 2, dangerY - 4);

    drawGrid(ctx, x0, y0, gw, gh, minVal, maxVal, 4, "", "%");

    // Line
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    history.forEach((entry, i) => {
      const val = (entry.debtToAssets || 0) * 100;
      const px  = x0 + (i / (history.length - 1)) * gw;
      const py  = y0 + gh - ((val - minVal) / (maxVal - minVal)) * gh;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Dots
    history.forEach((entry, i) => {
      const val = (entry.debtToAssets || 0) * 100;
      const px  = x0 + (i / (history.length - 1)) * gw;
      const py  = y0 + gh - ((val - minVal) / (maxVal - minVal)) * gh;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = val > 60 ? COLORS.red : COLORS.blue;
      ctx.fill();
    });

    // X labels
    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = "9px monospace";
    ctx.textAlign = "center";
    history.forEach((entry, i) => {
      if (i % 3 === 0 || i === history.length - 1) {
        const px = x0 + (i / (history.length - 1)) * gw;
        ctx.fillText(entry.label || "", px, y0 + gh + 14);
      }
    });
  }

  // ----------------------------------------------------------
  // CHART 4: PORTFOLIO COMPOSITION
  // Donut chart: split by sector and location
  // ----------------------------------------------------------
  function renderPortfolioComposition() {
    const c = prepareCanvas("chart-portfolio");
    if (!c) return;
    const { ctx, w, h } = c;

    if (GameState.portfolio.length === 0) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.font      = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No properties owned", w / 2, h / 2);
      return;
    }

    ctx.fillStyle = COLORS.text;
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Portfolio Composition (by Value)", 16, 22);

    // Tally by sector
    const sectorTotals = {};
    GameState.portfolio.forEach(p => {
      sectorTotals[p.sector] = (sectorTotals[p.sector] || 0) + p.currentValue;
    });
    const totalValue = Object.values(sectorTotals).reduce((a, b) => a + b, 0);

    // Donut
    const cx    = w / 2;
    const cy    = h / 2 + 10;
    const outer = Math.min(w, h) * 0.32;
    const inner = outer * 0.55;

    let angle = -Math.PI / 2;
    Object.entries(sectorTotals).forEach(([sector, value]) => {
      const slice = (value / totalValue) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outer, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = SECTOR_COLORS[sector] || COLORS.gray;
      ctx.fill();

      // Label if slice is big enough
      if (slice > 0.3) {
        const midAngle = angle + slice / 2;
        const lx = cx + Math.cos(midAngle) * (outer * 0.75);
        const ly = cy + Math.sin(midAngle) * (outer * 0.75);
        ctx.fillStyle = COLORS.background;
        ctx.font      = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${fmt(value / totalValue * 100, 0)}%`, lx, ly);
      }

      angle += slice;
    });

    // Inner circle (donut hole)
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();

    // Center text
    ctx.fillStyle = COLORS.text;
    ctx.font      = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`$${fmt(totalValue, 0)}M`, cx, cy);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = "10px sans-serif";
    ctx.fillText("total value", cx, cy + 14);

    // Legend
    const legendX = 12;
    let legendY   = h - 14 - Object.keys(sectorTotals).length * 18;
    ctx.font      = "11px sans-serif";
    ctx.textAlign = "left";
    Object.entries(sectorTotals).forEach(([sector, value]) => {
      ctx.fillStyle = SECTOR_COLORS[sector] || COLORS.gray;
      ctx.fillRect(legendX, legendY - 10, 12, 12);
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(
        `${sector.charAt(0).toUpperCase() + sector.slice(1)}: $${fmt(value, 0)}M`,
        legendX + 16, legendY
      );
      legendY += 18;
    });
  }

  // ----------------------------------------------------------
  // CHART 5: NOI TREND
  // Line chart of quarterly NOI and interest expense
  // ----------------------------------------------------------
  function renderNOITrend() {
    const c = prepareCanvas("chart-noi");
    if (!c) return;
    const { ctx, w, h } = c;

    const history = GameState.history.slice(-12);
    if (history.length < 2) return;

    const PAD = { top: 30, right: 20, bottom: 45, left: 65 };
    const gw  = w - PAD.left - PAD.right;
    const gh  = h - PAD.top  - PAD.bottom;
    const x0  = PAD.left;
    const y0  = PAD.top;

    const noiVals  = history.map(h => h.noi || 0);
    const intVals  = history.map(h => h.interestExpense || 0);
    const allVals  = [...noiVals, ...intVals];
    const maxVal   = Math.max(...allVals, 1) * 1.15;

    ctx.fillStyle = COLORS.text;
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("NOI vs Interest Expense ($M)", x0, y0 - 10);

    drawGrid(ctx, x0, y0, gw, gh, 0, maxVal, 4);

    const drawLine = (values, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      values.forEach((val, i) => {
        const px = x0 + (i / (history.length - 1)) * gw;
        const py = y0 + gh - (val / maxVal) * gh;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Dots
      values.forEach((val, i) => {
        const px = x0 + (i / (history.length - 1)) * gw;
        const py = y0 + gh - (val / maxVal) * gh;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    };

    drawLine(noiVals, COLORS.green);
    drawLine(intVals, COLORS.red);

    // X labels
    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = "9px monospace";
    ctx.textAlign = "center";
    history.forEach((entry, i) => {
      if (i % 3 === 0 || i === history.length - 1) {
        const px = x0 + (i / (history.length - 1)) * gw;
        ctx.fillText(entry.label || "", px, y0 + gh + 14);
      }
    });

    drawLegend(ctx, x0, y0 + gh + 36, [
      { color: COLORS.green, label: "NOI" },
      { color: COLORS.red,   label: "Interest Expense" },
    ]);
  }

  // ----------------------------------------------------------
  // CHART 6: SHARE PRICE + BOARD PRESSURE
  // Dual-axis line chart
  // ----------------------------------------------------------
  function renderSharePrice() {
    const c = prepareCanvas("chart-share-price");
    if (!c) return;
    const { ctx, w, h } = c;

    const history = GameState.history.slice(-12);
    if (history.length < 2) return;

    const PAD = { top: 30, right: 55, bottom: 45, left: 65 };
    const gw  = w - PAD.left - PAD.right;
    const gh  = h - PAD.top  - PAD.bottom;
    const x0  = PAD.left;
    const y0  = PAD.top;

    const prices   = history.map(h => h.sharePrice || 0);
    const pressure = history.map(h => h.pressurePoints || 0);
    const maxPrice = Math.max(...prices, 1) * 1.2;
    const maxPres  = GameState.board.maxPressure;

    ctx.fillStyle = COLORS.text;
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Share Price & Board Pressure", x0, y0 - 10);

    drawGrid(ctx, x0, y0, gw, gh, 0, maxPrice, 4, "$", "");

    // Share price line
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    prices.forEach((val, i) => {
      const px = x0 + (i / (history.length - 1)) * gw;
      const py = y0 + gh - (val / maxPrice) * gh;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Pressure line (right axis)
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    pressure.forEach((val, i) => {
      const px = x0 + (i / (history.length - 1)) * gw;
      const py = y0 + gh - (val / maxPres) * gh;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Right axis labels (pressure)
    ctx.fillStyle = COLORS.orange;
    ctx.font      = "10px monospace";
    ctx.textAlign = "left";
    for (let i = 0; i <= 4; i++) {
      const val = (maxPres * i) / 4;
      const py  = y0 + gh - (val / maxPres) * gh;
      ctx.fillText(fmt(val, 0), x0 + gw + 6, py + 4);
    }
    ctx.fillStyle = COLORS.orange;
    ctx.font      = "9px sans-serif";
    ctx.fillText("pressure", x0 + gw + 4, y0 - 4);

    // X labels
    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = "9px monospace";
    ctx.textAlign = "center";
    history.forEach((entry, i) => {
      if (i % 3 === 0 || i === history.length - 1) {
        const px = x0 + (i / (history.length - 1)) * gw;
        ctx.fillText(entry.label || "", px, y0 + gh + 14);
      }
    });

    drawLegend(ctx, x0, y0 + gh + 36, [
      { color: COLORS.blue,   label: "Share Price" },
      { color: COLORS.orange, label: "Board Pressure" },
    ]);
  }

  // ----------------------------------------------------------
  // CLICK HANDLER: Debt Maturity Chart
  // Shows tranche details when a bar is clicked
  // ----------------------------------------------------------
  function handleDebtMaturityClick(event) {
    const canvas = getCanvas("chart-debt-maturity");
    if (!canvas || !Charts._maturityBuckets) return;

    const rect  = canvas.getBoundingClientRect();
    const mx    = event.clientX - rect.left;
    const my    = event.clientY - rect.top;

    const clicked = Charts._maturityBuckets.find(bucket => {
      return bucket.amount > 0
        && mx >= bucket.x
        && mx <= bucket.x + bucket.w
        && my >= bucket.y
        && my <= bucket.y + bucket.h;
    });

    if (clicked && clicked.tranches.length > 0) {
      const details = clicked.tranches.map(t =>
        `• ${t.label} — $${t.amount}M @ ${t.rate}%`
      ).join("\n");
      UI.showModal(
        `Debt Maturing in Q${clicked.quarter}`,
        `Total: $${fmt(clicked.amount, 0)}M\n\n${details}`
      );
    }
  }

  // ----------------------------------------------------------
  // RENDER ALL CHARTS
  // ----------------------------------------------------------
  function renderAll() {
    renderDebtMaturity();
    renderFFOTrend();
    renderLeverageTrend();
    renderPortfolioComposition();
    renderNOITrend();
    renderSharePrice();
  }

  // ----------------------------------------------------------
  // INITIALISE
  // Attach click handler to debt maturity chart
  // ----------------------------------------------------------
  function init() {
    const canvas = getCanvas("chart-debt-maturity");
    if (canvas) {
      canvas.addEventListener("click", handleDebtMaturityClick);
      canvas.style.cursor = "pointer";
    }
  }

  // Expose maturity bucket data for click detection

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    renderAll,
    renderDebtMaturity,
    renderFFOTrend,
    renderLeverageTrend,
    renderPortfolioComposition,
    renderNOITrend,
    renderSharePrice,
  };

})();
