import * as C from './afloat-core.mjs';
import { handleApi, memoryStore } from './api.mjs';
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

// Play a level like a client would, recording the log
function playClient(level, policy) {
  const g = C.createGame(level);
  while (g.status === 'playing') {
    const evs = C.beginQuarter(g);
    evs.forEach(ev => { if (ev.def.kind === 'dilemma') C.resolveDilemma(g, ev, 1); });
    C.step(g, policy(g));
    if (g.endless && g.q > 12) { g.retired = true; g.status = 'complete'; }
  }
  return g;
}
const taylor = g => ({ rateDelta: C.taylorMove(g, 0.75), tools: {} });

// 1. Replay reproduces the exact same score
for (const L of C.LEVELS) {
  const g = playClient(L, L.features && L.features.book ? () => ({ tools: { trade: 'put' } }) : taylor);
  const r = C.replayGame(L, { actions: g.actions, choices: g.choices });
  assert(C.finalResult(r.g).total === C.finalResult(g).total && r.g.status === g.status, 'replay matches for ' + L.id + ' (' + C.finalResult(g).total + ')');
}
// 2. Verification
const L1 = C.LEVELS[0];
const g = playClient(L1, taylor);
const res = C.finalResult(g);
const sub = { v: 1, level: C.levelRefOf(L1, 'campaign'), actions: g.actions, choices: g.choices, retired: false, claimed: res.total };
let v = C.verifySubmission(sub);
assert(v.ok && v.pts === res.total && v.matchesClaim, 'honest submission verified: ' + v.pts);
v = C.verifySubmission(Object.assign({}, sub, { claimed: res.total + 500 }));
assert(v.ok && !v.matchesClaim && v.pts === res.total, 'inflated claim ignored; server keeps its own score');
v = C.verifySubmission(Object.assign({}, sub, { actions: sub.actions.slice(0, 3) }));
assert(!v.ok, 'unfinished run rejected: ' + v.error);
const cheat = JSON.parse(JSON.stringify(sub)); cheat.actions[0].t = { qe: 'buy', spend: 'up', tax: 'down', liquidity: 'open' };
v = C.verifySubmission(cheat);
assert(v.ok, 'tools not allowed in the level are stripped, not trusted');
const L15 = C.LEVELS.find(l => l.id === 'L15'); const g15 = playClient(L15, taylor);
v = C.verifySubmission({ v: 1, level: { kind: 'campaign', id: 'L15' }, actions: g15.actions, choices: [], claimed: 1 });
assert(!v.ok && /decision/.test(v.error), 'missing dilemma choice rejected');
// 3. Daily window
const key = '2026-10-16'; const D = C.makeDailyLevel(key); const gd = playClient(D, taylor);
const dsub = { v: 1, level: { kind: 'daily', key }, actions: gd.actions, choices: gd.choices, claimed: C.finalResult(gd).total };
assert(C.verifySubmission(dsub, { today: '2026-10-16' }).ok, 'daily accepted on the day');
assert(!C.verifySubmission(dsub, { today: '2026-10-20' }).ok, 'daily rejected days later');
// 4. Custom level by code, endless retire
const sample = { title: 'Test economy', tools: ['rate', 'spend'], quarters: 6, state: { infl: 4 }, events: [{ q: 2, id: 'oil_spike' }] };
const code = C.encodeLevel(sample); const CL = C.decodeLevel(code); const gc = playClient(CL, taylor);
assert(C.verifySubmission({ v: 1, level: { kind: 'custom', code }, actions: gc.actions, choices: gc.choices, claimed: 0 }).ok, 'custom level verified via code, id ' + CL.id);
const E = C.levelFromRef({ kind: 'endless' }); const ge = playClient(E, taylor);
v = C.verifySubmission({ v: 1, level: { kind: 'endless' }, actions: ge.actions, choices: ge.choices, retired: true, claimed: ge.points });
assert(v.ok && v.board === 'endless' && v.quarters === 12, 'endless retire verified: ' + v.quarters + ' quarters, ' + v.pts);
// 5. HTTP API
const store = memoryStore();
const call = (method, path, body, qs = '') => handleApi({ method, path, query: new URLSearchParams(qs), rawBody: body ? JSON.stringify(body) : undefined }, store, { now: Date.parse('2026-10-16T10:00:00Z') });
let r = await call('POST', '/scores', Object.assign({ name: 'Alex<script>' }, sub));
assert(r.status === 200 && JSON.parse(r.body).rank === 1, 'POST /scores stores a verified score');
r = await call('GET', '/scores', null, 'board=L1&limit=5');
const top = JSON.parse(r.body).scores; assert(top.length === 1 && top[0].name === 'Alexscript', 'GET /scores returns it, name cleaned: ' + top[0].name);
r = await call('POST', '/scores', Object.assign({}, sub, { actions: [] }));
assert(r.status === 400, 'bad run gets 400');
r = await call('POST', '/levels', { code, author: 'Alex' });
assert(r.status === 200, 'POST /levels publishes');
r = await call('GET', '/levels');
assert(JSON.parse(r.body).levels[0].title === 'Test economy', 'GET /levels lists it');
