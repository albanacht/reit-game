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

const Properties = (() => {

  // ----------------------------------------------------------
  // PROPERTY TEMPLATES
  // Each sector+location combo has a profile that drives generation
  // noiYield = annual NOI as % of property value (before vacancy)
  // volatility = how much occupancy swings (higher = riskier)
  // eventWeight = how likely bad events hit this type
  // ----------------------------------------------------------
  const PROFILES = {
    office: {
      tier1:    { basePriceMid: 120, noiYield: 0.055, occupancyMid: 0.90, volatility: 0.08, label: "CBD Office Tower" },
      tier2:    { basePriceMid: 65,  noiYield: 0.065, occupancyMid: 0.85, volatility: 0.10, label: "City Office Park" },
      suburban: { basePriceMid: 35,  noiYield: 0.075, occupancyMid: 0.80, volatility: 0.13, label: "Suburban Office Campus" },
    },
    industrial: {
      tier1:    { basePriceMid: 95,  noiYield: 0.045, occupancyMid: 0.95, volatility: 0.04, label: "Urban Logistics Hub" },
      tier2:    { basePriceMid: 55,  noiYield: 0.055, occupancyMid: 0.93, volatility: 0.05, label: "Regional Distribution Center" },
      suburban: { basePriceMid: 30,  noiYield: 0.065, occupancyMid: 0.90, volatility: 0.06, label: "Suburban Warehouse Park" },
    },
    multifamily: {
      tier1:    { basePriceMid: 110, noiYield: 0.050, occupancyMid: 0.93, volatility: 0.05, label: "Urban Apartment Tower" },
      tier2:    { basePriceMid: 60,  noiYield: 0.060, occupancyMid: 0.90, volatility: 0.07, label: "Mid-City Apartment Complex" },
      suburban: { basePriceMid: 32,  noiYield: 0.070, occupancyMid: 0.87, volatility: 0.10, label: "Suburban Apartment Community" },
    },
    retail: {
      tier1:    { basePriceMid: 100, noiYield: 0.060, occupancyMid: 0.88, volatility: 0.10, label: "High Street Retail Center" },
      tier2:    { basePriceMid: 50,  noiYield: 0.070, occupancyMid: 0.83, volatility: 0.13, label: "Community Shopping Center" },
      suburban: { basePriceMid: 28,  noiYield: 0.085, occupancyMid: 0.78, volatility: 0.16, label: "Suburban Strip Mall" },
    },
  };

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
  function generateProperty(sector, location, forSale = true) {
    const profile = PROFILES[sector][location];

    // Pick a unique name
    const namePool = NAMES[sector][location];
    const availableNames = namePool.filter(n => !usedNames.has(n));
    const name = availableNames.length > 0
      ? pick(availableNames)
      : `${profile.label} ${propIdCounter}`;
    usedNames.add(name);

    // Price varies ±30% around midpoint
    const priceVariance = randBetween(0.70, 1.30);
    const currentValue = Math.round(profile.basePriceMid * priceVariance * 10) / 10;

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
        pool.push(generateProperty(sector, location));
      });
      // Add two more varied properties per sector
      pool.push(generateProperty(sector, pick(locations)));
      pool.push(generateProperty(sector, pick(locations)));
    });

    return pool;
  }

  // ----------------------------------------------------------
  // GENERATE starting portfolio (2 properties, already owned)
  // Player starts with one industrial and one multifamily
  // ----------------------------------------------------------
  function generateStartingPortfolio() {
    const prop1 = generateProperty("industrial", "tier2", false);
    prop1.purchasePrice = prop1.currentValue;
    prop1.quarterOwned = 1;
    prop1.askingPrice = null;

    const prop2 = generateProperty("multifamily", "tier2", false);
    prop2.purchasePrice = prop2.currentValue;
    prop2.quarterOwned = 1;
    prop2.askingPrice = null;

    return [prop1, prop2];
  }

  // ----------------------------------------------------------
  // RECALCULATE property market value from current cap rates
  // Called every quarter as cap rates shift
  // ----------------------------------------------------------
  function recalculatePropertyValues() {
    const capRates = GameState.market.capRates;

    GameState.portfolio.forEach(prop => {
      const capRate = capRates[prop.sector][prop.location] / 100;
      const effectiveNOI = prop.annualNOI * prop.occupancy;
      prop.currentValue = Math.round((effectiveNOI / capRate) * 10) / 10;
    });

    GameState.propertyMarket.forEach(prop => {
      const capRate = capRates[prop.sector][prop.location] / 100;
      const effectiveNOI = prop.annualNOI * prop.occupancy;
      prop.currentValue = Math.round((effectiveNOI / capRate) * 10) / 10;
      // Asking price adjusts slowly (sellers are sticky)
      prop.askingPrice = Math.round(
        prop.askingPrice * 0.85 + prop.currentValue * 1.02 * 0.15
      * 10) / 10;
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
      GameState.propertyMarket.push(generateProperty(sector, location));
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
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    buyProperty,
    sellProperty,
    recalculatePropertyValues,
    quarterlyUpdate,
    refreshMarket,
    generateProperty,
    PROFILES,
  };

})();
