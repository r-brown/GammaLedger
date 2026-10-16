/* ============================================================
   APP — core helpers, storage, backend, profile, sound, modals, nav.

   Global leaderboard: set CONFIG.apiBase to your score server
   (see the server/ folder), or define window.AFLOAT_BACKEND before
   this script with the same four async methods:
     submitScore(submission) -> { ok, pts, rank }   (server re-plays the log)
     topScores(board, limit) -> [{ name, pts, stars, at }]
     publishLevel(code, author) -> { ok }
     listLevels()            -> [{ code, title, author }]
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}
function S(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); }
  add(el, kids);
  return el;
}
function add(el, kids) {
  kids.flat(Infinity).forEach(c => { if (c == null || c === false) return; el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
}
const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (v, d = 1) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
const fmtInt = v => Math.round(v).toLocaleString('en-US');
function fmtMetric(m, v) { const M = METRICS[m]; return fmt(v, M.dec) + (M.unit === '%' ? '%' : ''); }
function dateKey(d = new Date()) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function quarterLabel(level, q) {
  const st = level.start || { year: 1, q: 1 };
  const idx = (st.q - 1) + (q - 1);
  const y = st.year + Math.floor(idx / 4), qq = (idx % 4) + 1;
  return y >= 1000 ? 'Q' + qq + ' ' + y : 'Year ' + y + ' · Q' + qq;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const isBook = level => !!(level && level.features && level.features.book);

/* ---------- Storage (this browser only; wrapped for private windows) ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('afloat1.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('afloat1.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem('afloat1.' + k); } catch (e) { /* storage unavailable */ } }
};
function defaultProfile() {
  return { name: '', xp: 0, stars: {}, best: {}, quiz: {}, ach: {}, cards: {}, beatBot: {}, independent: 0, completed: {},
    daily: { last: null, streak: 0, best: {} }, endlessBest: 0, endlessQ: 0, skin: 'classic', sound: false, assist: null, plays: 0, created: 0 };
}
let P = Object.assign(defaultProfile(), LS.get('profile', {}));
function saveProfile() { LS.set('profile', P); }

/* ---------- Saved game (resume after reload) ---------- */
function saveResume() {
  if (!Session || !Session.game || Session.game.status !== 'playing') return;
  const g = Session.game;
  LS.set('resume', { ref: levelRefOf(Session.level, Session.kind), kind: Session.kind, assist: Session.assist, assisted: g.assisted,
    actions: g.actions, choices: g.choices, title: Session.level.title, when: quarterLabel(Session.level, g.q), at: Date.now() });
}
function loadResume() {
  const r = LS.get('resume', null);
  if (!r || !r.ref) return null;
  const level = levelFromRef(r.ref);
  if (!level) return null;
  if (r.ref.kind === 'daily' && r.ref.key !== dateKey()) return null;
  return Object.assign({ level }, r);
}
function clearResume() { LS.del('resume'); }

/* ---------- Backend (optional) ---------- */
function httpBackend(base) {
  const j = async (path, init) => { const r = await fetch(base.replace(/\/$/, '') + path, init); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  const post = (path, body) => j(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return {
    submitScore: sub => post('/scores', sub),
    topScores: async (board, limit) => (await j('/scores?board=' + encodeURIComponent(board) + '&limit=' + (limit || 10))).scores,
    publishLevel: (code, author) => post('/levels', { code, author }),
    listLevels: async () => (await j('/levels')).levels
  };
}
const Backend = (typeof window !== 'undefined' && window.AFLOAT_BACKEND) || (CONFIG.apiBase ? httpBackend(CONFIG.apiBase) : null);

function localBoard(id) { return (LS.get('boards', {})[id] || []); }
function addLocalScore(id, entry) {
  const all = LS.get('boards', {});
  all[id] = (all[id] || []).concat([entry]).sort((a, b) => b.pts - a.pts).slice(0, 10);
  LS.set('boards', all);
}
async function submitScore(board, entry, submission) {
  addLocalScore(board, entry);
  if (!Backend || !Backend.submitScore) return null;
  try { return await Backend.submitScore(Object.assign({ name: entry.name }, submission)); } catch (e) { return { ok: false, error: 'offline' }; }
}
async function fetchBoard(board) {
  if (Backend && Backend.topScores) { try { const r = await Backend.topScores(board, 10); if (Array.isArray(r)) return { global: true, list: r }; } catch (e) { /* fall back to local */ } }
  return { global: false, list: localBoard(board) };
}

/* ---------- Ranks ---------- */
function rankIndex(xp) { let i = 0; RANKS.forEach((r, k) => { if (xp >= r.xp) i = k; }); return i; }
function rankProgress(xp) {
  const i = rankIndex(xp), cur = RANKS[i], next = RANKS[i + 1];
  return { i, cur, next, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}
function applySkin() {
  const sk = SKINS.find(s => s.id === P.skin) || SKINS[0];
  document.documentElement.style.setProperty('--liq-a', sk.a);
  document.documentElement.style.setProperty('--liq-b', sk.b);
}

/* ---------- Icons ---------- */
function logo(size = 34) {
  return S('svg', { width: size, height: size, viewBox: '0 0 40 40', role: 'img', 'aria-label': 'GammaLedger' },
    S('defs', null, S('linearGradient', { id: 'lgG', x1: '0', y1: '0', x2: '0.4', y2: '1' }, S('stop', { offset: '0', 'stop-color': '#7c3aed' }), S('stop', { offset: '1', 'stop-color': '#8ea2f0' }))),
    S('circle', { cx: 20, cy: 20, r: 17.5, fill: 'none', stroke: 'url(#lgG)', 'stroke-width': 2.6 }),
    S('path', { d: 'M13 12.5 C14.5 11.4 16 11 18 11 H28 V16.5 H26.6 C26.4 14.4 25.6 13.4 24 13.4 H21.4 V25 C21.4 28.6 19.6 31.3 16 32.6 C17.6 30.4 18 28.6 18 25.6 V13.4 C15.8 13.4 14.4 13.8 13 14.6 Z', fill: 'url(#lgG)' }));
}
function starIcon(on, size = 16) {
  return S('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    S('path', { d: 'M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3 6.2 20.4l1.2-6.5L2.6 9.4l6.5-.8z', fill: on ? '#fbbf24' : 'none', stroke: on ? '#fbbf24' : 'rgba(203,213,225,0.35)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
}
function starsRow(n, size) { return h('span', { class: 'stars', role: 'img', 'aria-label': n + ' of 3 stars' }, [0, 1, 2].map(i => starIcon(i < n, size))); }
function checkIcon(ok) {
  return S('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true' },
    S('circle', { cx: 10, cy: 10, r: 9, fill: ok ? 'rgba(94,234,212,0.18)' : 'none', stroke: ok ? '#5eead4' : 'rgba(203,213,225,0.35)', 'stroke-width': 1.5 }),
    ok ? S('path', { d: 'M6 10.4l2.6 2.6L14 7.4', fill: 'none', stroke: '#5eead4', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) : null);
}
function rankBadge(i, size = 30) {
  const tiers = ['#94a3b8', '#94a3b8', '#60a5fa', '#60a5fa', '#a78bfa', '#a78bfa', '#c4b5fd', '#fbbf24', '#fbbf24', '#f0abfc'];
  const c = tiers[i] || '#94a3b8';
  const bars = Math.min(5, Math.floor(i / 2) + 1);
  return S('svg', { class: 'badge', width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': 'true' },
    S('path', { d: 'M16 2l12 5v8c0 7.5-5 12.5-12 15C9 27.5 4 22.5 4 15V7z', fill: 'rgba(139,92,246,0.15)', stroke: c, 'stroke-width': 1.6 }),
    ...Array.from({ length: bars }, (_, k) => S('rect', { x: 9, y: 21 - k * 3.6, width: 14, height: 2.2, rx: 1.1, fill: c })));
}
function iconSound(on) {
  return S('svg', { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    S('path', { d: 'M4 9v6h4l5 4V5L8 9z' }), on ? S('path', { d: 'M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12' }) : S('path', { d: 'M17 9l5 6M22 9l-5 6' }));
}
function trophy(on) {
  return S('svg', { viewBox: '0 0 36 36', 'aria-hidden': 'true' },
    S('circle', { cx: 18, cy: 18, r: 17, fill: on ? 'rgba(251,191,36,0.14)' : 'rgba(203,213,225,0.05)', stroke: on ? '#fbbf24' : 'rgba(203,213,225,0.3)', 'stroke-width': 1.4 }),
    S('path', { d: 'M12 10h12v4a6 6 0 01-12 0zM15 24h6M18 20v4M12 12H9.5a2.5 2.5 0 002.8 4M24 12h2.5a2.5 2.5 0 01-2.8 4', fill: 'none', stroke: on ? '#fbbf24' : 'rgba(203,213,225,0.45)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
}

/* ---------- Sound (WebAudio blips, off by default) ---------- */
const Sound = {
  ctx: null,
  play(kind) {
    if (!P.sound) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const c = this.ctx, t0 = c.currentTime;
      const seq = { click: [[660, 0.04]], good: [[523, 0.08], [659, 0.08], [784, 0.14]], bad: [[220, 0.14], [174, 0.22]],
        alarm: [[740, 0.12], [520, 0.12], [740, 0.12]], star: [[988, 0.1], [1319, 0.18]], rank: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]] }[kind] || [];
      let t = t0;
      seq.forEach(([f, d]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = kind === 'bad' || kind === 'alarm' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9;
      });
    } catch (e) { /* audio unavailable */ }
  }
};

/* ---------- Confetti ---------- */
function confetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#fx'); if (!cv) return;
  const ctx = cv.getContext('2d'); const W = cv.width = innerWidth, H = cv.height = innerHeight;
  const cols = ['#8b5cf6', '#3b82f6', '#c4b5fd', '#fbbf24', '#5eead4'];
  const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 200, y: H * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4, s: 4 + Math.random() * 5, r: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
  let n = 0;
  (function frame() {
    ctx.clearRect(0, 0, W, H);
    ps.forEach(p => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++n < 130) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })();
}

/* ---------- Toasts & modals ---------- */
function toast(text, opts = {}) {
  const box = $('#toasts');
  const t = h('div', { class: 'toast' + (opts.ach ? ' ach-t' : ''), role: 'status' }, opts.icon || null, h('span', { text }));
  box.appendChild(t);
  setTimeout(() => t.remove(), opts.ms || 3200);
}
let modalStack = [];
function openModal(content, opts = {}) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || 'Dialog' }, content);
  back.appendChild(box);
  const prevFocus = document.activeElement;
  function close() {
    back.remove(); modalStack = modalStack.filter(m => m !== api);
    document.removeEventListener('keydown', onKey);
    if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* element gone */ }
    if (opts.onClose) opts.onClose();
  }
  function onKey(e) {
    if (modalStack[modalStack.length - 1] !== api) return;
    if (e.key === 'Escape' && opts.dismissible) close();
    if (e.key === 'Tab') {
      const f = box.querySelectorAll('button:not([disabled]), input, select, textarea, a[href]');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  if (opts.dismissible) back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  $('#modal-root').appendChild(back);
  const api = { close, box };
  modalStack.push(api);
  setTimeout(() => { const f = box.querySelector(opts.focus || 'button:not([disabled])'); if (f) f.focus(); }, 30);
  return api;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); return true; }
  catch (e) {
    const ta = h('textarea', { rows: 6, readonly: true, 'aria-label': 'Text to copy' }); ta.value = text;
    const m = openModal([h('h2', { text: 'Copy this' }), h('p', { class: 'muted small', text: 'Your browser blocked automatic copying. Select the text and copy it yourself.' }), ta,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-quiet', text: 'Done', onclick: () => m.close() }))], { dismissible: true, label: 'Copy text', focus: 'textarea' });
    setTimeout(() => ta.select(), 60);
    return false;
  }
}

/* ---------- Navigation ---------- */
let VIEW = 'home';
const NAV = [['home', 'Campaign'], ['daily', 'Daily'], ['endless', 'Endless'], ['community', 'Community'], ['editor', 'Level editor'], ['profile', 'Profile']];
function renderTopbar() {
  const rp = rankProgress(P.xp);
  $('#topbar').replaceChildren(h('div', { class: 'wrap' },
    h('button', { class: 'brand', onclick: () => go('home'), 'aria-label': 'Keep the Economy Afloat, home' }, logo(34),
      h('span', { class: 'brand-name' }, 'Keep the Economy Afloat', h('small', { text: 'GammaLedger · MONIAC' }))),
    h('nav', { class: 'nav', 'aria-label': 'Main' }, NAV.map(([id, label]) => h('button', { 'aria-current': VIEW === id ? 'page' : null, onclick: () => navTo(id), text: label }))),
    h('div', { class: 'top-right' },
      h('a', { class: 'site-link', href: 'https://gammaledger.com/', target: '_blank', rel: 'noopener', text: 'GammaLedger ↗' }),
      h('button', { class: 'rank-chip', onclick: () => go('profile'), 'aria-label': 'Rank ' + rp.cur.name + ', ' + fmtInt(P.xp) + ' XP' }, rankBadge(rp.i), h('span', { class: 'rtxt' }, h('b', { text: rp.cur.name }), h('span', { text: fmtInt(P.xp) + ' XP' }))),
      h('button', { class: 'icon-btn', 'aria-pressed': P.sound ? 'true' : 'false', 'aria-label': P.sound ? 'Sound on' : 'Sound off', onclick: () => { P.sound = !P.sound; saveProfile(); renderTopbar(); Sound.play('click'); } }, iconSound(P.sound)))));
}
function navTo(id) {
  if (id === 'daily') return openBriefing(makeDailyLevel(dateKey()), 'daily');
  if (id === 'endless') return openBriefing(ENDLESS, 'endless');
  go(id);
}
function go(view, arg) {
  if (VIEW === 'play' && view !== 'play' && Session && Session.game && Session.game.status === 'playing' && !(arg && arg.force)) {
    return confirmLeave(() => go(view, Object.assign({}, arg, { force: true })));
  }
  VIEW = view;
  const app = $('#app');
  app.replaceChildren();
  if (view === 'home') renderHome(app);
  else if (view === 'play') renderPlay(app);
  else if (view === 'debrief') renderDebrief(app, arg);
  else if (view === 'community') renderCommunity(app);
  else if (view === 'editor') renderEditor(app, arg);
  else if (view === 'profile') renderProfile(app, arg && arg.tab);
  else if (view === 'model') renderModel(app);
  renderTopbar();
  window.scrollTo(0, 0);
}
function confirmLeave(onLeave) {
  const m = openModal([h('h2', { text: 'Leave this level?' }), h('p', { class: 'muted', text: 'You can save your game and pick it up later, on this device.' }),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', text: 'Save and exit', onclick: () => { saveResume(); m.close(); Session = null; onLeave(); toast('Game saved. Resume it from the home screen.'); } }),
      h('button', { class: 'btn btn-quiet', text: 'Keep playing', onclick: () => m.close() }),
      h('button', { class: 'btn btn-danger', text: 'Abandon', onclick: () => { clearResume(); m.close(); Session = null; onLeave(); } }))], { dismissible: true, label: 'Leave level' });
}

/* Level lookup across campaign, samples and the player's own levels */
function allCustomLevels() { return LS.get('mylevels', []).concat(LS.get('imported', [])); }
function isUnlocked(i) { return i === 0 || (P.stars[LEVELS[i - 1].id] || 0) >= 1; }
function nextLevelIndex() { const i = LEVELS.findIndex((l, k) => isUnlocked(k) && !P.stars[l.id]); return i === -1 ? LEVELS.length - 1 : i; }
function totalStars() { return LEVELS.reduce((a, l) => a + (P.stars[l.id] || 0), 0); }
