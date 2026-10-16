#!/bin/sh
set -e
cd "$(dirname "$0")"
mkdir -p dist
{ cat head.html; printf '%s\n' '<div class="glow" aria-hidden="true"></div>' '<header id="topbar" class="topbar"></header>' '<main id="app"><noscript><h1>Keep the Economy Afloat</h1><p>A free macroeconomics game inspired by the MONIAC water computer. Set interest rates, keep inflation, jobs and markets in the safe zone. Enable JavaScript to play. From <a href="https://gammaledger.com/">GammaLedger</a>, the private options trading journal.</p></noscript></main>' '<div id="modal-root"></div>' '<div id="toasts" class="toasts" aria-live="polite"></div>' '<canvas id="fx" aria-hidden="true"></canvas>' '<script>'; cat content.js engine.js shared.js analytics.js app1.js app2.js app3.js; echo '</script>'; } > dist/moniac-game.html
{ echo '/* Generated from the game sources (content.js + engine.js + shared.js). Do not edit by hand. */'; cat content.js engine.js shared.js; echo 'export { LEVELS, EVENTS, createGame, beginQuarter, resolveDilemma, step, finalResult, replayGame, verifySubmission, decodeLevel, encodeLevel, sanitizeLevel, makeDailyLevel, levelRefOf, levelFromRef, runBot, taylorMove };'; } > server/afloat-core.mjs
echo built
