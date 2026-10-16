/* ============================================================
   ENGINE — a small quarterly New Keynesian-style macro model.
   Demand: IS curve with lagged real rates, long real yields, fiscal
   impulse and financial stress. Prices: expectations-augmented
   Phillips curve. Expectations anchored by credibility. Okun's law,
   debt dynamics, term premium, housing credit, bank duration risk,
   an open-economy currency block, and Black–Scholes option pricing.
   Fully deterministic for a given level + seed + action log, so
   games can be resumed and scores re-verified on a server.
   ============================================================ */

const DEFAULT_TARGETS = { infl: [1, 3], unempMax: 6, growthMin: 0, stressMax: 40, debtMax: 120, approvalMin: 35, bubbleMax: 70, bankMin: 30, fxMin: 80, bookMin: 95 };
const DEFAULT_FAIL = { approvalMin: 12, stressMax: 93, inflMax: 16, debtMax: 175, fxMin: 45, bookMin: 70 };
const BASE_PARAMS = { rN: 0.5, target: 2, uStar: 4.5, potential: 2 };
const BASE_STATE = { rate: 2.5, infl: 2, expInfl: 2, gap: 0, unemp: 4.5, debt: 80, spend: 38, tax: 36, qe: 10, stress: 18,
  stocks: 100, approval: 55, cred: 70, bubble: 20, bank: 80, fx: 100, reserves: 30, foreignRate: 2.5, book: 100 };

const FAIL_REASONS = {
  fired: { title: 'You have been replaced', body: 'Public trust collapsed and the government found someone new. Economic pain that lasts too long becomes a political problem.' },
  meltdown: { title: 'Financial meltdown', body: 'Market fear went off the scale. Credit froze, and the panic fed on itself faster than policy could respond.' },
  spiral: { title: 'Runaway inflation', body: 'Prices spiralled out of control. Once everyone expects high inflation, it becomes self-fulfilling.' },
  debt: { title: 'Debt crisis', body: 'Investors refused to roll over the government’s debt. Borrowing costs exploded.' },
  currency: { title: 'Currency collapse', body: 'The currency went into free fall, pushing up import prices and wiping out anyone who borrowed in dollars.' },
  margin: { title: 'Margin call', body: 'Your book lost 30% of its value and the risk desk closed every position. Selling insurance pays steadily, right up until the disaster you insured.' }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- Black–Scholes (European, no dividends) ---------- */
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}
function blackScholes(S, K, r, sigma, T) {
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / sq, d2 = d1 - sq;
  const df = Math.exp(-r * T);
  return { call: S * normCdf(d1) - K * df * normCdf(d2), put: K * df * normCdf(-d2) - S * normCdf(-d1), deltaCall: normCdf(d1), deltaPut: normCdf(d1) - 1 };
}
/* Three-month options, 5% out of the money, priced off the fear index as implied volatility */
function optionQuotes(s) {
  const S = s.stocks, r = Math.log(1 + s.rate / 100), sig = s.iv / 100, T = 0.25;
  const Kp = 0.95 * S, Kc = 1.05 * S;
  const p = blackScholes(S, Kp, r, sig, T), c = blackScholes(S, Kc, r, sig, T);
  return { S, Kp, Kc, put: p.put, call: c.call, putPct: p.put / Kp * 100, callPct: c.call / S * 100, cashPct: s.rate / 4, iv: s.iv,
    deltaPut: p.deltaPut, deltaCall: c.deltaCall };
}
const impliedVol = stress => clamp(6 + 0.6 * stress, 8, 85);

function hasTool(g, t) { return (g.level.tools || []).includes(t); }
function visibleMetrics(level) {
  const tools = level.tools || [], F = level.features || {}, T = level.targets || {};
  if (F.book) return ['book', 'stocks', 'iv', 'rate', 'infl', 'growth'];
  const m = ['infl', 'unemp', 'growth', 'stress', 'approval'];
  if (tools.includes('spend') || tools.includes('tax') || tools.includes('liquidity') || T.debtMax != null) m.push('debt');
  if (F.bubble) m.push('bubble');
  if (F.banks) m.push('bank');
  if (F.fx) m.push('fx');
  if (F.fx && tools.includes('fx')) m.push('reserves');
  return m;
}

function createGame(level, opts = {}) {
  const params = Object.assign({}, BASE_PARAMS, level.params || {});
  const s = Object.assign({}, BASE_STATE, level.state || {});
  if (!level.state || level.state.unemp == null) s.unemp = params.uStar - 0.5 * s.gap;
  if (!level.state || level.state.expInfl == null) s.expInfl = s.infl;
  s.tp = 0.6 + 0.035 * Math.max(0, s.debt - 90) + 0.02 * Math.max(0, 60 - s.cred) - 0.03 * (s.qe - 10);
  s.y10 = clamp(0.4 * s.rate + 0.6 * (params.rN + s.expInfl) + s.tp, 0, 30);
  s.effRate = s.y10;
  s.growth = params.potential;
  s.deficit = (s.spend - s.tax) - 0.35 * s.gap + s.effRate * s.debt / 100;
  s.iv = impliedVol(s.stress);
  const seed = opts.seed != null ? opts.seed : hashStr(level.id || level.title || 'x');
  const g = {
    level, params, s,
    targets: Object.assign({}, DEFAULT_TARGETS, level.targets || {}),
    fail: Object.assign({}, DEFAULT_FAIL, level.fail || {}),
    metrics: visibleMetrics(level),
    q: 1, quarters: level.quarters || 8, endless: !!level.endless,
    rrLag: (s.rate - s.expInfl) - params.rN,
    shocks: [], history: [], qScores: [], streak: 0, bestStreak: 0, points: 0,
    tags: {}, status: 'playing', failReason: null, rng: makeRng(seed), seed,
    pp: level.pp || 2, lastGuidance: null, minRate: s.rate, maxRateRise: 0, maxStress: s.stress, maxQe: s.qe,
    recession: false, negRun: 0, flags: {}, forced: [], hazard: 0, pendingNews: [], lastNews: [],
    spend0: s.spend, tax0: s.tax, debt0: s.debt, foreign0: s.foreignRate, risk0: 0, rateExp0: s.rate - s.expInfl,
    gapQStart: s.gap, fxQStart: s.fx, assisted: false, eventLog: [], lastScore: null, lastWhy: null,
    cashBook: 100, insuredWin: false, actions: [], choices: [], retired: false
  };
  g.risk0 = riskPremium(g);
  const sh = level.shocks || {};
  Object.keys(sh).forEach(k => addShock(g, k, sh[k][0], sh[k][1]));
  g.history.push(snap(g));
  return g;
}

function snap(g) {
  const s = g.s;
  return { q: g.q - 1, infl: s.infl, expInfl: s.expInfl, unemp: s.unemp, growth: s.growth, stress: s.stress, approval: s.approval,
    debt: s.debt, rate: s.rate, y10: s.y10, cred: s.cred, bubble: s.bubble, bank: s.bank, fx: s.fx, reserves: s.reserves, qe: s.qe,
    stocks: s.stocks, gap: s.gap, book: s.book, iv: s.iv };
}

function addShock(g, kind, amt, decay) { if (amt) g.shocks.push({ kind, amt, decay: decay == null ? 0.8 : decay }); }
function shockSum(g, kind) { return g.shocks.reduce((a, x) => a + (x.kind === kind ? x.amt : 0), 0); }

function riskPremium(g) {
  const s = g.s;
  return 0.05 * Math.max(0, s.stress - 20) + 0.03 * Math.max(0, s.debt - 60) + (s.reserves < 8 ? 2 : 0) + 0.04 * Math.max(0, 60 - s.cred);
}

/* Taylor (1993): i = r* + π + 0.5(π − π*) + 0.5 × output gap */
function taylorRate(g) {
  const s = g.s, p = g.params;
  return Math.max(0, p.rN + s.infl + 0.5 * (s.infl - p.target) + 0.5 * s.gap);
}
function taylorMove(g, cap = 0.75) {
  const want = Math.round(taylorRate(g) * 4) / 4;
  return clamp(Math.round((want - g.s.rate) * 4) / 4, -cap, cap);
}

const LIMITS = { infl: [-10, 40], expInfl: [-5, 30], gap: [-15, 10], unemp: [1, 30], debt: [0, 300], spend: [20, 60], tax: [15, 60],
  qe: [0, 80], stress: [3, 99], stocks: [5, 999], approval: [0, 100], cred: [0, 100], bubble: [0, 100], bank: [0, 100],
  fx: [30, 180], reserves: [0, 120], rate: [0, 25], foreignRate: [0, 15] };

function applyEffects(g, eff, scale = 1) {
  if (!eff) return;
  const s = g.s;
  const add = eff.add || {};
  Object.keys(add).forEach(k => {
    if (!(k in s)) return;
    s[k] += add[k] * (['stress', 'gap', 'unemp', 'infl', 'expInfl'].includes(k) ? scale : 1);
    if (LIMITS[k]) s[k] = clamp(s[k], LIMITS[k][0], LIMITS[k][1]);
  });
  if (add.rate) s.rate = Math.round(s.rate * 4) / 4;
  const sh = eff.shock || {};
  Object.keys(sh).forEach(k => addShock(g, k, sh[k][0] * scale, sh[k][1]));
  (eff.tags || []).forEach(t => { g.tags[t] = (g.tags[t] || 0) + 1; });
}

/* Start of a quarter. Policy levels: news lands now, before you act.
   Trading levels (features.book): you only see hints now; the news
   itself hits during the quarter, after your position is set. */
function beginQuarter(g) {
  g.gapQStart = g.s.gap; g.fxQStart = g.s.fx;
  const out = [];
  const lvl = g.level, book = !!(lvl.features && lvl.features.book);
  (lvl.events || []).filter(e => e.q === g.q).forEach(e => { if (EVENTS[e.id]) out.push({ id: e.id, def: EVENTS[e.id], headline: e.headline || EVENTS[e.id].headline }); });
  g.forced.splice(0).forEach(id => out.push({ id, def: EVENTS[id], headline: EVENTS[id].headline, forced: true }));
  let chance = lvl.random || 0;
  if (g.endless) chance = Math.min(0.85, 0.45 + g.q * 0.012);
  if (chance && g.q > 1 && g.rng() < chance) {
    const pool = (lvl.pool || RANDOM_POOL).filter(id => !out.some(o => o.id === id) && g.lastRandom !== id);
    const id = pool[Math.floor(g.rng() * pool.length)];
    g.lastRandom = id;
    out.push({ id, def: EVENTS[id], headline: EVENTS[id].headline, random: true });
  }
  const scale = g.endless ? 1 + (g.q - 1) / 18 : 1;
  const shown = [];
  out.forEach(ev => {
    if (book && ev.def.kind === 'news') { g.pendingNews.push(Object.assign({ scale }, ev)); return; }
    if (ev.def.kind === 'news') applyEffects(g, ev.def.effects, scale);
    g.eventLog.push({ q: g.q, id: ev.id, headline: ev.headline });
    shown.push(ev);
  });
  if (lvl.features && lvl.features.bubble && out.some(e => e.id === 'bubble_pop')) g.flags.popped = true;
  return shown;
}

function resolveDilemma(g, ev, idx) {
  const n = ev.def.choices.length;
  const i = clamp(Math.round(+idx || 0), 0, n - 1);
  const ch = ev.def.choices[i];
  applyEffects(g, ch.effects, 1);
  g.choices.push({ q: g.q, id: ev.id, c: i });
  g.eventLog.push({ q: g.q, id: ev.id, choice: i });
  return ch;
}

/* Enforce the rules on any action (a server replaying a log relies on this) */
function sanitizeAction(g, act) {
  const out = { rateDelta: 0, tools: {} };
  if (hasTool(g, 'rate')) out.rateDelta = clamp(Math.round((+act.rateDelta || 0) * 4) / 4, -1, 1);
  let budget = g.pp;
  const t = (act && act.tools) || {};
  TOOL_ORDER.forEach(k => {
    if (k === 'rate' || !t[k] || !hasTool(g, k)) return;
    const T = TOOLS[k];
    if (!T.options.some(o => o.id === t[k]) || T.cost > budget) return;
    out.tools[k] = t[k]; budget -= T.cost;
  });
  return out;
}

/* One quarter of the model */
function step(g, actIn = {}) {
  const s = g.s, p = g.params, F = g.level.features || {};
  const act = sanitizeAction(g, actIn);
  g.actions.push({ r: act.rateDelta, t: act.tools });
  const notes = [];

  // 0. Trading levels: price the position at the start of the quarter, then the news hits
  let trade = null;
  if (F.book) {
    trade = { pos: act.tools.trade || 'cash', q: optionQuotes(s), rf: s.rate / 400 };
    g.lastNews = g.pendingNews.splice(0);
    g.lastNews.forEach(ev => { applyEffects(g, ev.def.effects, ev.scale || 1); g.eventLog.push({ q: g.q, id: ev.id, headline: ev.headline }); });
  }
  const prev = Object.assign({}, s);

  // 1. Policy rate (with no rate tool, the central bank follows the Taylor rule)
  let dr = hasTool(g, 'rate') ? act.rateDelta : taylorMove(g, 0.75);
  const newRate = clamp(Math.round((s.rate + dr) * 100) / 100, 0, 25);
  dr = newRate - s.rate; s.rate = newRate;
  if (g.lastGuidance === 'dove' && dr > 0.01) { s.cred -= 6; notes.push('You hiked after promising to stay easy. Credibility −6.'); }
  if (g.lastGuidance === 'hawk' && dr < -0.01) { s.cred -= 6; notes.push('You cut after promising to stay tough. Credibility −6.'); }
  let surprise = Math.max(0, Math.abs(dr) - 0.5) * 8;
  if ((g.lastGuidance === 'hawk' && dr > 0) || (g.lastGuidance === 'dove' && dr < 0)) surprise *= 0.4;
  g.lastGuidance = null;
  g.minRate = Math.min(g.minRate, s.rate);
  g.maxRateRise = Math.max(g.maxRateRise, s.rate - g.minRate);

  // 2. Other tools
  const t = act.tools;
  if (t.guidance === 'hawk') { s.expInfl -= 0.35 * s.cred / 100 + 0.05; addShock(g, 'tp', 0.15, 0.7); g.lastGuidance = 'hawk'; }
  if (t.guidance === 'dove') { s.expInfl += 0.12 * s.cred / 100 + 0.05; addShock(g, 'tp', -0.35, 0.7); g.lastGuidance = 'dove'; }
  if (t.qe === 'buy') { s.qe += 6; s.stress -= 5; s.stocks *= 1.03; }
  if (t.qe === 'sell') { s.qe = Math.max(0, s.qe - 5); s.stress += 2; }
  if (t.spend === 'up') { s.spend += 1; s.approval += 1.5; }
  if (t.spend === 'down') { s.spend -= 1; s.approval -= 2.5; }
  if (t.tax === 'down') { s.tax -= 1; s.approval += 2; }
  if (t.tax === 'up') { s.tax += 1; s.approval -= 3; }
  // Lender of last resort: calms the panic; the cost is moral hazard (more risk-taking later), not inflation credibility
  if (t.liquidity === 'open') { s.stress -= 18; s.bank += 18; addShock(g, 'fin', -8, 0.7); g.hazard += 1; if (F.bubble) s.bubble += 3; }
  if (t.macropru === 'tighten') { s.bubble -= 8; s.bank += 4; addShock(g, 'demand', -0.35, 0.8); s.approval -= 1; }
  if (t.macropru === 'loosen') { s.bubble += 6; s.bank -= 2; addShock(g, 'demand', 0.3, 0.8); }
  if (t.fx === 'sell' && s.reserves >= 1) { const used = Math.min(6, s.reserves); s.reserves -= used; s.fx += 5 * used / 6; }
  if (t.fx === 'buy') { s.reserves += 4; s.fx -= 3; }
  Object.keys(LIMITS).forEach(k => { s[k] = clamp(s[k], LIMITS[k][0], LIMITS[k][1]); });

  // 3. Shocks currently in play
  const D = shockSum(g, 'demand'), S = shockSum(g, 'supply'), FN = shockSum(g, 'fin'), TP = shockSum(g, 'tp');

  // 4. Long-term yields: expected path of short rates + term premium (debt, credibility, QE)
  s.tp = clamp(0.6 + 0.035 * Math.max(0, s.debt - 90) + 0.02 * Math.max(0, 60 - s.cred) - 0.03 * (s.qe - 10) + TP
    + (F.fx ? 0.03 * Math.max(0, 95 - s.fx) : 0), -1.5, 9);
  s.y10 = clamp(0.4 * s.rate + 0.6 * (p.rN + s.expInfl) + s.tp, 0, 30);

  // 5. Currency: interest-parity style, relative to the starting balance
  let fxChg = 0;
  if (F.fx) {
    const carry = (s.rate - s.expInfl) - g.rateExp0 - (s.foreignRate - g.foreign0) - (riskPremium(g) - g.risk0);
    fxChg = clamp(1.3 * carry + (g.rng() - 0.5) * 1.5, -9, 9);
    s.fx = clamp(s.fx * (1 + fxChg / 100), 30, 180);
  }
  const deprec = F.fx ? clamp((g.fxQStart - s.fx) / g.fxQStart * 100, -8, 15) : 0;

  // 6. Demand (IS curve)
  const realGap = (s.rate - s.expInfl) - p.rN;
  g.rrLag = 0.45 * g.rrLag + 0.55 * realGap;
  const longGap = (s.y10 - s.expInfl) - (p.rN + 0.6);
  const impulse = 0.65 * g.rrLag + 0.35 * longGap;
  const mult = (s.rate < 0.75 || s.gap < -2 ? 1.4 : 0.85) * (s.debt > 120 ? 0.75 : 1);
  const fiscal = mult * (s.spend - g.spend0) - 0.55 * (s.tax - g.tax0);
  const stressDrag = 0.09 * Math.max(0, s.stress - 22);
  const bubbleBoost = F.bubble ? 0.025 * (s.bubble - 40) : 0;
  const fxBoost = F.fx ? 0.02 * (100 - s.fx) : 0;
  const gapPrev = s.gap;
  const gNoise = (g.rng() - 0.5) * 0.3;
  s.gap = clamp(0.76 * gapPrev + 0.24 * (fiscal - 2.1 * impulse - stressDrag + bubbleBoost + fxBoost) + 0.45 * D + gNoise, -15, 10);

  // 7. Inflation: expectations-augmented Phillips curve + supply shocks + import prices
  const inflPrev = s.infl, expPrev = s.expInfl;
  const iNoise = (g.rng() - 0.5) * 0.15;
  s.infl = clamp(0.5 * expPrev + 0.5 * inflPrev + 0.28 * s.gap + S + 0.1 * deprec + iNoise, -10, 40);
  const w = 0.06 + 0.3 * s.cred / 100;
  s.expInfl = clamp(w * p.target + (1 - w) * (0.55 * s.infl + 0.45 * expPrev), -5, 30);

  // 8. Jobs (Okun's law) and growth (annualised quarter-on-quarter: potential + 4 × change in the output gap)
  s.unemp = clamp(0.55 * s.unemp + 0.45 * (p.uStar - 0.5 * s.gap), 1, 30);
  s.growth = clamp(p.potential + 4 * (s.gap - g.gapQStart), -40, 30);

  // 9. Public finances: d' = d + deficit/4 − d × nominal growth/400
  s.effRate = 0.88 * s.effRate + 0.12 * s.y10;
  s.deficit = (s.spend - s.tax) - 0.35 * s.gap + s.effRate * s.debt / 100;
  s.debt = clamp(s.debt + s.deficit / 4 - s.debt * (s.growth + s.infl) / 400, 0, 300);

  // 10. Financial stress (a fear index)
  const base = 15 + 0.12 * Math.max(0, s.debt - 100) + 2.5 * Math.max(0, -s.gap - 1.5) + (F.banks ? 0.35 * Math.max(0, 60 - s.bank) : 0)
    + (F.bubble && s.bubble > 75 ? 0.4 * (s.bubble - 75) : 0) + 0.6 * Math.max(0, s.infl - 6) + (F.fx ? 0.3 * Math.max(0, 90 - s.fx) : 0) + FN;
  s.stress = clamp(0.7 * s.stress + 0.3 * base + surprise + (g.rng() - 0.5) * 3, 3, 99);

  // 11. Stocks: earnings follow the economy; valuations fall when real yields rise; fear lowers prices
  const amp = 4 + 0.15 * prev.stress;
  const ret = 1.5 + 1.5 * (s.gap - g.gapQStart) - 6.5 * (s.y10 - prev.y10) - 0.25 * (s.stress - prev.stress) + (F.bubble ? 0.05 * (s.bubble - 50) : 0) + (g.rng() + g.rng() - 1) * amp;
  s.stocks = clamp(s.stocks * (1 + clamp(ret, -45, 45) / 100), 5, 999);
  s.iv = impliedVol(s.stress);

  // 12. Public trust
  const mood = 60 - 5 * Math.max(0, s.unemp - p.uStar) - 3.5 * Math.max(0, s.infl - 3) - 1.5 * Math.max(0, -Math.max(-12, s.growth))
    + clamp(s.growth - 1.5, -3, 3) - 0.1 * Math.max(0, s.stress - 40);
  s.approval = clamp(0.8 * s.approval + 0.2 * mood, 0, 100);

  // 13. Credibility of the inflation target
  const dev = Math.abs(s.infl - p.target);
  let dc = dev < 1 ? 2 : -0.5 * Math.min(4, dev - 1);
  if (prev.infl - s.infl > 0.2 && s.infl > p.target) dc += 2.5;
  if (s.infl - prev.infl > 0.3 && s.infl > p.target + 1) dc -= 1.5;
  if (s.infl > p.target + 2 && dr > 0) dc += 1.5;
  s.cred = clamp(s.cred + dc, 0, 100);

  // 14. Housing credit: grows when real rates sit below neutral; prices feed on their own momentum
  if (F.bubble) {
    s.bubble = clamp(s.bubble + 1.5 * ((p.rN + s.expInfl) - s.rate) + 0.6 * Math.max(0, s.gap) + 0.04 * (s.bubble - 40), 0, 100);
    if (s.bubble >= 92 && !g.flags.popped) { g.forced.push('bubble_pop'); g.flags.popped = true; notes.push('The bubble tank is overflowing.'); }
  }
  // 15. Banks: long-bond losses when yields rise; rescues weaken the incentive to rebuild buffers
  if (F.banks) {
    s.bank = clamp(s.bank + Math.max(0, 1.5 - 0.4 * g.hazard) - 9 * Math.max(0, s.y10 - prev.y10) - 0.2 * Math.max(0, s.stress - 45), 0, 100);
    if (s.bank < 22 && !g.flags.run) { g.forced.push('bank_run'); g.flags.run = true; notes.push('Banks look shaky. Depositors are getting nervous.'); }
  }

  // 16. Options book (trading levels): settle the quarter's position
  let bookWhy = null;
  if (trade) {
    const Q = trade.q, S0 = Q.S, S1 = s.stocks, rf = trade.rf;
    let R = rf, parts = [['Interest on cash', rf]];
    if (trade.pos === 'long') { R = S1 / S0 - 1; parts = [['Index move', R]]; }
    if (trade.pos === 'put') {
      const n = 1 / Q.Kp, prem = Q.put * n * (1 + rf), pay = -n * Math.max(Q.Kp - S1, 0);
      R = rf + prem + pay; parts = [['Interest on collateral', rf], ['Put premium collected', prem], ['Put assigned below strike', pay]];
    }
    if (trade.pos === 'call') {
      const n = 1 / S0, prem = Q.call * n * (1 + rf), mv = n * Math.min(S1, Q.Kc) - 1;
      R = mv + prem; parts = [['Index move (capped)', mv], ['Call premium collected', prem]];
    }
    if (trade.pos === 'hedge') {
      const n = 1 / (S0 + Q.put), mv = n * S1 - 1, ins = n * Math.max(Q.Kp - S1, 0);
      R = mv + ins; parts = [['Index move', n * S1 - n * S0], ['Put insurance cost', -n * Q.put], ['Insurance payout', ins]];
    }
    s.book = s.book * (1 + R);
    g.cashBook = g.cashBook * (1 + rf);
    if (S1 / S0 <= 0.9 && R > 0) g.insuredWin = true;
    g.lastTrade = { pos: trade.pos, R, rf, idx: S1 / S0 - 1 };
    bookWhy = { from: 0, to: R * 100, parts: parts.map(([l, v]) => [l, v * 100]) };
  }

  // 17. Decay shocks
  g.shocks.forEach(x => { x.amt *= x.decay; });
  g.shocks = g.shocks.filter(x => Math.abs(x.amt) > 0.03);

  // 18. Why did this happen? (contributions to this quarter's changes)
  const gr = (v) => 4 * v;
  g.lastWhy = {
    infl: { from: inflPrev, to: s.infl, parts: [
      ['Expected inflation pull', 0.5 * (expPrev - inflPrev)],
      [s.gap >= 0 ? 'Economy running hot' : 'Slack in the economy', 0.28 * s.gap],
      ['Supply shocks', S],
      [deprec >= 0 ? 'Weaker currency' : 'Stronger currency', 0.1 * deprec],
      ['Random noise', iNoise] ] },
    growth: { from: p.potential, to: s.growth, parts: [
      ['News this quarter', gr(gapPrev - g.gapQStart)],
      [gapPrev < 0 ? 'Natural recovery' : 'Boom fading', gr(-0.24 * gapPrev)],
      [impulse > 0 ? 'Interest rates above neutral' : 'Interest rates below neutral', gr(0.24 * -2.1 * impulse)],
      ['Government budget', gr(0.24 * fiscal)],
      ['Market fear', gr(-0.24 * stressDrag)],
      ['Housing', gr(0.24 * bubbleBoost)],
      ['Exports and currency', gr(0.24 * fxBoost)],
      ['Demand shocks', gr(0.45 * D)],
      ['Random noise', gr(gNoise)] ] },
    book: bookWhy
  };

  // 19. Trackers
  g.maxStress = Math.max(g.maxStress, s.stress);
  g.maxQe = Math.max(g.maxQe, s.qe);
  if (s.growth < 0) { g.negRun++; if (g.negRun >= 2) g.recession = true; } else g.negRun = 0;

  // 20. Score
  const sc = scoreQuarter(g);
  if (sc.score >= 80) g.streak++; else g.streak = 0;
  g.bestStreak = Math.max(g.bestStreak, g.streak);
  const mult2 = 1 + 0.1 * Math.min(g.streak, 5);
  const pts = Math.round(sc.score * mult2);
  g.points += pts;
  g.qScores.push(sc.score);
  g.lastScore = Object.assign({ pts, mult: mult2, notes }, sc);
  g.history.push(snap(g));
  g.history[g.history.length - 1].q = g.q;

  // 21. Failure
  const f = g.fail;
  let fail = null;
  if (F.book) { if (s.book < f.bookMin) fail = 'margin'; }
  else if (s.approval < f.approvalMin) fail = 'fired';
  else if (s.stress >= f.stressMax) fail = 'meltdown';
  else if (s.infl >= f.inflMax) fail = 'spiral';
  else if (s.debt >= f.debtMax) fail = 'debt';
  else if (F.fx && s.fx < f.fxMin) fail = 'currency';
  if (fail) { g.status = 'failed'; g.failReason = fail; return g.lastScore; }

  g.q++;
  if (!g.endless && g.q > g.quarters) g.status = 'complete';
  return g.lastScore;
}

function scoreQuarter(g) {
  const s = g.s, T = g.targets, F = g.level.features || {};
  if (F.book) {
    // Matching cash scores 80 (a green quarter); beating it scores more; losses are penalised twice
    const R = g.lastTrade ? g.lastTrade.R * 100 : 0, rf = g.lastTrade ? g.lastTrade.rf * 100 : 0;
    const raw = 80 + 6 * (R - rf) - 5 * Math.max(0, -R);
    const sc = Math.round(clamp(raw, 0, 100));
    return { score: sc, raw, parts: sc < 80 ? { book: 80 - sc } : {} };
  }
  const d = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
  const di = d(s.infl, T.infl[0], T.infl[1]), du = Math.max(0, s.unemp - T.unempMax), dg = Math.max(0, T.growthMin - Math.max(-12, s.growth));
  const ds = Math.max(0, s.stress - T.stressMax);
  const parts = {
    infl: 12 * di + 5 * di * di,
    unemp: 10 * du + 4 * du * du,
    growth: 3 * dg + 0.5 * dg * dg,
    stress: ds + 0.02 * ds * ds,
    approval: 1.2 * Math.max(0, T.approvalMin - s.approval)
  };
  if (g.metrics.includes('debt')) parts.debt = 1.2 * Math.max(0, s.debt - T.debtMax);
  if (F.bubble) parts.bubble = 1.2 * Math.max(0, s.bubble - T.bubbleMax);
  if (F.banks) parts.bank = 1.2 * Math.max(0, T.bankMin - s.bank);
  if (F.fx) parts.fx = 1.2 * Math.max(0, T.fxMin - s.fx);
  Object.keys(parts).forEach(k => { parts[k] = Math.min(75, parts[k]); });
  const raw = 100 - Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Math.round(clamp(raw, 0, 100)), raw, parts };
}

function inZone(g, m) {
  const z = zoneOf(g, m);
  if (!z) return true;
  const v = g.s[m];
  return v >= z[0] - 1e-9 && v <= z[1] + 1e-9;
}
function zoneOf(g, m) {
  const T = g.targets, M = METRICS[m];
  if (g.level.features && g.level.features.book) return m === 'book' ? [T.bookMin, M.max] : null;
  switch (m) {
    case 'infl': return [T.infl[0], T.infl[1]];
    case 'unemp': return [M.min, T.unempMax];
    case 'growth': return [T.growthMin, M.max];
    case 'stress': return [M.min, T.stressMax];
    case 'approval': return [T.approvalMin, M.max];
    case 'debt': return [M.min, T.debtMax];
    case 'bubble': return [M.min, T.bubbleMax];
    case 'bank': return [T.bankMin, M.max];
    case 'fx': return [T.fxMin, M.max];
    default: return null;
  }
}

function cmp(a, op, b) {
  switch (op) { case '<=': return a <= b; case '<': return a < b; case '>=': return a >= b; case '>': return a > b; default: return false; }
}
function checkObjective(obj, g) {
  if (!obj) return false;
  if (obj.type === 'end') return cmp(g.s[obj.metric], obj.op, obj.value);
  if (obj.type === 'always') return g.history.every(h => cmp(h[obj.metric], obj.op, obj.value));
  if (obj.type === 'noRecession') return !g.recession;
  if (obj.type === 'streak') return g.bestStreak >= obj.value;
  if (obj.type === 'beatCash') return g.s.book > g.cashBook + 0.01;
  if (obj.type === 'all') return (obj.parts || []).every(p => checkObjective(p, g));
  return false;
}

function finalResult(g) {
  const avg = g.qScores.length ? g.qScores.reduce((a, b) => a + b, 0) / g.qScores.length : 0;
  const twoStar = g.level.twoStar || 80;
  if (g.endless) {
    // Endless: there is no finish line; sinking still banks your points
    const stars = [true, avg >= 80, g.bestStreak >= 8];
    return { complete: true, endless: true, avg: Math.round(avg), stars, starCount: stars.filter(Boolean).length, total: g.points, unassisted: false, twoStar: 80, quarters: g.q - 1 };
  }
  const complete = g.status === 'complete';
  const stars = [complete, complete && avg >= twoStar, complete && checkObjective(g.level.objective, g)];
  let total = g.points;
  if (complete) total += 100;
  if (stars[2]) total += 150;
  const unassisted = complete && !g.assisted;
  if (unassisted) total = Math.round(total * 1.15);
  return { complete, avg: Math.round(avg), stars, starCount: stars.filter(Boolean).length, total, unassisted, twoStar, quarters: g.q - 1 };
}

function cloneGame(g) {
  const { level, rng, ...rest } = g;
  const c = JSON.parse(JSON.stringify(rest));
  c.level = level; c.rng = () => 0.5;
  return c;
}
/* Staff forecast: one quarter ahead with no noise and no knowledge of surprises */
function forecast(g, act) { const c = cloneGame(g); c.pendingNews = []; step(c, act); return c.s; }

/* ---------- Benchmark bots ---------- */
function botAction(g, kind) {
  if (g.level.features && g.level.features.book) return { rateDelta: 0, tools: kind === 'taylor' ? { trade: 'long' } : {} };
  return { rateDelta: kind === 'taylor' ? taylorMove(g, 0.75) : 0, tools: {} };
}
function runBot(level, kind, seed) {
  const g = createGame(level, { seed });
  while (g.status === 'playing' && g.q < 200) {
    const evs = beginQuarter(g);
    evs.forEach(ev => { if (ev.def.kind === 'dilemma') resolveDilemma(g, ev, ev.def.bot || 0); });
    step(g, botAction(g, kind));
  }
  return { result: finalResult(g), game: g };
}

/* ---------- Replay: rebuild a game from its log ----------
   Used to resume after a reload and by the score-verification server. */
function replayGame(level, log) {
  const g = createGame(level);
  const actions = (log && log.actions) || [], choices = (log && log.choices) || [];
  let i = 0;
  while (g.status === 'playing' && g.q <= 400) {
    const evs = beginQuarter(g);
    const open = [];
    evs.forEach(ev => {
      if (ev.def.kind !== 'dilemma') { open.push(ev); return; }
      const c = choices.find(x => x.q === g.q && x.id === ev.id);
      if (c) resolveDilemma(g, ev, c.c); else open.push(ev);
    });
    if (i >= actions.length) {
      if (log && log.retired && g.endless) { g.retired = true; g.status = 'complete'; }
      return { g, open, missingChoice: open.some(e => e.def.kind === 'dilemma') };
    }
    if (open.some(e => e.def.kind === 'dilemma')) return { g, open, missingChoice: true };
    const a = actions[i++] || {};
    step(g, { rateDelta: a.r, tools: a.t });
  }
  return { g, open: [], missingChoice: false };
}
