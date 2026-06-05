// ============================================================
// decisions.js — Interactive decision events
// 6 events, 3 choices each: cash / income / political capital
// REIT Simulator Game
// ============================================================

window.Decisions = (function() {

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function fmt(n, d) { d = d === undefined ? 1 : d; return Math.round(n * Math.pow(10,d)) / Math.pow(10,d); }

  var TENANT_NAMES = ["RetailCo Inc","LogiTrans Ltd","MegaMart Group","TechSpace Corp",
    "National Grocers","FastShip LLC","UrbanFit Gyms","CityBank Branch","CloudBase Inc","BuildRight Co"];

  // ----------------------------------------------------------
  // EVENT 1: TENANT IN DISTRESS
  // Most frequent. Trigger: sector risk × market cycle
  // ----------------------------------------------------------
  function checkTenantDistress() {
    if (GameState.portfolio.length === 0) return null;
    // Max once every 4 quarters (once per year)
    var lastFired = GameState._lastTenantDistressYear || 0;
    if (GameState.meta.year <= lastFired) return null;

    var cycle = GameState.market.cycle;
    var mult  = cycle==="recession"?2 : cycle==="contracting"?1.5 : cycle==="stable"?1 : 0.3;
    // Much lower base probabilities — roughly 2% per quarter per property in stable
    var risk  = { retail:0.025, office:0.015, multifamily:0.008, industrial:0.005 };
    var hits  = GameState.portfolio.filter(function(p) {
      return Math.random() < (risk[p.sector]||0.01) * mult;
    });
    if (hits.length === 0) return null;
    GameState._lastTenantDistressYear = GameState.meta.year;
    return pick(hits);
  }

  function generateTenantDistress(prop) {
    var tenant      = pick(TENANT_NAMES);
    var concession  = fmt(prop.annualNOI * 0.20 / 4, 2); // quarterly income loss
    var relettingCost = fmt(prop.annualNOI * 0.10, 2);   // one-time cash cost

    return {
      id:       "tenant_distress",
      prop:     prop,
      headline: "⚠️ Tenant in Financial Distress",
      body:     tenant + " at " + prop.name + " cannot meet rent obligations.\n" +
                "Sector: " + prop.sector + " | Occupancy: " + fmt(prop.occupancy*100,0) + "%\n" +
                "Market cycle: " + GameState.market.cycle,
      choices: [
        {
          label:  "💰 Re-let — evict and find new tenant",
          detail: "Pay re-letting fee $" + relettingCost + "M now.\n" +
                  "Occupancy drops ~25% for 2-3 quarters.\n" +
                  "New tenant at market rate after.\n" +
                  "COST TYPE: Cash ($" + relettingCost + "M immediate)",
          costType: "cash",
          outcome: function() {
            GameState.balance.cash = fmt(GameState.balance.cash - parseFloat(relettingCost));
            prop.occupancy = Math.max(0.30, fmt(prop.occupancy - prop.occupancy*0.25, 3));
            var ok = Board.getDirectorState("okafor");
            if (ok) ok.attitude = Math.min(10, ok.attitude + 0.3);
            return "Tenant evicted. Re-letting begun. Cost: $" + relettingCost + "M.";
          }
        },
        {
          label:  "📉 Grant rent concession — reduce 20% until market recovers",
          detail: "NOI on this property drops 20% ($" + concession + "M/qtr).\n" +
                  "Lasts until market cycle returns to Expanding.\n" +
                  "No cash cost. Tenant stays.\n" +
                  "COST TYPE: Income (unknown duration)",
          costType: "income",
          outcome: function() {
            prop.concessionActive = true;
            prop.annualNOI = fmt(prop.annualNOI * 0.80);
            var ha = Board.getDirectorState("hassan");
            if (ha) ha.attitude = Math.min(10, ha.attitude + 0.5);
            return "Concession granted. NOI reduced 20% until market recovers.";
          }
        },
        {
          label:  "💡 Spend 1 Political Capital — city retention scheme",
          detail: "Use board connections to access city business support.\n" +
                  "Tenant saved at zero cash cost, full rent preserved.\n" +
                  "COST TYPE: 1 Political Capital",
          costType: "capital",
          cost: 1,
          outcome: function() {
            var ok = Board.getDirectorState("okafor");
            if (ok) ok.attitude = Math.min(10, ok.attitude + 0.3);
            return "City retention scheme approved. Tenant remains at full rent.";
          }
        }
      ]
    };
  }

  // ----------------------------------------------------------
  // EVENT 2: DISTRESSED PROPERTY OPPORTUNITY
  // Trigger: contracting or recession, 10% chance
  // ----------------------------------------------------------
  function checkDistressedProperty() {
    var cycle = GameState.market.cycle;
    if (cycle !== "contracting" && cycle !== "recession") return null;
    return Math.random() < 0.16 ? true : null;
  }

  function generateDistressedProperty() {
    var sectors   = ["office","retail","industrial","multifamily"];
    var locations = ["tier1","tier2","suburban"];
    var s = pick(sectors), l = pick(locations);
    var prop = Properties.generateProperty(s, l, false, true);
    var price = fmt(prop.currentValue * 0.65, 1); // 35% discount
    prop.askingPrice = price;
    var interestCost = fmt(price * (GameState.market.baseInterestRate + GameState.credit.spread) / 100 / 4, 2);

    return {
      id:       "distressed_property",
      prop:     prop,
      headline: "🏢 Distressed Property Available",
      body:     prop.name + " (" + s + " · " + l + ") at 35% below market.\n" +
                "Market value: $" + fmt(prop.currentValue,1) + "M | Asking: $" + price + "M\n" +
                "NOI: $" + fmt(prop.annualNOI,1) + "M/yr | Occupancy: " + fmt(prop.occupancy*100,0) + "%",
      choices: [
        {
          label:  "💰 Buy with cash — $" + price + "M",
          detail: "Immediate acquisition at 35% discount.\n" +
                  "Chen +1.0 | Cash depletes $" + price + "M.\n" +
                  "COST TYPE: Cash ($" + price + "M immediate)",
          costType: "cash",
          check: function() { return GameState.balance.cash >= parseFloat(price); },
          checkMsg: "Insufficient cash.",
          outcome: function() {
            GameState.balance.cash = fmt(GameState.balance.cash - parseFloat(price));
            prop.purchasePrice = parseFloat(price);
            prop.quarterOwned  = 0;
            GameState.portfolio.push(prop);
            GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear||0)+1;
            var ch = Board.getDirectorState("chen");
            if (ch) ch.attitude = Math.min(10, ch.attitude+1.0);
            return prop.name + " acquired for $" + price + "M — 35% below market.";
          }
        },
        {
          label:  "📉 Buy but reduce dividend to fund it",
          detail: "Acquire property. Cut dividend 15% to preserve cash.\n" +
                  "Williams -0.5 | Chen +1.0.\n" +
                  "COST TYPE: Income (permanent dividend reduction)",
          costType: "income",
          check: function() { return GameState.balance.cash >= parseFloat(price) * 0.3; },
          checkMsg: "Need at least 30% of purchase price in cash.",
          outcome: function() {
            var partCash = fmt(parseFloat(price) * 0.3);
            GameState.balance.cash = fmt(GameState.balance.cash - partCash);
            var newDiv = fmt(GameState.company.dividendPerShare * 0.85, 2);
            Financials.setDividend(newDiv);
            prop.purchasePrice = parseFloat(price);
            prop.quarterOwned  = 0;
            GameState.portfolio.push(prop);
            GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear||0)+1;
            var ch = Board.getDirectorState("chen");
            if (ch) ch.attitude = Math.min(10, ch.attitude+1.0);
            var w = Board.getDirectorState("williams");
            if (w) w.attitude = Math.max(0, w.attitude-0.5);
            return prop.name + " acquired. Dividend cut to $" + newDiv + "/share to fund it.";
          }
        },
        {
          label:  "💡 Spend 1 Political Capital — co-investor partner",
          detail: "Use connections to bring in a silent co-investor.\n" +
                  "You fund only 50% but get 70% of upside.\n" +
                  "COST TYPE: 1 Political Capital",
          costType: "capital",
          cost: 1,
          check: function() { return GameState.balance.cash >= parseFloat(price) * 0.50; },
          checkMsg: "Need at least 50% of purchase price in cash.",
          outcome: function() {
            var halfPrice = fmt(parseFloat(price) * 0.50);
            GameState.balance.cash = fmt(GameState.balance.cash - halfPrice);
            prop.purchasePrice = parseFloat(price);
            prop.currentValue  = fmt(prop.currentValue * 0.70); // 70% ownership stake
            prop.annualNOI     = fmt(prop.annualNOI * 0.70);
            prop.quarterOwned  = 0;
            GameState.portfolio.push(prop);
            GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear||0)+1;
            var ch = Board.getDirectorState("chen");
            if (ch) ch.attitude = Math.min(10, ch.attitude+0.7);
            return prop.name + " acquired via co-investment. You own 70% for $" + halfPrice + "M.";
          }
        }
      ]
    };
  }

  // ----------------------------------------------------------
  // EVENT 3: ZONING OPPORTUNITY
  // Trigger: suburban property owned, 8% chance
  // ----------------------------------------------------------
  function checkZoning() {
    var sub = GameState.portfolio.filter(function(p) { return p.location==="suburban"; });
    if (sub.length === 0) return null;
    return Math.random() < 0.22 ? pick(sub) : null;
  }

  function generateZoning(prop) {
    var valueGain = fmt(prop.currentValue * 0.20, 1);
    var noiGain   = fmt(prop.annualNOI * 0.12, 2);
    var lobbyCost = fmt(Math.max(0.5, prop.currentValue * 0.025), 2);
    var noiFee    = fmt(prop.annualNOI * 0.05 / 4, 2); // quarterly planning fee

    return {
      id:       "zoning_opportunity",
      prop:     prop,
      headline: "📋 Zoning Change Opportunity",
      body:     "City planning is reviewing mixed-use zoning for " + prop.name + ".\n" +
                "Approval adds residential use rights — value +$" + valueGain + "M, NOI +$" + noiGain + "M/yr.\n" +
                "You must decide this quarter.",
      choices: [
        {
          label:  "💰 Formal application — $" + lobbyCost + "M in fees",
          detail: "60% approval: value +$" + valueGain + "M, NOI +$" + noiGain + "M/yr.\n" +
                  "40% rejected: fees lost.\n" +
                  "COST TYPE: Cash ($" + lobbyCost + "M immediate, risky)",
          costType: "cash",
          check: function() { return GameState.balance.cash >= parseFloat(lobbyCost); },
          checkMsg: "Insufficient cash for application fees.",
          outcome: function() {
            GameState.balance.cash = fmt(GameState.balance.cash - parseFloat(lobbyCost));
            if (Math.random() < 0.60) {
              prop.currentValue = fmt(prop.currentValue + parseFloat(valueGain));
              prop.annualNOI    = fmt(prop.annualNOI + parseFloat(noiGain));
              return "Zoning approved! " + prop.name + " value +$" + valueGain + "M.";
            }
            return "Application rejected. $" + lobbyCost + "M in fees lost.";
          }
        },
        {
          label:  "📉 Self-fund planning process — reduces NOI",
          detail: "Dedicate internal resources. Slower (2 quarters).\n" +
                  "NOI reduced $" + noiFee + "M/qtr for 2 quarters while process runs.\n" +
                  "75% approval rate — more thorough.\n" +
                  "COST TYPE: Income ($" + noiFee + "M/qtr for 2 quarters)",
          costType: "income",
          outcome: function() {
            prop.zoningInProgress = 2; // quarters remaining
            prop.annualNOI = fmt(prop.annualNOI * 0.95);
            prop.zoningValueGain = parseFloat(valueGain);
            prop.zoningNOIGain   = parseFloat(noiGain);
            prop.zoningSuccessRate = 0.75;
            return "Internal planning process started. Takes 2 quarters. NOI slightly reduced.";
          }
        },
        {
          label:  "💡 Spend 2 Political Capital — board connections",
          detail: "Board network fast-tracks approval.\n" +
                  "90% success rate. No cash. Instant.\n" +
                  "COST TYPE: 2 Political Capital",
          costType: "capital",
          cost: 2,
          outcome: function() {
            if (Math.random() < 0.90) {
              prop.currentValue = fmt(prop.currentValue + parseFloat(valueGain));
              prop.annualNOI    = fmt(prop.annualNOI + parseFloat(noiGain));
              return "Board connections secured approval. " + prop.name + " value +$" + valueGain + "M.";
            }
            return "Despite connections, planning committee rejected the application.";
          }
        }
      ]
    };
  }

  // ----------------------------------------------------------
  // EVENT 4: TENANT EXPANSION REQUEST
  // Trigger: property > 85% occupancy, 12% chance
  // ----------------------------------------------------------
  function checkExpansion() {
    var candidates = GameState.portfolio.filter(function(p) {
      return p.occupancy >= 0.85 && p.occupancy < 0.97;
    });
    return candidates.length > 0 && Math.random() < 0.30 ? pick(candidates) : null;
  }

  function generateExpansion(prop) {
    var tenant   = pick(TENANT_NAMES);
    var noiBoost = fmt(prop.annualNOI * 0.15, 2);
    var incentive= fmt(prop.annualNOI * 0.05, 2); // fit-out incentive cost

    return {
      id:       "tenant_expansion",
      prop:     prop,
      headline: "📈 Tenant Expansion Request",
      body:     tenant + " at " + prop.name + " wants to expand into vacant space.\n" +
                "Current occupancy: " + fmt(prop.occupancy*100,0) + "% → potential: 97%\n" +
                "They need your answer this quarter.",
      choices: [
        {
          label:  "💰 Offer fit-out incentive — $" + incentive + "M",
          detail: "Pay tenant fit-out costs to secure them immediately.\n" +
                  "Occupancy → 97%. Lease locked 5 years.\n" +
                  "NOI +" + noiBoost + "M/yr guaranteed.\n" +
                  "COST TYPE: Cash ($" + incentive + "M immediate)",
          costType: "cash",
          check: function() { return GameState.balance.cash >= parseFloat(incentive); },
          checkMsg: "Insufficient cash for fit-out incentive.",
          outcome: function() {
            GameState.balance.cash = fmt(GameState.balance.cash - parseFloat(incentive));
            prop.occupancy  = 0.97;
            prop.annualNOI  = fmt(prop.annualNOI * 1.15);
            return tenant + " expansion secured with incentive. Occupancy 97%, NOI +" + noiBoost + "M/yr.";
          }
        },
        {
          label:  "📉 Negotiate 15% rent increase — risk tenant walks",
          detail: "Push for higher rent on expanded space.\n" +
                  "60%: occupancy 97%, NOI +" + noiBoost + "M/yr.\n" +
                  "40%: tenant declines entirely, occupancy drops 10%.\n" +
                  "COST TYPE: Income risk (no upfront cost but downside possible)",
          costType: "income",
          outcome: function() {
            if (Math.random() < 0.60) {
              prop.occupancy = 0.97;
              prop.annualNOI = fmt(prop.annualNOI * 1.15);
              return tenant + " accepted 15% increase. Occupancy 97%, NOI +" + noiBoost + "M/yr.";
            }
            prop.occupancy = fmt(Math.max(0.60, prop.occupancy - 0.10), 3);
            return tenant + " rejected the increase and reduced their footprint. Occupancy fell 10%.";
          }
        },
        {
          label:  "💡 Spend 1 Political Capital — lock in anchor status",
          detail: "Use connections to formalize as anchor tenant.\n" +
                  "Occupancy → 97%. 7-year lease. NOI +" + noiBoost + "M/yr.\n" +
                  "No cash cost. Best lease terms in market.\n" +
                  "COST TYPE: 1 Political Capital",
          costType: "capital",
          cost: 1,
          outcome: function() {
            prop.occupancy = 0.97;
            prop.annualNOI = fmt(prop.annualNOI * 1.15);
            var ha = Board.getDirectorState("hassan");
            if (ha) ha.attitude = Math.min(10, ha.attitude + 0.5);
            return tenant + " locked in as anchor for 7 years. Occupancy 97%, NOI +" + noiBoost + "M/yr.";
          }
        }
      ]
    };
  }

  // ----------------------------------------------------------
  // EVENT 5: ACTIVIST INVESTOR
  // Trigger: Year 3+, share price down >15%, 8% per year
  // ----------------------------------------------------------
  function checkActivist() {
    if (GameState.meta.year < 3) return null;
    var start = GameState.board.startYearSharePrice || GameState.company.sharePrice;
    if (GameState.company.sharePrice > start * 0.85) return null;
    return Math.random() < 0.08 ? true : null;
  }

  function generateActivist() {
    var funds  = ["Citadel Partners","Elliott Management","Third Point LLC","ValueAct Capital"];
    var fund   = pick(funds);
    var newDiv = fmt(GameState.company.dividendPerShare * 1.15, 2);
    var gaoCut = fmt(GameState.pnl.gAndA * 0.10, 2);

    return {
      id:       "activist_investor",
      headline: "📢 Activist Investor Takes Stake",
      body:     fund + " acquired 6% of " + GameState.company.name + " and filed a public letter.\n" +
                "They cite poor share performance and demand immediate changes.",
      choices: [
        {
          label:  "💰 Cut G&A costs — $" + gaoCut + "M savings per quarter",
          detail: "Restructure management team. G&A -10% immediately.\n" +
                  "Activist satisfied. Share price +5%.\n" +
                  "Hassan -0.5 (operational disruption).\n" +
                  "COST TYPE: Cash (severance $" + fmt(parseFloat(gaoCut)*2,2) + "M one-time)",
          costType: "cash",
          outcome: function() {
            var severance = parseFloat(gaoCut) * 2;
            GameState.balance.cash = fmt(GameState.balance.cash - severance);
            GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.05);
            var ha = Board.getDirectorState("hassan");
            if (ha) ha.attitude = Math.max(0, ha.attitude - 0.5);
            var pe = Board.getDirectorState("petrova");
            if (pe) pe.attitude = Math.min(10, pe.attitude + 0.5);
            return fund + " satisfied with restructuring. Share price +5%.";
          }
        },
        {
          label:  "📉 Commit to dividend increase to $" + newDiv + "/share",
          detail: "Raise dividend 15% — permanent income commitment.\n" +
                  "Share price +8%. Activist backs off.\n" +
                  "Williams +1.0.\n" +
                  "COST TYPE: Income (permanent dividend increase)",
          costType: "income",
          outcome: function() {
            Financials.setDividend(parseFloat(newDiv));
            GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.08);
            var w = Board.getDirectorState("williams");
            if (w) w.attitude = Math.min(10, w.attitude + 1.0);
            return fund + " satisfied with dividend commitment. Share +8%.";
          }
        },
        {
          label:  "💡 Spend 2 Political Capital — negotiate privately",
          detail: "Private meeting. No public commitments.\n" +
                  "Activist reduces stake quietly.\n" +
                  "Board stays united. No financial cost.\n" +
                  "COST TYPE: 2 Political Capital",
          costType: "capital",
          cost: 2,
          outcome: function() {
            GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.03);
            return "Private deal struck. " + fund + " agreed to reduce stake. No public commitments.";
          }
        }
      ]
    };
  }

  // ----------------------------------------------------------
  // EVENT 6: DISTRESSED MICRO-REIT ACQUISITION (very rare)
  // Trigger: Year 3+, BBB+ rating, 4% per year
  // ----------------------------------------------------------
  function checkMicroReit() {
    if (GameState.meta.year < 3) return null;
    var order = ["CCC","B","BB","BBB","A","AA","AAA"];
    if (order.indexOf(GameState.credit.rating) < order.indexOf("BBB")) return null;
    return Math.random() < 0.04 ? true : null;
  }

  function generateMicroReit() {
    var sectors   = ["office","retail","industrial"];
    var locations = ["tier2","tier2","suburban"];
    var props = [], totalValue = 0, totalNOI = 0;

    for (var i = 0; i < 3; i++) {
      var p = Properties.generateProperty(sectors[i], locations[i], false, true);
      p.occupancy     = fmt(0.60 + Math.random()*0.15, 3);
      p.currentValue  = fmt(p.currentValue * 0.65);
      p.purchasePrice = p.currentValue;
      p.quarterOwned  = 0;
      p.annualNOI     = fmt(p.annualNOI * p.occupancy / 0.88);
      props.push(p);
      totalValue += p.currentValue;
      totalNOI   += p.annualNOI;
    }

    var totalV    = fmt(totalValue, 1);
    var totalNOIf = fmt(totalNOI, 1);
    var inheritedDebt = fmt(totalValue * 0.55, 1);
    var cashNeeded    = fmt(totalValue * 0.45, 1);
    var rate = fmt(GameState.market.baseInterestRate + GameState.credit.spread + 1.5, 2);
    var interestCost  = fmt(parseFloat(inheritedDebt) * parseFloat(rate) / 100 / 4, 2);

    return {
      id:       "micro_reit",
      props:    props,
      headline: "🏦 Distressed Micro-REIT Available",
      body:     "A private REIT with 3 properties is in administration. 35% below NAV.\n" +
                props.map(function(p) {
                  return "▸ " + p.name + " (" + p.sector + ") $" + fmt(p.currentValue,1) + "M | " + fmt(p.occupancy*100,0) + "% occ";
                }).join("\n") +
                "\nTotal: $" + totalV + "M | Inherited debt: $" + inheritedDebt + "M\n" +
                "Debt interest cost: $" + interestCost + "M/qtr",
      choices: [
        {
          label:  "💰 Acquire — cash funded ($" + cashNeeded + "M equity)",
          detail: "+3 properties, $" + inheritedDebt + "M inherited debt on balance sheet.\n" +
                  "Leverage jumps. Chen +2.0 | Okafor -1.5.\n" +
                  "COST TYPE: Cash ($" + cashNeeded + "M immediate)",
          costType: "cash",
          check: function() { return GameState.balance.cash >= parseFloat(cashNeeded); },
          checkMsg: "Need $" + cashNeeded + "M cash for equity portion.",
          outcome: function() {
            GameState.balance.cash = fmt(GameState.balance.cash - parseFloat(cashNeeded));
            props.forEach(function(p) { GameState.portfolio.push(p); });
            GameState.debtTranches.push({
              id: "d_micro_"+Date.now(), amount: parseFloat(inheritedDebt),
              rate: parseFloat(rate), maturityQuarter: GameState.meta.quarter,
              maturityYear: GameState.meta.year+5, quartersUntilMaturity: 20,
              label: rate+"% Inherited Debt due Y"+(GameState.meta.year+5)
            });
            GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear||0)+3;
            var ch=Board.getDirectorState("chen"); if(ch) ch.attitude=Math.min(10,ch.attitude+2.0);
            var ok=Board.getDirectorState("okafor"); if(ok) ok.attitude=Math.max(0,ok.attitude-1.5);
            return "Micro-REIT acquired. 3 properties added. $" + inheritedDebt + "M inherited debt on balance sheet.";
          }
        },
        {
          label:  "📉 Acquire — cut dividend 20% to fund it",
          detail: "Reduce dividend to free up cash for acquisition.\n" +
                  "+3 properties, $" + inheritedDebt + "M inherited debt.\n" +
                  "Williams -1.0 | Chen +2.0.\n" +
                  "COST TYPE: Income (permanent dividend reduction)",
          costType: "income",
          check: function() { return GameState.balance.cash >= parseFloat(cashNeeded)*0.5; },
          checkMsg: "Need at least $" + fmt(parseFloat(cashNeeded)*0.5,1) + "M cash.",
          outcome: function() {
            var partCash = fmt(parseFloat(cashNeeded)*0.5);
            GameState.balance.cash = fmt(GameState.balance.cash - partCash);
            var newDiv = fmt(GameState.company.dividendPerShare * 0.80, 2);
            Financials.setDividend(newDiv);
            props.forEach(function(p) { GameState.portfolio.push(p); });
            GameState.debtTranches.push({
              id: "d_micro2_"+Date.now(), amount: parseFloat(inheritedDebt),
              rate: parseFloat(rate), maturityQuarter: GameState.meta.quarter,
              maturityYear: GameState.meta.year+5, quartersUntilMaturity: 20,
              label: rate+"% Inherited Debt due Y"+(GameState.meta.year+5)
            });
            GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear||0)+3;
            var ch=Board.getDirectorState("chen"); if(ch) ch.attitude=Math.min(10,ch.attitude+2.0);
            var w=Board.getDirectorState("williams"); if(w) w.attitude=Math.max(0,w.attitude-1.0);
            return "Micro-REIT acquired. Dividend cut to $" + newDiv + "/share. Williams displeased.";
          }
        },
        {
          label:  "💡 Spend 2 Political Capital — bring silent partner",
          detail: "Use connections to bring in an institutional co-investor.\n" +
                  "You fund 30%, get 60% of properties.\n" +
                  "Much lower cash cost: $" + fmt(parseFloat(cashNeeded)*0.30,1) + "M.\n" +
                  "COST TYPE: 2 Political Capital",
          costType: "capital",
          cost: 2,
          check: function() { return GameState.balance.cash >= parseFloat(cashNeeded)*0.30; },
          checkMsg: "Need $" + fmt(parseFloat(cashNeeded)*0.30,1) + "M cash.",
          outcome: function() {
            var partCash = fmt(parseFloat(cashNeeded)*0.30);
            GameState.balance.cash = fmt(GameState.balance.cash - partCash);
            props.forEach(function(p) {
              p.currentValue = fmt(p.currentValue * 0.60);
              p.annualNOI    = fmt(p.annualNOI * 0.60);
              GameState.portfolio.push(p);
            });
            GameState.debtTranches.push({
              id: "d_micro3_"+Date.now(), amount: fmt(parseFloat(inheritedDebt)*0.60),
              rate: parseFloat(rate), maturityQuarter: GameState.meta.quarter,
              maturityYear: GameState.meta.year+5, quartersUntilMaturity: 20,
              label: rate+"% Inherited Debt (60% share) due Y"+(GameState.meta.year+5)
            });
            GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear||0)+3;
            var ch=Board.getDirectorState("chen"); if(ch) ch.attitude=Math.min(10,ch.attitude+1.5);
            return "Co-investor brought in. 60% ownership of 3 properties for $" + partCash + "M.";
          }
        }
      ]
    };
  }

  // ----------------------------------------------------------
  // CHECK FOR EVENT THIS QUARTER
  // ----------------------------------------------------------
  function checkForEvent() {
    if (GameState.meta.totalQuarters < 2) return null;
    if (GameState._lastDecisionQuarter &&
        GameState.meta.totalQuarters - GameState._lastDecisionQuarter < 2) return null;

    var checks = [
      { check: checkTenantDistress,    gen: generateTenantDistress    },
      { check: checkDistressedProperty,gen: generateDistressedProperty},
      { check: checkZoning,            gen: generateZoning            },
      { check: checkExpansion,         gen: generateExpansion         },
      { check: checkActivist,          gen: generateActivist          },
      { check: checkMicroReit,         gen: generateMicroReit         },
    ];

    // Shuffle so no single event type gets first-check priority each quarter
    // (Fisher-Yates). Without this, tenant distress always won the tie.
    for (var s = checks.length - 1; s > 0; s--) {
      var j = Math.floor(Math.random() * (s + 1));
      var tmp = checks[s]; checks[s] = checks[j]; checks[j] = tmp;
    }

    for (var i = 0; i < checks.length; i++) {
      var result = checks[i].check();
      if (result) {
        var evt = checks[i].gen(result === true ? undefined : result);
        if (evt) {
          GameState._lastDecisionQuarter = GameState.meta.totalQuarters;
          return evt;
        }
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // APPLY CHOICE
  // ----------------------------------------------------------
  function applyChoice(event, choiceIndex) {
    var choice = event.choices[choiceIndex];
    if (!choice) return { success: false, message: "Invalid choice." };

    if (choice.costType === "capital") {
      var cost = choice.cost || 1;
      if ((GameState.board.politicalCapital||0) < cost) {
        return { success: false, message: "Need " + cost + " political capital. You have " + (GameState.board.politicalCapital||0) + "." };
      }
      GameState.board.politicalCapital -= cost;
    }

    if (choice.check && !choice.check()) {
      return { success: false, message: choice.checkMsg || "Cannot select this option." };
    }

    var msg = choice.outcome();
    return { success: true, message: msg };
  }

  function init() {
    GameState._lastDecisionQuarter = 0;
  }

  return { init: init, checkForEvent: checkForEvent, applyChoice: applyChoice };

}());
