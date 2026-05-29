// ============================================================
// leaderboard.js — Global leaderboard via JSONBin.io
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file handles all leaderboard read/write operations
// - It never touches GameState directly except to read final stats
// - BIN_ID and API_KEY are set here — do not move them elsewhere
// ============================================================

const Leaderboard = (() => {

  // ----------------------------------------------------------
  // CONFIG
  // ----------------------------------------------------------
  const BIN_ID  = "6a1940b2ddf5aa59f7732d46";
  const API_KEY = "$2a$10$nav59ju0KVTvhg9N/NoXout8zV7VXoORRnSbSH7ur7uwW5D7M7Ycq";
  const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const MAX_SCORES = 100; // store top 100, display top 10

  // ----------------------------------------------------------
  // LEGACY SCORE CALCULATION
  // Called at game over with final GameState
  // ----------------------------------------------------------
  function calculateScore() {
    const quarters  = GameState.meta.totalQuarters;
    const history   = GameState.history;
    const ratios    = GameState.ratios;

    // Base: quarters survived
    const baseScore = quarters * 100;

    // FFO growth: average year-over-year FFO growth
    let avgFFOGrowth = 0;
    if (history.length >= 8) {
      const growthRates = [];
      for (let i = 4; i < history.length; i++) {
        const curr = history[i].ffo || 0;
        const prev = history[i - 4].ffo || 0;
        if (prev > 0) growthRates.push((curr - prev) / prev);
      }
      if (growthRates.length > 0) {
        avgFFOGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      }
    }
    const ffoScore = Math.max(0, avgFFOGrowth * 500);

    // Dividend coverage: average over all quarters
    let avgCoverage = 0;
    if (history.length > 0) {
      const coverages = history.map(h => Math.min(h.dividendCoverage || 0, 3));
      avgCoverage = coverages.reduce((a, b) => a + b, 0) / coverages.length;
    }
    const coverageScore = Math.max(0, avgCoverage * 200);

    // Peak market cap
    const peakCap = Math.max(...history.map(h => h.marketCap || 0), 0);
    const capScore = peakCap / 10;

    // Credit rating bonus
    const ratingBonuses = { AAA: 500, AA: 400, A: 300, BBB: 200, BB: 100, B: 0, CCC: -200 };
    const ratingScore = ratingBonuses[GameState.credit.rating] || 0;

    // Peak properties
    const peakProps = Math.max(...history.map(h => h.portfolioSize || 0), 0);
    const propScore = peakProps * 50;

    const total = Math.max(0, Math.round(
      baseScore + ffoScore + coverageScore + capScore + ratingScore + propScore
    ));

    return {
      total,
      breakdown: {
        baseScore:    Math.round(baseScore),
        ffoScore:     Math.round(ffoScore),
        coverageScore:Math.round(coverageScore),
        capScore:     Math.round(capScore),
        ratingScore,
        propScore:    Math.round(propScore),
      },
    };
  }

  // ----------------------------------------------------------
  // LETTER GRADE
  // ----------------------------------------------------------
  function getGrade(score, quarters) {
    if (quarters < 4)  return { grade: "F", label: "Abysmal" };
    if (score < 1000)  return { grade: "F", label: "Abysmal" };
    if (score < 2500)  return { grade: "D", label: "Poor" };
    if (score < 5000)  return { grade: "C", label: "Average" };
    if (score < 8000)  return { grade: "B", label: "Good" };
    if (score < 12000) return { grade: "A", label: "Excellent" };
    return { grade: "S", label: "Legendary" };
  }

  // ----------------------------------------------------------
  // READ LEADERBOARD from JSONBin
  // ----------------------------------------------------------
  async function fetchScores() {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          "X-Access-Key": API_KEY,
          "X-Bin-Meta":   "false",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.scores || [];
    } catch (err) {
      console.error("Leaderboard fetch failed:", err);
      return [];
    }
  }

  // ----------------------------------------------------------
  // WRITE SCORE to JSONBin
  // ----------------------------------------------------------
  async function submitScore(playerName, reitName, scoreData) {
    try {
      // First fetch existing scores
      const existing = await fetchScores();

      const newEntry = {
        playerName,
        reitName,
        score:        scoreData.total,
        quarters:     GameState.meta.totalQuarters,
        years:        GameState.meta.year,
        finalFFO:     Math.round(GameState.ratios.ffoPerShare * 100) / 100,
        finalOcc:     Math.round(GameState.ratios.occupancyPortfolio * 1000) / 10,
        finalRating:  GameState.credit.rating,
        peakMarketCap:Math.round(Math.max(...GameState.history.map(h => h.marketCap || 0), 0)),
        fireReason:   GameState.meta.gameOverReason.substring(0, 120),
        grade:        getGrade(scoreData.total, GameState.meta.totalQuarters).grade,
        date:         new Date().toISOString().split("T")[0],
      };

      // Add new entry and sort by score descending
      const updated = [...existing, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SCORES);

      // Write back
      const response = await fetch(API_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Key":  API_KEY,
        },
        body: JSON.stringify({ scores: updated }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { success: true, rank: updated.findIndex(e => e === newEntry) + 1 };
    } catch (err) {
      console.error("Score submission failed:", err);
      return { success: false, message: err.message };
    }
  }

  // ----------------------------------------------------------
  // RENDER LEADERBOARD TABLE
  // Called on start screen
  // ----------------------------------------------------------
  async function renderLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="lb-loading">Loading scores...</div>`;

    const scores = await fetchScores();

    if (scores.length === 0) {
      container.innerHTML = `
        <div class="lb-empty">
          No scores yet. Be the first to play and submit!
        </div>`;
      return;
    }

    const top10 = scores.slice(0, 10);

    container.innerHTML = `
      <table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>REIT</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Quarters</th>
            <th>FFO/sh</th>
            <th>Rating</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${top10.map((entry, i) => `
            <tr class="lb-row ${i === 0 ? "lb-gold" : i === 1 ? "lb-silver" : i === 2 ? "lb-bronze" : ""}"
                onclick="Leaderboard.showEntryDetail(${i})">
              <td class="lb-rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
              <td class="lb-name">${escapeHtml(entry.playerName)}</td>
              <td class="lb-reit">${escapeHtml(entry.reitName)}</td>
              <td class="lb-score">${Number(entry.score).toLocaleString()}</td>
              <td class="lb-grade grade-${entry.grade}">${entry.grade}</td>
              <td class="lb-quarters">${entry.quarters}q</td>
              <td class="lb-ffo">$${entry.finalFFO}</td>
              <td class="lb-rating">${entry.finalRating}</td>
              <td class="lb-date">${entry.date}</td>
            </tr>`
          ).join("")}
        </tbody>
      </table>`;

    // Store for detail view
    Leaderboard._cachedScores = top10;
  }

  // ----------------------------------------------------------
  // SHOW ENTRY DETAIL (click on a row)
  // ----------------------------------------------------------
  function showEntryDetail(index) {
    const entry = Leaderboard._cachedScores?.[index];
    if (!entry) return;

    UI.showModal(
      `${entry.playerName} — ${entry.reitName}`,
      `Score: ${Number(entry.score).toLocaleString()} (Grade ${entry.grade})\n` +
      `Survived: ${entry.quarters} quarters (${entry.years} years)\n` +
      `Final FFO/share: $${entry.finalFFO}\n` +
      `Final Occupancy: ${entry.finalOcc}%\n` +
      `Final Credit Rating: ${entry.finalRating}\n` +
      `Peak Market Cap: $${entry.peakMarketCap}M\n` +
      `Date: ${entry.date}\n\n` +
      `Termination reason:\n"${entry.fireReason}"`,
      []
    );
  }

  // ----------------------------------------------------------
  // SHOW SCORE SUBMISSION SCREEN
  // Called after game over
  // ----------------------------------------------------------
  function showSubmitScreen(scoreData) {
    const grade = getGrade(scoreData.total, GameState.meta.totalQuarters);

    UI.showModal(
      `Game Over — Submit Your Score`,
      `Your Legacy Score: ${scoreData.total.toLocaleString()}\n` +
      `Grade: ${grade.grade} — ${grade.label}\n\n` +
      `Score Breakdown:\n` +
      `  Survival (${GameState.meta.totalQuarters}q): +${scoreData.breakdown.baseScore}\n` +
      `  FFO Growth:                +${scoreData.breakdown.ffoScore}\n` +
      `  Dividend Coverage:         +${scoreData.breakdown.coverageScore}\n` +
      `  Peak Market Cap:           +${scoreData.breakdown.capScore}\n` +
      `  Credit Rating (${GameState.credit.rating}):      ${scoreData.breakdown.ratingScore >= 0 ? "+" : ""}${scoreData.breakdown.ratingScore}\n` +
      `  Portfolio Peak:            +${scoreData.breakdown.propScore}\n\n` +
      `Submit to the global leaderboard?`,
      [
        {
          label:   "Submit Score",
          style:   "btn-primary",
          onClick: async () => {
            const result = await submitScore(
              GameState.player.name,
              GameState.player.reitName + " REIT",
              scoreData
            );
            if (result.success) {
              UI.showToast(`Score submitted! You ranked #${result.rank} globally.`, "success");
              // Refresh leaderboard on start screen
              Leaderboard.renderLeaderboard("leaderboard-container");
            } else {
              UI.showToast("Submission failed. Check your connection.", "error");
            }
          },
        },
        {
          label:   "Skip",
          style:   "btn-secondary",
          onClick: () => {},
        },
      ]
    );
  }

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    calculateScore,
    getGrade,
    fetchScores,
    submitScore,
    renderLeaderboard,
    showEntryDetail,
    showSubmitScreen,
  };

})();
