/* ============================================================
   RESULTS, SHARE CARD, PROFILE, MODEL NOTES, COMMUNITY, EDITOR, BOOT
   ============================================================ */

function unlockAch(id, out) { if (P.ach[id]) return; P.ach[id] = Date.now(); out.push(id); }
function checkAchievements(sess, res, rec, out) {
  const g = sess.game, L = sess.level;
  if (res.complete && !g.endless) unlockAch('first', out);
  if (L.id === 'L12' && res.stars[2]) unlockAch('soft', out);
  if (g.maxRateRise >= 4 && hasTool(g, 'rate')) unlockAch('volcker', out);
  if (g.maxQe >= 40) unlockAch('brrr', out);
  if (g.bestStreak >= 8) unlockAch('steady', out);
  if (P.independent >= 3) unlockAch('independent', out);
  if (res.complete && g.maxStress > 70 && !isBook(L)) unlockAch('storm', out);
  if (res.complete && !g.endless && g.metrics.includes('debt') && g.s.debt < g.debt0) unlockAch('hawk', out);
  if (LEVELS.filter(l => P.stars[l.id] === 3).length >= 5) unlockAch('perfect', out);
  if (Object.keys(P.beatBot).filter(id => !isBook(LEVELS.find(l => l.id === id))).length >= 3) unlockAch('bot', out);
  if (P.daily.streak >= 3) unlockAch('habit', out);
  if (LEVELS.filter(l => /^\d{4}$/.test(l.era) && !isBook(l)).every(l => P.completed[l.id])) unlockAch('historian', out);
  if (P.stars.L5 === 3) unlockAch('zero', out);
  if (g.endless && res.quarters >= 20) unlockAch('endless20', out);
  if (res.complete && !g.endless && !g.assisted) unlockAch('unassisted', out);
  if (LEVELS.every(l => P.completed[l.id])) unlockAch('campaign', out);
  if (isBook(L) && res.complete && rec.beatBot && sess.bench && res.total > sess.bench.hold.total) unlockAch('theta', out);
  if (isBook(L) && g.insuredWin) unlockAch('insured', out);
}

function recordResult(sess, res) {
  const g = sess.game, L = sess.level, id = L.id;
  const out = { xp: 0, newStars: 0, ach: [], card: null, beatBot: false, prevRank: rankIndex(P.xp), entryAt: null, verify: null };
  if (g.endless) {
    if (res.total > P.endlessBest) { P.endlessBest = res.total; out.newBest = true; }
    P.endlessQ = Math.max(P.endlessQ, res.quarters);
    out.xp += Math.round(res.total / 6);
  } else {
    const prevStars = P.stars[id] || 0;
    if (res.starCount > prevStars) { out.newStars = res.starCount - prevStars; P.stars[id] = res.starCount; }
    out.prevBest = P.best[id] || 0;
    if (res.complete && res.total > out.prevBest) { P.best[id] = res.total; out.newBest = true; }
    if (res.complete) P.completed[id] = true;
    out.xp += Math.round((res.complete ? res.total : g.points) / 5) + out.newStars * 60;
    if (sess.kind === 'campaign' && res.complete && CARDS[id] && !P.cards[id]) { P.cards[id] = Date.now(); out.card = CARDS[id]; }
    if (res.complete && sess.bench && res.total > sess.bench.taylor.total) { out.beatBot = true; if (sess.kind === 'campaign') P.beatBot[id] = true; }
  }
  if (sess.kind === 'daily') {
    const key = id.slice(6), yest = dateKey(new Date(new Date(key + 'T12:00:00').getTime() - 864e5));
    if (P.daily.last !== key) { P.daily.streak = P.daily.last === yest ? P.daily.streak + 1 : 1; P.daily.last = key; out.xp += 50; out.streakUp = true; }
    if (res.complete) P.daily.best[key] = Math.max(P.daily.best[key] || 0, res.total);
  }
  P.independent += g.tags.independent || 0;
  checkAchievements(sess, res, out, out.ach);
  out.xp += out.ach.length * 100;
  P.xp += out.xp;
  out.newRank = rankIndex(P.xp);
  saveProfile();
  if (res.complete) {
    out.entryAt = Date.now();
    const submission = { v: 1, level: levelRefOf(L, sess.kind), actions: g.actions, choices: g.choices, retired: !!g.retired, claimed: res.total };
    out.verify = submitScore(boardIdOf(L), { name: P.name || 'Anonymous', pts: res.total, stars: res.starCount, at: out.entryAt, q: res.quarters }, submission);
  }
  return out;
}

/* ---------- Share text & image ---------- */
function shareText(sess, res) {
  const g = sess.game, L = sess.level;
  const squares = g.qScores.slice(0, 40).map(s => s >= 80 ? '🟦' : s >= 50 ? '🟨' : '🟥').join('');
  const head = CONFIG.gameName + ' · ' + (sess.kind === 'daily' ? 'Daily ' + L.era : g.endless ? 'Endless' : L.title);
  const line2 = g.endless ? res.quarters + ' quarters survived · ' + fmtInt(res.total) + ' pts' : '★'.repeat(res.starCount) + '☆'.repeat(3 - res.starCount) + ' · ' + fmtInt(res.total) + ' pts · ' + RANKS[rankIndex(P.xp)].name;
  return head + '\n' + line2 + '\n' + squares + '\nCan you keep it afloat? ' + CONFIG.shareUrl;
}
const SHORT_NAMES = { book: 'Book', stocks: 'Index', iv: 'Impl. vol', rate: 'Rate', infl: 'Inflation', growth: 'Growth', unemp: 'Jobless', stress: 'Fear', approval: 'Trust', debt: 'Debt', bubble: 'Bubble', bank: 'Banks', fx: 'Currency', reserves: 'Reserves' };
function wrapText(c, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
}
function drawStar(c, x, y, r, on) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
  if (on) { c.fillStyle = '#fbbf24'; c.fill(); } else { c.strokeStyle = 'rgba(203,213,225,0.4)'; c.lineWidth = 3; c.stroke(); }
}
function roundRect(c, x, y, w, hh, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
async function shareCardCanvas(sess, res) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* fonts optional */ }
  const g = sess.game, L = sess.level, W = 1200, H = 630;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const sk = SKINS.find(x => x.id === P.skin) || SKINS[0];
  c.fillStyle = '#0a0b1a'; c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(980, 60, 10, 980, 60, 700); rg.addColorStop(0, 'rgba(139,92,246,0.35)'); rg.addColorStop(1, 'rgba(139,92,246,0)');
  c.fillStyle = rg; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(139,92,246,0.07)'; c.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); c.stroke(); }
  for (let y = 0; y < H; y += 30) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
  // brand
  const lg = c.createLinearGradient(56, 56, 120, 124); lg.addColorStop(0, '#7c3aed'); lg.addColorStop(1, '#8ea2f0');
  c.strokeStyle = lg; c.lineWidth = 5; c.beginPath(); c.arc(88, 90, 32, 0, Math.PI * 2); c.stroke();
  c.fillStyle = lg; c.font = '700 40px Georgia, "Times New Roman", serif'; c.textAlign = 'center'; c.fillText('Γ', 88, 104); c.textAlign = 'left';
  c.fillStyle = '#a78bfa'; c.font = '500 19px "JetBrains Mono", ui-monospace, monospace'; c.fillText('KEEP THE ECONOMY AFLOAT', 140, 84);
  c.fillStyle = '#929ab8'; c.font = '500 15px "JetBrains Mono", ui-monospace, monospace'; c.fillText('GAMMALEDGER · MONIAC', 140, 110);
  // title
  c.fillStyle = '#f8fafc'; c.font = '700 54px Unbounded, "Arial Black", system-ui, sans-serif';
  const tl = wrapText(c, sess.kind === 'daily' ? 'Daily Challenge' : L.title, 600).slice(0, 2);
  tl.forEach((ln, i) => c.fillText(ln, 56, 210 + i * 62));
  let y = 210 + (tl.length - 1) * 62 + 44;
  c.fillStyle = '#cbd5e1'; c.font = '500 23px "DM Sans", system-ui, sans-serif';
  c.fillText((L.era || '') + (g.endless ? '' : ' · ' + L.concept), 56, y);
  // stars or quarters
  y += 62;
  if (g.endless) { c.fillStyle = '#f8fafc'; c.font = '700 34px "DM Sans", system-ui, sans-serif'; c.fillText(res.quarters + ' quarters survived', 56, y); }
  else for (let i = 0; i < 3; i++) drawStar(c, 80 + i * 66, y - 10, 26, res.stars[i]);
  // score
  y += 92;
  const sg = c.createLinearGradient(56, 0, 520, 0); sg.addColorStop(0, '#c4b5fd'); sg.addColorStop(1, '#60a5fa');
  c.fillStyle = sg; c.font = '700 70px "JetBrains Mono", ui-monospace, monospace'; c.fillText(fmtInt(res.total), 56, y);
  const sw = c.measureText(fmtInt(res.total)).width;
  c.fillStyle = '#cbd5e1'; c.font = '500 26px "DM Sans", system-ui, sans-serif'; c.fillText('points · ' + RANKS[rankIndex(P.xp)].name, 70 + sw, y - 4);
  // quarter squares
  const qs = g.qScores.slice(0, 20);
  qs.forEach((s, i) => { c.fillStyle = s >= 80 ? '#5eead4' : s >= 50 ? '#fbbf24' : '#fb7185'; roundRect(c, 56 + i * 30, 510, 24, 24, 5); c.fill(); });
  c.fillStyle = '#929ab8'; c.font = '500 20px "DM Sans", system-ui, sans-serif';
  c.fillText(CONFIG.shareUrl.replace(/^https?:\/\//, '') + ' · Can you keep it afloat?', 56, 584);
  // tanks
  const ms = g.metrics.slice(0, 5), tx0 = 1144 - ms.length * 96 + 20;
  ms.forEach((m, i) => {
    const M = METRICS[m], x = tx0 + i * 96, top = 150, hh = 300, w = 64;
    const pos = Math.max(0, Math.min(1, (g.s[m] - M.min) / (M.max - M.min)));
    c.save(); roundRect(c, x, top, w, hh, 14); c.clip();
    c.fillStyle = 'rgba(248,250,252,0.04)'; c.fillRect(x, top, w, hh);
    const z = zoneOf(g, m);
    if (z) { const y1 = top + (1 - Math.min(1, (z[1] - M.min) / (M.max - M.min))) * hh, y0 = top + (1 - Math.max(0, (z[0] - M.min) / (M.max - M.min))) * hh; c.fillStyle = 'rgba(94,234,212,0.12)'; c.fillRect(x, y1, w, y0 - y1); }
    const ly = top + (1 - pos) * hh;
    const lq = c.createLinearGradient(0, ly, 0, top + hh); lq.addColorStop(0, sk.a); lq.addColorStop(1, sk.b);
    c.fillStyle = lq; c.fillRect(x, ly, w, top + hh - ly);
    c.restore();
    c.strokeStyle = inZone(g, m) ? 'rgba(203,213,225,0.55)' : '#fb7185'; c.lineWidth = 2.5; roundRect(c, x, top, w, hh, 14); c.stroke();
    c.textAlign = 'center';
    c.fillStyle = inZone(g, m) ? '#f8fafc' : '#fb7185'; c.font = '700 21px "JetBrains Mono", ui-monospace, monospace'; c.fillText(fmtMetric(m, g.s[m]), x + w / 2, top + hh + 34);
    c.fillStyle = '#929ab8'; c.font = '500 15px "DM Sans", system-ui, sans-serif'; c.fillText(SHORT_NAMES[m] || M.name, x + w / 2, top + hh + 58);
    c.textAlign = 'left';
  });
  return cv;
}
async function saveCanvas(cv, filename) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  if (!blob) { toast('Could not create the image.'); return; }
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: blob }); toast('Image saved'); } catch (e) { if (e && e.code !== 'declined') toast('Saving is not available here. Right-click the image to save it.'); }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function shareImageBox(sess, res) {
  const box = h('div', { class: 'share-img' }, h('p', { class: 'tiny dim', text: 'Drawing your share card…' }));
  const fname = 'keep-the-economy-afloat-' + (sess.kind === 'daily' ? sess.level.id : sess.level.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '.png';
  shareCardCanvas(sess, res).then(cv => {
    const url = cv.toDataURL('image/png');
    const img = h('img', { src: url, alt: 'Share card: ' + sess.level.title + ', ' + fmtInt(res.total) + ' points', width: 1200, height: 630 });
    const blobP = () => new Promise(r => cv.toBlob(r, 'image/png'));
    const canShareFiles = !!(navigator.canShare && navigator.share);
    box.replaceChildren(img, h('div', { class: 'row', style: 'gap:8px' },
      h('button', { class: 'btn btn-quiet', text: 'Save image', onclick: () => saveCanvas(cv, fname) }),
      window.ClipboardItem && navigator.clipboard && navigator.clipboard.write ? h('button', { class: 'btn btn-quiet', text: 'Copy image', onclick: () => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP() })]).then(() => toast('Image copied')).catch(() => toast('Copying images is blocked here. Use Save image instead.'));
      } }) : null,
      canShareFiles ? h('button', { class: 'btn btn-quiet', text: 'Share…', onclick: async () => {
        try { const file = new File([await blobP()], fname, { type: 'image/png' }); if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: shareText(sess, res) }); else toast('Sharing is not available here.'); }
        catch (e) { if (e && e.name !== 'AbortError') toast('Sharing is not available here.'); }
      } }) : null));
  });
  return box;
}

/* ---------- Debrief ---------- */
function renderDebrief(app, arg) {
  if (!Session || !arg) return go('home');
  const { res, rec } = arg; const sess = Session, g = sess.game, L = sess.level, book = isBook(L);
  const failed = g.status === 'failed' && !g.endless;
  const idx = LEVELS.indexOf(L);
  if (res.starCount === 3 || rec.newRank > rec.prevRank) { setTimeout(confetti, 300); Sound.play('rank'); } else if (res.complete) Sound.play('good');

  const fr = failed ? FAIL_REASONS[g.failReason] : null;
  const title = g.endless ? (g.status === 'failed' ? 'Sunk after ' + res.quarters + ' quarters' : 'Retired after ' + res.quarters + ' quarters')
    : failed ? fr.title : book ? (res.starCount === 3 ? 'A masterclass in risk.' : 'Book closed.') : res.starCount === 3 ? 'Flawless. The economy is afloat.' : 'The economy is afloat.';
  const objs = h('ul', { class: 'objlist' }, objectiveLines(L).map((t, i) => h('li', null, checkIcon(res.stars[i]), h('span', null, t, i === 1 ? h('span', { class: 'dim', text: ' · yours: ' + res.avg }) : null))));

  const bench = sess.bench, [bn1, bn2] = benchNames(L);
  const maxB = Math.max(res.total, bench ? bench.taylor.total : 0, bench ? bench.hold.total : 0, 1);
  const bar = (label, v, col) => h('div', { class: 'bar' }, h('span', { text: label }), h('div', { class: 'track2' }, h('span', { style: 'width:' + Math.round(v / maxB * 100) + '%;background:' + col })), h('b', { class: 'num', style: 'text-align:right', text: fmtInt(v) }));
  const benchBox = bench && !g.endless ? h('div', { class: 'bars', 'aria-label': 'Benchmarks' },
    bar('You', res.total, 'linear-gradient(90deg,var(--violet),var(--blue))'), bar(bn1, bench.taylor.total, 'var(--good)'), bar(bn2, bench.hold.total, 'rgba(203,213,225,0.4)'),
    h('p', { class: 'tiny dim', text: book ? (res.total > bench.taylor.total && res.total > bench.hold.total ? 'You beat both buy-and-hold and cash. That is the hard part.' : res.total > bench.taylor.total ? 'You beat buy-and-hold, but plain cash did better. Risk has to earn its keep.' : 'Buy-and-hold beat you this time. Try again?')
      : res.total > bench.taylor.total ? 'You beat the GammaLedger autopilot, which follows the Taylor rule.' : 'The GammaLedger autopilot beat you this time. Try again?' })) : null;

  const strip = h('div', { class: 'qstrip', 'aria-label': 'Score per quarter' }, g.qScores.slice(0, 60).map((s, i) => h('i', { title: quarterLabel(L, i + 1) + ': ' + s, style: 'background:' + (s >= 80 ? 'var(--good)' : s >= 50 ? 'var(--warn)' : 'var(--bad)'), text: String(s) })));

  const rp = rankProgress(P.xp);
  const xpBox = h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', null, rankBadge(rp.i, 26), ' ', h('b', { text: rp.cur.name })), h('span', { class: 'num', style: 'color:var(--violet-3)', text: '+' + fmtInt(rec.xp) + ' XP' })),
    h('div', { class: 'xpbar' }, h('span', { style: 'width:' + Math.round(rp.pct * 100) + '%' })),
    rec.newRank > rec.prevRank ? h('p', { class: 'small', style: 'color:var(--warn)', text: 'Promoted to ' + rp.cur.name + '!' + (SKINS.find(s => s.rank === rec.newRank) ? ' New liquid colour unlocked in your profile.' : '') }) : null,
    rec.streakUp ? h('p', { class: 'small flame', text: 'Daily streak: ' + P.daily.streak + ' day' + (P.daily.streak === 1 ? '' : 's') }) : null);

  const nextL = idx >= 0 ? LEVELS[idx + 1] : null;
  const buttons = h('div', { class: 'row' },
    sess.kind === 'campaign' && nextL && res.starCount >= 1 ? h('button', { class: 'btn btn-primary btn-lg', text: 'Next: ' + nextL.title, onclick: () => openBriefing(nextL, 'campaign') }) : null,
    h('button', { class: 'btn btn-ghost', text: 'Play again', onclick: () => startLevel(L, sess.kind, sess.assist, sess.bench) }),
    h('button', { class: 'btn btn-quiet', text: sess.kind === 'custom' ? 'Community levels' : 'Back to map', onclick: () => go(sess.kind === 'custom' ? 'community' : 'home') }));

  const share = shareText(sess, res);
  const shareBox = h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, h('h3', { class: 'small', style: 'color:var(--muted);font-weight:500', text: 'Share your result' }),
    res.complete ? shareImageBox(sess, res) : null,
    h('div', { class: 'sharebox', text: share }),
    h('div', null, h('button', { class: 'btn btn-quiet', text: 'Copy text', onclick: () => copyText(share) })));

  const left = h('section', { class: 'panel result-hero' },
    h('div', { class: 'eyebrow', text: (sess.kind === 'campaign' ? 'Level ' + (idx + 1) + ' · ' : '') + L.title + ' · ' + L.era }),
    h('h1', { text: title }),
    failed ? h('p', { class: 'muted', text: fr.body }) : null,
    h('div', { class: 'bigstars' }, [0, 1, 2].map(i => { const el = starIcon(res.stars[i], 54); el.classList.add('s'); el.style.animationDelay = (0.2 + i * 0.25) + 's'; return el; })),
    objs,
    h('div', { class: 'statline' },
      h('div', null, h('b', { text: fmtInt(res.total) }), h('span', { text: 'Points' + (rec.newBest ? ' · new best' : '') })),
      h('div', null, h('b', { text: String(g.bestStreak) }), h('span', { text: 'Best streak' })),
      h('div', null, h('b', { text: String(res.avg) }), h('span', { text: 'Avg score' })),
      book ? h('div', null, h('b', { text: fmt(g.s.book, 1) }), h('span', { text: 'Book (cash: ' + fmt(g.cashBook, 1) + ')' })) : null,
      res.unassisted ? h('div', null, h('b', { text: '+15%' }), h('span', { text: 'No desk help' })) : null),
    strip, benchBox, xpBox, buttons, shareBox);

  const right = h('div', { style: 'display:flex;flex-direction:column;gap:16px;min-width:0' });
  if (L.lesson) right.appendChild(h('section', { class: 'panel lesson' }, h('div', { class: 'eyebrow', text: 'What you just learned' }), h('h3', { text: L.lesson.title }),
    h('ul', null, (L.lesson.points || []).map(p => h('li', { text: p }))), L.lesson.history ? h('p', { class: 'history', text: L.lesson.history }) : null,
    h('a', { class: 'tiny', href: '#model', onclick: e => { e.preventDefault(); go('model'); } }, 'How the model behind this level works')));
  if (rec.card) right.appendChild(h('div', { class: 'concept-card' }, h('div', { class: 'eyebrow', text: 'Concept card unlocked' }), h('b', { text: rec.card.term }), h('p', { class: 'small muted', text: rec.card.def })));
  if (L.quiz) right.appendChild(quizBox(L));
  if (book) right.appendChild(h('section', { class: 'panel lesson gl-cta' },
    h('div', { class: 'row', style: 'gap:10px' }, logo(28), h('div', { class: 'eyebrow', text: 'From the game to your own book' })),
    h('p', { class: 'small muted', text: 'Put sales, covered calls and protective puts are exactly what GammaLedger tracks for real portfolios: premium collected, assignment risk and your P&L over time. It runs locally in your browser, so your positions stay private.' }),
    h('a', { class: 'btn btn-ghost', href: CONFIG.shareUrl, target: '_blank', rel: 'noopener', style: 'align-self:flex-start' }, 'See GammaLedger')));
  if (rec.ach.length) right.appendChild(h('section', { class: 'panel lesson' }, h('div', { class: 'eyebrow', text: 'Achievements unlocked' }), rec.ach.map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return h('div', { class: 'ach' }, trophy(true), h('div', null, h('b', { text: a.name }), h('span', { text: a.desc + ' · +100 XP' }))); })));
  if (res.complete) right.appendChild(boardBox(boardIdOf(L), rec.entryAt, rec.verify));
  app.append(h('div', { class: 'wrap' }, h('div', { class: 'debrief' }, left, right)), footer());
  rec.ach.forEach((id, i) => setTimeout(() => { const a = ACHIEVEMENTS.find(x => x.id === id); toast('Achievement: ' + a.name, { ach: true, icon: trophy(true), ms: 4200 }); Sound.play('star'); }, 900 + i * 700));
}

function quizBox(L) {
  const q = L.quiz;
  const box = h('section', { class: 'panel lesson' }, h('div', { class: 'eyebrow', text: P.quiz[L.id] ? 'Quick quiz · answered' : 'Quick quiz · +40 XP' }), h('h3', { text: q.q }));
  const fb = h('p', { class: 'small', 'aria-live': 'polite' });
  const opts = h('div', { class: 'quiz-opts' });
  q.options.forEach((o, i) => opts.appendChild(h('button', { text: o, onclick: () => {
    opts.querySelectorAll('button').forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); });
    if (i === q.answer) {
      fb.textContent = 'Correct. ' + q.explain;
      if (!P.quiz[L.id]) { P.quiz[L.id] = true; P.xp += 40; const out = []; if (Object.keys(P.quiz).length >= 5) unlockAch('scholar', out); P.xp += out.length * 100; saveProfile(); renderTopbar(); toast('+40 XP'); if (out.length) toast('Achievement: Scholar', { ach: true, icon: trophy(true) }); }
      Sound.play('good');
    } else { opts.children[i].classList.add('wrong'); fb.textContent = 'Not quite. ' + q.explain; Sound.play('bad'); }
  } })));
  box.append(opts, fb);
  return box;
}

function boardBox(board, entryAt, verifyP) {
  const box = h('section', { class: 'panel lesson' }, h('div', { class: 'eyebrow', text: 'Leaderboard' }));
  const list = h('ol', { class: 'board' });
  const note = h('p', { class: 'tiny dim' });
  const status = h('p', { class: 'small', 'aria-live': 'polite' });
  const nameIn = h('input', { type: 'text', id: 'lbName', maxlength: 24, placeholder: 'Your name', value: P.name, 'aria-label': 'Your name on the leaderboard' });
  const draw = async () => {
    const r = await fetchBoard(board);
    list.replaceChildren(...(r.list.length ? r.list.slice(0, 10).map((e, i) => h('li', { class: e.at === entryAt ? 'me' : '' }, h('span', { class: 'num', text: '#' + (i + 1) }), h('span', { text: e.name || 'Anonymous' }), starsRow(e.stars || 0, 13), h('b', { class: 'num', text: fmtInt(e.pts) }))) : [h('li', null, h('span'), h('span', { class: 'dim', text: 'No scores yet' }))]));
    note.textContent = r.global ? 'Global leaderboard. Every score is re-played and checked by the server.' : 'Scores on this device. A global, server-checked board appears once the site connects its score server.';
  };
  if (verifyP && verifyP.then) verifyP.then(v => {
    if (!v) return;
    if (v.ok) { status.replaceChildren(h('span', { class: 'chip good', text: 'Verified by replay' + (v.rank ? ' · global rank #' + v.rank : '') })); draw(); }
    else if (v.error && v.error !== 'offline') status.replaceChildren(h('span', { class: 'chip bad', text: 'Not ranked: ' + v.error }));
  });
  box.append(h('div', { class: 'row', style: 'flex-wrap:nowrap' }, nameIn, h('button', { class: 'btn btn-quiet', text: 'Save', onclick: () => {
    P.name = nameIn.value.trim().slice(0, 24); saveProfile();
    const all = LS.get('boards', {}); (all[board] || []).forEach(e => { if (e.at === entryAt) e.name = P.name || 'Anonymous'; }); LS.set('boards', all);
    toast('Name saved. It is used for your next scores.'); draw();
  } })), status, list, note);
  draw();
  return box;
}

/* ---------- Profile ---------- */
function renderProfile(app, tab = 'career') {
  const rp = rankProgress(P.xp);
  const tabs = [['career', 'Career'], ['ach', 'Achievements'], ['cards', 'Concept cards'], ['boards', 'Leaderboards'], ['settings', 'Settings']];
  const body = h('div');
  const tabBar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label]) => h('button', { role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', text: label, onclick: () => go('profile', { tab: id }) })));
  if (tab === 'career') {
    body.append(h('div', { class: 'grid3', style: 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' },
      h('div', { class: 'card' }, h('h3', { text: 'Rank ladder' }), h('div', { class: 'ladder' }, RANKS.map((r, i) => h('div', { class: i === rp.i ? 'cur' : i > rp.i ? 'no' : '' }, rankBadge(i, 28), h('b', { text: r.name }), h('span', { class: 'num tiny dim', text: fmtInt(r.xp) + ' XP' }))))),
      h('div', { style: 'display:flex;flex-direction:column;gap:16px;min-width:0' },
        h('div', { class: 'card' }, h('h3', { text: 'Machine liquid' }), h('p', { class: 'small muted', text: 'Unlock new colours as you rise through the ranks.' }),
          h('div', { class: 'skins' }, SKINS.map(s => h('button', { class: 'skin', 'aria-pressed': P.skin === s.id ? 'true' : 'false', disabled: rp.i < s.rank, onclick: () => { P.skin = s.id; saveProfile(); applySkin(); go('profile', { tab: 'career' }); } },
            h('i', { style: 'background:linear-gradient(180deg,' + s.a + ',' + s.b + ')' }), h('span', { text: s.name }), h('span', { class: 'tiny dim', text: rp.i < s.rank ? 'Unlocks at ' + RANKS[s.rank].name : 'Unlocked' }))))),
        h('div', { class: 'card' }, h('h3', { text: 'Record' }), h('div', { class: 'statline' },
          h('div', null, h('b', { text: fmtInt(P.xp) }), h('span', { text: 'Total XP' })),
          h('div', null, h('b', { text: totalStars() + '/' + LEVELS.length * 3 }), h('span', { text: 'Campaign stars' })),
          h('div', null, h('b', { text: String(P.plays) }), h('span', { text: 'Levels played' })),
          h('div', null, h('b', { text: String(Object.keys(P.beatBot).length) }), h('span', { text: 'Benchmarks beaten' })),
          h('div', null, h('b', { text: String(P.endlessQ || 0) }), h('span', { text: 'Endless record' })))))));
  } else if (tab === 'ach') {
    body.append(h('div', { class: 'grid3' }, ACHIEVEMENTS.map(a => h('div', { class: 'ach' + (P.ach[a.id] ? '' : ' locked2') }, trophy(!!P.ach[a.id]), h('div', null, h('b', { text: a.name }), h('span', { text: a.desc }))))));
  } else if (tab === 'cards') {
    body.append(h('p', { class: 'muted', style: 'margin-bottom:14px', text: 'Finish a campaign level to collect its concept card.' }),
      h('div', { class: 'grid3' }, LEVELS.map((l, i) => P.cards[l.id] ? h('div', { class: 'concept-card' }, h('div', { class: 'eyebrow', text: 'Level ' + (i + 1) }), h('b', { text: CARDS[l.id].term }), h('p', { class: 'small muted', text: CARDS[l.id].def }))
        : h('div', { class: 'card', style: 'opacity:0.5' }, h('div', { class: 'eyebrow', text: 'Level ' + (i + 1) }), h('b', { text: 'Locked card' }), h('p', { class: 'small dim', text: 'Finish ' + l.title + ' to collect it.' })))));
  } else if (tab === 'boards') {
    const opts = [['endless', 'Endless'], ['daily-' + dateKey(), 'Today’s daily']].concat(LEVELS.map((l, i) => [l.id, 'Level ' + (i + 1) + ': ' + l.title]));
    const sel = h('select', { id: 'boardSel', 'aria-label': 'Choose a leaderboard' }, opts.map(([v, t]) => h('option', { value: v, text: t })));
    const holder = h('div');
    const show = () => holder.replaceChildren(boardBox(sel.value, null, null));
    sel.addEventListener('change', show);
    body.append(h('div', { style: 'max-width:640px;display:flex;flex-direction:column;gap:14px' }, sel, holder));
    show();
  } else if (tab === 'settings') {
    const nameIn = h('input', { type: 'text', id: 'setName', maxlength: 24, value: P.name, placeholder: 'Anonymous' });
    const confirmBox = h('div');
    body.append(h('div', { class: 'card', style: 'max-width:640px' },
      h('label', { class: 'f', for: 'setName' }, 'Name on leaderboards', nameIn),
      h('div', null, h('button', { class: 'btn btn-quiet', text: 'Save name', onclick: () => { P.name = nameIn.value.trim().slice(0, 24); saveProfile(); toast('Saved'); } })),
      h('hr', { style: 'border:0;border-top:1px solid var(--line);width:100%' }),
      h('p', { class: 'small muted', text: 'Progress is saved in this browser only. Clearing site data resets it.' }),
      h('div', null, h('button', { class: 'btn btn-danger', text: 'Reset all progress', onclick: () => {
        confirmBox.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'small', text: 'This deletes stars, XP, achievements, saved games and your levels. Sure?' }),
          h('button', { class: 'btn btn-danger', text: 'Yes, reset', onclick: () => { P = defaultProfile(); saveProfile(); LS.set('boards', {}); LS.set('mylevels', []); LS.set('imported', []); clearResume(); applySkin(); go('home'); toast('Progress reset'); } }),
          h('button', { class: 'btn btn-quiet', text: 'Cancel', onclick: () => confirmBox.replaceChildren() })));
      } })), confirmBox));
  }
  app.append(h('div', { class: 'wrap section' }, h('div', { class: 'section-head' }, h('div', { class: 'row', style: 'gap:14px' }, rankBadge(rp.i, 48), h('div', null, h('div', { class: 'eyebrow', text: fmtInt(P.xp) + ' XP' }), h('h2', { text: (P.name || 'Your') + (P.name ? ' · ' : ' profile · ') + rp.cur.name })))), tabBar, body), footer());
}

/* ---------- How the model works ---------- */
function renderModel(app) {
  const eq = (title, formula, text) => h('div', { class: 'eq' }, h('h3', { text: title }), h('pre', { class: 'formula' }, h('code', { text: formula })), h('p', { class: 'muted', text: text }));
  app.append(h('div', { class: 'wrap section model' },
    h('div', { class: 'eyebrow', text: 'Under the hood' }),
    h('h1', { class: 'model-title', text: 'How the model works' }),
    h('p', { class: 'lede-s', text: 'The machine runs a small quarterly model in the New Keynesian tradition: the same family of models taught in intermediate macroeconomics and used, in much larger form, by central banks. The structure follows the textbook. The coefficients were chosen to give realistic sizes and timings, then tuned for play. They are not estimated from data.' }),
    h('div', { class: 'eqs' },
      eq('1 · Demand (IS curve)', 'gap(t) = 0.76·gap(t−1) + 0.24·[fiscal − 2.1·monetary − fear drag + housing + exports] + 0.45·demand shocks\nmonetary = 0.65·smoothed real-rate gap (i − πᵉ − r*) + 0.35·real 10-year yield gap',
        'Higher real interest rates cut spending with a delay; the smoothing creates the "long and variable lags". Government spending and taxes shift demand, financial stress drags it down.'),
      eq('2 · Prices (Phillips curve)', 'π(t) = 0.5·πᵉ + 0.5·π(t−1) + 0.28·gap(t) + supply shocks + 0.1·depreciation',
        'The expectations-augmented Phillips curve of Friedman and Phelps: inflation rises when the economy runs above capacity and when people expect it to. Supply shocks raise prices directly.'),
      eq('3 · Expectations and credibility', 'πᵉ(t) = w·π* + (1 − w)·(0.55·π(t) + 0.45·πᵉ(t−1)),  w = 0.06 + 0.30·credibility',
        'A credible central bank anchors expectations to its target. Credibility grows when inflation is near target or falling, and is lost when you break promises or give in to political pressure.'),
      eq('4 · Jobs and growth', 'u(t) → u* − 0.5·gap(t)   (Okun’s law)\ngrowth (annualised) = potential + 4·Δgap',
        'Unemployment follows the output gap. Growth is the annualised quarter-on-quarter rate, so a recession is two quarters of negative growth.'),
      eq('5 · Interest rates and bonds', 'Taylor rule: i = r* + π + 0.5·(π − π*) + 0.5·gap\n10-year yield = 0.4·i + 0.6·(r* + πᵉ) + term premium',
        'The GammaLedger autopilot and the central bank in role-swap levels follow the Taylor rule (John Taylor, 1993). Long yields reflect expected future short rates plus a term premium that rises with debt above 90% of GDP and low credibility, and falls with quantitative easing.'),
      eq('6 · Fiscal policy and debt', 'spending multiplier ≈ 1.4 near the zero lower bound or in a slump, 0.85 otherwise (25% lower above 120% debt)\ntax multiplier 0.55 · debt(t) = debt(t−1) + deficit/4 − debt × nominal growth/400',
        'Multipliers are larger when monetary policy cannot offset them. Automatic stabilisers widen the deficit in downturns. Debt dynamics follow the standard identity: interest, primary deficit and nominal growth.'),
      eq('7 · Finance', 'housing: grows when real rates sit below neutral, with price momentum\nbanks: lose value when long yields rise (duration risk)\nlender of last resort: cuts panic now, adds moral hazard later',
        'Macroprudential rules lean on credit directly. Emergency lending follows Bagehot: lend freely against good collateral. Its cost is more risk-taking later, not inflation.'),
      eq('8 · Open economy', 'currency change ≈ 1.3 × (domestic real-rate gap − rate rises abroad − risk premium)\ninflation += 0.1 × depreciation',
        'A simplified uncovered-interest-parity relationship. Higher rates attract capital; risk premia and rising foreign rates push the currency down; a weaker currency raises import prices and helps exports.'),
      eq('9 · Markets and options', 'stock return = 1.5% + 1.5·Δgap − 6.5·Δ(10-year yield) − 0.25·Δfear + noise\nimplied volatility = 6 + 0.6 × fear index\noptions: Black–Scholes, three months, 5% out of the money',
        'Earnings follow the economy and valuations fall when yields rise. Implied volatility usually sits above the volatility that follows, the variance risk premium, so selling options pays on average and loses in crashes.')),
    h('section', { class: 'panel lesson', style: 'margin-top:24px' }, h('h3', { text: 'What the model leaves out' }),
      h('ul', null, ['Wages, inventories and productivity growth are not modelled separately', 'Shocks are scripted per level, so every player faces the same history',
        'There is one representative bank and one stock index', 'Coefficients are calibrated for plausible sizes, not estimated for any one country',
        'Small random noise keeps every quarter from being perfectly predictable'].map(t => h('li', { text: t })))),
    h('section', { class: 'panel lesson', style: 'margin-top:16px' }, h('h3', { text: 'Further reading' }),
      h('ul', null, ['Taylor, J. B. (1993). Discretion versus policy rules in practice. Carnegie-Rochester Conference Series on Public Policy',
        'Friedman, M. (1968). The role of monetary policy. American Economic Review', 'Phelps, E. S. (1967). Phillips curves, expectations of inflation and optimal unemployment over time. Economica',
        'Okun, A. M. (1962). Potential GNP: its measurement and significance', 'Galí, J. (2015). Monetary Policy, Inflation, and the Business Cycle. Princeton University Press',
        'Auerbach, A. and Gorodnichenko, Y. (2012). Measuring the output responses to fiscal policy. AEJ: Economic Policy',
        'Bagehot, W. (1873). Lombard Street', 'Obstfeld, M., Shambaugh, J. and Taylor, A. (2005). The trilemma in history. Review of Economics and Statistics',
        'Black, F. and Scholes, M. (1973). The pricing of options and corporate liabilities. Journal of Political Economy'].map(t => h('li', { text: t })))),
    h('div', { class: 'row', style: 'margin-top:20px' }, h('button', { class: 'btn btn-primary', text: 'Back to the game', onclick: () => go('home') }))), footer());
}

/* ---------- Community ---------- */
function renderCommunity(app) {
  const mine = LS.get('mylevels', []), imported = LS.get('imported', []);
  const body = h('div');
  const card = (L, kind) => {
    const st = P.stars[L.id] || 0;
    return h('div', { class: 'card lvlcard' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'eyebrow', text: L.era + ' · ' + L.quarters + ' quarters' }), starsRow(st, 14)),
      h('h3', { text: L.title }),
      h('p', { class: 'small muted', text: L.brief }),
      h('div', { class: 'meta' }, h('span', { class: 'chip violet', text: L.concept }), h('span', { class: 'chip', text: 'by ' + (L.author || 'A player') })),
      h('div', { class: 'spacer' }),
      h('div', { class: 'row', style: 'gap:8px' },
        h('button', { class: 'btn btn-primary', text: 'Play', onclick: () => openBriefing(L, kind === 'sample' ? 'custom' : 'custom') }),
        h('button', { class: 'btn btn-quiet', text: 'Copy code', onclick: () => copyText(encodeLevel(L)) }),
        kind === 'mine' ? h('button', { class: 'btn btn-quiet', text: 'Edit', onclick: () => go('editor', { level: L }) }) : null,
        kind === 'mine' || kind === 'imported' ? h('button', { class: 'btn btn-danger', text: 'Remove', onclick: e => {
          const b = e.currentTarget;
          if (b.dataset.armed) { const key = kind === 'mine' ? 'mylevels' : 'imported'; LS.set(key, LS.get(key, []).filter(x => (x.localId || x.id) !== (L.localId || L.id))); go('community'); toast('Removed'); }
          else { b.dataset.armed = '1'; b.textContent = 'Click again to remove'; }
        } }) : null,
        kind === 'mine' && Backend && Backend.publishLevel ? h('button', { class: 'btn btn-ghost', text: 'Publish', onclick: async () => { try { await Backend.publishLevel(encodeLevel(L), L.author); toast('Published for everyone'); } catch (err) { toast('Publishing failed. Try again later.'); } } }) : null));
  };
  const codeIn = h('textarea', { id: 'importCode', rows: 3, placeholder: 'Paste a level code (starts with AFL1.)', 'aria-label': 'Level code' });
  const importBox = h('div', { class: 'card', style: 'max-width:760px' }, h('h3', { text: 'Got a level code from a friend?' }), codeIn,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', text: 'Import and play', onclick: () => {
      const L = decodeLevel(codeIn.value);
      if (!L) { toast('That code could not be read. Check you copied all of it.'); return; }
      saveImported(L); go('community'); openBriefing(L, 'custom');
    } }), h('button', { class: 'btn btn-quiet', text: 'Build your own', onclick: () => go('editor') })));
  const section = (title, list, kind, empty) => h('section', { class: 'section', style: 'padding-top:6px' }, h('div', { class: 'section-head' }, h('h2', { text: title })),
    list.length ? h('div', { class: 'grid3' }, list.map(L => card(L, kind))) : h('p', { class: 'muted', text: empty }));
  body.append(importBox,
    section('Your levels', mine, 'mine', 'You have not built a level yet. Open the level editor to design an economy and share it.'),
    section('Imported levels', imported, 'imported', 'Levels you import from codes or links appear here.'),
    section('Example levels', SAMPLE_COMMUNITY, 'sample', ''));
  const online = h('div');
  if (Backend && Backend.listLevels) {
    Backend.listLevels().then(list => { const clean = (list || []).map(x => decodeLevel(x.code)).filter(Boolean); if (clean.length) online.replaceChildren(section('Published by players', clean, 'imported', '')); }).catch(() => {});
  }
  app.append(h('div', { class: 'wrap section' }, h('div', { class: 'section-head' }, h('div', null, h('div', { class: 'eyebrow', text: 'Community' }), h('h2', { text: 'Levels made by players' }))), online, body), footer());
}
function saveImported(L) {
  const list = LS.get('imported', []).filter(x => x.id !== L.id);
  list.unshift(L); LS.set('imported', list.slice(0, 40));
}
function shareLink(L) { return location.href.split('#')[0] + '#lvl.' + encodeLevel(L); }

/* ---------- Editor ---------- */
function defaultDraft() {
  return { title: 'My economy', concept: 'Your big idea', era: '2030', author: P.name || '', start: { year: 2030, q: 1 }, quarters: 8,
    tools: ['rate', 'guidance', 'spend', 'tax'], pp: 2, features: { bubble: false, banks: false, fx: false }, params: { rN: 0.5, target: 2, uStar: 4.5 },
    state: { rate: 2.5, infl: 3.5, expInfl: 2.6, gap: 1.0, unemp: 4.0, debt: 90, stress: 20, approval: 50, cred: 65 },
    targets: { infl: [1, 3], unempMax: 6, growthMin: 0, stressMax: 40, debtMax: 120, approvalMin: 35 },
    events: [{ q: 2, id: 'oil_spike' }, { q: 4, id: 'pres_pressure' }], random: 0,
    objective: { type: 'end', metric: 'infl', op: '<=', value: 3 }, twoStar: 75,
    brief: 'Describe the situation the player walks into.', goal: 'Keep every tank in its safe zone.',
    lesson: { title: 'The lesson', points: ['What should the player take away?'], history: '' } };
}
function renderEditor(app, arg) {
  let D = arg && arg.level ? JSON.parse(JSON.stringify(arg.level)) : LS.get('draft', null) || defaultDraft();
  D.targets = D.targets || {}; D.state = D.state || {}; D.params = D.params || { rN: 0.5, target: 2, uStar: 4.5 }; D.features = D.features || {}; D.lesson = D.lesson || { title: '', points: [], history: '' };
  if (!D.targets.infl) D.targets.infl = [1, 3];
  if (!Array.isArray(D.lesson.points)) D.lesson.points = [];
  if (!Array.isArray(D.events)) D.events = [];
  if (!Array.isArray(D.tools)) D.tools = ['rate'];
  if (!D.objective) D.objective = { type: 'noRecession' };
  const saveDraft = debounce(() => LS.set('draft', D), 400);
  const preview = h('div', { class: 'preview' });
  const refresh = debounce(() => { drawPreview(); saveDraft(); }, 250);
  const set = (path, v) => { const ks = path.split('.'); let o = D; ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = v; refresh(); };
  const getv = path => path.split('.').reduce((o, k) => o && o[k], D);
  const text = (label, path, opts = {}) => { const v = getv(path); const id = 'ed-' + path.replace(/\./g, '-');
    const el = opts.area ? h('textarea', { id, rows: opts.rows || 3, maxlength: opts.max || 400 }) : h('input', { type: 'text', id, maxlength: opts.max || 80 });
    el.value = v == null ? '' : v; el.addEventListener('input', () => set(path, el.value));
    return h('label', { class: 'f', for: id }, label, el); };
  const range = (label, path, min, max, stepv, dec) => { const v = getv(path); const id = 'ed-' + path.replace(/\./g, '-');
    const out = h('output', { for: id, text: v == null ? '—' : fmt(v, dec) });
    const el = h('input', { type: 'range', id, min, max, step: stepv, value: v == null ? (min + max) / 2 : v });
    el.addEventListener('input', () => { const n = +el.value; out.textContent = fmt(n, dec); set(path, n); });
    return h('div', { class: 'rng' }, h('div', null, h('label', { for: id, text: label }), out), el); };
  const numIn = (label, path, min, max, stepv) => { const v = getv(path); const id = 'ed-' + path.replace(/\./g, '-');
    const el = h('input', { type: 'number', id, min, max, step: stepv, value: v == null ? '' : v });
    el.addEventListener('input', () => { if (el.value === '') return; set(path, clamp(+el.value, min, max)); });
    return h('label', { class: 'f', for: id }, label, el); };

  const toolChecks = h('div', { class: 'checks' }, TOOL_ORDER.filter(t => t !== 'trade').map(t => { const id = 'tool-' + t; const cb = h('input', { type: 'checkbox', id, checked: D.tools.includes(t) });
    cb.addEventListener('change', () => { D.tools = TOOL_ORDER.filter(x => x === t ? cb.checked : D.tools.includes(x)); if (!D.tools.length) D.tools = ['rate']; refresh(); });
    return h('label', { for: id }, cb, TOOLS[t].name); }));
  const featChecks = h('div', { class: 'checks' }, [['bubble', 'Housing bubble'], ['banks', 'Fragile banks'], ['fx', 'Currency & capital flows']].map(([f, n]) => { const id = 'feat-' + f; const cb = h('input', { type: 'checkbox', id, checked: !!D.features[f] });
    cb.addEventListener('change', () => { D.features[f] = cb.checked; LS.set('draft', D); go('editor', { level: D }); });
    return h('label', { for: id }, cb, n); }));

  const evList = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
  const evOptions = () => {
    const ok = k => k !== 'bubble_pop' && EVENTS[k].tag !== 'Briefing';
    const news = Object.keys(EVENTS).filter(k => EVENTS[k].kind === 'news' && ok(k)), dil = Object.keys(EVENTS).filter(k => EVENTS[k].kind === 'dilemma'), info = Object.keys(EVENTS).filter(k => EVENTS[k].kind === 'info' && ok(k));
    return [h('optgroup', { label: 'News shocks' }, news.map(k => h('option', { value: k, text: EVENTS[k].headline }))), h('optgroup', { label: 'Decisions' }, dil.map(k => h('option', { value: k, text: EVENTS[k].headline }))), h('optgroup', { label: 'Hints and info' }, info.map(k => h('option', { value: k, text: EVENTS[k].headline })))];
  };
  const drawEvents = () => {
    evList.replaceChildren(...D.events.map((e, i) => {
      const qs = h('select', { 'aria-label': 'Quarter for event ' + (i + 1) }, Array.from({ length: D.quarters }, (_, k) => h('option', { value: k + 1, text: 'Q' + (k + 1) })));
      qs.value = Math.min(e.q, D.quarters); qs.addEventListener('change', () => { e.q = +qs.value; refresh(); });
      const es = h('select', { 'aria-label': 'Event ' + (i + 1) }, evOptions()); es.value = e.id; es.addEventListener('change', () => { e.id = es.value; refresh(); });
      const hl = h('input', { type: 'text', class: 'evh', maxlength: 120, placeholder: 'Custom headline (optional)', 'aria-label': 'Custom headline for event ' + (i + 1), value: e.headline || '' });
      hl.addEventListener('input', () => { e.headline = hl.value; refresh(); });
      return h('div', { class: 'evrow' }, qs, es, hl, h('button', { class: 'icon-btn', 'aria-label': 'Remove event ' + (i + 1), onclick: () => { D.events.splice(i, 1); drawEvents(); refresh(); } }, '×'));
    }));
  };
  drawEvents();

  const objType = h('select', { id: 'objType' }, [['end', 'Value at the end'], ['always', 'Value every quarter'], ['noRecession', 'Avoid a recession'], ['streak', 'Streak of green quarters']].map(([v, t]) => h('option', { value: v, text: t })));
  objType.value = D.objective.type;
  const objMetric = h('select', { id: 'objMetric', 'aria-label': 'Metric' }, OBJ_METRICS.map(m => h('option', { value: m, text: METRICS[m].name })));
  objMetric.value = D.objective.metric || 'infl';
  const objOp = h('select', { id: 'objOp', 'aria-label': 'Comparison' }, [['<=', 'at or below'], ['>=', 'at or above'], ['<', 'below'], ['>', 'above']].map(([v, t]) => h('option', { value: v, text: t })));
  objOp.value = D.objective.op || '<=';
  const objVal = h('input', { type: 'number', id: 'objVal', step: 0.1, value: D.objective.value != null ? D.objective.value : 3, 'aria-label': 'Value' });
  const lockObj = () => { const t = objType.value; objMetric.disabled = objOp.disabled = !(t === 'end' || t === 'always'); objVal.disabled = t === 'noRecession'; };
  const syncObj = () => { D.objective = { type: objType.value, metric: objMetric.value, op: objOp.value, value: +objVal.value || 0 }; lockObj(); refresh(); };
  [objType, objMetric, objOp, objVal].forEach(el => el.addEventListener('change', syncObj));
  objVal.addEventListener('input', syncObj);
  lockObj();

  const F = D.features;
  const form = h('div', null,
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'The story' }),
      h('div', { class: 'fgrid' }, text('Level name', 'title', { max: 60 }), text('Big idea it teaches', 'concept', { max: 80 }), text('Era label', 'era', { max: 20 }), text('Your name', 'author', { max: 32 })),
      text('Briefing', 'brief', { area: true, max: 500 }), text('Goal (one line)', 'goal', { max: 160 }),
      h('div', { class: 'fgrid' }, numIn('Start year', 'start.year', 1, 3000, 1), numIn('Start quarter', 'start.q', 1, 4, 1), range('Quarters', 'quarters', 4, 16, 1, 0))),
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'Starting economy' }),
      h('div', { class: 'fgrid' }, range('Policy rate %', 'state.rate', 0, 20, 0.25, 2), range('Inflation %', 'state.infl', -3, 15, 0.1, 1), range('Expected inflation %', 'state.expInfl', -2, 12, 0.1, 1),
        range('Output gap %', 'state.gap', -8, 6, 0.1, 1), range('Unemployment %', 'state.unemp', 2, 15, 0.1, 1), range('Public debt % GDP', 'state.debt', 5, 200, 1, 0),
        range('Market fear', 'state.stress', 5, 80, 1, 0), range('Public trust %', 'state.approval', 15, 85, 1, 0), range('Credibility', 'state.cred', 5, 95, 1, 0),
        F.bubble ? range('Housing bubble', 'state.bubble', 0, 90, 1, 0) : null, F.banks ? range('Bank health', 'state.bank', 15, 100, 1, 0) : null,
        F.fx ? range('Currency', 'state.fx', 60, 130, 1, 0) : null, F.fx ? range('FX reserves $bn', 'state.reserves', 0, 60, 1, 0) : null),
      h('div', { class: 'fgrid' }, range('Neutral real rate %', 'params.rN', -1, 4, 0.25, 2), range('Inflation target %', 'params.target', 0, 8, 0.5, 1), range('Natural unemployment %', 'params.uStar', 2, 12, 0.5, 1))),
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'Tools and mechanics' }), toolChecks, featChecks, range('Policy capital per quarter', 'pp', 1, 3, 1, 0)),
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'Safe zones' }),
      h('div', { class: 'fgrid' }, numIn('Inflation low %', 'targets.infl.0', -2, 10, 0.5), numIn('Inflation high %', 'targets.infl.1', -1, 12, 0.5),
        numIn('Max unemployment %', 'targets.unempMax', 3, 12, 0.5), numIn('Min growth %', 'targets.growthMin', -4, 2, 0.5), numIn('Max market fear', 'targets.stressMax', 20, 80, 1),
        numIn('Max debt % GDP', 'targets.debtMax', 30, 200, 1), numIn('Min public trust', 'targets.approvalMin', 10, 60, 1),
        F.bubble ? numIn('Max bubble', 'targets.bubbleMax', 30, 95, 1) : null, F.banks ? numIn('Min bank health', 'targets.bankMin', 10, 70, 1) : null, F.fx ? numIn('Min currency', 'targets.fxMin', 50, 100, 1) : null)),
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'Events timeline' }), evList,
      h('div', { class: 'row' }, h('button', { class: 'btn btn-quiet', text: 'Add event', onclick: () => { D.events.push({ q: Math.min(D.quarters, (D.events[D.events.length - 1] || { q: 1 }).q + 1), id: 'consumer_boom' }); drawEvents(); refresh(); } })),
      range('Chance of a surprise event each quarter', 'random', 0, 0.6, 0.05, 2)),
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'Stars' }),
      range('Average score for the 2nd star', 'twoStar', 40, 95, 1, 0),
      h('label', { class: 'f', for: 'objType' }, 'Third star objective', objType), h('div', { class: 'fgrid' }, objMetric, objOp, objVal)),
    h('fieldset', { class: 'fieldset' }, h('legend', { text: 'The lesson' }), text('Lesson title', 'lesson.title', { max: 80 }),
      text('Key point 1', 'lesson.points.0', { max: 240 }), text('Key point 2', 'lesson.points.1', { max: 240 }), text('Key point 3', 'lesson.points.2', { max: 240 }),
      text('History note (optional)', 'lesson.history', { area: true, max: 400 })));

  function drawPreview() {
    const L = sanitizeLevel(D);
    if (!L) return;
    const b = benchmarks(L);
    const diff = !b ? '' : b.taylor.avg >= 85 ? 'Gentle' : b.taylor.avg >= 70 ? 'Fair' : b.taylor.avg >= 50 ? 'Tough' : 'Brutal';
    preview.replaceChildren(
      h('div', { class: 'card' }, h('div', { class: 'eyebrow', text: 'Preview · ' + L.era }), h('h3', { text: L.title }), h('span', { class: 'chip violet', style: 'align-self:flex-start', text: L.concept }), h('p', { class: 'small muted', text: L.brief }),
        h('ul', { class: 'objlist' }, objectiveLines(L).map(t => h('li', null, starIcon(false, 18), h('span', { class: 'small', text: t })))),
        h('div', { class: 'row', style: 'gap:6px' }, L.tools.map(t => h('span', { class: 'chip', text: TOOLS[t].name })))),
      b ? h('div', { class: 'card' }, h('h3', { text: 'Difficulty: ' + diff }), h('p', { class: 'small muted', text: 'We play your level with two robots so you can tune it.' }),
        h('div', { class: 'statline' }, h('div', null, h('b', { text: b.taylor.starCount + '★ · ' + b.taylor.avg }), h('span', { text: 'GammaLedger autopilot' })), h('div', null, h('b', { text: b.hold.starCount + '★ · ' + b.hold.avg }), h('span', { text: 'Doing nothing' }))),
        h('p', { class: 'tiny dim', text: 'A good level: doing nothing fails or scores low, the autopilot earns 1–2 stars, and smart play earns 3.' })) : null,
      h('div', { class: 'card' },
        h('button', { class: 'btn btn-primary', text: 'Playtest', onclick: () => openBriefing(L, 'custom') }),
        h('button', { class: 'btn btn-ghost', text: D.localId ? 'Save changes' : 'Save to my levels', onclick: () => {
          if (!D.localId) D.localId = 'my_' + Date.now().toString(36);
          const saved = sanitizeLevel(D); saved.localId = D.localId;
          const list = LS.get('mylevels', []).filter(x => x.localId !== saved.localId); list.unshift(saved); LS.set('mylevels', list);
          const out = []; unlockAch('architect', out); if (out.length) { P.xp += 100; toast('Achievement: Architect', { ach: true, icon: trophy(true) }); }
          P.created++; saveProfile(); renderTopbar(); LS.set('draft', D); toast('Saved to your levels'); drawPreview();
        } }),
        h('button', { class: 'btn btn-quiet', text: 'Copy level code', onclick: () => copyText(encodeLevel(D)) }),
        h('button', { class: 'btn btn-quiet', text: 'Copy share link', onclick: () => copyText(shareLink(D)) }),
        h('p', { class: 'tiny dim', text: 'Anyone who opens the link or pastes the code in Community can play your level.' }),
        h('div', { class: 'row', style: 'gap:8px' },
          h('button', { class: 'btn btn-quiet', text: 'Start fresh', onclick: () => { LS.set('draft', defaultDraft()); go('editor'); } }),
          h('button', { class: 'btn btn-quiet', text: 'Remix Level 1', onclick: () => { const c = JSON.parse(JSON.stringify(LEVELS[0])); delete c.id; c.title = 'Turn the Tap (remix)'; c.author = P.name; LS.set('draft', c); go('editor'); } }))));
  }
  drawPreview();
  app.append(h('div', { class: 'wrap section' }, h('div', { class: 'section-head' }, h('div', null, h('div', { class: 'eyebrow', text: 'Level editor' }), h('h2', { text: 'Design an economy, then challenge your friends' }))),
    h('div', { class: 'editor' }, form, preview)), footer());
}

/* ---------- Boot ---------- */
function handleHash() {
  const raw = location.hash.slice(1);
  if (raw.startsWith('lvl.')) {
    const L = decodeLevel(raw.slice(4));
    if (L) { saveImported(L); go('community'); openBriefing(L, 'custom'); return true; }
  }
  if (raw === 'daily' || raw === 'endless') { go('home'); navTo(raw); return true; }
  if (['community', 'editor', 'profile', 'model'].includes(raw)) { go(raw); return true; }
  return false;
}
function boot() {
  applySkin();
  if (handleHash()) return;
  go('home');
  const r = loadResume();
  if (r) {
    const m = openModal([h('div', { class: 'eyebrow', text: 'Welcome back' }), h('h2', { text: 'Pick up where you left off?' }),
      h('p', { class: 'muted', text: r.title + ', ' + r.when + '.' }),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', text: 'Resume', onclick: () => { m.close(); resumeGame(r); } }),
        h('button', { class: 'btn btn-quiet', text: 'Not now', onclick: () => m.close() }))], { dismissible: true, label: 'Resume game' });
  }
}
boot();
