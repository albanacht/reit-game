// ============================================================
// properties.js — Property pool, generation, buy/sell logic
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file manages the property market and portfolio
// - It reads/writes GameState.portfolio and GameState.propertyMarket
// - It never touches P&L directly — financials.js does that
// - Property VALUE is recalculated here; property INCOME is in financials.js
// ============================================================

window.Properties = (() => {

  // ----------------------------------------------------------
  // PROPERTY TEMPLATES
  // Each sector+location combo has a profile that drives generation
  // noiYield = annual NOI as % of property value (before vacancy)
  // volatility = how much occupancy swings (higher = riskier)
  // eventWeight = how likely bad events hit this type
  // ----------------------------------------------------------
  const PROFILES = {
    office: {
      tier1:    { basePriceMid: 105, noiYield: 0.072, occupancyMid: 0.90, volatility: 0.08, label: "CBD Office Tower" },
      tier2:    { basePriceMid: 48,  noiYield: 0.077, occupancyMid: 0.85, volatility: 0.10, label: "City Office Park" },
      suburban: { basePriceMid: 18,  noiYield: 0.0845, occupancyMid: 0.80, volatility: 0.13, label: "Suburban Office Campus" },
    },
    industrial: {
      tier1:    { basePriceMid: 90,  noiYield: 0.062, occupancyMid: 0.95, volatility: 0.04, label: "Urban Logistics Hub" },
      tier2:    { basePriceMid: 42,  noiYield: 0.067, occupancyMid: 0.93, volatility: 0.05, label: "Regional Distribution Center" },
      suburban: { basePriceMid: 15,  noiYield: 0.0745, occupancyMid: 0.90, volatility: 0.06, label: "Suburban Warehouse Park" },
    },
    multifamily: {
      tier1:    { basePriceMid: 100, noiYield: 0.067, occupancyMid: 0.93, volatility: 0.05, label: "Urban Apartment Tower" },
      tier2:    { basePriceMid: 45,  noiYield: 0.072, occupancyMid: 0.90, volatility: 0.07, label: "Mid-City Apartment Complex" },
      suburban: { basePriceMid: 16,  noiYield: 0.0795, occupancyMid: 0.87, volatility: 0.10, label: "Suburban Apartment Community" },
    },
    retail: {
      tier1:    { basePriceMid: 95,  noiYield: 0.077, occupancyMid: 0.88, volatility: 0.10, label: "High Street Retail Center" },
      tier2:    { basePriceMid: 40,  noiYield: 0.082, occupancyMid: 0.83, volatility: 0.13, label: "Community Shopping Center" },
      suburban: { basePriceMid: 13,  noiYield: 0.0945, occupancyMid: 0.78, volatility: 0.16, label: "Suburban Strip Mall" },
    },
  };

  // Market and starting portfolio now use the same base prices (no multiplier).
  // Range emerges naturally: ~10M suburban up to ~120M prime tier-1.
  const MARKET_PRICE_MULT = 1.0;

  // ----------------------------------------------------------
  // NAME BANKS — for generating realistic property names
  // ----------------------------------------------------------
  const NAMES = {
    office: {
      tier1:    ["One Capital Plaza", "Meridian Tower", "Exchange Place", "The Landmark", "Civic Center Tower", "Harbor Point Office"],
      tier2:    ["Westgate Business Park", "Riverview Office Centre", "Northgate Plaza", "Commerce Park II", "The Atrium", "Lakeside Office Park"],
      suburban: ["Innovation Campus", "Creekside Business Center", "Pinewood Office Park", "Hillside Campus", "Meadowbrook Center", "Gateway Business Park"],
    },
    industrial: {
      tier1:    ["Port Logistics Center", "Metro Distribution Hub", "Urban Commerce Center", "Railyard Industrial", "Harbor Logistics", "City Freight Terminal"],
      tier2:    ["Crossroads Distribution", "Regional Logistics Park", "Central Warehouse Hub", "Eastgate Industrial", "Westpark Distribution", "Summit Logistics"],
      suburban: ["Freedom Industrial Park", "Countryside Warehouse", "Route 9 Distribution", "Clearfield Logistics", "Valley Industrial Estate", "Ridgeline Warehouse"],
    },
    multifamily: {
      tier1:    ["The Metropolitan", "Skyline Residences", "Harborview Apartments", "The Gramercy", "Central Park Flats", "The Pinnacle"],
      tier2:    ["Riverside Commons", "The Meridian", "Uptown Flats", "Lakeside Living", "The Enclave", "Midtown Residences"],
      suburban: ["Maple Grove Apartments", "Sunridge Communities", "Creekwood Flats", "The Villages at Oakdale", "Pinecrest Residences", "Willowbrook Commons"],
    },
    retail: {
      tier1:    ["The Gallery at Fifth", "Regent Street Shops", "Harbor Place Retail", "The Arcade", "City Center Market", "Union Square Retail"],
      tier2:    ["Westfield Commons", "Riverside Marketplace", "Northgate Shopping Center", "The Town Center", "Lakeview Mall", "Central Plaza"],
      suburban: ["Sunset Strip Mall", "Route 40 Retail Plaza", "Valley Fair Center", "Clearview Commons", "Millbrook Shopping Center", "Parkway Plaza"],
    },
  };

  // Track which names have been used to avoid duplicates
  const usedNames = new Set();

  // ----------------------------------------------------------
  // UTILITY: random float between min and max
  // ----------------------------------------------------------
  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  // ----------------------------------------------------------
  // UTILITY: random int between min and max inclusive
  // ----------------------------------------------------------
  function randInt(min, max) {
    return Math.floor(randBetween(min, max + 1));
  }

  // ----------------------------------------------------------
  // UTILITY: pick random item from array
  // ----------------------------------------------------------
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ----------------------------------------------------------
  // UTILITY: generate unique property ID
  // ----------------------------------------------------------
  let propIdCounter = 1;
  function nextPropId() {
    return "p" + String(propIdCounter++).padStart(3, "0");
  }

  // ----------------------------------------------------------
  // GENERATE a single property given sector and location
  // ----------------------------------------------------------
  function generateProperty(sector, location, forSale = true, forMarket = false) {
    const profile = PROFILES[sector][location];

    // Pick a unique name
    const namePool = NAMES[sector][location];
    const availableNames = namePool.filter(n => !usedNames.has(n));
    const name = availableNames.length > 0
      ? pick(availableNames)
      : `${profile.label} ${propIdCounter}`;
    usedNames.add(name);

    // Market properties priced 1.5x base; starting portfolio uses raw base.
    const priceMult = forMarket ? MARKET_PRICE_MULT : 1.0;

    // Price varies ±30% around midpoint
    const priceVariance = randBetween(0.70, 1.30);
    const currentValue = Math.round(profile.basePriceMid * priceMult * priceVariance * 10) / 10;

    // NOI yield varies slightly around profile
    const actualYield = profile.noiYield * randBetween(0.90, 1.10);
    const annualNOI = Math.round(currentValue * actualYield * 10) / 10;

    // Occupancy varies around midpoint
    const occupancy = Math.min(1.0, Math.max(0.50,
      profile.occupancyMid + randBetween(-0.08, 0.08)
    ));

    // Age affects capex reserve needs
    const age = randInt(1, 25);
    const capexReserve = Math.round(currentValue * 0.01 * (age / 10) * 10) / 10;

    // Asking price: slight premium over value for seller motivation
    const askingPremium = forSale ? randBetween(1.00, 1.05) : 1.0;
    const askingPrice = Math.round(currentValue * askingPremium * 10) / 10;

    return {
      id: nextPropId(),
      name,
      sector,
      location,
      label: profile.label,
      purchasePrice: null,          // set when bought
      currentValue,
      askingPrice,
      annualNOI,
      occupancy: Math.round(occupancy * 1000) / 1000,
      age,
      capexReserve,
      quarterOwned: 0,
      encumbered: false,
      daysOnMarket: randInt(1, 6),  // quarters already listed
    };
  }

  // ----------------------------------------------------------
  // GENERATE the initial pool of 20 market properties
  // Distribution: 5 office, 5 industrial, 5 multifamily, 5 retail
  // Each sector gets roughly: 2 tier1, 2 tier2, 1 suburban (varied)
  // ----------------------------------------------------------
  function generateInitialMarket() {
    const sectors = ["office", "industrial", "multifamily", "retail"];
    const locations = ["tier1", "tier2", "suburban"];
    const pool = [];

    sectors.forEach(sector => {
      // Ensure at least one of each location per sector
      locations.forEach(location => {
        pool.push(generateProperty(sector, location, true, true));
      });
      // Add two more varied properties per sector
      pool.push(generateProperty(sector, pick(locations), true, true));
      pool.push(generateProperty(sector, pick(locations), true, true));
    });

    return pool;
  }

  // ----------------------------------------------------------
  // GENERATE starting portfolio (2 properties, already owned)
  // Player starts with one industrial and one multifamily
  // ----------------------------------------------------------
  function generateStartingPortfolio() {
    const sectors = ["industrial", "multifamily", "office", "retail"];
    var portfolio = sectors.map(function(sector) {
      const prop = generateProperty(sector, "tier2", false);
      prop.purchasePrice = prop.currentValue;
      prop.quarterOwned  = 1;
      prop.askingPrice   = null;
      prop.daysOnMarket  = null;
      // Easter egg: the starting multifamily building is named after a
      // certain seaside workplace in Phuket.
      if (sector === "multifamily") prop.name = "Sunshine Beach Residences";
      return prop;
    });

    // A small, high-yield suburban anchor — provides useful income to help
    // cover fixed costs while you build, at a realistic suburban occupancy
    // (~86%) so there's room to lease it up as an early goal. ~$10M, ~9.5% cap.
    var anchor = generateProperty("retail", "suburban", false);
    anchor.currentValue   = 10;
    anchor.baseValue      = 10;
    anchor.annualNOI      = 0.95;        // ~9.5% cap on $10M (at full occupancy)
    anchor.baseCapRate    = 9.5;
    anchor.occupancy      = 0.86;        // realistic suburban — room to lease up
    anchor.purchasePrice  = 10;
    anchor.quarterOwned   = 1;
    anchor.askingPrice    = null;
    anchor.daysOnMarket   = null;
    anchor.name           = "Cornerstone Strip Center";
    portfolio.push(anchor);

    return portfolio;
  }

  // ----------------------------------------------------------
  // RECALCULATE property market value from current cap rates
  // Called every quarter as cap rates shift
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // RECALCULATE PROPERTY VALUES
  // Value is NOT driven by operational lease-up (filling the bus earns
  // more fares, it doesn't make the bus worth more). Instead value =
  // a depreciating base, re-rated by market cap-rate swings (cycle + rates).
  // Operational gains show up as NOI, never as value.
  // ----------------------------------------------------------
  function recalculatePropertyValues() {
    const capRates = GameState.market.capRates;

    GameState.portfolio.forEach(prop => {
      // Establish a baseline cap rate the first time we see this property
      if (prop.baseCapRate === undefined) {
        prop.baseCapRate = capRates[prop.sector][prop.location];
      }
      if (prop.baseValue === undefined) {
        prop.baseValue = prop.currentValue;
      }
      // Market re-rating: how today's cap rate compares to the property's
      // baseline. Lower cap rate than baseline => market marks it UP; higher
      // => marks it DOWN. This is the cycle/interest-rate swing, both ways.
      const curCap = capRates[prop.sector][prop.location];
      const marketFactor = prop.baseCapRate / curCap;
      prop.currentValue = Math.round(prop.baseValue * marketFactor * 10) / 10;
    });

    GameState.propertyMarket.forEach(prop => {
      const capRate = capRates[prop.sector][prop.location] / 100;
      const effectiveNOI = prop.annualNOI * prop.occupancy;
      prop.currentValue = Math.round((effectiveNOI / capRate) * 10) / 10;
      prop.askingPrice = Math.round(
        (prop.askingPrice * 0.85 + prop.currentValue * 1.02 * 0.15) * 10
      ) / 10;
    });
  }

  // ----------------------------------------------------------
  // ANNUAL DEPRECIATION & NOI DECAY (called once per year)
  // Buildings wear out: base value depreciates ~1.75%/yr and NOI drifts
  // down ~1.25%/yr unless renovated. Renovation resets the decay clock.
  // ----------------------------------------------------------
  function applyAnnualDecay() {
    GameState.portfolio.forEach(prop => {
      if (prop.underConstruction) return;
      if (prop.baseValue === undefined) prop.baseValue = prop.currentValue;

      // Physical depreciation on the asset's base value (2.0%/yr)
      prop.baseValue = Math.round(prop.baseValue * 0.98 * 10) / 10;

      // NOI decay (~0.4%/yr) — very gentle now; the real late-game cost
      // pressure comes from the bullshit-department escalation, not silent
      // rent erosion. Renovated properties resist it.
      var decayResist = (prop.renovated && prop.renovatedYear && (GameState.meta.year - prop.renovatedYear) < 4) ? 0.5 : 1.0;
      prop.annualNOI = Math.round(prop.annualNOI * (1 - 0.004 * decayResist) * 10) / 10;

      prop.age = (prop.age || 0) + 1;
    });
  }

  // ----------------------------------------------------------
  // BUY a property from the market
  // Returns { success: bool, message: string }
  // ----------------------------------------------------------
  function buyProperty(propertyId) {
    const idx = GameState.propertyMarket.findIndex(p => p.id === propertyId);
    if (idx === -1) return { success: false, message: "Property not found in market." };

    const prop = GameState.propertyMarket[idx];

    if (GameState.balance.cash < prop.askingPrice) {
      return {
        success: false,
        message: `Insufficient cash. Need $${prop.askingPrice}M, have $${GameState.balance.cash}M.`
      };
    }

    // Transfer
    prop.purchasePrice = prop.askingPrice;
    prop.quarterOwned = 0;
    prop.askingPrice = null;
    prop.daysOnMarket = null;

    GameState.balance.cash -= prop.purchasePrice;
    GameState.portfolio.push(prop);
    GameState.propertyMarket.splice(idx, 1);

    // Refresh market with a new property to keep pool near 20
    refreshMarket();

    if (typeof News !== "undefined" && News.propertyBought) {
      News.propertyBought(prop.name, prop.purchasePrice);
    }

    return {
      success: true,
      message: `Acquired ${prop.name} for $${prop.purchasePrice}M.`
    };
  }

  // ----------------------------------------------------------
  // SELL a property from portfolio
  // Sells at current market value ± negotiation variance
  // Returns { success: bool, message: string, salePrice: number }
  // ----------------------------------------------------------
  function sellProperty(propertyId) {
    const idx = GameState.portfolio.findIndex(p => p.id === propertyId);
    if (idx === -1) return { success: false, message: "Property not found in portfolio." };

    const prop = GameState.portfolio[idx];

    // Sale price: 95%–102% of current value (market conditions apply)
    const cycle = GameState.market.cycle;
    const cycleMod = cycle === "expanding" ? 1.02
                   : cycle === "contracting" ? 0.97
                   : cycle === "recession" ? 0.93
                   : 1.00;
    const salePrice = Math.round(prop.currentValue * cycleMod * randBetween(0.97, 1.02) * 10) / 10;
    const gain = Math.round((salePrice - prop.purchasePrice) * 10) / 10;

    GameState.balance.cash += salePrice;
    GameState.portfolio.splice(idx, 1);

    if (typeof News !== "undefined" && News.propertySold) {
      News.propertySold(prop.name, salePrice, gain);
    }

    return {
      success: true,
      message: `Sold ${prop.name} for $${salePrice}M (${gain >= 0 ? "+" : ""}$${gain}M vs cost).`,
      salePrice,
      gain,
    };
  }

  // ----------------------------------------------------------
  // REFRESH MARKET — add new properties when pool drops below 20
  // Called after a purchase
  // ----------------------------------------------------------
  function refreshMarket() {
    const sectors = ["office", "industrial", "multifamily", "retail"];
    const locations = ["tier1", "tier2", "suburban"];
    while (GameState.propertyMarket.length < 20) {
      const sector = pick(sectors);
      const location = pick(locations);
      GameState.propertyMarket.push(generateProperty(sector, location, true, true));
    }
    // Acquisitions Lead unlocks rare off-market mega-properties
    maybeInjectMegaProperty();
  }

  // ----------------------------------------------------------
  // MEGA-PROPERTY — large single-tenant assets only accessible
  // with an Acquisitions Lead hired. Rare, expensive, reliable.
  // ----------------------------------------------------------
  function maybeInjectMegaProperty() {
    if (typeof Staff === "undefined" || !Staff.hasRole("acquisitions")) return;
    // Only one mega-property on the market at a time
    if (GameState.propertyMarket.some(function(p) { return p.isMega; })) return;
    // Only roll once per year
    if (GameState._lastMegaRollYear === GameState.meta.year) return;
    GameState._lastMegaRollYear = GameState.meta.year;
    // 40% base chance per year, 60% with a Rainmaker
    var megaOdds = (Staff.hasTrait && Staff.hasTrait("acquisitions", "rainmaker")) ? 0.60 : 0.40;
    if (Math.random() > megaOdds) return;

    var megaTypes = [
      { sector: "industrial", label: "Mega Distribution Centre", price: [80, 140], tenant: "national logistics operator" },
      { sector: "industrial", label: "Machinery Manufacturing Plant", price: [90, 160], tenant: "blue-chip manufacturer" },
      { sector: "office",     label: "Corporate HQ Campus", price: [100, 160], tenant: "Fortune 500 anchor" },
      { sector: "retail",     label: "Regional Distribution Hub", price: [85, 150], tenant: "diversified retail consortium" },
    ];
    var m = pick(megaTypes);

    // The acquisitions officer's skill sets how good a deal he digs up:
    // a poor AL finds ~7.5% cap, a great one ~9.5% cap. Higher cap = cheaper
    // for the income = a genuine life-saving bargain.
    var skill = Staff.skillFactor("acquisitions"); // 0..1
    var capRate = 7.5 + skill * 2.0;               // 7.5% (poor) → 9.5% (great)
    capRate = Math.round(capRate * 10) / 10;

    var value = Math.round(randBetween(m.price[0], m.price[1]) * 10) / 10;
    var noi   = Math.round(value * (capRate / 100) * 10) / 10;

    var prop = {
      id: nextPropId(),
      name: "★ " + m.label,
      sector: m.sector,
      location: "tier1",
      label: m.label,
      purchasePrice: null,
      currentValue: value,
      baseValue: value,
      baseCapRate: capRate,
      askingPrice: value,         // sold at fair value — the deal is the high cap
      annualNOI: noi,
      occupancy: 0.97,            // single reliable tenant, near-full
      age: randInt(1, 8),
      capexReserve: Math.round(value * 0.008 * 10) / 10,
      quarterOwned: 0,
      encumbered: false,
      daysOnMarket: 0,
      isMega: true,
      isSingleTenant: true,
      megaCapRate: capRate,
      megaTenant: m.tenant,
    };
    GameState.propertyMarket.unshift(prop);

    // The Acquisitions Lead announces the find with his face/voice
    var al = Staff.getStaff("acquisitions");
    if (al) {
      GameState._pendingMegaFind = {
        alName:     al.name,
        alPortrait: al.portrait,
        propName:   prop.name,
        tenant:     m.tenant,
        price:      prop.askingPrice,
        sector:     prop.sector,
      };
    }
  }

  // ----------------------------------------------------------
  // QUARTERLY UPDATE — age properties, shift occupancy slightly
  // Called once per quarter advance
  // ----------------------------------------------------------
  function quarterlyUpdate() {
    GameState.portfolio.forEach(prop => {
      prop.quarterOwned += 1;

      // Age increases every 4 quarters
      if (prop.quarterOwned % 4 === 0) prop.age += 1;

      // Occupancy drifts slightly (mean-reversion toward profile midpoint)
      const profile = PROFILES[prop.sector][prop.location];
      const drift = (profile.occupancyMid - prop.occupancy) * 0.1;
      const noise = randBetween(-profile.volatility * 0.15, profile.volatility * 0.15);
      prop.occupancy = Math.min(1.0, Math.max(0.40,
        Math.round((prop.occupancy + drift + noise) * 1000) / 1000
      ));
    });

    // Age market listings
    GameState.propertyMarket.forEach(prop => {
      prop.daysOnMarket = (prop.daysOnMarket || 0) + 1;
      // Properties on market too long get a price reduction
      if (prop.daysOnMarket > 4) {
        prop.askingPrice = Math.round(prop.askingPrice * 0.98 * 10) / 10;
      }
    });
  }

  // ----------------------------------------------------------
  // INITIALISE — call once at game start
  // ----------------------------------------------------------
  function init() {
    usedNames.clear();
    propIdCounter = 1;
    GameState.portfolio = generateStartingPortfolio();
    GameState.propertyMarket = generateInitialMarket();
  }

  // ----------------------------------------------------------
  // UPGRADE FUNCTIONS
  // ----------------------------------------------------------

  // Check if renovation is available for a property
  function canRenovate(prop) {
    if (!prop) return { ok: false, reason: "Property not found." };
    if (typeof Staff !== "undefined" && !Staff.hasRole("asset")) return { ok: false, reason: "Requires an Asset Manager. Hire one in the Staff tab." };
    if (prop.location === "tier1") return { ok: false, reason: "Tier 1 properties are already premium — renovation not applicable." };
    if (prop.renovated) return { ok: false, reason: "Already renovated." };
    if (prop.underConstruction) return { ok: false, reason: "Already under construction." };
    if (prop.repositioning) return { ok: false, reason: "Repositioning in progress." };
    if ((prop.quarterOwned || 0) < 2) return { ok: false, reason: "Must own property for at least 2 quarters before renovating." };
    if (prop.occupancy >= 0.90) return { ok: false, reason: "Occupancy already above 90% — renovation would not improve returns sufficiently." };
    return { ok: true };
  }

  function canReposition(prop) {
    if (!prop) return { ok: false, reason: "Property not found." };
    if (typeof Staff !== "undefined" && !Staff.hasRole("asset")) return { ok: false, reason: "Requires an Asset Manager. Hire one in the Staff tab." };
    if (prop.location === "tier1") return { ok: false, reason: "Tier 1 properties cannot be repositioned." };
    if (prop.repositioned) return { ok: false, reason: "Already repositioned." };
    if (prop.underConstruction) return { ok: false, reason: "Already under construction." };
    if (prop.renovating) return { ok: false, reason: "Renovation in progress." };
    if ((prop.quarterOwned || 0) < 2) return { ok: false, reason: "Must own for at least 2 quarters." };

    // Repositioning is a last resort for genuinely distressed assets only —
    // a major, expensive structural change, not a routine optimisation.
    if (prop.occupancy >= 0.70) {
      return { ok: false, reason: "Repositioning is only for distressed properties (occupancy below 70%). This asset is performing too well to justify it." };
    }

    // Must have a valid target sector
    var targets = getRepositionTargets(prop);
    if (targets.length === 0) return { ok: false, reason: "No valid repositioning targets for this property type." };
    return { ok: true };
  }

  function getRepositionTargets(prop) {
    var targets = [];
    if (prop.location === "suburban") {
      if (prop.sector === "office")      targets = ["industrial"];
      if (prop.sector === "retail")      targets = ["industrial", "multifamily"];
      if (prop.sector === "multifamily") targets = ["office"];
      if (prop.sector === "industrial")  targets = [];
    }
    if (prop.location === "tier2") {
      if (prop.sector === "office")      targets = ["multifamily"];
      if (prop.sector === "retail")      targets = ["multifamily", "industrial"];
      if (prop.sector === "multifamily") targets = ["office"];
      if (prop.sector === "industrial")  targets = [];
    }
    return targets;
  }

  function startRenovation(propId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propId; });
    var check = canRenovate(prop);
    if (!check.ok) return { success: false, message: check.reason };

    var cost = Math.round(prop.currentValue * 0.10 * 10) / 10;
    if (GameState.balance.cash < cost) {
      return { success: false, message: "Insufficient cash. Need $" + cost + "M." };
    }

    GameState.balance.cash = Math.round((GameState.balance.cash - cost) * 100) / 100;
    prop.underConstruction = true;
    prop.renovating        = true;
    prop.constructionQuartersLeft = 1;
    prop.constructionType  = "renovation";
    prop.preConstructionOccupancy = prop.occupancy;
    prop.occupancy         = 0; // offline

    return {
      success: true,
      message: prop.name + " renovation started. $" + cost + "M spent. Property offline for 1 quarter.",
      cost: cost
    };
  }

  function startRepositioning(propId, targetSector) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propId; });
    var check = canReposition(prop);
    if (!check.ok) return { success: false, message: check.reason };

    var targets = getRepositionTargets(prop);
    if (targets.indexOf(targetSector) === -1) {
      return { success: false, message: "Cannot reposition " + prop.sector + " to " + targetSector + " at this location." };
    }

    var cost = Math.round(prop.currentValue * 0.15 * 10) / 10;
    if (GameState.balance.cash < cost) {
      return { success: false, message: "Insufficient cash. Need $" + cost + "M." };
    }

    GameState.balance.cash = Math.round((GameState.balance.cash - cost) * 100) / 100;
    prop.underConstruction  = true;
    prop.repositioning      = true;
    prop.constructionQuartersLeft = 2;
    prop.constructionType   = "repositioning";
    prop.targetSector       = targetSector;
    prop.preConstructionOccupancy = prop.occupancy;
    prop.occupancy          = 0;

    return {
      success: true,
      message: prop.name + " repositioning to " + targetSector + " started. $" + cost + "M spent. Offline for 2 quarters.",
      cost: cost
    };
  }

  function processConstructionProgress() {
    GameState.portfolio.forEach(function(prop) {
      if (!prop.underConstruction) return;

      prop.constructionQuartersLeft--;

      if (prop.constructionQuartersLeft <= 0) {
        // Construction complete
        prop.underConstruction = false;

        if (prop.constructionType === "renovation") {
          prop.renovating  = false;
          prop.renovated   = true;
          prop.renovatedYear = GameState.meta.year;
          // Renovation lifts NOI 15% and restores the asset's base value
          prop.annualNOI   = Math.round(prop.annualNOI * 1.15 * 100) / 100;
          prop.baseValue   = Math.round((prop.baseValue || prop.currentValue) * 1.12 * 10) / 10;
          prop.baseCapRate = GameState.market.capRates[prop.sector][prop.location];
          prop.occupancy   = Math.min(0.97, Math.round((prop.preConstructionOccupancy + 0.08) * 1000) / 1000);
          prop.constructionType = null;
          GameState.eventLog.push({
            quarter: GameState.meta.quarter,
            year:    GameState.meta.year,
            headline:"🔨 Renovation Complete",
            body:    prop.name + " renovation complete. NOI increased 15%. Occupancy restored.",
            events:  [{ headline: "🔨 " + prop.name + " Renovation Complete", body: "NOI +15%, occupancy restored.", impact: "+$" + Math.round(prop.annualNOI * 0.15 * 10)/10 + "M annual NOI" }]
          });
        }

        if (prop.constructionType === "repositioning") {
          var oldSector    = prop.sector;
          prop.sector      = prop.targetSector;
          prop.repositioning = false;
          prop.repositioned  = true;
          // Recalculate NOI at new sector cap rate — use new sector's tier2/suburban profile
          var newProfile   = PROFILES[prop.targetSector][prop.location];
          var newCapRate   = GameState.market.capRates[prop.targetSector][prop.location] / 100;
          // New NOI = current value × new cap rate (value unchanged, income improves)
          prop.annualNOI   = Math.round(prop.currentValue * newCapRate * 100) / 100;
          prop.occupancy   = Math.round((newProfile.occupancyMid * 0.90) * 1000) / 1000; // start at 90% of sector midpoint
          prop.label       = newProfile.label;
          prop.targetSector = null;
          prop.constructionType = null;
          GameState.eventLog.push({
            quarter: GameState.meta.quarter,
            year:    GameState.meta.year,
            headline:"🔄 Repositioning Complete",
            body:    prop.name + " repositioned from " + oldSector + " to " + prop.sector + ".",
            events:  [{ headline: "🔄 " + prop.name + " Repositioned", body: "Sector: " + oldSector + " → " + prop.sector, impact: "New NOI: $" + prop.annualNOI + "M/yr" }]
          });
        }
      }
    });
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    buyProperty,
    sellProperty,
    recalculatePropertyValues,
    applyAnnualDecay,
    quarterlyUpdate,
    refreshMarket,
    maybeInjectMegaProperty,
    generateProperty,
    canRenovate,
    canReposition,
    getRepositionTargets,
    startRenovation,
    startRepositioning,
    processConstructionProgress,
    PROFILES,
  };

})();
