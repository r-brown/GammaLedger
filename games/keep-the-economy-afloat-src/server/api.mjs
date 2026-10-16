/* Platform-neutral API. Every score is re-played with the game's own engine
   before it is stored, so the client cannot simply claim a score. */
import { verifySubmission, decodeLevel, encodeLevel } from './afloat-core.mjs';

const BOARD_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_BODY = 256 * 1024;
const BOARD_SIZE = 100;
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};
const json = (status, body) => ({ status, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(body) });
const cleanName = n => (typeof n === 'string' ? n : '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Anonymous';

/**
 * @param {{method:string, path:string, query:URLSearchParams, rawBody?:string}} req
 * @param {{getBoard(id):Promise<any[]>, putBoard(id, list):Promise<void>, getLevels():Promise<any[]>, putLevels(list):Promise<void>}} store
 */
export async function handleApi(req, store, opts = {}) {
  const now = opts.now || Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (req.method === 'OPTIONS') return { status: 204, headers: cors, body: '' };
  const path = req.path.replace(/\/+$/, '') || '/';
  let body = null;
  if (req.method === 'POST') {
    if (!req.rawBody || req.rawBody.length > MAX_BODY) return json(413, { ok: false, error: 'Body missing or too large' });
    try { body = JSON.parse(req.rawBody); } catch (e) { return json(400, { ok: false, error: 'Invalid JSON' }); }
  }

  if (path.endsWith('/scores') && req.method === 'GET') {
    const board = req.query.get('board') || '';
    if (!BOARD_RE.test(board)) return json(400, { ok: false, error: 'Bad board id' });
    const limit = Math.max(1, Math.min(50, parseInt(req.query.get('limit') || '10', 10) || 10));
    const list = await store.getBoard(board);
    return json(200, { ok: true, scores: list.slice(0, limit) });
  }

  if (path.endsWith('/scores') && req.method === 'POST') {
    const v = verifySubmission(body, { today });
    if (!v.ok) return json(400, v);
    const entry = { name: cleanName(body.name), pts: v.pts, stars: v.stars, q: v.quarters, at: now };
    const list = (await store.getBoard(v.board)).concat([entry]).sort((a, b) => b.pts - a.pts || a.at - b.at).slice(0, BOARD_SIZE);
    await store.putBoard(v.board, list);
    const idx = list.indexOf(entry);
    return json(200, { ok: true, board: v.board, pts: v.pts, stars: v.stars, rank: idx >= 0 ? idx + 1 : null, matchesClaim: v.matchesClaim });
  }

  if (path.endsWith('/levels') && req.method === 'GET') {
    return json(200, { ok: true, levels: (await store.getLevels()).slice(0, 50) });
  }

  if (path.endsWith('/levels') && req.method === 'POST') {
    const L = decodeLevel(body && body.code);
    if (!L) return json(400, { ok: false, error: 'Level code could not be read' });
    const entry = { id: L.id, code: encodeLevel(L), title: L.title, author: cleanName(body.author || L.author), at: now };
    const list = [entry].concat((await store.getLevels()).filter(x => x.id !== L.id)).slice(0, 200);
    await store.putLevels(list);
    return json(200, { ok: true, id: L.id });
  }

  return json(404, { ok: false, error: 'Not found' });
}

/* In-memory store for local testing */
export function memoryStore() {
  const boards = new Map(); let levels = [];
  return {
    getBoard: async id => boards.get(id) || [],
    putBoard: async (id, list) => { boards.set(id, list); },
    getLevels: async () => levels,
    putLevels: async list => { levels = list; }
  };
}
