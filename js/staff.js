// ============================================================
// staff.js — Executive hiring system
// 5 roles, hidden skill revealed after 2-4 quarters,
// each unlocks a unique function. Unlock lost if fired.
// REIT Simulator Game
// ============================================================

window.Staff = (function() {

  function fmt(n, d) { d = d === undefined ? 2 : d; return Math.round(n * Math.pow(10,d)) / Math.pow(10,d); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randBetween(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(randBetween(a, b + 1)); }

  // ----------------------------------------------------------
  // ROLE DEFINITIONS
  // ----------------------------------------------------------
  // Each role: id, title, salary range (per quarter $M), the
  // function it unlocks, and how its hidden skill scales effect.
  // ----------------------------------------------------------
  var ROLES = {
    acquisitions: {
      id:        "acquisitions",
      title:     "Acquisitions Lead",
      blurb:     "Sources off-market mega-deals and finds premium buyers.",
      salaryMin: 0.4,
      salaryMax: 0.9,
      unlocks:   "Off-market mega-properties + premium sell offers",
      candidateNames: ["Marcus Webb", "Diana Cho", "Rafael Ortiz", "Susan Bell"],
      hints: [
        "Strong track record in industrial markets.",
        "Known for aggressive deal sourcing.",
        "Built a reputation on off-market transactions.",
        "Former investment banker turned dealmaker."
      ],
    },
    asset: {
      id:        "asset",
      title:     "Asset Manager",
      blurb:     "Unlocks lease-up, renovation and repositioning. Lifts occupancy.",
      salaryMin: 0.3,
      salaryMax: 0.7,
      unlocks:   "Lease-up, renovation, repositioning + occupancy uplift",
      candidateNames: ["Priya Nair", "Tom Fletcher", "Elena Vasquez", "James Okoro"],
      hints: [
        "Specialist in turning around underperforming assets.",
        "Hands-on operational background.",
        "Known for tenant retention expertise.",
        "Came up through property management."
      ],
    },
    cfo: {
      id:        "cfo",
      title:     "Chief Financial Officer",
      blurb:     "Unlocks tenant bridge-lending. Improves credit terms.",
      salaryMin: 0.3,
      salaryMax: 0.6,
      unlocks:   "Tenant bridge loans + cheaper refinancing",
      candidateNames: ["Margaret Liu", "David Stern", "Aisha Rahman", "Peter Novak"],
      hints: [
        "Former treasury head at a large REIT.",
        "Reputation for creative financing.",
        "Strong relationships with credit agencies.",
        "Conservative but effective capital manager."
      ],
    },
    ir: {
      id:        "ir",
      title:     "Head of Investor Relations",
      blurb:     "Unlocks market guidance to soften share-price shocks. Lifts P/FFO.",
      salaryMin: 0.2,
      salaryMax: 0.5,
      unlocks:   "Market guidance (damage control) + P/FFO uplift",
      candidateNames: ["Charlotte Reed", "Sam Patel", "Nina Falk", "George Adler"],
      hints: [
        "Ex-equity analyst with deep market contacts.",
        "Polished communicator, trusted by institutions.",
        "Known for managing difficult announcements.",
        "Background in financial PR."
      ],
    },
    operations: {
      id:        "operations",
      title:     "Head of Operations",
      blurb:     "Unlocks preventive maintenance. Reduces G&A and capex.",
      salaryMin: 0.2,
      salaryMax: 0.5,
      unlocks:   "Preventive maintenance + lower G&A/capex",
      candidateNames: ["Laura Simmons", "Hassan Ali", "Greg Thornton", "Mei Lin"],
      hints: [
        "Relentless cost controller.",
        "Engineering background, detail-obsessed.",
        "Known for streamlining operations.",
        "Built efficient teams at scale."
      ],
    },
  };

  // ----------------------------------------------------------
  // TIERS — what the player sees (stars) maps to a hidden skill band.
  // Bands OVERLAP so a lucky cheap hire can match an unlucky premium one.
  // ----------------------------------------------------------
  var TIERS = {
    1: { stars: "★",   skillMin: 2, skillMax: 6, costMult: 0.70, traitChance: 0.40, negBias: 0.60 },
    2: { stars: "★★",  skillMin: 4, skillMax: 8, costMult: 1.00, traitChance: 0.50, negBias: 0.35 },
    3: { stars: "★★★", skillMin: 7, skillMax: 10, costMult: 1.35, traitChance: 0.60, negBias: 0.15 },
  };

  // ----------------------------------------------------------
  // TRAITS — revealed after 2-4 quarters. Skill stays hidden forever
  // (player only feels it through results). Cost traits bake in at
  // generation. Board-drift traits apply once per year at year-end.
  // ----------------------------------------------------------
  var TRAITS = {
    // ---- generic positive (any role) ----
    frugal:     { id:"frugal",     label:"Frugal",         positive:true,  generic:true,  desc:"Function cost 15% below tier norm." },
    connected:  { id:"connected",  label:"Connected",      positive:true,  generic:true,  desc:"+0.5/year to one board member (not the Chairman)." },
    efficient:  { id:"efficient",  label:"Efficient",      positive:true,  generic:true,  desc:"Trims a little extra G&A each quarter." },
    // ---- generic negative ----
    expensive:  { id:"expensive",  label:"Expensive Taste",positive:false, generic:true,  desc:"Function cost 15% above tier norm." },
    abrasive:   { id:"abrasive",   label:"Abrasive",       positive:false, generic:true,  desc:"-0.5/year to one board member (not the Chairman)." },
    highmaint:  { id:"highmaint",  label:"High Maintenance",positive:false,generic:true,  desc:"Small fixed G&A overhead each quarter." },
    complacent: { id:"complacent", label:"Complacent",     positive:false, generic:true,  desc:"Delivers below their tier — underperforms." },
    // ---- role-specific positive ----
    rainmaker:  { id:"rainmaker",  label:"Rainmaker",      positive:true,  role:"acquisitions", desc:"Higher mega-deal odds and richer sell offers." },
    steady:     { id:"steady",     label:"Steady",         positive:true,  role:"operations",   desc:"Preventive maintenance noticeably more effective." },
    disciplined:{ id:"disciplined",label:"Disciplined",    positive:true,  role:"cfo",          desc:"Extra cut to borrowing/refinancing cost." },
    silvertongue:{id:"silvertongue",label:"Silver Tongue", positive:true,  role:"ir",           desc:"Market guidance softens share shocks more." },
  };

  function traitsForRole(roleId, positive) {
    return Object.keys(TRAITS).filter(function(k) {
      var t = TRAITS[k];
      if (t.positive !== positive) return false;
      if (t.generic) return true;
      return t.role === roleId;
    });
  }

  function rollTrait(roleId, tier) {
    var cfg = TIERS[tier];
    if (Math.random() > cfg.traitChance) return null;  // no trait
    var wantNegative = Math.random() < cfg.negBias;
    var pool = traitsForRole(roleId, !wantNegative);
    if (pool.length === 0) pool = traitsForRole(roleId, wantNegative); // fallback
    if (pool.length === 0) return null;
    return TRAITS[pick(pool)].id;
  }
  function generateCandidate(roleId) {
    var role = ROLES[roleId];
    if (!role) return null;

    // Pick a tier (roughly even, slight lean to mid)
    var r = Math.random();
    var tier = r < 0.38 ? 1 : r < 0.72 ? 2 : 3;
    var cfg  = TIERS[tier];

    // Hidden skill within the tier's band
    var skill = randInt(cfg.skillMin, cfg.skillMax);

    // Base cost from role range, scaled by tier multiplier, with light noise
    var midCost = role.salaryMin + (role.salaryMax - role.salaryMin) * 0.5;
    var cost = midCost * cfg.costMult * randBetween(0.92, 1.08);

    // Roll a trait (may be null)
    var traitId = rollTrait(roleId, tier);

    // Cost-modifying traits bake in NOW (fixed for employment)
    if (traitId === "frugal")    cost *= 0.85;
    if (traitId === "expensive") cost *= 1.15;
    cost = fmt(Math.max(0.1, cost), 2);

    // Portrait + easter-egg candidate (port13 = A. Crow)
    var portrait = "port" + randInt(1, 15) + ".png";
    var name, hint;
    if (portrait === "port13.png") {
      name = "A. Crow";
      hint = "Unusually confident. Won't say where he's from.";
    } else {
      name = pick(role.candidateNames);
      hint = pick(role.hints);
    }

    // Board target for connected/abrasive — picked once, never Williams
    var boardTarget = null;
    if (traitId === "connected" || traitId === "abrasive") {
      boardTarget = pick(["chen", "okafor", "petrova", "hassan"]);
    }

    return {
      roleId:           roleId,
      title:            role.title,
      name:             name,
      portrait:         portrait,
      tier:             tier,
      stars:            cfg.stars,
      salary:           cost,           // $M per quarter ("Function Cost")
      skill:            skill,          // HIDDEN, never shown as a number
      skillRevealed:    false,
      traitId:          traitId,
      traitRevealed:    false,
      boardTarget:      boardTarget,
      hint:             hint,
      hiredQuarter:     null,
      quartersEmployed: 0,
    };
  }

  // ----------------------------------------------------------
  // GENERATE THE TALENT MARKET — refreshed each year
  // 3 candidates per unfilled role, so hiring is a real choice
  // ----------------------------------------------------------
  function refreshTalentMarket() {
    var market = [];
    Object.keys(ROLES).forEach(function(roleId) {
      if (!isRoleFilled(roleId)) {
        for (var i = 0; i < 3; i++) {
          market.push(generateCandidate(roleId));
        }
      }
    });
    GameState._talentMarket = market;
    return market;
  }

  // ----------------------------------------------------------
  // QUERIES
  // ----------------------------------------------------------
  function isRoleFilled(roleId) {
    return GameState.staff.some(function(s) { return s.roleId === roleId; });
  }

  function getStaff(roleId) {
    return GameState.staff.find(function(s) { return s.roleId === roleId; });
  }

  function hasRole(roleId) {
    return isRoleFilled(roleId);
  }

  // Skill multiplier 0.0-1.0 for scaling effects. Complacent shaves it down,
  // so an overpaid premium hire quietly underdelivers (felt, never shown as a number).
  function skillFactor(roleId) {
    var s = getStaff(roleId);
    if (!s) return 0;
    var eff = s.skill;
    if (s.traitId === "complacent") eff = Math.max(1, eff - 3);
    return eff / 10;
  }

  function hasTrait(roleId, traitId) {
    var s = getStaff(roleId);
    return s && s.traitId === traitId;
  }

  // ----------------------------------------------------------
  // HIRE
  // ----------------------------------------------------------
  function hire(candidate) {
    if (isRoleFilled(candidate.roleId)) {
      return { success: false, message: "You already have a " + candidate.title + ". Fire them first." };
    }
    candidate.hiredQuarter     = GameState.meta.totalQuarters;
    candidate.quartersEmployed = 0;
    candidate.skillRevealed    = false;
    GameState.staff.push(candidate);

    // Remove from talent market
    if (GameState._talentMarket) {
      GameState._talentMarket = GameState._talentMarket.filter(function(c) {
        return c.roleId !== candidate.roleId;
      });
    }

    return { success: true, message: candidate.name + " hired as " + candidate.title + " at $" + candidate.salary + "M/quarter." };
  }

  // ----------------------------------------------------------
  // FIRE — lose unlock, pay one quarter severance
  // ----------------------------------------------------------
  function fire(roleId) {
    var s = getStaff(roleId);
    if (!s) return { success: false, message: "No one in that role." };

    var severance = fmt(s.salary, 2);  // one quarter severance
    GameState.balance.cash = fmt(GameState.balance.cash - severance);
    GameState.staff = GameState.staff.filter(function(x) { return x.roleId !== roleId; });

    return { success: true, message: s.name + " dismissed. Severance $" + severance + "M paid. " + ROLES[roleId].title + " functions are now locked." };
  }

  // ----------------------------------------------------------
  // QUARTERLY PROCESSING
  // - Tick employment counter
  // - Reveal TRAIT after 2-4 quarters (skill number never shown)
  // - Asset Manager occupancy uplift
  // - High Maintenance / Efficient G&A adjustments
  // - Return total salary for G&A inclusion
  // ----------------------------------------------------------
  function processQuarter() {
    var totalSalary = 0;
    var gaAdjust = 0;   // extra G&A from traits (+/-)

    GameState.staff.forEach(function(s) {
      s.quartersEmployed += 1;
      totalSalary += s.salary;

      // Reveal trait after 2-4 quarters (deterministic per hire)
      if (!s.traitRevealed) {
        if (!s._revealAt) s._revealAt = randInt(2, 4);
        if (s.quartersEmployed >= s._revealAt) {
          s.traitRevealed = true;
          s.skillRevealed = true; // keep both flags in sync
        }
      }

      // Asset Manager passive: occupancy uplift scaled by effective skill
      if (s.roleId === "asset") {
        var uplift = 0.003 + skillFactor("asset") * 0.007; // 0.3%-1.0%/qtr
        GameState.portfolio.forEach(function(p) {
          if (!p.underConstruction) {
            p.occupancy = Math.min(0.98, fmt(p.occupancy + uplift, 3));
          }
        });
      }

      // Trait-based G&A tweaks
      if (s.traitId === "highmaint") gaAdjust += 0.05;            // fixed overhead
      if (s.traitId === "efficient") gaAdjust -= 0.04;            // trims G&A
    });

    GameState._staffSalaryThisQuarter = fmt(totalSalary, 2);
    GameState._staffGAAdjust = fmt(gaAdjust, 2);
    return fmt(totalSalary, 2);
  }

  // Called once per year at year-end: applies Connected/Abrasive board drift
  function processYearEnd() {
    GameState.staff.forEach(function(s) {
      if (!s.boardTarget) return;
      var dir = (typeof Board !== "undefined" && Board.getDirectorState) ? Board.getDirectorState(s.boardTarget) : null;
      if (!dir) return;
      if (s.traitId === "connected") dir.attitude = Math.min(10, fmt(dir.attitude + 0.5, 2));
      if (s.traitId === "abrasive")  dir.attitude = Math.max(0,  fmt(dir.attitude - 0.5, 2));
    });
  }

  // Total quarterly salary (for G&A display / calculation)
  function totalSalary() {
    var base = GameState.staff.reduce(function(sum, s) { return sum + s.salary; }, 0);
    return fmt(base + (GameState._staffGAAdjust || 0), 2);
  }

  // ----------------------------------------------------------
  // TRAIT DISPLAY — what the player sees in the trait column.
  // Before reveal: "Assessing…". After: the trait name (or "—" if none).
  // The skill NUMBER is never shown.
  // ----------------------------------------------------------
  function traitLabel(s) {
    if (!s.traitRevealed) {
      return "Assessing… (" + s.quartersEmployed + "q)";
    }
    if (!s.traitId) return "No notable trait";
    return TRAITS[s.traitId] ? TRAITS[s.traitId].label : "—";
  }

  function traitColor(s) {
    if (!s.traitRevealed) return "text-muted";
    if (!s.traitId) return "text-muted";
    var t = TRAITS[s.traitId];
    if (!t) return "text-muted";
    return t.positive ? "text-green" : "text-red";
  }

  function traitDesc(s) {
    if (!s.traitRevealed || !s.traitId) return "";
    return TRAITS[s.traitId] ? TRAITS[s.traitId].desc : "";
  }

  // ----------------------------------------------------------
  // INIT / RESET
  // ----------------------------------------------------------
  function init() {
    GameState.staff = [];
    GameState._talentMarket = [];
    GameState._staffSalaryThisQuarter = 0;
    refreshTalentMarket();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    ROLES:              ROLES,
    init:               init,
    refreshTalentMarket:refreshTalentMarket,
    generateCandidate:  generateCandidate,
    isRoleFilled:       isRoleFilled,
    getStaff:           getStaff,
    hasRole:            hasRole,
    hasTrait:           hasTrait,
    skillFactor:        skillFactor,
    hire:               hire,
    fire:               fire,
    processQuarter:     processQuarter,
    processYearEnd:     processYearEnd,
    totalSalary:        totalSalary,
    traitLabel:         traitLabel,
    traitColor:         traitColor,
    traitDesc:          traitDesc,
    TRAITS:             TRAITS,
    TIERS:              TIERS,
  };

})();
