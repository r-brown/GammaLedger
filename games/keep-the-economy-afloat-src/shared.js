/* ============================================================
   SHARED — used by the game and by the score-verification server.
   No DOM access in this file.
   ============================================================ */

const ENDLESS = { id: 'endless', endless: true, title: 'Endless Economy', concept: 'How long can you stay afloat?', era: 'Endless',
  start: { year: 1, q: 1 }, quarters: 999, tools: ['rate', 'guidance', 'qe', 'spend', 'tax', 'liquidity'], features: { banks: true },
  brief: 'No script, no end. Random shocks arrive faster and hit harder every year. Survive as many quarters as you can.',
  goal: 'Stay afloat. Retire whenever you like to bank your score.', state: {}, events: [ { q: 1, id: 'welcome' } ],
  objective: { type: 'streak', value: 8, label: 'Reach a streak of 8 green quarters' } };

function makeDailyLevel(key) {
  const rng = makeRng(hashStr('daily:' + key));
  const r = (a, b) => a + rng() * (b - a);
  const infl = +r(0.8, 5.5).toFixed(1), gap = +r(-2.5, 2.5).toFixed(1);
  const expInfl = +(2 + (infl - 2) * r(0.3, 0.7)).toFixed(1);
  const rate = Math.max(0, Math.round((0.5 + expInfl + r(-1.5, 1.5)) * 4) / 4);
  const pool = RANDOM_POOL.slice(); const evs = []; const qs = [2, 3, 4, 5, 6, 7];
  for (let i = 0; i < 3; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const q = qs.splice(Math.floor(rng() * qs.length), 1)[0];
    evs.push({ q, id });
  }
  evs.sort((a, b) => a.q - b.q);
  const objs = [
    { type: 'end', metric: 'infl', op: '<=', value: 3, label: 'Finish with inflation at 3% or lower' },
    { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' },
    { type: 'end', metric: 'unemp', op: '<=', value: 5, label: 'Finish with unemployment at 5% or lower' },
    { type: 'always', metric: 'stress', op: '<=', value: 45, label: 'Keep market fear at 45 or lower every quarter' },
    { type: 'streak', value: 5, label: 'Build a streak of 5 green quarters' } ];
  const [Y, M, Dd] = key.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { id: 'daily-' + key, daily: true, title: 'Daily Challenge', concept: 'Same economy for everyone today',
    era: Dd + ' ' + months[M - 1] + ' ' + Y, start: { year: Y, q: Math.floor((M - 1) / 3) + 1 }, quarters: 8, tools: ['rate', 'guidance', 'qe', 'spend', 'tax'],
    brief: 'A fresh economy, generated for today. Everyone playing gets the same starting point and the same shocks. Come back tomorrow for a new one.',
    goal: 'Score as high as you can.', twoStar: 75,
    state: { rate, infl, expInfl, gap, debt: Math.round(r(50, 120)), stress: Math.round(r(14, 38)), approval: Math.round(r(42, 60)), cred: Math.round(r(45, 80)) },
    events: evs, objective: objs[Math.floor(rng() * objs.length)] };
}

/* ---------- Level codes (player-made levels) ---------- */
const OBJ_METRICS = ['infl', 'unemp', 'growth', 'stress', 'approval', 'debt', 'bubble', 'bank', 'fx', 'reserves', 'expInfl', 'cred'];
const EDIT_STATE = { rate: [0, 20, 0.25], infl: [-3, 15, 0.1], expInfl: [-2, 12, 0.1], gap: [-8, 6, 0.1], unemp: [2, 15, 0.1], debt: [5, 200, 1], stress: [5, 80, 1], approval: [15, 85, 1], cred: [5, 95, 1], bubble: [0, 90, 1], bank: [15, 100, 1], fx: [60, 130, 1], reserves: [0, 60, 1] };
const EDIT_TARGETS = { unempMax: [3, 12, 0.5], growthMin: [-4, 2, 0.5], stressMax: [20, 80, 1], debtMax: [30, 200, 1], approvalMin: [10, 60, 1], bubbleMax: [30, 95, 1], bankMin: [10, 70, 1], fxMin: [50, 100, 1] };
const fmtN = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
function objectiveLabel(type, metric, op, value) {
  const M = METRICS[metric], words = { '<=': 'at or below', '>=': 'at or above', '<': 'below', '>': 'above' }[op];
  const v = fmtN(value, M.dec) + (M.unit === '%' ? '%' : '');
  return type === 'always' ? 'Keep ' + M.name.toLowerCase() + ' ' + words + ' ' + v + ' every quarter' : 'Finish with ' + M.name.toLowerCase() + ' ' + words + ' ' + v;
}
function sanitizeObjective(o) {
  if (!o || typeof o !== 'object') return { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' };
  if (o.type === 'noRecession') return { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' };
  if (o.type === 'streak') { const v = Math.round(clamp(+o.value || 4, 2, 16)); return { type: 'streak', value: v, label: 'Build a streak of ' + v + ' green quarters' }; }
  if (o.type === 'end' || o.type === 'always') {
    const metric = OBJ_METRICS.includes(o.metric) ? o.metric : 'infl';
    const op = ['<=', '>=', '<', '>'].includes(o.op) ? o.op : '<=';
    const value = Number.isFinite(+o.value) ? clamp(+o.value, -50, 300) : 3;
    return { type: o.type, metric, op, value, label: objectiveLabel(o.type, metric, op, value) };
  }
  return { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' };
}
function sanitizeLevel(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const str = (v, n, d = '') => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : d;
  const num = (v, a, b, d) => v !== null && v !== '' && Number.isFinite(+v) ? clamp(+v, a, b) : d;
  const L = { custom: true };
  L.title = str(raw.title, 60, 'Untitled economy') || 'Untitled economy';
  L.author = str(raw.author, 32, 'A player') || 'A player';
  L.concept = str(raw.concept, 80, 'Player-made level');
  L.era = str(raw.era, 20, 'Custom');
  L.start = { year: Math.round(num(raw.start && raw.start.year, 1, 3000, 1)), q: Math.round(num(raw.start && raw.start.q, 1, 4, 1)) };
  L.quarters = Math.round(num(raw.quarters, 4, 16, 8));
  L.tools = Array.isArray(raw.tools) ? TOOL_ORDER.filter(t => t !== 'trade' && raw.tools.includes(t)) : ['rate'];
  if (!L.tools.length) L.tools = ['rate'];
  L.pp = Math.round(num(raw.pp, 1, 3, 2));
  const F = raw.features || {};
  L.features = { bubble: !!F.bubble, banks: !!F.banks, fx: !!F.fx };
  const pr = raw.params || {};
  L.params = { rN: num(pr.rN, -1, 4, 0.5), target: num(pr.target, 0, 8, 2), uStar: num(pr.uStar, 2, 12, 4.5) };
  L.state = {};
  const st = raw.state || {};
  Object.keys(EDIT_STATE).forEach(k => { const v = num(st[k], EDIT_STATE[k][0], EDIT_STATE[k][1], null); if (v != null) L.state[k] = v; });
  const tg = raw.targets || {};
  L.targets = {};
  if (Array.isArray(tg.infl)) { const lo = num(tg.infl[0], -2, 10, 1), hi = num(tg.infl[1], -1, 12, 3); L.targets.infl = [Math.min(lo, hi), Math.max(lo, hi)]; }
  Object.keys(EDIT_TARGETS).forEach(k => { const v = num(tg[k], EDIT_TARGETS[k][0], EDIT_TARGETS[k][1], null); if (v != null) L.targets[k] = v; });
  L.events = (Array.isArray(raw.events) ? raw.events : []).filter(e => e && EVENTS[e.id] && e.id !== 'bubble_pop' && EVENTS[e.id].tag !== 'Briefing').slice(0, 24)
    .map(e => { const o = { q: Math.round(num(e.q, 1, L.quarters, 1)), id: e.id }; const hl = str(e.headline, 120); if (hl) o.headline = hl; return o; });
  L.random = num(raw.random, 0, 0.6, 0);
  L.objective = sanitizeObjective(raw.objective);
  L.twoStar = Math.round(num(raw.twoStar, 40, 95, 75));
  L.brief = str(raw.brief, 500, 'A player-made economy.');
  L.goal = str(raw.goal, 160, 'Keep every tank in its safe zone.');
  const ls = raw.lesson || {};
  L.lesson = { title: str(ls.title, 80, L.concept), points: (Array.isArray(ls.points) ? ls.points : []).map(p => str(p, 240)).filter(Boolean).slice(0, 4), history: str(ls.history, 400) };
  if (!L.lesson.points.length && !L.lesson.history) delete L.lesson;
  // The id is derived from the content, so the same level always has the same leaderboard
  const body = Object.assign({}, L); delete body.author;
  L.id = 'U_' + hashStr(JSON.stringify(body)).toString(36);
  return L;
}
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let c = s.replace(/[^A-Za-z0-9_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (c.length % 4) c += '=';
  const bin = atob(c);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}
function encodeLevel(L) {
  const clean = sanitizeLevel(L);
  delete clean.id; delete clean.custom;
  return 'AFL1.' + b64urlEncode(JSON.stringify(clean));
}
function decodeLevel(code) {
  try {
    let c = String(code).trim();
    const at = c.indexOf('AFL1.');
    if (at >= 0) c = c.slice(at + 5);
    if (c.length > 20000) return null;
    return sanitizeLevel(JSON.parse(b64urlDecode(c)));
  } catch (e) { return null; }
}

/* ---------- Level references (what a saved game or a score submission points at) ---------- */
function levelRefOf(level, kind) {
  if (kind === 'endless' || level.endless) return { kind: 'endless' };
  if (kind === 'daily' || level.daily) return { kind: 'daily', key: level.id.slice(6) };
  if (LEVELS.some(l => l.id === level.id)) return { kind: 'campaign', id: level.id };
  if (SAMPLE_COMMUNITY.some(l => l.id === level.id)) return { kind: 'sample', id: level.id };
  return { kind: 'custom', code: encodeLevel(level) };
}
function levelFromRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  if (ref.kind === 'endless') return ENDLESS;
  if (ref.kind === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(ref.key || '')) return makeDailyLevel(ref.key);
  if (ref.kind === 'campaign') return LEVELS.find(l => l.id === ref.id) || null;
  if (ref.kind === 'sample') return SAMPLE_COMMUNITY.find(l => l.id === ref.id) || null;
  if (ref.kind === 'custom' && typeof ref.code === 'string') return decodeLevel(ref.code);
  return null;
}
function boardIdOf(level) { return level.endless ? 'endless' : level.id; }

/* ---------- Score verification (run this on the server) ----------
   submission = { v: 1, level: ref, actions: [{ r, t }], choices: [{ q, id, c }], retired, claimed } */
function verifySubmission(sub, opts = {}) {
  if (!sub || sub.v !== 1) return { ok: false, error: 'Unsupported submission version' };
  const level = levelFromRef(sub.level);
  if (!level) return { ok: false, error: 'Unknown level' };
  if (level.daily && opts.today) {
    const key = sub.level.key, t = Date.parse(opts.today + 'T12:00:00Z'), d = Date.parse(key + 'T12:00:00Z');
    if (!(Math.abs(t - d) <= 864e5 * 1.01)) return { ok: false, error: 'This daily challenge is closed' };
  }
  if (!Array.isArray(sub.actions) || sub.actions.length > 420) return { ok: false, error: 'Bad action log' };
  if (!Array.isArray(sub.choices) || sub.choices.length > 420) return { ok: false, error: 'Bad choice log' };
  const { g, missingChoice } = replayGame(level, { actions: sub.actions, choices: sub.choices, retired: !!sub.retired });
  if (missingChoice) return { ok: false, error: 'A decision is missing from the log' };
  if (!level.endless && g.status !== 'complete') return { ok: false, error: g.status === 'failed' ? 'Failed runs are not ranked' : 'The run is not finished' };
  if (level.endless && g.status === 'playing') return { ok: false, error: 'The run is not finished' };
  const res = finalResult(g);
  const claimed = +sub.claimed || 0;
  return { ok: true, board: boardIdOf(level), pts: res.total, stars: res.starCount, quarters: res.quarters,
    matchesClaim: Math.abs(claimed - res.total) <= Math.max(5, res.total * 0.02) };
}
