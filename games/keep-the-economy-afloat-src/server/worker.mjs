/* Cloudflare Worker adapter. Bind a KV namespace as AFLOAT_KV (see wrangler.toml).
   KV is eventually consistent: fine for a game leaderboard. For strict ordering
   under heavy write load, swap the store for D1 or a Durable Object. */
import { handleApi } from './api.mjs';

function kvStore(kv) {
  return {
    getBoard: async id => (await kv.get('board:' + id, 'json')) || [],
    putBoard: (id, list) => kv.put('board:' + id, JSON.stringify(list)),
    getLevels: async () => (await kv.get('levels', 'json')) || [],
    putLevels: list => kv.put('levels', JSON.stringify(list))
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const rawBody = request.method === 'POST' ? await request.text() : undefined;
    const res = await handleApi({ method: request.method, path: url.pathname, query: url.searchParams, rawBody }, kvStore(env.AFLOAT_KV));
    return new Response(res.body, { status: res.status, headers: res.headers });
  }
};
