// ============================================================
// events.js — Random event engine
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file generates and applies random events each quarter
// - Events target specific sectors, locations, or the whole portfolio
// - This file WRITES to GameState.portfolio (occupancy, NOI)
// - This file WRITES to GameState.pnl.unusualItems
// - This file WRITES to GameState.market (for macro events)
// - Never touches debt or equity — financials.js does that
// ============================================================

window.Events = (() => {

  // ----------------------------------------------------------
  // EVENT CATALOGUE
  // Each event has:
  //   id, name, description
  //   type: "macro" | "sector" | "property"
  //   target: which sectors/locations it can hit (null = any)
  //   probability: base chance per quarter (0–1)
  //   cycleBias: which cycles make this more likely
  //   effect: function(targets) that applies the impact
  //   narrativeTemplates: array of strings, one picked randomly
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function fmt(n) {
    return Math.round(n * 10) / 10;
  }

  // Get portfolio properties matching a filter
  function getMatching(filter) {
    return GameState.portfolio.filter(filter);
  }

  // Apply occupancy hit to a set of properties
  function applyOccupancyHit(properties, minHit, maxHit) {
    const impacts = [];
    properties.forEach(prop => {
      const hit = randBetween(minHit, maxHit);
      const oldOcc = prop.occupancy;
      prop.occupancy = Math.max(0.30, fmt(prop.occupancy - hit));
      impacts.push({ name: prop.name, from: oldOcc, to: prop.occupancy });
    });
    return impacts;
  }

  // Apply NOI change to a set of properties
  function applyNOIChange(properties, minPct, maxPct) {
    const impacts = [];
    properties.forEach(prop => {
      const pct = randBetween(minPct, maxPct);
      const oldNOI = prop.annualNOI;
      prop.annualNOI = Math.max(0.1, fmt(prop.annualNOI * (1 + pct)));
      impacts.push({ name: prop.name, from: oldNOI, to: prop.annualNOI });
    });
    return impacts;
  }

  // Add to unusual items (one-time P&L hit or gain)
  function addUnusualItem(amount) {
    GameState.pnl.unusualItems = fmt(GameState.pnl.unusualItems + amount);
  }

  // ----------------------------------------------------------
  // EVENT DEFINITIONS
  // ----------------------------------------------------------
  const EVENT_CATALOGUE = [

    // ---- MACRO EVENTS ----------------------------------------

    {
      id: "fed_rate_hike",
      name: "Federal Reserve Rate Hike",
      type: "macro",
      target: null,
      baseProbability: 0.15,
      cycleBias: { expanding: 2.0, stable: 1.0, contracting: 0.3, recession: 0.1 },
      apply(narrative) {
        const hike = pick([0.25, 0.25, 0.50]);
        GameState.market.baseInterestRate = fmt(
          Math.min(12, GameState.market.baseInterestRate + hike)
        );
        const msg = pick([
          `The Federal Reserve raised its benchmark rate by ${hike*100}bps to ${GameState.market.baseInterestRate}%, citing persistent inflation. New debt issuance will be more expensive.`,
          `In a widely anticipated move, the Fed hiked rates ${hike*100}bps. Your floating-rate exposure is now a concern.`,
          `The Fed delivered a ${hike*100}bps hike, pushing the base rate to ${GameState.market.baseInterestRate}%. Refinancing costs are rising.`,
        ]);
        return { isMacro: true, headline: "🏦 Fed Hikes Rates", body: msg, impact: `-${hike*100}bps to base rate` };
      },
    },

    {
      id: "fed_rate_cut",
      name: "Federal Reserve Rate Cut",
      type: "macro",
      target: null,
      baseProbability: 0.12,
      cycleBias: { expanding: 0.1, stable: 0.5, contracting: 2.0, recession: 3.0 },
      apply() {
        const cut = pick([0.25, 0.25, 0.50]);
        GameState.market.baseInterestRate = fmt(
          Math.max(2, GameState.market.baseInterestRate - cut)
        );
        const msg = pick([
          `The Federal Reserve cut rates by ${cut*100}bps to ${GameState.market.baseInterestRate}%, providing relief on new borrowings.`,
          `A surprise ${cut*100}bps cut from the Fed. Your refinancing window just got more attractive.`,
          `Fed eases by ${cut*100}bps. Cap rates may follow over coming quarters.`,
        ]);
        return { isMacro: true, headline: "🏦 Fed Cuts Rates", body: msg, impact: `+${cut*100}bps relief to base rate` };
      },
    },

    {
      id: "credit_crunch",
      name: "Credit Market Freeze",
      type: "macro",
      target: null,
      baseProbability: 0.05,
      cycleBias: { expanding: 0.1, stable: 0.3, contracting: 1.5, recession: 3.0 },
      apply() {
        // Temporarily widen all spreads by forcing a rating drop
        const ratingOrder = ["AAA","AA","A","BBB","BB","B","CCC"];
        const idx = ratingOrder.indexOf(GameState.credit.rating);
        if (idx < ratingOrder.length - 1) {
          GameState.credit.rating = ratingOrder[idx + 1];
          const spreads = { AAA:0.5,AA:0.8,A:1.1,BBB:1.6,BB:2.5,B:3.8,CCC:6.0 };
          GameState.credit.spread = spreads[GameState.credit.rating];
        }
        addUnusualItem(-randBetween(2, 6));
        const msg = pick([
          "Credit markets have seized up following a banking sector scare. Lenders are pulling back and spreads have blown out. Your effective credit rating has been marked down one notch.",
          "A sudden risk-off move in credit markets has tightened lending standards. Your borrowing costs have increased and one tranche was repriced at a higher spread.",
        ]);
        return { isMacro: true, headline: "🔒 Credit Market Freeze", body: msg, impact: "Rating marked down 1 notch" };
      },
    },

    {
      id: "pandemic_shock",
      name: "Pandemic / Public Health Crisis",
      type: "macro",
      target: null,
      baseProbability: 0.03,
      cycleBias: { expanding: 0.5, stable: 1.0, contracting: 1.0, recession: 0.5 },
      apply() {
        // Crushes retail and office, spares industrial
        const retailProps = getMatching(p => p.sector === "retail");
        const officeProps = getMatching(p => p.sector === "office");
        const indProps    = getMatching(p => p.sector === "industrial");

        applyOccupancyHit(retailProps, 0.15, 0.30);
        applyOccupancyHit(officeProps, 0.10, 0.20);
        applyNOIChange(indProps, 0.02, 0.06); // e-commerce boost

        addUnusualItem(-randBetween(5, 15));

        const msg = `A public health emergency has been declared. Retail properties are facing forced closures and your office tenants have vacated to work-from-home. Industrial assets are seeing a modest boost from accelerated e-commerce demand. Expect occupancy pain for 2–4 quarters.`;
        return { isMacro: true, headline: "🦠 Pandemic Shock", body: msg, impact: "Retail & Office occupancy -15–30%" };
      },
    },

    {
      id: "interest_rate_shock",
      name: "Unexpected Rate Shock",
      type: "macro",
      target: null,
      baseProbability: 0.06,
      cycleBias: { expanding: 1.5, stable: 0.8, contracting: 0.5, recession: 0.3 },
      apply() {
        const shock = randBetween(0.50, 1.00);
        GameState.market.baseInterestRate = fmt(
          Math.min(12, GameState.market.baseInterestRate + shock)
        );
        const msg = `Inflation data came in dramatically above expectations, forcing an emergency rate response. The base rate jumped ${fmt(shock*100)}bps to ${GameState.market.baseInterestRate}%. Bond markets are repricing and cap rates are expected to follow.`;
        return { isMacro: true, headline: "⚡ Rate Shock", body: msg, impact: `+${fmt(shock*100)}bps emergency hike` };
      },
    },

    // ---- SECTOR EVENTS ----------------------------------------

    {
      id: "retail_oversupply",
      name: "Retail Oversupply Crisis",
      type: "sector",
      target: { sector: "retail" },
      baseProbability: 0.12,
      cycleBias: { expanding: 0.5, stable: 1.0, contracting: 2.0, recession: 2.5 },
      apply() {
        const props = getMatching(p => p.sector === "retail");
        if (props.length === 0) return null;
        applyOccupancyHit(props, 0.05, 0.15);
        applyNOIChange(props, -0.05, -0.10);
        const msg = pick([
          "A wave of retailer bankruptcies has hit the sector. Several anchor tenants have vacated, and your retail properties are seeing significant occupancy pressure.",
          "Online competition has accelerated store closures across the retail sector. Your shopping centers are feeling the heat with rising vacancies and falling rents.",
          "National retail chains announced mass store closure programs this quarter, directly impacting occupancy across your retail portfolio.",
        ]);
        return { headline: "🏬 Retail Sector Crisis", body: msg, impact: "Retail occupancy & NOI down" };
      },
    },

    {
      id: "office_wfh",
      name: "Work-From-Home Structural Shift",
      type: "sector",
      target: { sector: "office" },
      baseProbability: 0.10,
      cycleBias: { expanding: 0.7, stable: 1.2, contracting: 1.5, recession: 1.8 },
      apply() {
        const props = getMatching(p => p.sector === "office");
        if (props.length === 0) return null;
        // Suburban office hit hardest
        const suburban = props.filter(p => p.location === "suburban");
        const others   = props.filter(p => p.location !== "suburban");
        applyOccupancyHit(suburban, 0.08, 0.18);
        applyOccupancyHit(others,   0.03, 0.08);
        const msg = pick([
          "Major corporations announced permanent hybrid work policies this quarter, triggering lease non-renewals across suburban office markets. Your CBD assets are more resilient but not immune.",
          "A survey of Fortune 500 tenants shows significant planned footprint reductions. Suburban office is most exposed; flight-to-quality continues to benefit Tier 1 assets.",
        ]);
        return { headline: "🏠 WFH Structural Shift", body: msg, impact: "Office occupancy down, suburban worst" };
      },
    },

    {
      id: "industrial_boom",
      name: "Industrial / Logistics Boom",
      type: "sector",
      target: { sector: "industrial" },
      baseProbability: 0.14,
      cycleBias: { expanding: 2.0, stable: 1.5, contracting: 0.8, recession: 0.4 },
      apply() {
        const props = getMatching(p => p.sector === "industrial");
        if (props.length === 0) return null;
        applyNOIChange(props, 0.03, 0.08);
        props.forEach(p => {
          p.occupancy = Math.min(1.0, fmt(p.occupancy + randBetween(0.01, 0.04)));
        });
        const msg = pick([
          "E-commerce demand continues to surge, driving record absorption of industrial space. Your logistics assets are benefiting from strong rent growth and near-full occupancy.",
          "Supply chain restructuring is driving demand for last-mile logistics facilities. Your industrial portfolio is commanding premium rents at lease renewal.",
        ]);
        return { headline: "📦 Industrial Boom", body: msg, impact: "Industrial NOI & occupancy up" };
      },
    },

    {
      id: "multifamily_oversupply",
      name: "Housing Oversupply",
      type: "sector",
      target: { sector: "multifamily" },
      baseProbability: 0.10,
      cycleBias: { expanding: 1.5, stable: 1.0, contracting: 0.8, recession: 0.5 },
      apply() {
        const props = getMatching(p =>
          p.sector === "multifamily" && p.location === "suburban"
        );
        if (props.length === 0) return null;
        applyOccupancyHit(props, 0.04, 0.10);
        applyNOIChange(props, -0.03, -0.07);
        const msg = pick([
          "A construction boom over the past two years has flooded suburban apartment markets with new supply. Concessions are rising and renewal rents are flat to down.",
          "Suburban multifamily is absorbing a surge of new completions. Your suburban apartment communities are facing higher vacancy and lower effective rents.",
        ]);
        return { headline: "🏘️ Multifamily Oversupply", body: msg, impact: "Suburban multifamily NOI & occupancy down" };
      },
    },

    {
      id: "multifamily_shortage",
      name: "Housing Shortage Windfall",
      type: "sector",
      target: { sector: "multifamily" },
      baseProbability: 0.10,
      cycleBias: { expanding: 1.5, stable: 1.2, contracting: 0.8, recession: 0.3 },
      apply() {
        const props = getMatching(p => p.sector === "multifamily");
        if (props.length === 0) return null;
        applyNOIChange(props, 0.04, 0.09);
        props.forEach(p => {
          p.occupancy = Math.min(1.0, fmt(p.occupancy + randBetween(0.01, 0.03)));
        });
        const msg = "A chronic shortage of housing supply combined with strong population growth has pushed rents sharply higher. Your multifamily portfolio is seeing strong mark-to-market rent gains at lease expiry.";
        return { headline: "🏠 Housing Shortage Windfall", body: msg, impact: "Multifamily NOI & occupancy up" };
      },
    },

    // ---- PROPERTY-LEVEL EVENTS ----------------------------------------

    {
      id: "major_tenant_bankruptcy",
      name: "Major Tenant Bankruptcy",
      type: "property",
      target: null,
      baseProbability: 0.18,
      cycleBias: { expanding: 0.5, stable: 0.8, contracting: 1.8, recession: 2.5 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Pick one property at random, weighted toward retail and office
        const weighted = GameState.portfolio.flatMap(p =>
          p.sector === "retail" ? [p, p] :
          p.sector === "office" ? [p, p] : [p]
        );
        const prop = pick(weighted);
        const hit = randBetween(0.08, 0.20);
        const oldOcc = prop.occupancy;
        prop.occupancy = Math.max(0.30, fmt(prop.occupancy - hit));
        const cost = randBetween(0.5, 2.0);
        addUnusualItem(-fmt(cost));
        const msg = pick([
          `A major tenant at ${prop.name} filed for Chapter 11 bankruptcy protection, vacating ${fmt(hit*100)}% of leasable area. We incurred $${fmt(cost)}M in lease termination and re-leasing costs.`,
          `${prop.name} lost its anchor tenant to insolvency this quarter. Occupancy fell from ${fmt(oldOcc*100)}% to ${fmt(prop.occupancy*100)}%. Re-leasing efforts are underway but will take 2–3 quarters.`,
        ]);
        return { headline: "💥 Tenant Bankruptcy", body: msg, impact: `${prop.name} occupancy -${fmt(hit*100)}%` };
      },
    },

    {
      id: "major_repair",
      name: "Unexpected Capital Repair",
      type: "property",
      target: null,
      baseProbability: 0.15,
      cycleBias: { expanding: 1.0, stable: 1.0, contracting: 1.0, recession: 1.0 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Older properties more likely
        const weighted = GameState.portfolio.flatMap(p =>
          p.age > 15 ? [p, p, p] : p.age > 8 ? [p, p] : [p]
        );
        const prop = pick(weighted);
        const cost = randBetween(1.0, fmt(prop.currentValue * 0.04));
        addUnusualItem(-fmt(cost));
        const msg = pick([
          `${prop.name} (age ${prop.age} years) required emergency roof replacement and HVAC system upgrade this quarter, resulting in a $${fmt(cost)}M unplanned capital expense.`,
          `An inspection at ${prop.name} revealed significant structural issues requiring immediate remediation. The $${fmt(cost)}M repair program has been expensed this quarter.`,
          `Fire suppression system failure at ${prop.name} required full system replacement. Insurance covered 40% of the $${fmt(cost*1.67)}M cost; our net expense was $${fmt(cost)}M.`,
        ]);
        return { headline: "🔧 Emergency Repair Required", body: msg, impact: `-$${fmt(cost)}M unusual expense` };
      },
    },

    {
      id: "new_lease_windfall",
      name: "Major New Lease Signed",
      type: "property",
      target: null,
      baseProbability: 0.14,
      cycleBias: { expanding: 2.0, stable: 1.2, contracting: 0.6, recession: 0.3 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Prefer properties with room to improve
        const candidates = GameState.portfolio.filter(p => p.occupancy < 0.92);
        if (candidates.length === 0) return null;
        const prop = pick(candidates);
        const gain = randBetween(0.03, 0.09);
        prop.occupancy = Math.min(1.0, fmt(prop.occupancy + gain));
        applyNOIChange([prop], 0.02, 0.05);
        const msg = pick([
          `We are pleased to announce a long-term lease agreement at ${prop.name} with a creditworthy national tenant. Occupancy at the property has increased to ${fmt(prop.occupancy*100)}%.`,
          `${prop.name} signed a 10-year anchor lease this quarter, meaningfully improving occupancy and locking in above-market rents for the next decade.`,
        ]);
        return { headline: "✅ Major Lease Signed", body: msg, impact: `${prop.name} occupancy +${fmt(gain*100)}%` };
      },
    },

    {
      id: "zoning_approval",
      name: "Zoning / Development Approval",
      type: "property",
      target: null,
      baseProbability: 0.08,
      cycleBias: { expanding: 1.5, stable: 1.2, contracting: 0.8, recession: 0.5 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        const prop = pick(GameState.portfolio);
        const valueGain = randBetween(0.03, 0.08);
        prop.currentValue = fmt(prop.currentValue * (1 + valueGain));
        const msg = `Planning authorities approved a density uplift application at ${prop.name}, allowing for additional development rights. Independent appraisers have marked the property up ${fmt(valueGain*100)}% to reflect the enhanced entitlement value.`;
        return { headline: "📋 Zoning Approval", body: msg, impact: `${prop.name} value +${fmt(valueGain*100)}%` };
      },
    },

    {
      id: "natural_disaster",
      name: "Natural Disaster / Extreme Weather",
      type: "property",
      target: null,
      baseProbability: 0.06,
      cycleBias: { expanding: 1.0, stable: 1.0, contracting: 1.0, recession: 1.0 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Hit suburban properties more (less resilient infrastructure)
        const weighted = GameState.portfolio.flatMap(p =>
          p.location === "suburban" ? [p, p] : [p]
        );
        const prop = pick(weighted);
        const cost = randBetween(2.0, fmt(prop.currentValue * 0.06));
        const occHit = randBetween(0.05, 0.15);
        prop.occupancy = Math.max(0.30, fmt(prop.occupancy - occHit));
        addUnusualItem(-fmt(cost));
        const msg = pick([
          `Severe flooding caused significant damage to ${prop.name}. Insurance claims are underway but the net uninsured cost is estimated at $${fmt(cost)}M. Occupancy has been temporarily impacted while repairs are completed.`,
          `${prop.name} sustained structural damage from an extreme weather event. Emergency repairs are costing $${fmt(cost)}M. Several tenants have invoked force majeure clauses on their leases.`,
        ]);
        return { headline: "🌪️ Natural Disaster", body: msg, impact: `-$${fmt(cost)}M + occupancy hit` };
      },
    },

    {
      id: "hurricane_citywide",
      name: "Hurricane Sweeps the City",
      type: "property",
      target: null,
      baseProbability: 0.05,
      cycleBias: { expanding: 1.0, stable: 1.0, contracting: 1.0, recession: 1.0 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Citywide — hits several properties, suburban/coastal worse
        var hits = 0, totalCost = 0;
        GameState.portfolio.forEach(function(p) {
          var exposure = p.location === "suburban" ? 0.7 : p.location === "tier2" ? 0.5 : 0.35;
          if (Math.random() < exposure) {
            var occHit = randBetween(0.03, 0.10);
            p.occupancy = Math.max(0.30, fmt(p.occupancy - occHit));
            var c = randBetween(0.4, fmt(p.currentValue * 0.025));
            totalCost += c; hits++;
          }
        });
        if (hits === 0) return null;
        addUnusualItem(-fmt(totalCost));
        return { headline: "🌀 Hurricane Hits the City", body: "A major hurricane swept across the metro area, damaging " + hits + " of our properties. Cleanup, repairs and tenant disruption cost $" + fmt(totalCost) + "M this quarter, with occupancy dented across the affected assets. Recovery will be gradual.", impact: "-$" + fmt(totalCost) + "M, " + hits + " properties hit" };
      },
    },

    {
      id: "obsolete_equipment",
      name: "Obsolete Equipment (Industrial)",
      type: "property",
      target: null,
      baseProbability: 0.10,
      cycleBias: { expanding: 1.2, stable: 1.0, contracting: 0.8, recession: 0.6 },
      apply() {
        var industrial = GameState.portfolio.filter(function(p) { return p.sector === "industrial"; });
        if (industrial.length === 0) return null;
        var prop = pick(industrial);
        var cost = randBetween(1.0, fmt(prop.currentValue * 0.05));
        addUnusualItem(-fmt(cost));
        // Upgrading preserves NOI; we model auto-upgrade (keeps the tenant)
        return { headline: "🏭 Equipment Modernization", body: prop.name + "'s anchor tenant demanded modernization of aging loading docks and climate systems to renew their lease. We funded the $" + fmt(cost) + "M upgrade to retain them — the alternative was losing a major tenant.", impact: "-$" + fmt(cost) + "M capital upgrade" };
      },
    },

    {
      id: "crime_wave_suburban",
      name: "Crime Wave (Suburban)",
      type: "property",
      target: null,
      baseProbability: 0.09,
      cycleBias: { expanding: 0.6, stable: 1.0, contracting: 1.4, recession: 1.8 },
      apply() {
        var suburban = GameState.portfolio.filter(function(p) { return p.location === "suburban"; });
        if (suburban.length === 0) return null;
        var prop = pick(suburban);
        var cost = randBetween(0.3, 0.8);
        var occHit = randBetween(0.03, 0.08);
        prop.occupancy = Math.max(0.30, fmt(prop.occupancy - occHit));
        addUnusualItem(-fmt(cost));
        return { headline: "🚨 Rising Crime Hits Suburb", body: "A spike in property crime around " + prop.name + " has spooked tenants. We've engaged a private security firm ($" + fmt(cost) + "M) but some tenants didn't renew — occupancy slipped " + fmt(occHit*100) + "%.", impact: prop.name + " occupancy -" + fmt(occHit*100) + "%" };
      },
    },

    {
      id: "anchor_renegotiation",
      name: "Anchor Tenant Renegotiation (Retail)",
      type: "property",
      target: null,
      baseProbability: 0.10,
      cycleBias: { expanding: 0.6, stable: 1.0, contracting: 1.5, recession: 2.0 },
      apply() {
        var retail = GameState.portfolio.filter(function(p) { return p.sector === "retail"; });
        if (retail.length === 0) return null;
        var prop = pick(retail);
        // Anchor demands rent cut; we model accepting a modest NOI reduction
        var noiCut = randBetween(0.04, 0.10);
        prop.annualNOI = fmt(prop.annualNOI * (1 - noiCut));
        return { headline: "🏬 Anchor Tenant Squeeze", body: "The anchor tenant at " + prop.name + " leveraged soft retail conditions to renegotiate their lease downward. We accepted a " + fmt(noiCut*100) + "% rent reduction to keep them — losing them would have been worse.", impact: prop.name + " NOI -" + fmt(noiCut*100) + "%" };
      },
    },

    {
      id: "environmental_remediation",
      name: "Environmental Remediation",
      type: "property",
      target: null,
      baseProbability: 0.07,
      cycleBias: { expanding: 1.0, stable: 1.0, contracting: 1.0, recession: 1.0 },
      apply() {
        var eligible = GameState.portfolio.filter(function(p) { return p.sector === "office" || p.sector === "industrial"; });
        if (eligible.length === 0) return null;
        var prop = pick(eligible);
        var cost = randBetween(1.0, fmt(prop.currentValue * 0.045));
        addUnusualItem(-fmt(cost));
        return { headline: "☣️ Environmental Cleanup", body: "Mandatory environmental testing at " + prop.name + " uncovered asbestos and soil contamination requiring remediation. Regulators gave us no choice — the $" + fmt(cost) + "M cleanup was expensed this quarter.", impact: "-$" + fmt(cost) + "M remediation" };
      },
    },

    {
      id: "tax_reassessment",
      name: "Property Tax Reassessment",
      type: "market",
      target: null,
      baseProbability: 0.09,
      cycleBias: { expanding: 1.4, stable: 1.0, contracting: 0.7, recession: 0.5 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Citywide reassessment nudges NOI down a touch across the portfolio
        var noiCut = randBetween(0.01, 0.03);
        GameState.portfolio.forEach(function(p) { p.annualNOI = fmt(p.annualNOI * (1 - noiCut)); });
        return { headline: "🏛️ Tax Reassessment", body: "The city reassessed commercial property values upward, raising our property tax burden across the portfolio. Net operating income takes a " + fmt(noiCut*100) + "% haircut. We could appeal, but the odds and legal costs rarely favor it.", impact: "Portfolio NOI -" + fmt(noiCut*100) + "%" };
      },
    },

    {
      id: "viral_prestige_moment",
      name: "Viral / Prestige Moment",
      type: "property",
      target: null,
      baseProbability: 0.08,
      cycleBias: { expanding: 1.5, stable: 1.0, contracting: 0.7, recession: 0.4 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        var prop = pick(GameState.portfolio);
        var occBoost = randBetween(0.03, 0.07);
        prop.occupancy = Math.min(0.99, fmt(prop.occupancy + occBoost));
        return { headline: "✨ A Property Goes Viral", body: prop.name + " caught fire on social media after a viral moment, and a prestige tenant signed on to be associated with it. Leasing demand surged — occupancy climbed " + fmt(occBoost*100) + "%. Sometimes you get lucky.", impact: prop.name + " occupancy +" + fmt(occBoost*100) + "%" };
      },
    },


    {
      id: "acquisition_offer",
      name: "Unsolicited Acquisition Offer",
      type: "property",
      target: null,
      baseProbability: 1.0,   // gating handled inside apply() (once/year, skill-scaled)
      cycleBias: { expanding: 1.0, stable: 1.0, contracting: 1.0, recession: 1.0 },
      apply() {
        if (GameState.portfolio.length === 0) return null;
        // Requires Acquisitions Lead — they source the buyers
        if (typeof Staff === "undefined" || !Staff.hasRole("acquisitions")) return null;

        // Once per year only
        if (GameState._lastBuyerFindYear === GameState.meta.year) return null;
        GameState._lastBuyerFindYear = GameState.meta.year;

        // Chance of FINDING a buyer scales with skill: ~50% (low) to ~90% (high)
        var findChance = 0.50 + Staff.skillFactor("acquisitions") * 0.40;
        if (Math.random() > findChance) {
          // He looked but found nothing this year — quiet, no popup
          return null;
        }

        // Prefer an underperforming property (the AL finds buyers for weak assets)
        var underperformers = GameState.portfolio.filter(function(p) { return p.occupancy < 0.82 && !p.underConstruction; });
        const prop = underperformers.length > 0 ? pick(underperformers) : pick(GameState.portfolio);
        if (prop.underConstruction) return null;

        // Premium scales with skill: ~10% (low) to ~25% (high)
        const premium = 0.10 + Staff.skillFactor("acquisitions") * 0.15;
        const offerPrice = fmt(prop.currentValue * (1 + premium));
        const al = Staff.getStaff("acquisitions");
        GameState._pendingOffer = {
          propertyId: prop.id,
          propertyName: prop.name,
          offerPrice,
          premium: fmt(premium * 100),
          expiresNextQuarter: true,
          alName: al.name,
          alPortrait: al.portrait,
        };
        const msg = al.name + " (Acquisitions): \"Boss, I found a buyer for " + prop.name + " at $" + offerPrice + "M — a " + fmt(premium*100) + "% premium to appraised value. " + (prop.occupancy < 0.82 ? "Good chance to offload an underperformer. " : "") + "We can accept or decline next quarter.\"";
        return { headline: "💼 " + al.name + " Found a Buyer", body: msg, impact: "Offer: $" + offerPrice + "M for " + prop.name };
      },
    },

  ]; // end EVENT_CATALOGUE

  // ----------------------------------------------------------
  // ROLL EVENTS FOR THE QUARTER
  // Returns array of events that fired this quarter
  // ----------------------------------------------------------
  function rollEvents() {
    const cycle = GameState.market.cycle;
    const year = GameState.meta.year;
    const firedEvents = [];

    // Base number of event slots per quarter (increases with years)
    const eventSlots = Math.min(3, 1 + Math.floor(year / 3));

    // Events that inflict damage (cost / occupancy loss) — throttled by cooldown
    var HARMFUL_IDS = {
      credit_crunch:true, pandemic_shock:true, interest_rate_shock:true,
      retail_oversupply:true, office_wfh:true, multifamily_oversupply:true,
      major_tenant_bankruptcy:true, major_repair:true, natural_disaster:true,
      hurricane_citywide:true, obsolete_equipment:true, crime_wave_suburban:true,
      anchor_renegotiation:true, environmental_remediation:true, tax_reassessment:true,
    };

    // Build probability-adjusted list
    const candidates = EVENT_CATALOGUE.map(evt => {
      const bias = evt.cycleBias[cycle] || 1.0;
      // Probability scales up slightly with years (world gets more volatile)
      const yearMod = 1 + (year - 1) * 0.05;
      evt.harmful = !!HARMFUL_IDS[evt.id];
      return {
        evt,
        probability: Math.min(0.60, evt.baseProbability * bias * yearMod),
      };
    });

    // Roll each event independently, but throttle NEGATIVE shocks with a
    // global cooldown so the player isn't hit with a bad event every quarter.
    const firedIds = new Set();
    var negativeCooldown = GameState._negEventCooldown || 0;
    var firedNegativeThisQuarter = false;

    candidates.forEach(({ evt, probability }) => {
      if (firedIds.has(evt.id)) return;
      // Year 1 is an orientation year — suppress harmful macro shocks entirely.
      if (year <= 1 && evt.harmful) return;
      // If a negative event is on cooldown, skip harmful events this quarter.
      if (evt.harmful && (negativeCooldown > 0 || firedNegativeThisQuarter)) return;
      if (Math.random() < probability) {
        const result = evt.apply();
        if (result) {
          firedIds.add(evt.id);
          firedEvents.push(result);
          if (evt.harmful) {
            firedNegativeThisQuarter = true;
            // After a negative shock, 2-3 quarter breather before the next one.
            GameState._negEventCooldown = 2 + Math.floor(Math.random() * 2);
          }
        }
      }
    });
    if (negativeCooldown > 0) GameState._negEventCooldown = negativeCooldown - 1;

    // Cap at eventSlots to avoid chaos
    return firedEvents.slice(0, eventSlots);
  }

  // ----------------------------------------------------------
  // INITIALISE — clear any pending offers at game start
  // ----------------------------------------------------------
  function init() {
    GameState._pendingOffer = null;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    rollEvents,
    EVENT_CATALOGUE,
  };

})();
