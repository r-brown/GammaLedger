/* ============================================================
   ANALYTICS: anonymous gameplay statistics.
   The rest of the game only calls track(eventType, extra). Nothing here can
   throw into the game, wait on the network or touch the page.
   Sent: event name, a random per-tab session id, and the small `extra`
   object the caller passes (game, gameVersion, round, score, action, ...).
   Never sent: names, free text, IP, user agent, cookies, tokens.
   Debug: open the game with ?audit-debug=1 (or set ANALYTICS_CONFIG.debug)
   and every event is printed with console.table instead of being sent.
   ============================================================ */

const ANALYTICS_CONFIG = {
  endpoint: 'https://relay.dev.labs64.io/',
  tenantId: 'gammaledger',
  game: 'keep-the-economy-afloat',
  gameVersion: '1.0', // bump when gameplay changes, so sessions can be compared by version
  sessionKey: 'gl.sid',
  maxEvents: 300, // safety cap per page load
  maxBytes: 4096, // the server rejects larger bodies
  debug: false // DEBUG_ANALYTICS: same as ?audit-debug=1
};
const ANALYTICS_STATE = { sent: 0, memorySid: null };

function analyticsNewId() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (crypto && typeof crypto.getRandomValues === 'function') {
      return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => (b < 16 ? '0' : '') + b.toString(16)).join('');
    }
  } catch (e) { /* fall through */ }
  return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* The same random id for every event of one browser session (tab). If sessionStorage is blocked, one id per page load. */
function analyticsSessionId() {
  const key = ANALYTICS_CONFIG.sessionKey;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored && /^[A-Za-z0-9._:-]{8,64}$/.test(stored)) return stored;
  } catch (e) { /* storage blocked */ }
  if (!ANALYTICS_STATE.memorySid) ANALYTICS_STATE.memorySid = analyticsNewId();
  try { sessionStorage.setItem(key, ANALYTICS_STATE.memorySid); } catch (e) { /* storage blocked */ }
  return ANALYTICS_STATE.memorySid;
}

function analyticsDebugOn() {
  if (ANALYTICS_CONFIG.debug) return true;
  try { return new URLSearchParams(location.search).get('audit-debug') === '1'; } catch (e) { return false; }
}

function track(eventType, extra) {
  try {
    const C = ANALYTICS_CONFIG, debug = analyticsDebugOn();
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
      if (debug) console.log('[analytics] Do Not Track is on: nothing is recorded');
      return;
    }
    if (typeof eventType !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]{0,99}$/.test(eventType)) return;
    if (ANALYTICS_STATE.sent >= C.maxEvents) return;

    const data = {};
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(k => {
        const v = extra[k];
        if (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' || typeof v === 'boolean') data[k] = v;
      });
    }
    data.game = C.game;
    data.gameVersion = C.gameVersion;
    const body = { tenantId: C.tenantId, eventType, correlationId: analyticsSessionId(), extra: data };
    const json = JSON.stringify(body);
    if (json.length > C.maxBytes) return;

    ANALYTICS_STATE.sent++;
    if (debug) { console.table([Object.assign({ eventType, correlationId: body.correlationId }, data)]); return; }
    if (typeof fetch !== 'function') return;
    const p = fetch(C.endpoint, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: json });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* analytics must never reach the game */ }
}
