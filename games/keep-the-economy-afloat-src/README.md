# Keep the Economy Afloat: source

- `content.js`: levels, events, tools, ranks, achievements, concept cards (the level format is documented at the bottom)
- `engine.js`: the macro model, scoring, option pricing, benchmark bots and replay
- `shared.js`: level codes, the daily challenge generator and score verification (used by the game and the server)
- `app1.js` to `app3.js`: the interface
- `head.html`: title, fonts and styles
- `build.sh`: builds `dist/moniac-game.html` (one self-contained file) and `server/afloat-core.mjs`
- `server/`: the score-verification server. See `server/README.md`

Set `CONFIG.shareUrl` and, once the server is live, `CONFIG.apiBase` at the top of `content.js`, then run `./build.sh`.
