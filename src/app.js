(function () {
  "use strict";
  const DATA = window.SHILPMUN_SEATING;
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const G = window.gsap || null;
  const ST = window.ScrollTrigger || null;
  if (G && ST) G.registerPlugin(ST);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (isMac) { $("ctrl-hint").textContent = "Hold ⌘ and scroll to zoom the plan"; $("map-help").textContent = "Drag to move · ⌘ + scroll or pinch to zoom · Arrow keys step seat to seat"; }

  /* ---------- committee reference (from the SHILPMUN 2026 site data) ---------- */
  const ORDER = ["UNSC", "UNHRC", "AIPPM", "COP 31", "CCC", "DISEC", "SOCHUM", "UNODC", "G20", "EU Council", "IPLA", "FIA", "NATO", "PRESS"];
  const META = {
    "UNSC": { pre: "United Nations", name: "Security Council", full: "United Nations Security Council", tag: "Veto power in the room. Every word weighted.", type: "Specialised", level: "Advanced" },
    "UNHRC": { pre: "United Nations", name: "Human Rights Council", full: "United Nations Human Rights Council", tag: "Moral clarity backed by legal precision.", type: "General Assembly", level: "Intermediate" },
    "AIPPM": { pre: "All India", name: "Political Parties Meet", full: "All India Political Parties Meet", tag: "Indian democracy at its most contested.", type: "Specialised", level: "Intermediate" },
    "COP 31": { pre: "United Nations", name: "Conference of Parties", full: "United Nations Conference of Parties", tag: "Every fraction of a degree matters.", type: "Specialised", level: "Intermediate" },
    "CCC": { pre: "Continuous", name: "Crisis Committee", full: "Continuous Crisis Committee", tag: "Not a simulation of policy. A simulation of consequence.", type: "Crisis", level: "Advanced" },
    "DISEC": { pre: "UNGA I", name: "Disarmament & International Security", full: "UNGA-I: Disarmament and International Security Committee", tag: "The broadest mandate of any GA committee.", type: "General Assembly", level: "Beginner+" },
    "SOCHUM": { pre: "UNGA III", name: "Social, Humanitarian & Cultural Committee", full: "UNGA-III: Social, Humanitarian and Cultural Committee", tag: "Precision of thought over volume of speech.", type: "General Assembly", level: "Beginner+" },
    "UNODC": { pre: "United Nations", name: "Office on Drugs & Crime", full: "United Nations Office on Drugs and Crime", tag: "Law enforcement, public health, finance and treaty law at once.", type: "Specialised", level: "Intermediate" },
    "G20": { pre: "Group of Twenty", name: "G20 Summit", full: "G20 Summit", tag: "No state has veto power. Every state has interests.", type: "Specialised", level: "Advanced" },
    "EU Council": { pre: "European Union", name: "Council of the European Union", full: "Council of the European Union", tag: "For delegates who think in systems, not slogans.", type: "Regional", level: "Intermediate" },
    "IPLA": { pre: "Indian", name: "Premier League Auctions", full: "Indian Premier League Auctions", tag: "Cricket is a sport. The IPL auction is a market.", type: "Simulation", level: "Beginner+" },
    "FIA": { pre: "Fédération Internationale", name: "de l'Automobile", full: "Fédération Internationale de l'Automobile", tag: "Strategy, technical fluency, and pressure.", type: "Simulation", level: "Beginner+" },
    "NATO": { pre: "North Atlantic", name: "Treaty Organization", full: "North Atlantic Treaty Organization" },
    "PRESS": { pre: "Conference", name: "Press", full: "Press" }
  };

  /* ---------- committee rooms (from the Operations room-allotment sheet) ---------- */
  const DAYS = [{ n: 1, d: "29 Oct", day: "Thursday" }, { n: 2, d: "30 Oct", day: "Friday" }, { n: 3, d: "31 Oct", day: "Saturday" }];
  const VENUES = {
    "UNSC": {
      "rooms": [
        "IG 9 B",
        "IG 9 B",
        "IG 9 B"
      ],
      "cap": 25,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "Addressing the legality of pre-emptive military action against non-state actors across sovereign borders",
        "Reassessing the mandate, effectiveness and reform of UN peacekeeping operations in active conflict zones"
      ]
    },
    "UNHRC": {
      "rooms": [
        "IG 9 A",
        "IG 9 A",
        "IG 9 A"
      ],
      "cap": 30,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "Combating the arbitrary stripping of citizenship as a tool of political persecution and ethnic exclusion"
      ]
    },
    "AIPPM": {
      "rooms": [
        "P 8",
        "ShilpEncounter",
        "P 8"
      ],
      "cap": 35,
      "setup": "UK parliamentary arrangement, seated bloc-wise",
      "note": "Day 2 shifts to ShilpEncounter (the P 8 PTM room): 30 seats, classroom arrangement with projector and mic system. Needs extra volunteers and operations capacity — it is a longer walk, so plan arrival, departure and lunch movement carefully.",
      "agenda": [
        "Examining how SIR has strengthened democratic accountability, paved the way for anti-incumbency, and created pathways for emerging political forces to challenge entrenched power across Indian states"
      ]
    },
    "COP 31": {
      "rooms": [
        "IG 10 B",
        "IG 10 B",
        "IG 10 B"
      ],
      "cap": 30,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "Reviewing a decade of the Paris Agreement: assessing national commitments, accountability gaps, and the path forward for accelerated climate action at COP 31"
      ]
    },
    "CCC": {
      "rooms": [
        "IG 10 A",
        "IG 10 A",
        "IG 10 A"
      ],
      "cap": 30,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "The drawing of lines — negotiating the terms of Indian independence and the human cost of Partition, June 1947"
      ]
    },
    "DISEC": {
      "rooms": [
        "P Dayananda Pai Auditorium",
        "P Dayananda Pai Auditorium",
        "P Dayananda Pai Auditorium"
      ],
      "cap": 80,
      "setup": "Auditorium seating, tables on stage",
      "note": "Three to four wireless mics to be passed around. Projector required.",
      "agenda": [
        "Developing an international legal framework for the regulation and accountability of lethal autonomous weapons systems",
        "Establishing an international legal framework for state-sponsored cyber operations, critical infrastructure attacks and digital acts of war"
      ]
    },
    "SOCHUM": {
      "rooms": [
        "AS Level A",
        "AS Level A",
        "AS Level A"
      ],
      "cap": 30,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "Regulating the use of artificial intelligence in electoral processes and the protection of the right to free and informed political participation"
      ]
    },
    "UNODC": {
      "rooms": [
        "AS Level B",
        "AS Level B",
        "AS Level B"
      ],
      "cap": 30,
      "setup": "Classroom arrangement",
      "agenda": [
        "Addressing the exploitation of decentralised cryptocurrency infrastructure in transnational drug trafficking and terror financing",
        "Examining the global shift toward drug decriminalisation, the public health versus criminal justice paradigm, and the future of international drug control treaties"
      ]
    },
    "G20": {
      "rooms": [
        "IG 8 A",
        "IG 8 A",
        "IG 8 A"
      ],
      "cap": 21,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "Addressing the geopolitical weaponisation of sovereign lending, debt-trap diplomacy, and the restructuring of global financial power in a multipolar world"
      ]
    },
    "EU Council": {
      "rooms": [
        "IG 8 B",
        "IG 8 B",
        "IG 8 B"
      ],
      "cap": 27,
      "setup": "Classroom arrangement",
      "agenda": [
        "Strengthening the architecture of economic interdependence — harmonising trade, investment and industrial policy across EU member states to build a more resilient and cohesive single market"
      ]
    },
    "IPLA": {
      "rooms": [
        "Senior Library",
        "Auditorium Lobby",
        "Senior Library"
      ],
      "cap": 40,
      "setup": "Four-person team tables in a zig-zag layout",
      "note": "Day 2 moves to the Auditorium Lobby. Each table seats four.",
      "agenda": [
        "IPL Mega Auction 2026 — franchise strategy, player valuation and budget management"
      ]
    },
    "FIA": {
      "rooms": [
        "A Level B",
        "A Level B",
        "A Level B"
      ],
      "cap": 33,
      "setup": "Three-person team arrangement",
      "agenda": [
        "Debating regulatory reforms and financial frameworks in Formula One — where teams will contest rule changes, defend strategic decisions, and navigate crisis response in the fight for competitive supremacy"
      ]
    },
    "NATO": {
      "rooms": [
        "A Level A",
        "A Level A",
        "A Level A"
      ],
      "cap": 29,
      "setup": "Semi-circle arrangement",
      "agenda": [
        "Managing escalation in the Russia–Ukraine war: sustaining support to Ukraine, deterring Russian aggression, and the threshold for collective defence"
      ]
    }
  };

  /* ---------- model ---------- */
  const CW = 26, RH = 32, AISLE_COL = 18;
  const rows = DATA.rows;               // back (Q) -> front (A)
  const seats = [], byId = {};
  rows.forEach((r, ri) => {
    r.seats.sort((a, b) => a.x - b.x);
    r.list = r.seats.map((s, si) => {
      const o = { id: s.id, row: r.row, ri, si, col: s.x, x: s.x * CW, y: ri * RH, side: s.x < AISLE_COL ? "Left" : "Right", p: DATA.people[s.id] || null };
      seats.push(o); byId[s.id.toUpperCase()] = o; return o;
    });
  });
  const people = seats.filter(s => s.p);
  const delegates = people.filter(s => s.p.k !== "EB");
  const eb = people.filter(s => s.p.k === "EB");
  const ebBy = {};
  eb.forEach(o => { (ebBy[o.p.c] = ebBy[o.p.c] || []).push(o); });
  const countBy = (list, fn) => { const m = new Map(); list.forEach(s => { const k = fn(s.p); m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const comCount = countBy(delegates, p => p.c || "—");
  const schoolCount = countBy(delegates, p => p.s);
  const rowOrderFront = rows.map(r => r.row).reverse();   // A first

  /* ---------- colours ---------- */
  const PAL = ["#2e63b8", "#99292d", "#2f7d66", "#d2a03c", "#7a55a8", "#2b97b0", "#c76a3a", "#7f9a3a", "#c0578f", "#8c6a46", "#5f7fc9", "#4f5d75", "#d98c94", "#a7b84a"];
  const COM = {}; ORDER.forEach((c, i) => COM[c] = PAL[i]);
  const NEUTRAL = "#cfd3dc", HOST = "#18295b", GOLD = "#c9a24a";
  const SCHOOL_PAL = ["#99292d", "#2e63b8", "#2f7d66", "#7a55a8", "#2b97b0", "#c76a3a", "#7f9a3a", "#c0578f", "#8c6a46", "#5f7fc9", "#4f5d75"];
  /* Grades 11 and 12 are also known by their Cambridge names */
  const GRADE_TAG = { 11: "AS Level", 12: "A Level" };
  const GRADE_ALIASES = {
    11: ["as", "as level", "as levels", "as-level", "aslevel", "cie as", "cambridge as", "cambridge as level", "grade 11", "class 11", "11", "11th", "cie", "cambridge", "cambridge international"],
    12: ["a level", "a levels", "a-level", "alevel", "a2", "a2 level", "cie a level", "cambridge a level", "grade 12", "class 12", "12", "12th", "cie", "cambridge", "cambridge international"]
  };
  /* Grade ramp: rose -> oxblood -> plum -> navy, young to senior */
  const RAMP = ["#f3d3d5", "#d8727a", "#99292d", "#5a2a5e", "#18295b"].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const gradeColor = t => {
    const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), u = x - i;
    return "#" + [0, 1, 2].map(c => Math.round(RAMP[i][c] + (RAMP[i + 1][c] - RAMP[i][c]) * u).toString(16).padStart(2, "0")).join("");
  };

  function buildScheme(mode) {
    if (mode === "committee") {
      const key = p => p.c || "—";
      const m = countBy(people, key);
      const items = ORDER.filter(c => m.has(c)).map(c => ({ key: c, label: c === "EU Council" ? "EU Council" : c, sub: META[c] ? META[c].full : "", n: m.get(c), color: COM[c] }));
      if (m.has("—")) items.push({ key: "—", label: "Awaiting committee", n: m.get("—"), color: NEUTRAL });
      return { key, items, title: "Committees", unit: "seats", limit: 99 };
    }
    if (mode === "school") {
      const key = p => p.s;
      const m = countBy(people, key);
      const ks = [...m.keys()].filter(k => k !== "Executive Board").sort((a, b) => m.get(b) - m.get(a) || a.localeCompare(b));
      let pi = 0;
      const items = ks.map((k, i) => {
        let color = NEUTRAL;
        if (k === "Vidyashilp Academy") color = HOST;
        else if (i < 12) color = SCHOOL_PAL[pi++ % SCHOOL_PAL.length];
        return { key: k, label: k, n: m.get(k), color };
      });
      items.splice(1, 0, { key: "Executive Board", label: "Executive Board", n: m.get("Executive Board") || 0, color: GOLD });
      return { key, items, title: ks.length + " schools", unit: "seats", limit: 13 };
    }
    if (mode === "grade") {
      const key = p => p.k === "EB" ? "EB" : p.g ? "g" + p.g : "other";
      const m = countBy(people, key);
      const gs = [...m.keys()].filter(k => /^g\d+$/.test(k)).map(k => +k.slice(1)).sort((a, b) => a - b);
      const lo = gs[0], hi = gs[gs.length - 1];
      const items = gs.map(g => ({ key: "g" + g, label: "Grade " + g + (GRADE_TAG[g] ? " · " + GRADE_TAG[g] : ""), sub: "Vidyashilp Academy, grade " + g + (GRADE_TAG[g] ? " (" + GRADE_TAG[g] + ")" : ""), n: m.get("g" + g), color: gradeColor((g - lo) / Math.max(1, hi - lo)) }));
      if (m.has("EB")) items.push({ key: "EB", label: "Executive Board", n: m.get("EB"), color: GOLD });
      if (m.has("other")) items.push({ key: "other", label: "Visiting delegates & others", n: m.get("other"), color: NEUTRAL });
      const stops = [0, .25, .5, .75, 1].map(t => gradeColor(t)).join(",");
      return { key, items, title: "Vidyashilp grades", unit: "seats", limit: 99, ramp: { css: `linear-gradient(90deg,${stops})`, a: "Grade " + lo, b: "Grade " + hi + (GRADE_TAG[hi] ? " · " + GRADE_TAG[hi] : "") } };
    }
    const key = p => p.k;
    const m = countBy(people, key);
    const defs = [["Host", "Vidyashilp Academy (host)", HOST], ["Delegation", "Visiting school delegations", "#99292d"], ["Individual", "Individual registrations", "#2f7d66"], ["EB", "Executive Board", GOLD]];
    return { key, items: defs.filter(d => m.has(d[0])).map(d => ({ key: d[0], label: d[1], n: m.get(d[0]), color: d[2] })), title: "Delegate type", unit: "seats", limit: 99 };
  }
  function textClass(c) {
    const n = parseInt(c.slice(1), 16), L = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    return L > 0.62 ? "dk" : "lt";
  }

  /* room helpers */
  const roomsOf = c => (VENUES[c] || {}).rooms || null;
  const roomRuns = c => {           // ["IG 9 B","IG 9 B","IG 9 B"] -> [{room, days:[1,2,3]}]
    const r = roomsOf(c); if (!r) return [];
    const runs = [];
    r.forEach((room, i) => {
      const last = runs[runs.length - 1];
      if (last && last.room === room) last.days.push(i + 1); else runs.push({ room, days: [i + 1] });
    });
    return runs;
  };
  const roomSummary = c => {
    const runs = roomRuns(c); if (!runs.length) return "";
    if (runs.length === 1) return runs[0].room + " \u00b7 all three days";
    return runs.map(r => r.room + " (Day " + r.days.join(" & ") + ")").join(" \u00b7 ");
  };
  const roomMoves = c => roomRuns(c).length > 1;

  /* ---------- draw the hall ---------- */
  const deco = $("deco"), seatLayer = $("seats"), ring = $("ring"), vp = $("vp");
  const yA = (rows.length - 1) * RH;
  const minCol = Math.min(...seats.map(s => s.col)), maxCol = Math.max(...seats.map(s => s.col));
  const ax = AISLE_COL * CW, midX = ((minCol + maxCol) / 2) * CW;

  /* Curve: every row is an arc of a circle centred beyond the stage, so the
     rows wrap toward the stage like the real hall. R0 is the front-row radius
     (bigger = flatter). Seats keep their spacing along the arc and turn to face the stage. */
  const R0 = 1250, cy0 = yA + R0;
  const polar = (r, a) => ({ x: ax + r * Math.sin(a), y: cy0 - r * Math.cos(a) });
  const f1 = n => Math.round(n * 10) / 10;
  seats.forEach(o => {
    const r = cy0 - o.y, a = (o.x - ax) / r, q = polar(r, a);
    o.r = r; o.a = a; o.x = f1(q.x); o.y = f1(q.y); o.rot = f1(a * 180 / Math.PI);
  });
  const stageH = 70, rO = R0 - 40, rI = rO - stageH;
  const aS = ((maxCol - minCol) / 2 - 2) * CW / rO;          // half-angle the stage spans
  const arc = (r, a0, a1, sweep) => { const q = polar(r, a1); return `A${f1(r)} ${f1(r)} 0 0 ${sweep} ${f1(q.x)} ${f1(q.y)}`; };
  const pt = (r, a) => { const q = polar(r, a); return `${f1(q.x)} ${f1(q.y)}`; };
  const band = (ro, ri, a) => `M${pt(ro, -a)} ${arc(ro, -a, a, 1)} L${pt(ri, a)} ${arc(ri, a, -a, 0)} Z`;
  const bounds = {
    x0: Math.min(...seats.map(o => o.x)) - CW * 2.6, x1: Math.max(...seats.map(o => o.x)) + CW * 2.6, y0: -RH * 1.9,
    y1: Math.max(polar(rI, -aS).y, polar(rI, aS).y) + 14
  };
  let d = "";
  d += `<text class="back-label" x="${midX}" y="${-RH * 1.05}">BACK OF THE HALL</text>`;
  d += `<rect class="aisle" x="${ax - 10}" y="${-RH * 0.6}" width="20" height="${yA + RH * 1.15}"/>`;
  for (let y = -RH * 0.6 + 8; y < yA + RH * 0.55; y += 8) d += `<line class="step" x1="${ax - 10}" x2="${ax + 10}" y1="${y}" y2="${y}"/>`;
  rows.forEach(r => {
    const a = r.list[0], b = r.list[r.list.length - 1];
    const la = polar(a.r, a.a - CW * 1.1 / a.r), lb = polar(b.r, b.a + CW * 1.1 / b.r);
    d += `<text class="rowlab" x="${f1(la.x)}" y="${f1(la.y + 4)}" text-anchor="middle">${r.row}</text><text class="rowlab" x="${f1(lb.x)}" y="${f1(lb.y + 4)}" text-anchor="middle">${r.row}</text>`;
  });
  const ha = rows.find(r => r.row === "HA");
  if (ha) {
    const h0 = ha.list[0], dq = polar(h0.r, h0.a - CW * 3.5 / h0.r);
    d += `<g class="door" transform="translate(${f1(dq.x)},${f1(dq.y)})"><rect class="door-leaf" x="-4" y="-14" width="8" height="28" rx="1.5"/><path class="door-swing" d="M4 -14 A28 28 0 0 1 28 6"/><text class="entry" x="-10" y="4" text-anchor="end">ENTRANCE</text></g>`;
  }
  const rowA = rows[rows.length - 1].list, eA = rowA[0], eB = rowA[rowA.length - 1];
  const ea = polar(eA.r, eA.a - CW * 2.3 / eA.r), eb2 = polar(eB.r, eB.a + CW * 2.3 / eB.r);
  d += `<text class="entry" x="${f1(ea.x)}" y="${f1(ea.y + 24)}" text-anchor="end">ENTRY →</text><text class="entry" x="${f1(eb2.x)}" y="${f1(eb2.y + 24)}">← ENTRY</text>`;
  d += `<g id="stage"><path class="stage" d="${band(rO, rI, aS)}"/><path class="stage-in" d="${band(rO - 5, rI + 5, aS - 5 / rO)}"/>`;
  for (let a = -aS + 22 / rO; a < aS - 12 / rO; a += 34 / rO) { const q = polar(rO - 12, a); d += `<circle class="foot" cx="${f1(q.x)}" cy="${f1(q.y)}" r="2.2"/>`; }
  const sTop = cy0 - rO;
  d += `<text class="stage-label" x="${ax + 7}" y="${f1(sTop + 46)}">STAGE</text><text class="stage-sub" x="${ax}" y="${f1(sTop + 61)}">Dais of the Executive Board</text></g>`;
  deco.innerHTML = d;

  let s = "";
  rows.forEach((r, ri) => {
    s += `<g class="row" style="--d:${(rows.length - 1 - ri) * 24}ms">`;
    r.list.forEach(o => {
      const num = o.id.slice(o.row.length);
      s += `<g class="seat" data-id="${o.id}" transform="translate(${o.x},${o.y})"><rect class="b" transform="rotate(${o.rot})" x="-11" y="-11" width="22" height="22" rx="4"/><rect class="bk" transform="rotate(${o.rot})" x="-11" y="-11" width="22" height="5.5" rx="2.5"/><text y="5">${num}</text>${o.p && o.p.k === "EB" ? '<circle class="ebm" cx="9" cy="-9" r="3.4"/>' : ""}</g>`;
    });
    s += "</g>";
  });
  seatLayer.innerHTML = s;
  seatLayer.querySelectorAll(".seat").forEach(el => { const o = byId[el.dataset.id.toUpperCase()]; o.el = el; o.rect = el.firstChild; });
  const rowEls = [...seatLayer.querySelectorAll(".row")];

  /* ---------- stats + ticker ---------- */
  const nSchools = schoolCount.size, nComs = ORDER.filter(c => comCount.has(c) || ebBy[c]).length;
  $("stats").innerHTML = [[seats.length, "Seats"], [delegates.length, "Delegates"], [eb.length, "Executive Board"], [nComs, "Committees"], [nSchools, "Schools"]]
    .map(([n, l]) => `<div><div class="stat-v" data-n="${n}">${n}</div><div class="stat-l">${l}</div></div>`).join("");
  (($e) => { if ($e) $e.textContent = seats.length; })($("hero-seats"));
  $("foot-count").textContent = `${seats.length} seats · ${delegates.length} delegates · ${eb.length} Executive Board`;
  const tick = ORDER.filter(c => comCount.has(c)).map(c => `<span>${esc(c)}<b>${comCount.get(c)}</b></span><span><i>✦</i></span>`).join("");
  $("marquee").innerHTML = `<div class="marquee-set">${tick}</div><div class="marquee-set">${tick}</div>`;

  /* ---------- state ---------- */
  const state = { mode: "committee", scheme: null, focus: null, sel: null, showAll: false };
  const mq = matchMedia("(max-width: 1000px)");

  function applyScheme() {
    const sc = state.scheme, cmap = new Map(sc.items.map(i => [i.key, i.color]));
    seats.forEach(o => {
      const c = o.p ? (cmap.get(sc.key(o.p)) || NEUTRAL) : NEUTRAL;
      o.color = c;
      o.rect.style.fill = c;
      o.el.classList.remove("dk", "lt"); o.el.classList.add(textClass(c));
      o.el.classList.toggle("dim", !!state.focus && !(o.p && sc.key(o.p) === state.focus));
    });
    const note = $("focus-note");
    if (state.focus) {
      const it = sc.items.find(i => i.key === state.focus);
      note.innerHTML = `<span>Showing</span><strong>${esc(it ? it.label : state.focus)}</strong><span>· ${it ? it.n : 0} seats</span><button type="button" class="link-arrow" id="note-clear">Show everyone</button>`;
      $("note-clear").onclick = () => setFocus(state.focus);
    } else note.innerHTML = `<span>Showing all ${seats.length} seats</span>`;
  }

  function renderLegend(animate) {
    const sc = state.scheme;
    $("legend-title").textContent = sc.title;
    $("clear").hidden = !state.focus;
    const many = sc.items.length > sc.limit && !state.showAll;
    let list = many ? sc.items.slice(0, sc.limit) : sc.items;
    if (many && state.focus && !list.some(i => i.key === state.focus)) list = list.concat(sc.items.filter(i => i.key === state.focus));
    const ramp = sc.ramp ? `<div class="ramp" aria-hidden="true"><i style="background:${sc.ramp.css}"></i><span>${sc.ramp.a}</span><span>${sc.ramp.b}</span></div>` : "";
    $("chips").innerHTML = ramp + list.map(it =>
      `<button type="button" class="chip" data-key="${esc(it.key)}" aria-pressed="${state.focus === it.key}" title="${esc(it.sub || it.label)}"><span class="sw" style="background:${it.color}"></span><span class="lbl">${esc(it.label)}</span><span class="n">${it.n}</span></button>`).join("");
    const more = $("legend-more");
    more.hidden = sc.items.length <= sc.limit;
    more.textContent = state.showAll ? "Fewer schools" : `All ${sc.items.length} groups →`;
    if (animate && G && !reduce) G.from("#chips .chip", { x: -10, opacity: 0, duration: .45, stagger: .018, ease: "power3.out", clearProps: "all" });
  }

  function setMode(mode, focus) {
    const changed = mode !== state.mode || !state.scheme;
    state.mode = mode; state.scheme = buildScheme(mode); state.focus = focus || null;
    if (changed) state.showAll = false;
    document.querySelectorAll(".modes .filter").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    applyScheme(); renderLegend(changed);
    if (state.sel) renderCard(state.sel, false);
    try { localStorage.setItem("shilpmun-mode", mode); } catch (e) {}
  }
  function setFocus(key) {
    state.focus = state.focus === key ? null : key;
    applyScheme(); renderLegend(false);
    if (state.focus) { const hit = people.filter(o => state.scheme.key(o.p) === state.focus); if (hit.length) frameSeats(hit); }
    else animateTo(fitView());
  }
  $("chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) setFocus(b.dataset.key); });
  $("clear").addEventListener("click", () => setFocus(state.focus));
  $("legend-more").addEventListener("click", () => { state.showAll = !state.showAll; renderLegend(true); });
  document.querySelectorAll(".modes .filter").forEach(b => b.addEventListener("click", () => { if (b.dataset.mode !== state.mode) setMode(b.dataset.mode); }));

  /* ---------- seat card ---------- */
  function esc(t) { return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  const ordinal = n => { const sfx = ["th", "st", "nd", "rd"], v = n % 100; return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]); };
  const closeIcon = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

  function renderCard(o, animate) {
    const card = $("card");
    if (!o) {
      card.className = "seatcard plate sc-empty";
      card.innerHTML = `<div class="sc-head"><div><p class="eyebrow eyebrow--red">Your seat</p><div class="sc-code">—</div></div><div class="sc-where">No seat<br>selected</div></div>
        <p>Choose a seat on the plan, or search for a delegate. This card shows their name, school, committee and portfolio.</p>
        <div class="key"><i></i>Gold dot marks the Executive Board</div>`;
      return;
    }
    const r = rows[o.ri].list, p = o.p;
    const where = `Row ${o.row}<br>${o.side} of aisle<br>${ordinal(o.si + 1)} from left`;
    const com = p && p.c ? `<span class="sw" style="background:${COM[p.c] || NEUTRAL}"></span>${esc(p.c)}${META[p.c] ? `<small>${esc(META[p.c].full)}</small>` : ""}` : `<span class="muted">Awaiting committee</span>`;
    let body;
    if (!p) body = `<h3 class="sc-name">Empty seat</h3>`;
    else if (p.k === "EB") body = `<h3 class="sc-name">${esc(p.n)}</h3><span class="tag tag--red sc-badge">Executive Board</span>
      <dl class="sc-dl"><div class="sc-row"><dt>Role</dt><dd>${esc(p.p)}</dd></div><div class="sc-row"><dt>Committee</dt><dd>${com}</dd></div>${p.c && roomsOf(p.c) ? `<div class="sc-row"><dt>Room</dt><dd>${esc(roomRuns(p.c)[0].room)}<small>${esc(roomMoves(p.c) ? roomSummary(p.c) : "All three days")}</small></dd></div>` : ""}</dl>`;
    else body = `<h3 class="sc-name">${esc(p.n)}</h3>
      <dl class="sc-dl">
        <div class="sc-row"><dt>School</dt><dd>${esc(p.s)}</dd></div>
        <div class="sc-row"><dt>Committee</dt><dd>${com}</dd></div>
        ${p.c && roomsOf(p.c) ? `<div class="sc-row"><dt>Room</dt><dd>${esc(roomRuns(p.c)[0].room)}${roomMoves(p.c) ? `<small>${esc(roomSummary(p.c))}</small>` : `<small>All three days</small>`}</dd></div>` : ""}
        <div class="sc-row"><dt>Portfolio</dt><dd class="port">${p.p ? esc(p.p) : `<span class="muted">Awaiting allocation</span>`}</dd></div>
        <div class="sc-row reg"><dt>Registered</dt><dd>${esc(p.r)}${p.g ? `<small class="cur">Grade ${p.g}${GRADE_TAG[p.g] ? " · " + GRADE_TAG[p.g] : ""}${p.cu === "IGCSE" ? " · IGCSE" : ""}</small>` : ""}</dd></div>
      </dl>`;
    const prev = r[o.si - 1], next = r[o.si + 1];
    const nb = (x, dir) => x ? `<button type="button" data-go="${x.id}"><b>${dir === "l" ? "← " + x.id : x.id + " →"}</b><span>${x.p ? esc(x.p.n) : "Empty"}</span></button>` : `<button type="button" disabled><b>${dir === "l" ? "← Wall" : "Wall →"}</b><span>End of row</span></button>`;
    card.className = "seatcard plate is-open";
    card.innerHTML = `<div class="sc-head"><div><p class="eyebrow eyebrow--red">Seat</p><div class="sc-code">${o.id}</div></div><div class="sc-where">${where}</div><button type="button" class="sc-close" id="card-close" aria-label="Close seat details">${closeIcon}</button></div>${body}
      <div class="sc-nav">${nb(prev, "l")}${nb(next, "r")}</div>`;
    $("card-close").onclick = () => select(null);
    card.querySelectorAll("[data-go]").forEach(b => b.onclick = () => select(byId[b.dataset.go.toUpperCase()], { reveal: true }));
    if (animate && G && !reduce) G.from(card.querySelectorAll(".sc-code, .sc-where, .sc-name, .sc-badge, .sc-row, .sc-nav"), { y: 12, opacity: 0, duration: .55, stagger: .035, ease: "expo.out", clearProps: "all" });
  }

  let ringTween = null;
  function select(o, opts = {}) {
    if (state.sel) state.sel.el.classList.remove("sel");
    state.sel = o;
    if (o) {
      o.el.classList.add("sel");
      o.el.parentNode.appendChild(o.el);
      ring.setAttribute("cx", o.x); ring.setAttribute("cy", o.y); ring.setAttribute("visibility", "visible");
      if (G && !reduce) {
        if (ringTween) ringTween.kill();
        ringTween = G.fromTo(ring, { attr: { r: 13 }, opacity: 1 }, { attr: { r: 30 }, opacity: 0, duration: 1.5, ease: "power2.out", repeat: -1 });
        G.fromTo(o.rect, { scale: 1.35, transformOrigin: "50% 50%" }, { scale: 1, duration: .7, ease: "elastic.out(1, .45)" });
      }
      if (opts.zoom) zoomTo(o); else if (opts.reveal) reveal(o);
      try { history.replaceState(null, "", "#" + o.id); } catch (e) {}
    } else {
      ring.setAttribute("visibility", "hidden");
      if (ringTween) { ringTween.kill(); ringTween = null; }
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }
    renderCard(o, true);
  }

  /* ---------- pan & zoom ---------- */
  const map = $("map");
  const view = { k: 1, tx: 0, ty: 0 };
  let userMoved = false, minK = 0.3;
  const maxK = 6;
  const apply = () => vp.setAttribute("transform", `translate(${view.tx},${view.ty}) scale(${view.k})`);
  const size = () => { const r = map.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  function fitView() {
    const { w, h } = size(), bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    const k = Math.min((w - 28) / bw, (h - 28) / bh);
    minK = Math.min(k * 0.8, 1);
    return { k, tx: (w - bw * k) / 2 - bounds.x0 * k, ty: (h - bh * k) / 2 - bounds.y0 * k };
  }
  function stopAnim() { if (G) G.killTweensOf(view); }
  function animateTo(t) {
    stopAnim();
    if (!G || reduce) { Object.assign(view, t); apply(); return; }
    G.to(view, { k: t.k, tx: t.tx, ty: t.ty, duration: .9, ease: "expo.out", onUpdate: apply });
  }
  function visibleH() {
    const { h } = size();
    const card = $("card");
    if (!mq.matches || !card.classList.contains("is-open")) return h;
    const mapTop = map.getBoundingClientRect().top, sheetTop = innerHeight - 12 - card.offsetHeight;
    return Math.max(140, Math.min(h, sheetTop - mapTop));
  }
  const centerOn = (x, y, k) => { const { w } = size(), vh = visibleH(); return { k, tx: w / 2 - x * k, ty: vh / 2 - y * k }; };
  function zoomTo(o) { userMoved = true; animateTo(centerOn(o.x, o.y, Math.max(view.k, Math.min(maxK, fitView().k * 2.4)))); }
  function reveal(o) {
    const { w } = size(), h = visibleH(), sx = view.tx + o.x * view.k, sy = view.ty + o.y * view.k, m = 48;
    if (sx < m || sx > w - m || sy < m || sy > h - m) { userMoved = true; animateTo(centerOn(o.x, o.y, view.k)); }
  }
  function frameSeats(list) {
    const xs = list.map(o => o.x), ys = list.map(o => o.y);
    const x0 = Math.min(...xs) - CW, x1 = Math.max(...xs) + CW, y0 = Math.min(...ys) - RH, y1 = Math.max(...ys) + RH;
    const { w, h } = size(), fit = fitView();
    const k = Math.max(fit.k, Math.min(maxK, fit.k * 2.4, (w - 60) / (x1 - x0), (h - 60) / (y1 - y0)));
    userMoved = true; animateTo(centerOn((x0 + x1) / 2, (y0 + y1) / 2, k));
  }
  function zoomAt(px, py, f0) {
    const k = Math.max(minK, Math.min(maxK, view.k * f0)), f = k / view.k;
    view.tx = px - (px - view.tx) * f; view.ty = py - (py - view.ty) * f; view.k = k; apply(); userMoved = true;
  }
  function zoomBy(f) {
    const { w, h } = size(), k = Math.max(minK, Math.min(maxK, view.k * f)), r = k / view.k;
    animateTo({ k, tx: w / 2 - (w / 2 - view.tx) * r, ty: h / 2 - (h / 2 - view.ty) * r }); userMoved = true;
  }
  $("zin").onclick = () => zoomBy(1.5);
  $("zout").onclick = () => zoomBy(1 / 1.5);
  $("zfit").onclick = () => { userMoved = false; animateTo(fitView()); };

  let hintT = null;
  map.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey)) {
      const h = $("ctrl-hint"); h.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove("on"), 900);
      return;   // let the page (Lenis) scroll
    }
    e.preventDefault(); e.stopPropagation(); stopAnim();
    $("ctrl-hint").classList.remove("on");
    const r = map.getBoundingClientRect(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * 0.0022));
  }, { passive: false });

  const ptrs = new Map();
  let gesture = null;
  map.addEventListener("pointerdown", e => {
    if (e.target.closest(".zoom")) return;
    stopAnim();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { map.setPointerCapture(e.pointerId); } catch (_) {}
    const seatEl = e.target.closest && e.target.closest(".seat");
    if (ptrs.size === 1) gesture = { type: "pan", sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false, seat: seatEl ? seatEl.dataset.id : null };
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], r = map.getBoundingClientRect();
      gesture = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k, tx: view.tx, ty: view.ty, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
    }
  });
  map.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === "mouse") hover(e); return; }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.type === "pan") {
      const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
      if (!gesture.moved && Math.hypot(dx, dy) > 6) { gesture.moved = true; map.classList.add("dragging"); $("tip").hidden = true; }
      if (gesture.moved) { view.tx = gesture.tx + dx; view.ty = gesture.ty + dy; apply(); userMoved = true; }
    } else if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], r = map.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      const k = Math.max(minK, Math.min(maxK, gesture.k * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d)), f = k / gesture.k;
      view.k = k; view.tx = mx - (gesture.mx - gesture.tx) * f; view.ty = my - (gesture.my - gesture.ty) * f; apply(); userMoved = true;
    }
  });
  function endPtr(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (gesture && gesture.type === "pan" && !gesture.moved && e.type === "pointerup" && gesture.seat) select(byId[gesture.seat.toUpperCase()]);
    if (ptrs.size === 0) { gesture = null; map.classList.remove("dragging"); }
    else if (ptrs.size === 1) { const [p] = [...ptrs.values()]; gesture = { type: "pan", sx: p.x, sy: p.y, tx: view.tx, ty: view.ty, moved: true }; }
  }
  map.addEventListener("pointerup", endPtr);
  map.addEventListener("pointercancel", endPtr);
  map.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") $("tip").hidden = true; });
  function hover(e) {
    const el = e.target.closest && e.target.closest(".seat"), tip = $("tip");
    if (!el) { tip.hidden = true; return; }
    const o = byId[el.dataset.id.toUpperCase()];
    tip.innerHTML = `<b>${o.id}</b>${o.p ? esc(o.p.n) : "Empty"}`;
    tip.style.left = (view.tx + o.x * view.k) + "px";
    tip.style.top = (view.ty + (o.y - 11) * view.k) + "px";
    tip.hidden = false;
  }
  map.addEventListener("keydown", e => {
    const k = e.key;
    if (k === "+" || k === "=") { zoomBy(1.5); e.preventDefault(); return; }
    if (k === "-") { zoomBy(1 / 1.5); e.preventDefault(); return; }
    if (k === "0") { $("zfit").click(); e.preventDefault(); return; }
    if (k === "Escape") { select(null); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return;
    e.preventDefault();
    const o = state.sel;
    if (!o) { const a = rows[rows.length - 1].list; select(a[Math.floor(a.length / 2)], { reveal: true }); return; }
    const r = rows[o.ri].list;
    let n = null;
    if (k === "ArrowLeft") n = r[o.si - 1];
    else if (k === "ArrowRight") n = r[o.si + 1];
    else { const tr = rows[o.ri + (k === "ArrowUp" ? -1 : 1)]; if (tr) n = tr.list.reduce((b, c) => Math.abs(c.col - o.col) < Math.abs(b.col - o.col) ? c : b); }
    if (n) select(n, { reveal: true });
  });

  /* ---------- scrolling (Lenis + GSAP ticker) ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.6, lerp: 0.09 });
    if (G && ST) { lenis.on("scroll", ST.update); G.ticker.add(t => lenis.raf(t * 1000)); G.ticker.lagSmoothing(0); }
    else { const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  }
  const barH = () => $("topbar").getBoundingClientRect().height;
  function scrollToEl(el, cb, extra = 16) {
    const offset = -(barH() + extra);
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.3, onComplete: () => cb && cb() });
    else { const y = el.getBoundingClientRect().top + window.scrollY + offset; window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" }); if (cb) setTimeout(cb, reduce ? 0 : 600); }
  }
  const planEl = $("plan"), mapEl = $("map");
  const toMap = cb => scrollToEl(mq.matches ? mapEl : planEl.querySelector(".plan-grid"), cb, mq.matches ? 8 : 16);
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    const target = id === "#top" ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (id === "#top") { lenis ? lenis.scrollTo(0, { duration: 1.3 }) : window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }
    else scrollToEl(target);
  });

  // top bar: tint after scrolling, tuck away on the way down
  let lastY = 0;
  const topbar = $("topbar"), prog = $("progress");
  function onScroll() {
    const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    topbar.classList.toggle("is-scrolled", y > 24);
    topbar.classList.toggle("is-hidden", y > lastY && y > 320 && document.activeElement !== $("q"));
    lastY = y;
    prog.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- search ---------- */
  const q = $("q"), res = $("results");
  const norm = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const schoolList = [...schoolCount];
  let hits = [], active = 0;
  function search(text) {
    const t = norm(text).trim();
    if (!t) return [];
    const out = [];
    const seat = byId[text.trim().toUpperCase().replace(/\s+/g, "")];
    if (seat) out.push({ kind: "Seat", seat });
    const tg = t.replace(/[-\s]+/g, " ");
    Object.keys(GRADE_ALIASES).forEach(g => {
      const n = people.filter(o => o.p.g === +g).length;
      if (n && GRADE_ALIASES[g].some(a => { const an = a.replace(/[-\s]+/g, " "); return tg === an || (tg.length >= 3 && an.startsWith(tg)); })) out.push({ kind: "Grade", grade: +g, n });
    });
    const roomNorm = r => norm(r).replace(/[^a-z0-9]/g, "");
    const tRoom = t.replace(/[^a-z0-9]/g, "");
    if (tRoom.length >= 2) ORDER.filter(c => VENUES[c] && !out.some(o => o.com === c) && VENUES[c].rooms.some(r => roomNorm(r).includes(tRoom)))
      .forEach(c => out.push({ kind: "Room", com: c, n: comCount.get(c) || 0, room: roomSummary(c) }));
    ORDER.filter(c => comCount.has(c) && (norm(c).startsWith(t) || (t.length > 3 && norm(META[c].full).includes(t)))).forEach(c => out.push({ kind: "Committee", com: c, n: comCount.get(c) }));
    const wordStart = s => norm(s).split(/[\s.]+/).some(w => w.startsWith(t));
    const nameHits = people.filter(o => norm(o.p.n).includes(t)).sort((a, b) => (wordStart(b.p.n) - wordStart(a.p.n)) || a.p.n.localeCompare(b.p.n));
    nameHits.slice(0, 8).forEach(o => out.push({ kind: "Delegate", seat: o }));
    schoolList.filter(([sname]) => norm(sname).includes(t)).slice(0, 4).forEach(([sname, n]) => out.push({ kind: "School", school: sname, n }));
    if (t.length >= 4) delegates.filter(o => o.p.cu && norm(o.p.cu).replace(/\s+/g, "").startsWith(tg.replace(/ /g, "")) && !nameHits.includes(o)).slice(0, 10).forEach(o => out.push({ kind: "Delegate", seat: o }));
    if (out.length < 12) delegates.filter(o => norm(o.p.p).includes(t) && !nameHits.includes(o)).slice(0, 12 - out.length).forEach(o => out.push({ kind: "Portfolio", seat: o }));
    return out.slice(0, 18);
  }
  function renderResults() {
    if (!q.value.trim()) { res.hidden = true; q.setAttribute("aria-expanded", "false"); return; }
    res.hidden = false; q.setAttribute("aria-expanded", "true");
    if (!hits.length) { res.innerHTML = `<div class="none">Nobody matches “${esc(q.value)}”. Try a surname, a school or a seat such as K5.</div>`; return; }
    res.innerHTML = hits.map((h, i) => {
      let code, main, sub;
      if (h.seat) {
        const p = h.seat.p; code = h.seat.id; main = p ? p.n : "Empty seat";
        sub = !p ? "" : h.kind === "Portfolio" ? `${p.p} · ${p.c || "awaiting committee"}` : p.k === "EB" ? `${p.p} · ${p.c}` : `${p.s}${p.c ? " · " + p.c : ""}`;
      } else if (h.school) { code = h.n; main = h.school; sub = `Light up all ${h.n} seats`; }
      else if (h.grade) { code = h.n; main = "Grade " + h.grade + " · " + GRADE_TAG[h.grade]; sub = `Cambridge ${GRADE_TAG[h.grade]} · light up all ${h.n} seats`; }
      else if (h.kind === "Room") { code = h.n; main = h.com + " \u00b7 " + roomRuns(h.com)[0].room; sub = h.room; }
      else { code = h.n; main = h.com; sub = META[h.com].full; }
      return `<button type="button" role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === active}"><span class="r-code">${esc(code)}</span><span class="r-main"><strong>${esc(main)}</strong><small>${esc(sub)}</small></span><span class="tag ${h.kind === "Delegate" || h.kind === "Seat" ? "" : "tag--red"}">${h.kind}</span></button>`;
    }).join("");
    if (G && !reduce) G.from("#results button", { y: 6, opacity: 0, duration: .35, stagger: .015, ease: "power2.out", clearProps: "all" });
  }
  function closeResults() { res.hidden = true; q.setAttribute("aria-expanded", "false"); }
  function choose(h) {
    if (!h) return;
    closeResults(); q.blur();
    if (h.seat) {
      if (state.focus) { state.focus = null; applyScheme(); renderLegend(false); }
      select(h.seat);
      toMap(() => zoomTo(h.seat));
    } else if (h.grade) focusGroup("grade", "g" + h.grade);
    else if (h.school) focusGroup("school", h.school);
    else if (h.com) focusGroup("committee", h.com);
  }
  function focusGroup(mode, key) {
    setMode(mode, key);
    if (mode === "school" && !state.showAll) { const idx = state.scheme.items.findIndex(i => i.key === key); if (idx >= state.scheme.limit) { state.showAll = true; renderLegend(false); } }
    toMap(() => frameSeats(people.filter(o => state.scheme.key(o.p) === key)));
  }
  q.addEventListener("input", () => { hits = search(q.value); active = 0; renderResults(); });
  q.addEventListener("focus", () => { if (q.value.trim()) { hits = search(q.value); renderResults(); } });
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hits.length) return; e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
      res.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-selected", String(+b.dataset.i === active)));
      const el = $("opt-" + active); if (el) el.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); choose(hits[active]); }
    else if (e.key === "Escape") closeResults();
  });
  res.addEventListener("pointerdown", e => e.preventDefault());
  res.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) choose(hits[+b.dataset.i]); });
  document.addEventListener("pointerdown", e => { if (!e.target.closest(".finder")) closeResults(); });
  document.querySelectorAll("[data-try]").forEach(b => b.addEventListener("click", () => { q.value = b.dataset.try; hits = search(q.value); active = 0; renderResults(); q.focus(); }));
  function goFind() { const after = () => { q.focus({ preventScroll: true }); q.select(); }; lenis ? lenis.scrollTo(0, { duration: 1.1, onComplete: after }) : (window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }), setTimeout(after, 400)); }
  $("top-find").addEventListener("click", goFind);
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); goFind(); }
  });

  /* ---------- committee rooms ---------- */
  const rolesShort = r => r.replace("Chairperson", "Chair");
  /* ---------- rooms reference ---------- */
  let roomDay = 1;
  function renderRooms() {
    const list = ORDER.filter(c => VENUES[c]).map(c => ({ c, v: VENUES[c], room: VENUES[c].rooms[roomDay - 1] }))
      .sort((a, b) => a.room.localeCompare(b.room, "en", { numeric: true }) || a.c.localeCompare(b.c));
    $("rooms-body").innerHTML = list.map(({ c, v, room }) => {
      const moved = roomMoves(c), runs = roomRuns(c);
      const mine = runs.filter(r => r.room === room).reduce((a, r) => a.concat(r.days), []);
      const other = [...new Set(runs.filter(r => r.room !== room).map(r => r.room))];
      return `<tr${moved ? ' class="is-moved"' : ""}>
        <th scope="row"><span class="rm-name">${esc(room)}</span>${moved ? `<span class="rm-flag">Day${mine.length > 1 ? "s" : ""} ${mine.join(" &amp; ")}${other.length ? " \u00b7 otherwise " + esc(other.join(", ")) : ""}</span>` : ""}</th>
        <td><span class="rm-com"><i style="background:${COM[c]}"></i>${esc(c)}</span><span class="rm-full">${esc((META[c] || {}).full || "")}</span></td>
        <td class="rm-n">${v.cap}</td>
        <td class="rm-go"><button type="button" class="link-arrow" data-com="${esc(c)}">Seats <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg></button></td>
      </tr>`;
    }).join("");
    const movers = ORDER.filter(c => VENUES[c] && roomMoves(c));
    $("rooms-note").innerHTML = movers.length
      ? `<strong>Rooms that change:</strong> ${movers.map(c => `${esc(c)} \u2014 ${esc(roomSummary(c))}`).join(" &nbsp;·&nbsp; ")}`
      : "";
    document.querySelectorAll(".days .filter").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.day === roomDay)));
  }
  document.querySelectorAll(".days .filter").forEach(b => b.addEventListener("click", () => {
    if (+b.dataset.day === roomDay) return;
    roomDay = +b.dataset.day; renderRooms();
    if (G && !reduce) G.from("#rooms-body tr", { y: 10, opacity: 0, duration: .4, stagger: .02, ease: "power2.out", clearProps: "all" });
  }));
  $("rooms-body").addEventListener("click", e => { const b = e.target.closest("[data-com]"); if (b) focusGroup("committee", b.dataset.com); });
  renderRooms();

  $("cmt-grid").innerHTML = ORDER.filter(c => comCount.has(c) || ebBy[c]).map(c => {
    const m = META[c] || { pre: "", name: c }, n = comCount.get(c) || 0, board = ebBy[c] || [];
    return `<button type="button" class="cmt" data-com="${esc(c)}" data-abbr="${esc(c)}" aria-label="${esc(m.full || c)}: show ${n} delegates on the plan">
      <span class="cmt-prefix">${esc(m.pre)}</span>
      <span class="cmt-abbr"><i style="background:${COM[c]}"></i>${esc(c)}</span>
      <span class="cmt-name">${esc(m.name)}</span>
      ${m.tag ? `<span class="cmt-agenda">${esc(m.tag)}</span>` : ""}
      ${roomsOf(c) ? (roomMoves(c)
        ? `<span class="cmt-rooms moves">${DAYS.map((d, i) => `<span><b>Day ${d.n}</b><i>${esc(roomsOf(c)[i])}</i></span>`).join("")}</span>`
        : `<span class="cmt-rooms same"><span><b>Days 1&ndash;3</b><i>${esc(roomsOf(c)[0])}</i></span></span>`) : ""}
      ${VENUES[c] ? `<span class="cmt-setup"><b>Arrangement</b>${esc(VENUES[c].setup)}${VENUES[c].note ? `<em>${esc(VENUES[c].note)}</em>` : ""}</span>` : ""}
      ${board.length ? `<span class="cmt-eb">${board.map(o => `<span><b>${esc(o.p.n)}</b> · ${esc(rolesShort(o.p.p))} · ${o.id}</span>`).join("")}</span>` : ""}
      <span class="cmt-foot"><span class="tag">${n ? n + " delegates" : "Board only"}</span>${m.type ? `<span class="tag tag--red">${esc(m.type)}</span>` : ""}<span class="cmt-more">${n ? "On the plan" : "Board seats"} <span aria-hidden="true">→</span></span></span>
    </button>`;
  }).join("");
  $("cmt-grid").addEventListener("click", e => {
    const b = e.target.closest(".cmt"); if (!b) return;
    const c = b.dataset.com;
    if (comCount.has(c)) focusGroup("committee", c);
    else { setMode("committee", c); toMap(() => frameSeats(ebBy[c])); }
  });

  /* ---------- schools ---------- */
  const rowsOf = sname => {
    const set = new Set(delegates.filter(o => o.p.s === sname).map(o => o.row));
    const ordered = rowOrderFront.filter(r => set.has(r));
    return ordered.length > 4 ? `Rows ${ordered.slice(0, 3).join(", ")} + ${ordered.length - 3} more` : (ordered.length > 1 ? "Rows " : "Row ") + ordered.join(", ");
  };
  const schoolScheme = buildScheme("school");
  $("school-list").innerHTML = schoolScheme.items.filter(i => i.key !== "Executive Board").map(it =>
    `<button type="button" class="school" data-school="${esc(it.key)}"><span class="sch-n">${it.n}</span><span class="sch-name"><span class="sw" style="background:${it.color}"></span>${esc(it.key)}<small>${rowsOf(it.key)}</small></span><span class="sch-go">Plan <span aria-hidden="true">→</span></span></button>`).join("");
  $("school-list").addEventListener("click", e => { const b = e.target.closest(".school"); if (b) focusGroup("school", b.dataset.school); });

  /* ---------- boot ---------- */
  let startMode = "committee";
  try { const m = localStorage.getItem("shilpmun-mode"); if (["committee", "school", "type", "grade"].includes(m)) startMode = m; } catch (e) {}
  setMode(startMode);
  renderCard(null);
  Object.assign(view, fitView()); apply();
  if (window.ResizeObserver) new ResizeObserver(() => { if (!userMoved) { stopAnim(); Object.assign(view, fitView()); apply(); } }).observe(map);
  mq.addEventListener && mq.addEventListener("change", () => renderCard(state.sel, false));
  onScroll();
  if (window.IntersectionObserver) new IntersectionObserver(es => es.forEach(en => $("card").classList.toggle("is-away", !en.isIntersecting)), { threshold: 0.12 }).observe(map);

  /* ---------- motion ---------- */
  if (G && !reduce) {
    const tl = G.timeline({ defaults: { ease: "expo.out" } });
    tl.from(".hero .mh-bold", { yPercent: 110, duration: 1.2 }, 0.1)
      .fromTo(".hero .mh-script", { clipPath: "inset(-20% 100% -40% 0)" }, { clipPath: "inset(-20% 0% -40% 0)", duration: 1.5, ease: "power2.inOut", clearProps: "clipPath" }, 0.35)
      .from(".hero [data-hero]", { y: 22, opacity: 0, duration: 1, stagger: .08, clearProps: "transform,opacity" }, 0.3)
      .fromTo("#hero-plate", { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.4, ease: "expo.inOut", clearProps: "clipPath" }, 0.05)
      .from("#hero-plate img", { scale: 1.3, duration: 2, ease: "expo.out" }, 0.05)
      .from("#stats > div", { y: 18, opacity: 0, duration: .9, stagger: .06, clearProps: "transform,opacity" }, 0.55);
    document.querySelectorAll("#stats .stat-v").forEach((el, i) => {
      const o = { v: 0 }, n = +el.dataset.n;
      G.to(o, { v: n, duration: 1.6, delay: .6 + i * .06, ease: "power3.out", onUpdate: () => el.textContent = Math.round(o.v) });
    });

    // ticker drifts on its own and speeds up with scroll velocity
    const mq1 = G.to("#marquee", { xPercent: -50, ease: "none", duration: 38, repeat: -1 });
    if (lenis) lenis.on("scroll", e => { const v = Math.min(5, 1 + Math.abs(e.velocity) / 12); G.to(mq1, { timeScale: e.direction < 0 ? -v : v, duration: .3, overwrite: true }); G.to(mq1, { timeScale: e.direction < 0 ? -1 : 1, duration: 1.2, delay: .3 }); });

    if (ST) {
      G.to("#hero-plate img", { yPercent: 10, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      document.querySelectorAll("[data-reveal]").forEach(h => {
        const st = { trigger: h, start: "top 85%", once: true };
        G.from(h.querySelectorAll(".mh-bold"), { yPercent: 110, duration: 1.1, ease: "expo.out", scrollTrigger: st });
        G.fromTo(h.querySelectorAll(".mh-script"), { clipPath: "inset(-20% 100% -40% 0)" }, { clipPath: "inset(-20% 0% -40% 0)", duration: 1.3, ease: "power2.inOut", delay: .15, clearProps: "clipPath", scrollTrigger: st });
        G.from(h.querySelectorAll(".eyebrow, .lede"), { y: 18, opacity: 0, duration: .9, stagger: .08, ease: "expo.out", delay: .1, clearProps: "transform,opacity", scrollTrigger: st });
        G.from(h.querySelectorAll("[data-rule]"), { scaleX: 0, duration: 1.1, ease: "expo.inOut", delay: .2, scrollTrigger: st });
      });
      // the hall fills from the stage backwards
      const front = rowEls.slice().reverse();
      G.from(front, { opacity: 0, y: 14, duration: .7, stagger: .045, ease: "power3.out", clearProps: "opacity", scrollTrigger: { trigger: "#map", start: "top 78%", once: true } });
      G.from("#stage", { opacity: 0, y: 20, duration: .9, ease: "expo.out", scrollTrigger: { trigger: "#map", start: "top 78%", once: true } });
      G.from(".plan-side > *", { x: 24, opacity: 0, duration: 1, stagger: .1, ease: "expo.out", clearProps: "transform,opacity", scrollTrigger: { trigger: ".plan-grid", start: "top 80%", once: true } });
      G.set(".cmt", { y: 40, opacity: 0 }); G.set(".school", { x: -18, opacity: 0 });
      ST.batch(".cmt", { start: "top 90%", once: true, onEnter: b => G.fromTo(b, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .07, ease: "expo.out", clearProps: "transform,opacity" }) });
      ST.batch(".school", { start: "top 94%", once: true, onEnter: b => G.fromTo(b, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: .8, stagger: .03, ease: "expo.out", clearProps: "transform,opacity" }) });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
    }
  }

  /* ---------- deep link ---------- */
  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    if (id && byId[id]) { select(byId[id]); setTimeout(() => toMap(() => zoomTo(byId[id])), 250); }
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
