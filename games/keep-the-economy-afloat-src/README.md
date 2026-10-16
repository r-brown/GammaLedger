# Keep the Economy Afloat: source

- `content.js`: levels, events, tools, ranks, achievements, concept cards (the level format is documented at the bottom)
- `engine.js`: the macro model, scoring, option pricing, benchmark bots and replay
- `shared.js`: level codes, the daily challenge generator and score verification (used by the game and the server)
- `analytics.js`: `track()`, anonymous gameplay statistics (endpoint and game version at the top of the file). Not part of the server core. Test with `node --test analytics.test.mjs`; see more below
- `app1.js` to `app3.js`: the interface
- `head.html`: title, fonts and styles
- `build.sh`: builds `dist/moniac-game.html` (one self-contained file) and `server/afloat-core.mjs`
- `server/`: the score-verification server. See `server/README.md`

Set `CONFIG.shareUrl` and, once the server is live, `CONFIG.apiBase` at the top of `content.js`, then run `./build.sh`.

## Gameplay analytics

`analytics.js` sends a few anonymous events per game (`game.started`, `game.round.completed`, `game.action`, `game.ended`) to a Lambda endpoint, keyed by a random per-tab id (`sessionStorage["gl.sid"]`). The endpoint only accepts the `https://gammaledger.com` origin, so locally the requests fail with a harmless CORS error. To see the events instead, open the game with `?audit-debug=1` (or set `ANALYTICS_CONFIG.debug`): each event is printed with `console.table` and nothing is sent. Nothing is sent when the browser has Do Not Track on. The game calls `track()` from `app2.js` (see the `trackAction`/`trackEnded` helpers) and `app1.js` (`confirmLeave`).
