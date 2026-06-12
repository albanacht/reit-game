// ============================================================
// news.js — Financial news terminal
// Purely DESCRIPTIVE headlines that translate the game's math
// into narrative consequence. No mechanical effects.
// Categories: capital, debt, dividend, rating, market, board,
//             property, staff, ambient
// ============================================================

window.News = (function() {

  function fmt(n, d) { d = d === undefined ? 1 : d; return Math.round(n * Math.pow(10,d)) / Math.pow(10,d); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Rolling feed — newest first, capped
  var MAX_ITEMS = 60;

  function ensureFeed() {
    if (!GameState._newsFeed) GameState._newsFeed = [];
    return GameState._newsFeed;
  }

  // ----------------------------------------------------------
  // ADD a headline. category drives the colour tag.
  // ----------------------------------------------------------
  function add(text, category, tone) {
    var feed = ensureFeed();
    feed.unshift({
      text:    text,
      category: category || "market",
      tone:    tone || "neutral",   // "good" | "bad" | "neutral" | "action"
      year:    GameState.meta ? GameState.meta.year : 1,
      quarter: GameState.meta ? GameState.meta.quarter : 1,
      t:       Date.now(),
    });
    if (feed.length > MAX_ITEMS) feed.length = MAX_ITEMS;
  }

  // ----------------------------------------------------------
  // TEMPLATED HEADLINE HELPERS — translate math into narrative.
  // Called by other modules at the moment an action happens.
  // ----------------------------------------------------------
  var R = function() { return (GameState.company && GameState.company.name) ? GameState.company.name : "The REIT"; };

  // Equity issuance / dilution
  function equityIssued(pctDilution, priceDropPct) {
    var sev = pctDilution >= 15 ? "aggressive" : pctDilution >= 8 ? "sizeable" : "modest";
    if (pctDilution >= 12) {
      add("Analysts flag capital-allocation concerns after " + R() + "'s " + sev + " " + fmt(pctDilution) + "% equity raise; shares slide " + fmt(priceDropPct) + "%.", "capital");
    } else {
      add(R() + " raises equity (" + fmt(pctDilution) + "% dilution); shares ease " + fmt(priceDropPct) + "% as new stock prices in.", "capital");
    }
  }

  // Debt issued
  function debtIssued(amount, rate, years) {
    add(R() + " issues $" + fmt(amount) + "M of " + years + "-year notes at " + fmt(rate,2) + "%.", "debt");
  }

  // Dividend changes
  function dividendChanged(oldPS, newPS) {
    var pct = oldPS > 0 ? fmt((newPS - oldPS) / oldPS * 100) : 0;
    if (newPS > oldPS) {
      add(R() + " lifts quarterly dividend " + Math.abs(pct) + "% to $" + fmt(newPS,2) + "/share; income investors cheer.", "dividend");
    } else if (newPS < oldPS) {
      add(R() + " cuts dividend " + Math.abs(pct) + "% to $" + fmt(newPS,2) + "/share; market reads it as a warning sign.", "dividend");
    }
  }

  // Credit rating change
  function ratingChanged(oldR, newR, up) {
    if (up) {
      add("Credit agencies upgrade " + R() + " to " + newR + " on a stronger balance sheet; borrowing costs to ease.", "rating");
    } else {
      add("Credit agencies cut " + R() + " to " + newR + "; funding costs set to rise across the board.", "rating");
    }
  }

  // Property bought / sold
  function propertyBought(name, price) {
    add(R() + " acquires " + name + " for $" + fmt(price) + "M.", "property");
  }
  function propertySold(name, price, gain) {
    var tail = (gain !== undefined && gain !== null)
      ? (gain >= 0 ? " booking a $" + fmt(Math.abs(gain)) + "M gain." : " at a $" + fmt(Math.abs(gain)) + "M loss.")
      : ".";
    add(R() + " divests " + name + " for $" + fmt(price) + "M" + tail, "property");
  }

  // Board outcome
  function boardOutcome(text) { add(text, "board"); }

  // Staff hire/fire
  function staffHired(name, title) { add(R() + " appoints " + name + " as " + title + ".", "staff"); }
  function staffFired(name, title) { add(name + " departs " + R() + " (" + title + ").", "staff"); }

  // ----------------------------------------------------------
  // AMBIENT NEWS — flavour reflecting the market cycle/sectors.
  // Purely atmospheric, no REIT-specific consequence. 0-1 per quarter.
  // ----------------------------------------------------------
  var AMBIENT = {
    expanding: [
      "Capital floods commercial real estate as investors chase yield.",
      "Industrial rents hit record highs on e-commerce demand.",
      "Office leasing rebounds in prime districts.",
      "Multifamily occupancy tightens as renting outpaces buying.",
    ],
    stable: [
      "Real estate markets steady as rate expectations settle.",
      "Cap rates hold firm across major sectors this quarter.",
      "Lenders report healthy appetite for quality REIT paper.",
    ],
    contracting: [
      "Investors turn cautious as financing conditions tighten.",
      "Retail landlords brace for softer foot traffic.",
      "Cap rates drift higher as buyers demand discounts.",
    ],
    recession: [
      "Commercial property values slide as the downturn deepens.",
      "Distressed sales mount as overleveraged owners capitulate.",
      "Credit markets freeze for all but the strongest borrowers.",
      "Vacancy rises across office and retail as tenants retrench.",
    ],
  };

  function rollAmbient() {
    if (Math.random() > 0.55) return; // ~55% chance of an ambient line per quarter
    var cycle = (GameState.market && GameState.market.cycle) ? GameState.market.cycle : "stable";
    var pool = AMBIENT[cycle] || AMBIENT.stable;
    add(pick(pool), "ambient");
  }

  // ----------------------------------------------------------
  // GET feed for rendering
  // ----------------------------------------------------------
  function getFeed() { return ensureFeed(); }

  function init() {
    GameState._newsFeed = [];
    add("Markets open. " + R() + " begins operations under new leadership.", "market");
  }

  return {
    add:             add,
    equityIssued:    equityIssued,
    debtIssued:      debtIssued,
    dividendChanged: dividendChanged,
    ratingChanged:   ratingChanged,
    propertyBought:  propertyBought,
    propertySold:    propertySold,
    boardOutcome:    boardOutcome,
    staffHired:      staffHired,
    staffFired:      staffFired,
    rollAmbient:     rollAmbient,
    getFeed:         getFeed,
    init:            init,
  };

})();
