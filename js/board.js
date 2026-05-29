// ============================================================
// board.js — Board of Directors AI and Pressure Mechanics
// REIT Simulator Game
// ============================================================

const Board = (() => {

  function init() {
    GameState.board = {
      pressurePoints: 0,
      maxPressure: 8,
      pressureLog: [],
      dividendCutQuarters: -1,
    };
  }

  function evaluatePerformance(financialSummary) {
    const ratios = financialSummary.ratios;
    const msgs = [];
    let pressureDelta = 0;

    if (ratios.dividendCoverage < 0.90) {
      pressureDelta += 1;
      msgs.push("The board is alarmed by the dividend coverage ratio falling below 0.90. We are paying dividends with debt.");
    } else if (ratios.dividendCoverage > 1.20 && pressureDelta < 0) {
      pressureDelta -= 1;
      msgs.push("Strong dividend coverage noted. The board is satisfied with cash retention.");
    }

    if (ratios.debtToAssets > 0.60) {
      pressureDelta += 1;
      msgs.push("Our leverage is dangerously high (>60% D/A). The board demands immediate deleveraging.");
    } else if (ratios.debtToAssets < 0.40) {
      pressureDelta -= 0.5; 
    }

    if (GameState.balance.cash < 0) {
      pressureDelta += 2;
      msgs.push("CRITICAL: Negative cash balance. The board is furious about the severe liquidity crisis.");
    }

    if (pressureDelta === 0 && GameState.board.pressurePoints > 0) {
      pressureDelta -= 0.5;
      msgs.push("A quiet quarter. The board's confidence is slowly recovering.");
    }

    applyPressure(pressureDelta, msgs.join(" "));

    return {
      pressurePoints: GameState.board.pressurePoints,
      messages: msgs,
      isFired: checkTermination(),
    };
  }

  function applyPressure(amount, reason) {
    if (amount === 0) return;
    GameState.board.pressurePoints = Math.max(
      0, 
      Math.min(GameState.board.maxPressure, GameState.board.pressurePoints + amount)
    );
    if (amount > 0 && reason) {
      GameState.board.pressureLog.push({
        quarter: GameState.meta.quarter,
        year: GameState.meta.year,
        reason: reason,
        points: amount
      });
    }
  }

  function checkTermination() {
    return GameState.board.pressurePoints >= GameState.board.maxPressure;
  }

  function getStatusLabel() {
    const p = GameState.board.pressurePoints;
    if (p >= 7) return "HOSTILE (Imminent Termination)";
    if (p >= 5) return "ANGRY";
    if (p >= 3) return "CONCERNED";
    if (p >= 1) return "NEUTRAL";
    return "SUPPORTIVE";
  }

  return { init, evaluatePerformance, getStatusLabel, checkTermination };

})();
