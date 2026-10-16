# Keep the Economy Afloat: score server

A small API that keeps global leaderboards honest. The game never sends just a score. It sends the **move log**: which level, every quarter's rate move and tools, and every decision-card choice. The server re-plays that log with the game's own engine (`afloat-core.mjs`) and stores the score *it* computes. A player who edits the request can only submit a different game, never a fake score.

## Files

| File | What it is |
|---|---|
| `afloat-core.mjs` | Generated from the game sources (`content.js`, `engine.js`, `shared.js`) by `build.sh`. Do not edit by hand |
| `api.mjs` | Platform-neutral request handler: `GET/POST /scores`, `GET/POST /levels` |
| `worker.mjs` + `wrangler.toml` | Cloudflare Workers adapter (KV storage) |
| `lambda.mjs` | AWS Lambda adapter (API Gateway HTTP API + DynamoDB) |
| `test.mjs` | Local tests: replay determinism, cheating attempts, API round trip |

Run the tests with `node test.mjs` (Node 18 or newer).

## API

| Call | Body or query | Returns |
|---|---|---|
| `POST /scores` | `{ v: 1, name, level: { kind, id \| key \| code }, actions: [{ r, t }], choices: [{ q, id, c }], retired, claimed }` | `{ ok, board, pts, stars, rank }` or `400 { ok: false, error }` |
| `GET /scores?board=L5&limit=10` | | `{ ok, scores: [{ name, pts, stars, q, at }] }` |
| `POST /levels` | `{ code: "AFL1.…", author }` | `{ ok, id }` |
| `GET /levels` | | `{ ok, levels: [{ id, code, title, author, at }] }` |

Board ids: campaign levels use their id (`L1`…`L18`), the daily challenge uses `daily-YYYY-MM-DD`, endless mode uses `endless`, and player-made levels use `U_<content hash>`.

What the server rejects:
- Unfinished or failed runs
- Logs with a missing decision-card choice
- Daily challenges more than a day away from the server's date
- Bodies over 256 KB

Tools a level doesn't allow, or moves over the policy-capital budget, are stripped by the engine during replay. The client's claimed score is only compared with the server's for monitoring (`matchesClaim`).

## Deploy on Cloudflare Workers

1. `npm i -g wrangler` and `wrangler login`
2. `wrangler kv namespace create AFLOAT_KV` and paste the id into `wrangler.toml`
3. `wrangler deploy`
4. In the game's `content.js`, set `CONFIG.apiBase` to the worker URL, for example `https://afloat-scores.<you>.workers.dev`, then run `build.sh`

KV is eventually consistent. Two scores landing in the same second on the same board can overwrite each other's list update. That's fine for a game; for strict guarantees use D1 or a Durable Object behind the same `store` interface.

## Deploy on AWS (Lambda + API Gateway + DynamoDB)

1. Create a DynamoDB table with partition key `pk` (String), on-demand capacity
2. Create a Lambda function, Node.js 20.x. Upload a zip containing `lambda.mjs`, `api.mjs` and `afloat-core.mjs`. Set the handler to `lambda.handler` and the environment variable `TABLE_NAME`
3. Give the Lambda role `dynamodb:GetItem` and `dynamodb:PutItem` on the table
4. Create an HTTP API in API Gateway with routes `GET /scores`, `POST /scores`, `GET /levels`, `POST /levels` and `OPTIONS /{proxy+}`, all integrated with the Lambda
5. Set `CONFIG.apiBase` to the API's invoke URL and run `build.sh`

The handler sends permissive CORS headers (`*`). Restrict `access-control-allow-origin` in `api.mjs` to your site's origin once it's live.

## Keeping game and server in sync

The server must run the same engine and level content as the game, or replays will produce different scores. After you change levels or the engine:

1. Run `build.sh`. It regenerates both `dist/moniac-game.html` and `server/afloat-core.mjs`
2. Deploy the server first, then the game

Different browsers can differ in the last digit of `Math.exp` and `Math.log` (used only for option pricing). The server always stores its own result, and `matchesClaim` allows a 2% tolerance, so this never blocks an honest player.

## Recommended extras

- **Rate limiting:** a per-IP limit at the edge, for example Cloudflare rate-limiting rules or an API Gateway usage plan
- **Name moderation:** names are stripped of control characters and angle brackets, and capped at 24 characters. Add a word filter if you need one
