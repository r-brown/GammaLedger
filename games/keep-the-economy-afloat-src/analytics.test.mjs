// Unit tests for analytics.js. Run with: node --test analytics.test.mjs   (Node 18 or newer)
// analytics.js is a plain script inlined into the game page, so it is evaluated in a fresh vm context with fake browser globals.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('./analytics.js', import.meta.url), 'utf8');
const ENDPOINT = 'https://q4cffnmf57m2pybahil3ha7lca0docmr.lambda-url.eu-west-1.on.aws/';

let uuidN = 0; // shared across load() calls so two fake tabs get different ids
function load(opts = {}) {
  const calls = [], logs = [], tables = [], store = new Map();
  const sessionStorage = opts.noStorage
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const ctx = {
    fetch: opts.noFetch ? undefined : (url, init) => { calls.push({ url, init }); return opts.fetch ? opts.fetch(url, init) : Promise.resolve({ status: 202 }); },
    sessionStorage,
    navigator: { doNotTrack: opts.dnt || null },
    location: { search: opts.search || '' },
    crypto: { randomUUID: () => 'aaaaaaaa-0000-4000-8000-' + String(++uuidN).padStart(12, '0') },
    console: { log: (...a) => logs.push(a), table: t => tables.push(t) },
    URLSearchParams, Promise, Number, Object, JSON, Array, Date, Math
  };
  vm.createContext(ctx);
  const api = vm.runInContext(SRC + '\n;({ track, ANALYTICS_CONFIG })', ctx);
  return { ...api, calls, logs, tables, store };
}
const body = call => JSON.parse(call.init.body);

test('POSTs the documented body with the documented fetch options', () => {
  const t = load();
  t.track('game.round.completed', { round: 3, score: 1250.5 });
  assert.equal(t.calls.length, 1);
  const { url, init } = t.calls[0];
  assert.equal(url, ENDPOINT);
  assert.equal(init.method, 'POST');
  assert.equal(init.keepalive, true);
  assert.deepEqual({ ...init.headers }, { 'Content-Type': 'application/json' });
  const b = body(t.calls[0]);
  assert.equal(b.tenantId, 'gammaledger');
  assert.equal(b.eventType, 'game.round.completed');
  assert.match(b.correlationId, /^[A-Za-z0-9._:-]{8,64}$/);
  assert.deepEqual({ ...b.extra }, { round: 3, score: 1250.5, game: 'keep-the-economy-afloat', gameVersion: '1.0' });
  assert.equal(typeof b.extra.round, 'number');
  assert.equal(typeof b.extra.score, 'number');
});

test('game and gameVersion cannot be overridden by the caller, and unknown value types are dropped', () => {
  const t = load();
  t.track('game.action', { game: 'other', gameVersion: '9', action: 'cut_taxes', list: [1], nothing: null, bad: NaN, obj: { a: 1 } });
  const e = body(t.calls[0]).extra;
  assert.equal(e.game, 'keep-the-economy-afloat');
  assert.equal(e.gameVersion, '1.0');
  assert.equal(e.action, 'cut_taxes');
  assert.deepEqual(Object.keys(e).sort(), ['action', 'game', 'gameVersion']);
});

test('the session id is random, stored under gl.sid and the same for every event', () => {
  const t = load();
  t.track('game.started');
  t.track('game.started');
  const ids = t.calls.map(c => body(c).correlationId);
  assert.equal(ids[0], ids[1]);
  assert.equal(t.store.get('gl.sid'), ids[0]);
  const other = load();
  other.track('game.started');
  assert.notEqual(body(other.calls[0]).correlationId, ids[0]);
});

test('an existing valid gl.sid is reused; an invalid one is replaced', () => {
  const t = load();
  t.store.set('gl.sid', 'abcdef12-session');
  t.track('game.started');
  assert.equal(body(t.calls[0]).correlationId, 'abcdef12-session');
  t.store.set('gl.sid', 'bad id!');
  t.track('game.started');
  assert.match(body(t.calls[1]).correlationId, /^[A-Za-z0-9._:-]{8,64}$/);
});

test('falls back to one in-memory id when sessionStorage is blocked', () => {
  const t = load({ noStorage: true });
  t.track('game.started');
  t.track('game.started');
  assert.equal(t.calls.length, 2);
  assert.equal(body(t.calls[0]).correlationId, body(t.calls[1]).correlationId);
});

test('stops after 300 events', () => {
  const t = load();
  for (let i = 0; i < 350; i++) t.track('game.action', { round: 1, action: 'cut_taxes' });
  assert.equal(t.calls.length, 300);
});

test('invalid event types are not sent', () => {
  const t = load();
  ['', '1abc', 'has space', 'x'.repeat(101), null, undefined, 42].forEach(v => t.track(v));
  assert.equal(t.calls.length, 0);
  t.track('a'.repeat(100));
  assert.equal(t.calls.length, 1);
});

test('oversized bodies are not sent', () => {
  const t = load();
  t.track('game.action', { action: 'x'.repeat(5000) });
  assert.equal(t.calls.length, 0);
});

test('swallows a synchronous fetch error, a rejected promise and a missing fetch', async () => {
  const throws = load({ fetch: () => { throw new Error('boom'); } });
  assert.doesNotThrow(() => throws.track('game.started'));
  const rejects = load({ fetch: () => Promise.reject(new Error('CORS')) });
  assert.doesNotThrow(() => rejects.track('game.started'));
  const none = load({ noFetch: true });
  assert.doesNotThrow(() => none.track('game.started'));
  let unhandled = false;
  const onUnhandled = () => { unhandled = true; };
  process.once('unhandledRejection', onUnhandled);
  await new Promise(r => setTimeout(r, 20));
  process.off('unhandledRejection', onUnhandled);
  assert.equal(unhandled, false);
});

test('does not throw on odd arguments', () => {
  const t = load();
  assert.doesNotThrow(() => t.track('game.action', 'text'));
  assert.doesNotThrow(() => t.track('game.action', null));
  assert.doesNotThrow(() => t.track('game.action', { get boom() { throw new Error('getter'); } }));
});

test('does nothing when Do Not Track is on', () => {
  const t = load({ dnt: '1' });
  t.track('game.started');
  assert.equal(t.calls.length, 0);
  assert.equal(t.store.has('gl.sid'), false);
});

test('?audit-debug=1 prints the event and sends nothing', () => {
  const t = load({ search: '?audit-debug=1' });
  t.track('game.round.completed', { round: 2, score: 90 });
  assert.equal(t.calls.length, 0);
  assert.equal(t.tables.length, 1);
  assert.equal(t.tables[0][0].eventType, 'game.round.completed');
  assert.equal(t.tables[0][0].round, 2);
  assert.equal(t.tables[0][0].game, 'keep-the-economy-afloat');
});

test('ANALYTICS_CONFIG.debug prints instead of sending; other query values do not', () => {
  const t = load();
  t.ANALYTICS_CONFIG.debug = true;
  t.track('game.started');
  assert.equal(t.calls.length, 0);
  assert.equal(t.tables.length, 1);
  const off = load({ search: '?audit-debug=0' });
  off.track('game.started');
  assert.equal(off.calls.length, 1);
});
