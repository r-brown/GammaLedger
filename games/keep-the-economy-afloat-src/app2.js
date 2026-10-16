/* ============================================================
   HOME, BRIEFING, PLAY
   ============================================================ */

function heroMachine() {
  const tanks = [ { x: 40, lvl: 0.62, name: 'INCOME' }, { x: 170, lvl: 0.4, name: 'SPENDING' }, { x: 300, lvl: 0.74, name: 'SAVINGS' }, { x: 430, lvl: 0.3, name: 'TAXES' } ];
  const W = 540, H = 330;
  const defs = S('defs', null,
    S('linearGradient', { id: 'hmLiq', x1: 0, y1: 0, x2: 0, y2: 1 }, S('stop', { offset: 0, style: 'stop-color: var(--liq-a)' }), S('stop', { offset: 1, style: 'stop-color: var(--liq-b)' })),
    S('radialGradient', { id: 'hmGlow', cx: 0.5, cy: 0.55, r: 0.55 }, S('stop', { offset: 0, 'stop-color': '#8b5cf6', 'stop-opacity': 0.28 }), S('stop', { offset: 1, 'stop-color': '#8b5cf6', 'stop-opacity': 0 })),
    ...tanks.map((t, i) => S('clipPath', { id: 'hmc' + i }, S('rect', { x: t.x, y: 60, width: 70, height: 190, rx: 14 }))));
  const pipes = S('g', null,
    S('path', { d: 'M75 250 V284 H465 V250 M205 250 V284 M335 250 V284', fill: 'none', stroke: 'rgba(203,213,225,0.16)', 'stroke-width': 10, 'stroke-linejoin': 'round' }),
    S('path', { class: 'flow', d: 'M75 250 V284 H465 V250 M205 250 V284 M335 250 V284', fill: 'none', stroke: '#a78bfa', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    S('path', { d: 'M75 60 V30 H465 V60', fill: 'none', stroke: 'rgba(203,213,225,0.16)', 'stroke-width': 10 }),
    S('path', { class: 'flow', d: 'M465 60 V30 H75 V60', fill: 'none', stroke: '#60a5fa', 'stroke-width': 4, 'stroke-linecap': 'round' }));
  const tg = tanks.map((t, i) => {
    const y = 60 + (1 - t.lvl) * 190;
    return S('g', null,
      S('rect', { x: t.x, y: 60, width: 70, height: 190, rx: 14, fill: 'rgba(248,250,252,0.03)' }),
      S('g', { 'clip-path': 'url(#hmc' + i + ')' },
        S('g', { transform: 'translate(0 ' + y + ')' },
          S('path', { class: 'wave', style: 'animation-duration:' + (2.6 + i * 0.5) + 's', d: 'M' + (t.x - 60) + ' 0 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V300 H' + (t.x - 60) + ' Z', fill: 'url(#hmLiq)', opacity: 0.95 }))),
      S('rect', { x: t.x, y: 60, width: 70, height: 190, rx: 14, fill: 'none', stroke: 'rgba(203,213,225,0.45)', 'stroke-width': 2 }),
      S('rect', { x: t.x + 10, y: 70, width: 6, height: 150, rx: 3, fill: 'rgba(255,255,255,0.08)' }),
      S('text', { x: t.x + 35, y: 316, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11, 'letter-spacing': 1.5, fill: '#929ab8' }, t.name));
  });
  return S('svg', { class: 'hero-machine', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Four glass tanks of glowing liquid joined by pipes, like the MONIAC water computer' },
    defs, S('ellipse', { cx: 270, cy: 170, rx: 270, ry: 160, fill: 'url(#hmGlow)' }), pipes, ...tg);
}

function renderHome(app) {
  const ni = nextLevelIndex(), nl = LEVELS[ni];
  const started = Object.keys(P.stars).length > 0;
  const rp = rankProgress(P.xp);
  const today = dateKey();
  const dailyBest = P.daily.best[today];
  const streakAlive = P.daily.last === today || P.daily.last === dateKey(new Date(Date.now() - 864e5));
  const achCount = Object.keys(P.ach).length, cardCount = Object.keys(P.cards).length;
  const resume = loadResume();

  const hero = h('section', { class: 'hero' },
    h('div', null,
      h('div', { class: 'eyebrow', text: 'A macroeconomics game · inspired by the 1949 MONIAC' }),
      h('h1', null, 'Keep the economy ', h('em', { text: 'afloat.' })),
      h('p', { class: 'lede', text: 'In 1949 an economist built a computer out of water tanks and pipes to show how money flows. Now you run it. Set interest rates, tax and spend, calm panics and stand up to politicians. Then take what you learned to the trading desk.' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary btn-lg', onclick: () => openBriefing(nl, 'campaign') }, started ? 'Continue: ' + nl.title : 'Start the campaign'),
        h('button', { class: 'btn btn-ghost btn-lg', onclick: () => navTo('daily') }, 'Today’s challenge')),
      h('p', { class: 'tiny dim', style: 'margin-top:14px' }, LEVELS.length + ' levels · ' + CHAPTERS.length + ' chapters · real history from 1973 to 2023 · ', h('a', { href: '#model', onclick: e => { e.preventDefault(); go('model'); } }, 'how the model works'))),
    h('div', null, heroMachine()));

  const resumeBar = resume ? h('div', { class: 'resume', role: 'region', 'aria-label': 'Unfinished game' },
    h('div', null, h('div', { class: 'eyebrow', text: 'Unfinished game' }), h('b', { text: resume.title + ' · ' + resume.when })),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', text: 'Resume', onclick: () => resumeGame(resume) }),
      h('button', { class: 'btn btn-quiet', text: 'Discard', onclick: () => { clearResume(); go('home'); } }))) : null;

  const career = h('div', { class: 'card' },
    h('div', { class: 'row', style: 'gap:10px' }, rankBadge(rp.i, 40), h('div', null, h('div', { class: 'eyebrow', text: 'Your rank' }), h('h3', { text: rp.cur.name }))),
    h('div', { class: 'xpbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(rp.pct * 100), 'aria-label': 'Progress to next rank' }, h('span', { style: 'width:' + Math.round(rp.pct * 100) + '%' })),
    h('p', { class: 'tiny dim', text: rp.next ? fmtInt(rp.next.xp - P.xp) + ' XP to ' + rp.next.name : 'Top rank reached' }),
    h('div', { class: 'statline' },
      h('div', null, h('b', { text: totalStars() + '/' + LEVELS.length * 3 }), h('span', { text: 'Stars' })),
      h('div', null, h('b', { text: achCount + '/' + ACHIEVEMENTS.length }), h('span', { text: 'Achievements' })),
      h('div', null, h('b', { text: cardCount + '/' + LEVELS.length }), h('span', { text: 'Concept cards' }))),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn btn-quiet', text: 'View profile', onclick: () => go('profile') }));

  const daily = h('div', { class: 'card feature' },
    h('div', { class: 'eyebrow', text: 'Daily challenge · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }),
    h('h3', { text: 'One economy. Everyone plays it today.' }),
    h('p', { class: 'small muted', text: 'Same starting point and the same shocks for every player. Compare scores, keep your streak alive.' }),
    h('div', { class: 'statline' },
      h('div', null, h('b', { class: 'flame', text: (streakAlive ? P.daily.streak : 0) + ' day' + ((streakAlive ? P.daily.streak : 0) === 1 ? '' : 's') }), h('span', { text: 'Streak' })),
      h('div', null, h('b', { text: dailyBest ? fmtInt(dailyBest) : '—' }), h('span', { text: 'Your best today' }))),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn btn-primary', text: dailyBest ? 'Play again' : 'Play today’s economy', onclick: () => navTo('daily') }));

  const endless = h('div', { class: 'card' },
    h('div', { class: 'eyebrow', text: 'Endless mode' }),
    h('h3', { text: 'How long can you stay afloat?' }),
    h('p', { class: 'small muted', text: 'Random shocks, faster and harder every year. Retire whenever you like to bank your score.' }),
    h('div', { class: 'statline' },
      h('div', null, h('b', { text: P.endlessQ || '—' }), h('span', { text: 'Best quarters' })),
      h('div', null, h('b', { text: P.endlessBest ? fmtInt(P.endlessBest) : '—' }), h('span', { text: 'Best score' }))),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn btn-quiet', text: 'Start endless run', onclick: () => navTo('endless') }));

  const map = h('section', { class: 'section', 'aria-labelledby': 'mapH' },
    h('div', { class: 'section-head' }, h('h2', { id: 'mapH', text: 'Campaign' }), h('span', { class: 'chip violet' }, starIcon(true, 14), totalStars() + ' of ' + LEVELS.length * 3 + ' stars')),
    CHAPTERS.map(ch => h('div', { class: 'chapter' + (ch.id === 7 ? ' ch-markets' : '') },
      h('div', { class: 'chapter-name' }, h('div', { class: 'eyebrow', text: 'Chapter ' + ch.id + (ch.id === 7 ? ' · with GammaLedger' : '') }), h('h3', { text: ch.name }), h('p', { text: ch.blurb })),
      h('div', { class: 'track' }, LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch.id).map(({ l, i }) => {
        const un = isUnlocked(i), st = P.stars[l.id] || 0;
        return h('button', { class: 'node' + (i === ni && un ? ' next' : ''), disabled: !un, onclick: () => openBriefing(l, 'campaign'), 'aria-label': 'Level ' + (i + 1) + ': ' + l.title + (un ? ', ' + st + ' stars' : ', locked') },
          h('span', { class: 'lvl' }, h('span', { text: 'Level ' + (i + 1) + ' · ' + l.era }), un ? starsRow(st, 14) : h('span', { text: 'Locked' })),
          h('b', { text: l.title }), h('span', { class: 'concept', text: l.concept }),
          P.best[l.id] ? h('span', { class: 'tiny dim num', text: 'Best ' + fmtInt(P.best[l.id]) }) : null);
      })))));

  app.append(h('div', { class: 'wrap' }, hero, resumeBar, h('section', { class: 'dash', 'aria-label': 'Your progress' }, career, daily, endless), map), footer());
}
function footer() {
  return h('footer', { class: 'foot' }, h('div', { class: 'wrap row', style: 'justify-content:space-between' },
    h('p', { style: 'max-width:70ch' }, 'Bill Phillips built the first MONIAC (Monetary National Income Analogue Computer) in 1949. At least twelve were made; a working one is kept at the University of Cambridge. ',
      h('a', { href: '#model', onclick: e => { e.preventDefault(); go('model'); } }, 'How this game’s model works')),
    h('a', { class: 'btn btn-ghost', href: CONFIG.shareUrl, target: '_blank', rel: 'noopener' }, 'Track real options with GammaLedger')));
}

/* ---------- Briefing ---------- */
function benchmarks(level) {
  try { return { taylor: runBot(level, 'taylor').result, hold: runBot(level, 'hold').result }; } catch (e) { return null; }
}
function benchNames(level) { return isBook(level) ? ['Buy and hold the index', 'Cash only'] : ['GammaLedger autopilot', 'Doing nothing']; }
function objectiveLines(level) {
  const q = level.endless ? 'Survive as long as you can' : 'Complete all ' + level.quarters + ' quarters';
  return [q, 'Average quarter score of ' + (level.twoStar || 80) + ' or more', (level.objective && level.objective.label) || 'Bonus objective'];
}
function openBriefing(level, kind) {
  const idx = LEVELS.indexOf(level);
  const bench = level.endless ? null : benchmarks(level);
  const [bn1, bn2] = benchNames(level);
  const defaultAssist = P.assist == null ? (kind === 'campaign' && idx >= 0 && idx < 4) || kind === 'custom' : P.assist;
  const assistBox = h('input', { type: 'checkbox', id: 'assistToggle', checked: defaultAssist });
  const toolChips = (level.tools || []).map(t => h('span', { class: 'chip', text: TOOLS[t].name }));
  if (!(level.tools || []).includes('rate')) toolChips.unshift(h('span', { class: 'chip warn', text: 'Rates set by the central bank' }));
  const m = openModal([
    h('div', { class: 'news-tag' }, h('span', { class: 'eyebrow', text: (kind === 'campaign' ? 'Level ' + (idx + 1) : kind === 'daily' ? 'Daily challenge' : kind === 'endless' ? 'Endless' : 'Community level') + ' · ' + level.era })),
    h('h2', { text: level.title }),
    h('div', { class: 'row', style: 'gap:6px' }, h('span', { class: 'chip violet', text: level.concept }), level.author ? h('span', { class: 'chip', text: 'by ' + level.author }) : null),
    h('p', { class: 'muted', text: level.brief }),
    h('p', null, h('b', { text: 'Goal: ' }), level.goal),
    h('ul', { class: 'objlist', 'aria-label': 'Stars' }, objectiveLines(level).map(t => h('li', null, starIcon(false, 20), h('span', { text: t })))),
    h('div', { class: 'row', style: 'gap:6px' }, toolChips),
    bench ? h('p', { class: 'small dim' }, 'To beat: ' + bn1 + ' scores ', h('b', { class: 'num', style: 'color:var(--fg)', text: fmtInt(bench.taylor.total) }), ' (' + bench.taylor.starCount + '★). ' + bn2 + ' scores ' + fmtInt(bench.hold.total) + '.') : null,
    h('label', { class: 'switch', for: 'assistToggle' }, assistBox, h('span', null, 'GammaLedger Desk: next-quarter forecasts' + (isBook(level) ? ' and live option quotes' : ' and a suggested rate') + '. ', h('span', { class: 'dim', text: 'Play without it for +15% points.' }))),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary btn-lg', text: 'Start', onclick: () => { P.assist = assistBox.checked; saveProfile(); m.close(); startLevel(level, kind, assistBox.checked, bench); } }),
      h('button', { class: 'btn btn-quiet', text: 'Not now', onclick: () => m.close() }))
  ], { dismissible: true, label: level.title + ' briefing' });
}

/* ---------- Play ---------- */
let Session = null;
function startLevel(level, kind, assist, bench) {
  clearResume();
  Session = { level, kind, assist, bench: bench === undefined ? (level.endless ? null : benchmarks(level)) : bench, game: createGame(level), pending: { rateDelta: 0, tools: {} }, log: [], tip: null, report: null, busy: false };
  P.plays++; saveProfile();
  go('play', { force: true });
  setTimeout(beginQ, 250);
}
function resumeGame(r) {
  const { g, open } = replayGame(r.level, { actions: r.actions, choices: r.choices });
  if (g.status !== 'playing') { clearResume(); toast('That game had already finished.'); return go('home'); }
  g.assisted = !!r.assisted;
  Session = { level: r.level, kind: r.kind, assist: r.assist, bench: r.level.endless ? null : benchmarks(r.level), game: g, pending: { rateDelta: 0, tools: {} },
    log: [{ q: quarterLabel(r.level, g.q), text: 'Game resumed.' }], tip: null, report: null, busy: false };
  go('play', { force: true });
  Session.tip = (r.level.tutorial && r.level.tutorial[g.q]) || null;
  setTimeout(() => showEvents(open.slice(), () => { updateAll(); saveResume(); }), 250);
}
function ppUsed() { return Object.keys(Session.pending.tools).reduce((a, t) => a + (TOOLS[t].cost || 0), 0); }

function renderPlay(app) {
  if (!Session) return go('home');
  const L = Session.level, g = Session.game;
  const ui = Session.ui = {};
  ui.when = h('span', { class: 'when' });
  ui.qprog = h('div', { class: 'qprog', 'aria-hidden': 'true' });
  ui.points = h('b'); ui.streak = h('b'); ui.avg = h('b');
  const bar = h('div', { class: 'levelbar' },
    h('button', { class: 'btn btn-quiet', onclick: () => go(Session.kind === 'custom' ? 'community' : 'home'), 'aria-label': 'Exit level' }, '← Exit'),
    h('div', null, h('h1', { text: L.title }), h('div', { class: 'row', style: 'gap:10px' }, ui.when, ui.qprog)),
    h('div', { class: 'grow' }),
    g.endless ? h('button', { class: 'btn btn-ghost', text: 'Retire and bank score', onclick: () => { if (g.q > 1 && g.status === 'playing') { g.retired = true; g.status = 'complete'; finishLevel(); } } }) : null,
    h('div', { class: 'scorebox' }, h('div', null, ui.points, h('span', { text: 'Points' })), h('div', null, ui.streak, h('span', { text: 'Streak' })), h('div', null, ui.avg, h('span', { text: 'Avg score' }))));

  ui.gauges = h('div', { class: 'gauges' });
  ui.tanks = h('div', { class: 'tanks' });
  ui.tankRefs = {};
  g.metrics.forEach(m => { const t = createTank(m); ui.tankRefs[m] = t; ui.tanks.appendChild(t.el); });
  ui.chart = h('div');
  ui.log = h('ul', { class: 'log', 'aria-live': 'polite' });
  ui.ticker = h('div', { class: 'ticker-inner' });
  ui.fcLegend = h('span', { class: 'fc-legend', text: 'Dashed marker: GammaLedger forecast for next quarter' });
  const legend = isBook(L)
    ? h('span', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--violet-3)' }), 'Your book'), h('span', null, h('i', { style: 'background:var(--blue-2)' }), 'Index'), h('span', null, h('i', { style: 'background:var(--good)' }), 'Cash'))
    : h('span', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--violet-3)' }), 'Inflation'), h('span', null, h('i', { style: 'background:var(--blue-2)' }), 'Unemployment'), h('span', null, h('i', { style: 'background:var(--good)' }), 'Policy rate'));
  ui.machine = h('section', { class: 'machine', 'aria-label': 'The economy' },
    h('div', { class: 'machine-head' }, h('span', { class: 'plate', text: 'MONIAC Mk II · GammaLedger edition · ' + (L.era || '') }), ui.gauges),
    ui.tanks, h('div', { class: 'fc-row' }, ui.fcLegend),
    h('div', { class: 'machine-foot' },
      h('div', { class: 'chartbox' }, h('h3', null, h('span', { text: 'Track record' }), legend), ui.chart),
      h('div', { class: 'logbox' }, h('h3', { text: 'Logbook' }), ui.log)),
    h('div', { class: 'ticker', 'aria-hidden': 'true' }, ui.ticker));

  ui.coach = h('div'); ui.report = h('div'); ui.capital = h('div'); ui.rate = h('div'); ui.tools = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }); ui.locked = h('div');
  ui.assist = h('input', { type: 'checkbox', id: 'assistPlay', checked: Session.assist, onchange: e => { Session.assist = e.target.checked; P.assist = Session.assist; saveProfile(); updateAll(); } });
  ui.run = h('button', { class: 'btn btn-primary btn-lg', onclick: runQuarter });
  const desk = h('aside', { class: 'desk', 'aria-label': 'Policy desk' }, ui.coach, ui.report, ui.capital, ui.rate, ui.tools, ui.locked,
    h('label', { class: 'switch', for: 'assistPlay' }, ui.assist, h('span', null, 'GammaLedger Desk ', h('span', { class: 'dim tiny', text: '(off = +15% points)' }))),
    h('div', { class: 'runbar' }, ui.run));

  app.append(h('div', { class: 'wrap' }, bar, h('div', { class: 'play' }, ui.machine, desk)));
  updateAll();
}

/* Tank SVG */
function createTank(m) {
  const M = METRICS[m];
  const id = 't' + m;
  const liquid = S('g', { class: 'liquid' },
    S('path', { class: 'wave', d: 'M-46 0 q15 -5 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V420 H-46 Z', fill: 'url(#lq' + id + ')' }));
  const zone = S('rect', { x: 12, width: 76, fill: 'rgba(94,234,212,0.09)' });
  const zTop = S('line', { x1: 8, x2: 92, stroke: 'rgba(94,234,212,0.7)', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
  const zBot = S('line', { x1: 8, x2: 92, stroke: 'rgba(94,234,212,0.7)', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
  const fmark = S('g', { class: 'fmark' },
    S('line', { x1: 14, x2: 86, y1: 0, y2: 0, stroke: '#f8fafc', 'stroke-width': 1.6, 'stroke-dasharray': '3 3', opacity: 0.85 }),
    S('path', { d: 'M88 0 l8 -5 v10 z', fill: '#f8fafc' }));
  const alarm = S('g', { class: 'alarm' }, S('circle', { cx: 86, cy: 10, r: 9, fill: '#fb7185' }), S('text', { x: 86, y: 14.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#0a0b1a', 'font-family': 'DM Sans, sans-serif' }, '!'));
  const ticks = S('g', null, [0.25, 0.5, 0.75].map(p => S('line', { x1: 14, x2: 22, y1: 8 + p * 192, y2: 8 + p * 192, stroke: 'rgba(203,213,225,0.35)', 'stroke-width': 1 })));
  const svg = S('svg', { viewBox: '0 0 100 210', 'aria-hidden': 'true' },
    S('defs', null,
      S('linearGradient', { id: 'lq' + id, x1: 0, y1: 0, x2: 0, y2: 1 }, S('stop', { offset: 0, style: 'stop-color: var(--liq-a)' }), S('stop', { offset: 0.6, style: 'stop-color: var(--liq-b)' })),
      S('clipPath', { id: 'cl' + id }, S('rect', { x: 12, y: 8, width: 76, height: 192, rx: 14 }))),
    S('rect', { x: 12, y: 8, width: 76, height: 192, rx: 14, fill: 'rgba(248,250,252,0.035)' }),
    S('g', { 'clip-path': 'url(#cl' + id + ')' }, zone, liquid),
    zTop, zBot, ticks,
    S('rect', { x: 20, y: 18, width: 6, height: 150, rx: 3, fill: 'rgba(255,255,255,0.08)' }),
    S('rect', { class: 'glass', x: 12, y: 8, width: 76, height: 192, rx: 14, fill: 'none', stroke: 'rgba(203,213,225,0.5)', 'stroke-width': 2 }),
    fmark, alarm);
  const val = h('div', { class: 'tval' });
  const zoneTxt = h('div', { class: 'tzone' });
  const pipe = S('svg', { class: 'pipe', viewBox: '0 0 120 22', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    S('path', { d: 'M60 0 V12 M0 12 H120', stroke: 'rgba(203,213,225,0.16)', 'stroke-width': 8, fill: 'none' }),
    S('path', { class: 'flow', d: 'M60 0 V12 M0 12 H120', stroke: 'var(--liq-a)', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }));
  const el = h('div', { class: 'tank', role: 'group', 'aria-label': M.name }, h('div', { class: 'tname', text: M.name }), svg, val, zoneTxt, pipe);
  return { el, m, liquid, zone, zTop, zBot, fmark, val, zoneTxt };
}
const yOf = (m, v) => { const M = METRICS[m]; const p = Math.max(0, Math.min(1, (v - M.min) / (M.max - M.min))); return 8 + (1 - p) * 192; };

function updateTanks(fc) {
  const g = Session.game, book = isBook(Session.level);
  g.metrics.forEach(m => {
    const t = Session.ui.tankRefs[m], v = g.s[m], M = METRICS[m];
    t.liquid.style.transform = 'translateY(' + yOf(m, v) + 'px)';
    const z = zoneOf(g, m);
    if (z) {
      const yt = yOf(m, z[1]), yb = yOf(m, z[0]);
      t.zone.setAttribute('y', yt); t.zone.setAttribute('height', Math.max(0, yb - yt));
      t.zTop.setAttribute('y1', yt); t.zTop.setAttribute('y2', yt); t.zTop.style.display = z[1] >= M.max ? 'none' : '';
      t.zBot.setAttribute('y1', yb); t.zBot.setAttribute('y2', yb); t.zBot.style.display = z[0] <= M.min ? 'none' : '';
      const lo = z[0] <= M.min ? null : z[0], hi = z[1] >= M.max ? null : z[1];
      t.zoneTxt.textContent = lo != null && hi != null ? 'safe ' + fmt(lo, M.dec) + '–' + fmt(hi, M.dec) : hi != null ? 'safe ≤ ' + fmt(hi, M.dec) : lo != null ? 'safe ≥ ' + fmt(lo, M.dec) : '';
    } else {
      t.zone.setAttribute('height', 0); t.zTop.style.display = 'none'; t.zBot.style.display = 'none';
      t.zoneTxt.textContent = m === 'reserves' ? '$bn' : book && m === 'stocks' ? 'started at 100' : book ? 'not scored' : '';
    }
    t.val.textContent = fmtMetric(m, v) + (m === 'reserves' ? 'bn' : '');
    t.el.classList.toggle('out', !inZone(g, m));
    if (fc && Session.assist && g.status === 'playing') { t.fmark.style.display = ''; t.fmark.style.transform = 'translateY(' + yOf(m, fc[m]) + 'px)'; }
    else t.fmark.style.display = 'none';
    t.el.setAttribute('aria-label', M.name + ' ' + t.val.textContent + (inZone(g, m) ? '' : ', outside safe zone'));
  });
  Session.ui.fcLegend.style.visibility = Session.assist ? 'visible' : 'hidden';
  const flowDur = Math.max(0.5, Math.min(4, 2.2 - g.s.growth * 0.15));
  Session.ui.tanks.querySelectorAll('.flow').forEach(f => { f.style.animationDuration = flowDur + 's'; });
}

function delta(d, dec) { if (Math.abs(d) < Math.pow(10, -dec) / 2) return ''; return (d > 0 ? '▲' : '▼') + fmt(Math.abs(d), dec); }
function updateGauges() {
  const g = Session.game, s = g.s, prev = g.history[g.history.length - 2] || g.history[0];
  const pend = Session.pending.rateDelta;
  const items = isBook(Session.level) ? [
    ['Your book', fmt(s.book, 1), delta(s.book - prev.book, 1), s.book - prev.book >= 0 ? 'down' : 'up'],
    ['Cash-only book', fmt(g.cashBook, 1), '', ''],
    ['Policy rate', fmt(s.rate, 2) + '%', delta(s.rate - prev.rate, 2), s.rate - prev.rate > 0 ? 'up' : 'down'],
    ['10-yr yield', fmt(s.y10, 1) + '%', delta(s.y10 - prev.y10, 1), s.y10 - prev.y10 > 0 ? 'up' : 'down'],
    ['Market fear', fmt(s.stress, 0), delta(s.stress - prev.stress, 0), s.stress - prev.stress > 0 ? 'up' : 'down']
  ] : [
    ['Policy rate', fmt(s.rate + pend, 2) + '%', pend ? (pend > 0 ? '▲' : '▼') + fmt(Math.abs(pend), 2) : '', pend > 0 ? 'up' : 'down'],
    ['10-yr yield', fmt(s.y10, 1) + '%', delta(s.y10 - prev.y10, 1), s.y10 - prev.y10 > 0 ? 'up' : 'down'],
    ['Expected inflation', fmt(s.expInfl, 1) + '%', delta(s.expInfl - prev.expInfl, 1), s.expInfl - prev.expInfl > 0 ? 'up' : 'down'],
    ['Credibility', fmt(s.cred, 0), delta(s.cred - prev.cred, 0), s.cred - prev.cred >= 0 ? 'down' : 'up'],
    ['Stocks', fmt(s.stocks, 0), delta(s.stocks - prev.stocks, 0), s.stocks - prev.stocks >= 0 ? 'down' : 'up']
  ];
  Session.ui.gauges.replaceChildren(...items.map(([n, v, d, c]) => h('div', { class: 'gauge' }, h('span', { text: n }), h('b', null, v, d ? h('i', { class: c, text: d }) : null))));
}

function updateLevelbar() {
  const g = Session.game, L = Session.level, ui = Session.ui;
  ui.when.textContent = g.endless ? quarterLabel(L, g.q) + ' · quarter ' + g.q : quarterLabel(L, Math.min(g.q, g.quarters)) + ' · quarter ' + Math.min(g.q, g.quarters) + ' of ' + g.quarters;
  if (!g.endless) ui.qprog.replaceChildren(...Array.from({ length: g.quarters }, (_, i) => { const sc = g.qScores[i]; return h('i', { class: sc == null ? (i === g.q - 1 ? 'now' : '') : sc >= 80 ? 'g' : sc >= 50 ? 'w' : 'b' }); }));
  ui.points.textContent = fmtInt(g.points);
  ui.streak.textContent = '×' + fmt(1 + 0.1 * Math.min(g.streak, 5), 1) + (g.streak ? ' · ' + g.streak : '');
  ui.avg.textContent = g.qScores.length ? Math.round(g.qScores.reduce((a, b) => a + b, 0) / g.qScores.length) : '—';
}

function updateDesk() {
  const g = Session.game, L = Session.level, ui = Session.ui, pend = Session.pending, book = isBook(L);
  const used = ppUsed(), playing = g.status === 'playing' && !Session.busy;
  ui.coach.replaceChildren();
  if (Session.tip) ui.coach.appendChild(h('div', { class: 'coach', role: 'note' }, h('div', null, h('b', { text: 'Coach: ' }), Session.tip), h('button', { class: 'icon-btn', style: 'width:32px;height:32px;flex:none', 'aria-label': 'Dismiss tip', onclick: () => { Session.tip = null; updateDesk(); } }, '×')));
  ui.report.replaceChildren();
  if (Session.report) ui.report.appendChild(reportCard(Session.report));
  // policy capital (not shown on trading levels: one trade per quarter)
  ui.capital.replaceChildren(...(book ? [] : [h('div', { class: 'desk-card capital' },
    h('div', null, h('b', { text: 'Policy capital' }), h('div', { class: 'tiny dim', text: 'Rate moves are free. Other tools cost capital.' })),
    h('span', { class: 'pips', role: 'img', 'aria-label': (g.pp - used) + ' of ' + g.pp + ' left' }, Array.from({ length: g.pp }, (_, i) => h('i', { class: i < g.pp - used ? 'on' : '' }))))]));
  // rate
  if (hasTool(g, 'rate')) {
    const target = g.s.rate + pend.rateDelta;
    const tr = Math.round(taylorRate(g) * 4) / 4;
    const trDelta = Math.max(-1, Math.min(1, Math.round((tr - g.s.rate) * 4) / 4));
    ui.rate.replaceChildren(h('div', { class: 'desk-card ratecard' },
      h('div', { class: 'tool-head' }, h('b', { text: 'Policy rate' }), h('span', { class: 'chip', text: 'Central bank' })),
      h('div', { class: 'rv' },
        h('div', null, h('div', { class: 'big', text: fmt(target, 2) + '%' }), h('div', { class: 'delta num ' + (pend.rateDelta > 0 ? 'up' : pend.rateDelta < 0 ? 'down' : 'dim'), text: pend.rateDelta ? (pend.rateDelta > 0 ? 'Hike ' : 'Cut ') + fmt(Math.abs(pend.rateDelta), 2) + ' pts' : 'Hold at ' + fmt(g.s.rate, 2) + '%' })),
        h('div', { class: 'stepper' },
          h('button', { 'aria-label': 'Cut rate by 0.25 points', disabled: !playing || pend.rateDelta <= -1 || target <= 0, onclick: () => { pend.rateDelta = Math.round((pend.rateDelta - 0.25) * 100) / 100; changed(); } }, '−'),
          h('button', { 'aria-label': 'Raise rate by 0.25 points', disabled: !playing || pend.rateDelta >= 1, onclick: () => { pend.rateDelta = Math.round((pend.rateDelta + 0.25) * 100) / 100; changed(); } }, '+'))),
      target <= 0 && hasTool(g, 'qe') ? h('p', { class: 'tiny', style: 'margin-top:8px;color:var(--warn)', text: 'Zero lower bound: try bond buying or forward guidance.' }) : null,
      Session.assist ? h('div', { class: 'taylor' },
        h('span', { class: 'chip violet', title: 'Taylor rule: neutral rate + inflation + ½ × (inflation − target) + ½ × output gap', text: 'GammaLedger Desk suggests ' + fmt(tr, 2) + '%' }),
        pend.rateDelta === trDelta || !playing ? null : h('button', { class: 'btn btn-quiet', style: 'min-height:34px;padding:4px 10px;font-size:13px', onclick: () => { pend.rateDelta = trDelta; changed(); } }, 'Use it'),
        h('span', { class: 'tiny dim', style: 'width:100%', text: 'Based on the Taylor rule (John Taylor, 1993). A rule of thumb, not an oracle.' })) : null));
  } else if (book) {
    ui.rate.replaceChildren(quoteCard(g));
  } else {
    ui.rate.replaceChildren(h('div', { class: 'desk-card' }, h('b', { text: 'Interest rates' }), h('p', { class: 'small dim', text: 'The central bank sets rates by its own rule. Right now: ' + fmt(g.s.rate, 2) + '%. Your tools are the budget.' })));
  }
  // tools
  ui.tools.replaceChildren(...(L.tools || []).filter(t => t !== 'rate').map(t => {
    const T = TOOLS[t], sel = pend.tools[t];
    return h('div', { class: 'desk-card tool' },
      h('div', { class: 'tool-head' }, h('b', { text: T.name }), h('span', { class: 'row', style: 'gap:6px' }, h('span', { class: 'chip', text: T.who }), book ? null : h('span', { class: 'pips', 'aria-label': 'Costs ' + T.cost }, Array.from({ length: T.cost }, () => h('i', { class: 'on' }))))),
      h('p', { text: T.blurb }),
      h('div', { class: 'opts' }, T.options.map(o => {
        const on = sel === o.id;
        const can = on || (used - (sel ? T.cost : 0) + T.cost <= g.pp);
        const dis = !playing || !can || (t === 'fx' && o.id === 'sell' && g.s.reserves < 1);
        return h('button', { class: 'opt', 'aria-pressed': on ? 'true' : 'false', disabled: dis && !on, onclick: () => { if (on) delete pend.tools[t]; else pend.tools[t] = o.id; changed(); } }, h('span', { text: o.label }), h('small', { text: o.hint }));
      })),
      book ? h('p', { class: 'tiny', style: 'color:var(--muted)', text: pend.tools.trade ? positionSummary(g, pend.tools.trade) : 'No trade selected: the book sits in cash and earns ' + fmt(g.s.rate / 4, 2) + '% this quarter.' }) : null);
  }));
  ui.locked.replaceChildren();
  if (Session.kind === 'campaign' && !book) {
    const lockedTools = TOOL_ORDER.filter(t => t !== 'trade' && !(L.tools || []).includes(t)).map(t => ({ t, i: LEVELS.findIndex(l => l.tools.includes(t)) })).filter(x => x.i > LEVELS.indexOf(L));
    if (lockedTools.length) ui.locked.appendChild(h('div', { class: 'locked' }, h('span', { text: 'Coming later:' }), lockedTools.slice(0, 4).map(x => h('span', { class: 'chip', text: TOOLS[x.t].name + ' · L' + (x.i + 1) }))));
  }
  ui.run.disabled = !playing;
  ui.run.textContent = g.status !== 'playing' ? 'Quarter complete' : 'Run ' + quarterLabel(L, g.q) + ' →';
}

/* GammaLedger quote card on trading levels */
function quoteCard(g) {
  const Q = optionQuotes(g.s);
  const row = (k, v) => h('div', { class: 'qrow' }, h('span', { text: k }), h('b', { class: 'num', text: v }));
  return h('div', { class: 'desk-card gl-card' },
    h('div', { class: 'tool-head' }, h('span', { class: 'row', style: 'gap:8px' }, logo(22), h('b', { text: 'GammaLedger' })), h('span', { class: 'chip', text: '3-month · 5% OTM' })),
    Session.assist ? h('div', { class: 'qgrid' },
      row('Implied volatility', fmt(Q.iv, 0) + '%'),
      row('Put premium (strike ' + fmt(Q.Kp, 0) + ')', fmt(Q.putPct, 2) + '%'),
      row('Call premium (strike ' + fmt(Q.Kc, 0) + ')', fmt(Q.callPct, 2) + '%'),
      row('Cash yield this quarter', fmt(Q.cashPct, 2) + '%'),
      row('Put delta', fmt(Q.deltaPut, 2))) : h('p', { class: 'small dim', text: 'Quotes are hidden while the desk is off. Implied volatility tracks market fear: ' + fmt(g.s.stress, 0) + '.' }),
    h('p', { class: 'tiny dim', text: 'Black–Scholes prices from the fear index. The central bank sets rates by the Taylor rule; you only trade.' }));
}
function positionSummary(g, pos) {
  const Q = optionQuotes(g.s);
  if (pos === 'long') return 'All in the index. You gain or lose whatever it does. Break-even: index flat.';
  if (pos === 'put') return 'Collect ' + fmt(Q.putPct, 2) + '% now plus interest on the collateral. If the index ends below ' + fmt(Q.Kp, 0) + ', you pay the difference.';
  if (pos === 'call') return 'Own the index and collect ' + fmt(Q.callPct, 2) + '%. Gains above ' + fmt(Q.Kc, 0) + ' go to the call buyer.';
  if (pos === 'hedge') return 'Own the index and pay ' + fmt(Q.put / Q.S * 100, 2) + '% for insurance. Losses stop at ' + fmt(Q.Kp, 0) + ' (about −' + fmt(5 + Q.put / Q.S * 100, 1) + '% worst case).';
  return '';
}

/* Quarter report with the "why" breakdown */
function whyBlock(title, w, unit, baseLabel) {
  if (!w) return null;
  const items = w.parts.filter(p => Math.abs(p[1]) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
  const max = Math.max(0.5, ...items.map(p => Math.abs(p[1])));
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 1);
  return h('div', { class: 'why' },
    h('div', { class: 'why-head' }, h('span', { text: title }), h('b', { class: 'num', text: baseLabel != null ? baseLabel : fmt(w.from, 1) + unit + ' → ' + fmt(w.to, 1) + unit })),
    items.length ? items.map(([lab, v]) => h('div', { class: 'why-row' },
      h('span', { class: 'why-lab', text: lab }),
      h('span', { class: 'why-bar', 'aria-hidden': 'true' }, h('i', { class: v >= 0 ? 'pos' : 'neg', style: 'width:' + Math.round(Math.abs(v) / max * 50) + '%' })),
      h('b', { class: 'num', text: sign(v) }))) : h('p', { class: 'tiny dim', text: 'Barely moved.' }));
}
function reportCard(r) {
  const col = r.score >= 80 ? 'var(--good)' : r.score >= 50 ? 'var(--warn)' : 'var(--bad)';
  const C = 2 * Math.PI * 24;
  const ring = S('svg', { class: 'ring', viewBox: '0 0 58 58', role: 'img', 'aria-label': 'Quarter score ' + r.score },
    S('circle', { cx: 29, cy: 29, r: 24, fill: 'none', stroke: 'rgba(203,213,225,0.15)', 'stroke-width': 6 }),
    S('circle', { cx: 29, cy: 29, r: 24, fill: 'none', stroke: col, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': (C * r.score / 100) + ' ' + C, transform: 'rotate(-90 29 29)' }),
    S('text', { x: 29, y: 34, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 15, 'font-weight': 700, fill: '#f8fafc' }, String(r.score)));
  const names = { infl: 'Inflation', unemp: 'Jobs', growth: 'Growth', stress: 'Fear', approval: 'Trust', debt: 'Debt', bubble: 'Bubble', bank: 'Banks', fx: 'Currency', book: 'Book vs cash' };
  const parts = Object.keys(r.parts).filter(k => r.parts[k] >= 1).sort((a, b) => r.parts[b] - r.parts[a]).slice(0, 3);
  const w = r.why;
  const book = w && w.book;
  const details = h('details', { class: 'whybox', open: P.whyOpen !== false ? true : null, ontoggle: e => { P.whyOpen = e.target.open; saveProfile(); } },
    h('summary', { text: 'Why did this happen?' }),
    book ? whyBlock('Your book this quarter', w.book, '%', (w.book.to >= 0 ? '+' : '−') + fmt(Math.abs(w.book.to), 1) + '%') : null,
    book ? null : whyBlock('Inflation', w.infl, '%'),
    whyBlock('Growth (annualised)', w.growth, '%', 'potential ' + fmt(w.growth.from, 1) + '% → ' + fmt(w.growth.to, 1) + '%'),
    h('p', { class: 'tiny dim', text: book ? 'Index ' + (r.idx >= 0 ? '+' : '−') + fmt(Math.abs(r.idx * 100), 1) + '% this quarter.' : 'Numbers are percentage points. Policy works with a lag, so today’s moves show up over the next few quarters.' }));
  return h('div', { class: 'qreport', role: 'status' },
    h('div', { class: 'qtop' }, ring, h('div', { style: 'min-width:0' },
      h('div', { class: 'small' }, h('b', { text: r.label }), ' · ', h('span', { class: 'num', text: '+' + r.pts + ' pts' }), r.mult > 1 ? h('span', { class: 'flame', text: ' ×' + fmt(r.mult, 1) + ' streak' }) : null),
      h('div', { class: 'chips' }, parts.length ? parts.map(k => h('span', { class: 'chip bad', text: names[k] + ' −' + Math.round(r.parts[k]) })) : h('span', { class: 'chip good', text: book ? 'Beat cash this quarter' : 'All tanks in the safe zone' })),
      (r.notes || []).map(n => h('p', { class: 'tiny', style: 'margin-top:6px;color:var(--warn)', text: n })))),
    w ? details : null);
}

function updateChart() {
  const g = Session.game, hist = g.history, book = isBook(Session.level);
  const N = g.endless ? Math.max(8, hist.length) : g.quarters;
  const W = 520, H = 170, l = 34, r = 12, t = 10, b = 22;
  let series, band = null, unit = '%';
  if (book) {
    let cash = 100; const cashSeries = hist.map((x, i) => { if (i > 0) cash *= 1 + hist[i - 1].rate / 400; return cash; });
    series = [['book', '#c4b5fd', hist.map(x => x.book)], ['stocks', '#60a5fa', hist.map(x => x.stocks)], ['cash', '#5eead4', cashSeries, '5 4']];
    unit = '';
  } else series = [['rate', '#5eead4', hist.map(x => x.rate), '5 4'], ['unemp', '#60a5fa', hist.map(x => x.unemp)], ['infl', '#c4b5fd', hist.map(x => x.infl)]];
  const vals = series.flatMap(sr => sr[2]);
  let hi = Math.ceil(Math.max(...vals) + 1), lo = Math.floor(Math.min(...vals));
  if (!book) { hi = Math.max(8, hi); lo = Math.min(0, lo); } else { hi = Math.max(110, Math.ceil(hi / 10) * 10); lo = Math.min(90, Math.floor(lo / 10) * 10); }
  const X = i => l + (i / N) * (W - l - r), Y = v => t + (1 - (v - lo) / (hi - lo)) * (H - t - b);
  const step2 = book ? 10 : hi - lo > 14 ? 5 : 2;
  const grid = [];
  for (let v = Math.ceil(lo / step2) * step2; v <= hi; v += step2) grid.push(S('g', null, S('line', { x1: l, x2: W - r, y1: Y(v), y2: Y(v), stroke: 'rgba(203,213,225,0.1)' }), S('text', { x: l - 6, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 10.5, fill: '#929ab8', 'font-family': 'JetBrains Mono, monospace' }, v + unit)));
  if (!book) { const T = g.targets.infl; band = S('rect', { x: l, width: W - l - r, y: Y(T[1]), height: Math.max(0, Y(T[0]) - Y(T[1])), fill: 'rgba(94,234,212,0.07)' }); }
  const lines = series.map(([k, c, arr, dash]) => S('polyline', { points: arr.map((v, i) => X(i) + ',' + Y(v)).join(' '), fill: 'none', stroke: c, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': dash || null }));
  const last = hist.length - 1;
  const dots = series.map(([k, c, arr]) => S('circle', { cx: X(last), cy: Y(arr[last]), r: 3.5, fill: c }));
  const xl = [];
  for (let i = 0; i <= N; i += Math.max(1, Math.ceil(N / 8))) xl.push(S('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#929ab8', 'font-family': 'JetBrains Mono, monospace' }, i === 0 ? 'start' : 'Q' + i));
  const label = book ? 'Book ' + fmt(g.s.book, 1) + ', index ' + fmt(g.s.stocks, 0) : 'Inflation now ' + fmt(g.s.infl, 1) + '%, unemployment ' + fmt(g.s.unemp, 1) + '%, rate ' + fmt(g.s.rate, 2) + '%';
  Session.ui.chart.replaceChildren(S('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Track record so far. ' + label }, band, ...grid, ...lines, ...dots, ...xl));
}

function updateLog() {
  Session.ui.log.replaceChildren(...Session.log.slice().reverse().slice(0, 30).map(e => h('li', null, h('span', { text: e.q }), h('div', { text: e.text }))));
}
function updateTicker() {
  const g = Session.game, s = g.s, T = g.targets, lines = [];
  lines.push(...g.eventLog.filter(e => e.headline).slice(-2).map(e => e.headline));
  if (isBook(Session.level)) {
    lines.push('Index at ' + fmt(s.stocks, 0) + '. Implied volatility ' + fmt(s.iv, 0) + '%.', 'Central bank rate ' + fmt(s.rate, 2) + '%. Ten-year yield ' + fmt(s.y10, 1) + '%.', 'Inflation ' + fmt(s.infl, 1) + '%. Unemployment ' + fmt(s.unemp, 1) + '%.');
  } else {
    if (s.infl > T.infl[1] + 1) lines.push('Prices up ' + fmt(s.infl, 1) + '% on a year ago. Shoppers trade down to own brands.');
    else if (s.infl < 0) lines.push('Prices are falling. Shoppers hold off, waiting for bargains.');
    else lines.push('Inflation at ' + fmt(s.infl, 1) + '%.');
    if (s.unemp > T.unempMax) lines.push('Jobless rate climbs to ' + fmt(s.unemp, 1) + '%. Job centres report long queues.');
    else lines.push('Unemployment at ' + fmt(s.unemp, 1) + '%. Firms say hiring is ' + (s.unemp < 4 ? 'brutally hard.' : 'steady.'));
    if (s.stress > 50) lines.push('Fear index at ' + fmt(s.stress, 0) + ': traders pile into gold and cash.');
    if (s.growth < 0) lines.push('Economy shrinks ' + fmt(Math.abs(s.growth), 1) + '% annualised.');
    if (s.approval < 35) lines.push('Poll: just ' + fmt(s.approval, 0) + '% trust the people running the economy.');
    lines.push('Stocks at ' + fmt(s.stocks, 0) + '. Ten-year yield ' + fmt(s.y10, 1) + '%.');
    if (s.cred > 80) lines.push('Markets believe the central bank. Expected inflation ' + fmt(s.expInfl, 1) + '%.');
  }
  const spans = lines.map(tx => h('span', { text: tx }));
  Session.ui.ticker.replaceChildren(...spans, ...spans.map(sp => sp.cloneNode(true)));
}

function updateAll() {
  const g = Session.game;
  const fc = g.status === 'playing' ? forecast(g, { rateDelta: Session.pending.rateDelta, tools: Session.pending.tools }) : null;
  updateLevelbar(); updateGauges(); updateTanks(fc); updateDesk(); updateChart(); updateLog(); updateTicker();
}
function changed() { Sound.play('click'); updateAll(); }

/* ---------- Turn flow ---------- */
function beginQ() {
  if (!Session || VIEW !== 'play') return;
  const g = Session.game;
  const evs = beginQuarter(g);
  Session.tip = (Session.level.tutorial && Session.level.tutorial[g.q]) || null;
  updateAll();
  saveResume();
  showEvents(evs, () => { updateAll(); });
}
function showEvents(list, done) {
  if (!list.length || !Session) return done();
  const ev = list.shift();
  showEvent(ev, () => showEvents(list, done));
}
const FX_NAMES = { infl: 'Inflation', expInfl: 'Expected inflation', unemp: 'Unemployment', gap: 'Output', stress: 'Market fear', approval: 'Public trust', cred: 'Credibility', debt: 'Debt', spend: 'Spending', tax: 'Taxes', qe: 'Bond buying', bubble: 'Housing bubble', bank: 'Bank health', fx: 'Currency', reserves: 'Reserves', rate: 'Policy rate', stocks: 'Stocks', foreignRate: 'Rates abroad' };
const FX_GOOD = { infl: -1, expInfl: -1, unemp: -1, gap: 1, stress: -1, approval: 1, cred: 1, debt: -1, bubble: -1, bank: 1, fx: 1, reserves: 1, stocks: 1, foreignRate: -1 };
const FX_BIG = { infl: 1, expInfl: 0.6, unemp: 3, gap: 3, stress: 15, approval: 5, cred: 8, debt: 3, bubble: 10, bank: 15, fx: 8, reserves: 8, stocks: 12, rate: 0.75, spend: 1.5, tax: 2, qe: 10 };
function effectChips(eff) {
  if (!eff) return [];
  const out = [];
  Object.keys(eff.add || {}).forEach(k => {
    const v = eff.add[k]; if (!v || !FX_NAMES[k]) return;
    const arrow = (v > 0 ? '↑' : '↓').repeat(Math.abs(v) >= (FX_BIG[k] || 99) ? 2 : 1);
    const good = FX_GOOD[k] ? Math.sign(v) === FX_GOOD[k] : null;
    out.push(h('span', { class: 'chip ' + (good === null ? '' : good ? 'good' : 'bad'), text: FX_NAMES[k] + ' ' + arrow }));
  });
  const sh = eff.shock || {};
  const sn = { demand: ['Demand', 0], supply: ['Price pressure', -1], fin: ['Financial strain', -1], tp: ['Long-term yields', -1] };
  Object.keys(sh).forEach(k => { const v = sh[k][0]; if (!v || !sn[k]) return; const good = sn[k][1] ? Math.sign(v) === sn[k][1] : null; out.push(h('span', { class: 'chip ' + (good === null ? '' : good ? 'good' : 'bad'), text: sn[k][0] + ' ' + (v > 0 ? '↑' : '↓') })); });
  return out;
}
function showEvent(ev, next, during) {
  const g = Session.game, d = ev.def, label = quarterLabel(Session.level, during ? g.q - 1 : g.q);
  const head = h('div', { class: 'news-tag' }, d.kind === 'dilemma' ? h('span', { class: 'breaking', style: 'background:var(--violet-3)', text: 'DECISION' }) : d.kind === 'info' ? h('span', { class: 'chip violet', text: d.tag }) : h('span', { class: 'breaking', text: during ? 'DURING THE QUARTER' : 'BREAKING' }), d.kind === 'info' ? null : h('span', { class: 'chip', text: d.tag }), h('span', { class: 'tiny dim num', text: label }));
  if (d.kind === 'news' && (ev.id === 'lehman' || ev.id === 'bubble_pop' || ev.id === 'lockdown' || ev.id.startsWith('bank_run'))) { Sound.play('alarm'); shake(); }
  else Sound.play(d.kind === 'dilemma' ? 'click' : d.kind === 'info' ? 'click' : 'bad');
  if (d.kind !== 'dilemma') {
    const chips = effectChips(d.effects);
    const m = openModal([head, h('h2', { text: ev.headline }), h('p', { class: 'muted', text: d.body }),
      chips.length ? h('div', null, h('p', { class: 'tiny dim', style: 'margin-bottom:6px', text: 'What it does to the machine' }), h('div', { class: 'fx-chips' }, chips)) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', text: 'Continue', onclick: () => { m.close(); Session.log.push({ q: label, text: ev.headline }); updateLog(); next(); } }))], { label: ev.headline });
    return;
  }
  const m = openModal([head, h('h2', { text: ev.headline }), h('p', { class: 'muted', text: d.body }),
    h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, d.choices.map((c, i) => h('button', { class: 'choice', onclick: () => {
      resolveDilemma(g, ev, i);
      saveResume();
      Session.log.push({ q: label, text: ev.headline.replace(/[.!?]?$/, x => x || '.') + ' You chose: ' + c.label.toLowerCase() + '.' });
      if (c.effects.tags && c.effects.tags.includes('independent')) toast('Independence noted. Credibility up.');
      m.close();
      const m2 = openModal([h('div', { class: 'news-tag' }, h('span', { class: 'chip violet', text: 'Consequence' })), h('h2', { text: c.label }), h('div', { class: 'fx-chips' }, effectChips(c.effects)), h('p', { class: 'lessonnote', text: c.note }),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', text: 'Continue', onclick: () => { m2.close(); updateAll(); next(); } }))], { label: 'Consequence' });
    } }, h('b', { text: c.label }), h('div', { class: 'fx-chips' }, effectChips(c.effects))))) ], { label: ev.headline });
}
function shake() { const el = Session && Session.ui && Session.ui.machine; if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

function describeActions(act, g, prevRate) {
  const out = [];
  if (isBook(g.level)) {
    const pos = act.tools.trade;
    out.push(pos ? TOOLS.trade.options.find(o => o.id === pos).label : 'Stayed in cash');
    out.push('Book ' + (g.lastTrade.R >= 0 ? '+' : '−') + fmt(Math.abs(g.lastTrade.R * 100), 1) + '%');
    return out.join('. ') + '.';
  }
  if (Math.abs(g.s.rate - prevRate) > 0.001) out.push((hasTool(g, 'rate') ? (g.s.rate > prevRate ? 'Raised' : 'Cut') + ' the policy rate' : 'Central bank moved rates') + ' to ' + fmt(g.s.rate, 2) + '%');
  else if (hasTool(g, 'rate')) out.push('Held the rate at ' + fmt(g.s.rate, 2) + '%');
  Object.keys(act.tools).forEach(t => { const o = TOOLS[t].options.find(x => x.id === act.tools[t]); out.push(TOOLS[t].name + ': ' + o.label.toLowerCase()); });
  return (out.join('. ') || 'No moves') + '.';
}

function runQuarter() {
  if (!Session || Session.busy) return;
  const g = Session.game; if (g.status !== 'playing') return;
  Session.busy = true;
  if (Session.assist) g.assisted = true;
  const act = { rateDelta: Session.pending.rateDelta, tools: Object.assign({}, Session.pending.tools) };
  const label = quarterLabel(Session.level, g.q), prevRate = g.s.rate;
  const res = step(g, act);
  Session.log.push({ q: label, text: describeActions(act, g, prevRate) + ' Score ' + res.score + '.' });
  Session.report = Object.assign({ label, why: g.lastWhy, idx: g.lastTrade ? g.lastTrade.idx : 0 }, res);
  Session.pending = { rateDelta: 0, tools: {} };
  Session.tip = null;
  Sound.play(res.score >= 80 ? 'good' : res.score < 50 ? 'bad' : 'click');
  if (g.status === 'failed') { Sound.play('alarm'); shake(); }
  if (g.status === 'playing') saveResume();
  updateAll();
  const news = (g.lastNews || []).slice();
  const after = () => {
    Session.busy = false;
    if (g.status === 'playing') { updateDesk(); beginQ(); } else finishLevel();
  };
  // Trading levels: show what happened during the quarter, after the trade settled
  setTimeout(() => showEventsDuring(news, after), g.status === 'playing' ? 700 : 1200);
}
function showEventsDuring(list, done) {
  if (!list.length || !Session) return done();
  const ev = list.shift();
  showEvent(ev, () => showEventsDuring(list, done), true);
}
function finishLevel() {
  clearResume();
  const res = finalResult(Session.game);
  const rec = recordResult(Session, res);
  go('debrief', { force: true, res, rec });
}
