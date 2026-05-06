#!/usr/bin/env node
/**
 * Extract waves 8-11 UI, chart, chat, leg form, and database methods.
 * Usage: node scripts/extract-wave8-11.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APP_JS = join(ROOT, 'src/legacy/app.js');

function readLines() { return readFileSync(APP_JS, 'utf-8').split('\n'); }
function writeLines(lines) { writeFileSync(APP_JS, lines.join('\n'), 'utf-8'); }

function findMethodStart(lines, sigRe) {
    for (let i = 0; i < lines.length; i++) {
        if (sigRe.test(lines[i])) return i;
    }
    return -1;
}

function findMethodEnd(lines, startLine) {
    let depth = 0, foundOpen = false;
    for (let i = startLine; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') { depth++; foundOpen = true; }
            else if (ch === '}') { depth--; }
        }
        if (foundOpen && depth === 0) return i;
    }
    return -1;
}

function buildExportFunction(stripped) {
    let firstLine = stripped[0];
    if (firstLine.startsWith('async ')) firstLine = 'export async function ' + firstLine.slice('async '.length);
    else firstLine = 'export function ' + firstLine;
    return [firstLine, ...stripped.slice(1)].join('\n');
}

function replaceDelegator(lines, startIdx, endIdx, delegatorBody) {
    const newLines = [...lines];
    newLines.splice(startIdx, endIdx - startIdx + 1, `    ${delegatorBody}`);
    return newLines;
}

function parseMethodSig(sigLine) {
    const m = sigLine.trim().match(/^(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)(\(.*\))\s*\{?\s*$/);
    if (!m) return null;
    return { name: m[1], paramsStr: m[2] };
}

function buildCallArgs(paramsStr) {
    const inner = paramsStr.slice(1, -1).trim();
    if (!inner) return '';
    const params = [];
    let depth = 0, current = '';
    for (const ch of inner) {
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') depth--;
        if (ch === ',' && depth === 0) { params.push(current.trim()); current = ''; }
        else current += ch;
    }
    if (current.trim()) params.push(current.trim());
    return params.map(p => {
        if (p.startsWith('{') || p.startsWith('[')) return null;
        return p.split(/\s*=\s*/)[0].trim().split(/\s+/)[0];
    }).filter(Boolean).join(', ');
}

function processModule(outFile, header, methodSigs, moduleAlias) {
    console.log(`\n=== Extracting ${outFile} ===`);
    let lines = readLines();
    const exportBlocks = [];

    for (const sig of methodSigs) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) { console.warn(`  WARN: Not found: ${sig}`); continue; }
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) { console.warn(`  WARN: No end at ${startIdx + 1}`); continue; }
        const stripped = lines.slice(startIdx, endIdx + 1).map(l => l.startsWith('    ') ? l.slice(4) : l);
        exportBlocks.push(buildExportFunction(stripped));
        console.log(`  ${startIdx + 1}-${endIdx + 1}: ${stripped[0].split('(')[0].trim()}`);
    }

    writeFileSync(join(ROOT, outFile), header + '\n' + exportBlocks.join('\n\n') + '\n', 'utf-8');
    console.log(`  → Wrote ${outFile}`);

    lines = readLines();
    const toReplace = [];
    for (const sig of methodSigs) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) continue;
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) continue;
        const rawLine = lines[startIdx].trim();
        const parsed = parseMethodSig(rawLine);
        if (!parsed) continue;
        const { name, paramsStr } = parsed;
        const callArgs = buildCallArgs(paramsStr);
        const isAsync = rawLine.startsWith('async ');
        const sigLine = isAsync ? `async ${name}${paramsStr}` : `${name}${paramsStr}`;
        const delegator = `${sigLine} { return ${moduleAlias}.${name}.call(this${callArgs ? ', ' + callArgs : ''}); }`;
        toReplace.push({ startIdx, endIdx, delegator });
    }
    toReplace.sort((a, b) => b.startIdx - a.startIdx);
    for (const { startIdx, endIdx, delegator } of toReplace) {
        lines = replaceDelegator(lines, startIdx, endIdx, delegator);
    }
    writeLines(lines);
    console.log(`  → Updated app.js delegators`);
}

// =============================================================
// WAVE 8 — UI helpers
// =============================================================

processModule('src/ui/notifications.js',
    `// src/ui/notifications.js — Wave 8: Notification display helpers.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}showLoadingIndicator\(text = 'Loading\.\.\.'\)/,
        /^\s{4}hideLoadingIndicator\(\)/,
        /^\s{4}showNotification\(message, type = 'info'\)/,
        /^\s{4}markUnsavedChanges\(\)/,
        /^\s{4}updateFileNameDisplay\(\)/,
        /^\s{4}updateUnsavedIndicator\(\)/,
    ],
    'notificationsModule'
);

processModule('src/ui/sidebar.js',
    `// src/ui/sidebar.js — Wave 8: Sidebar toggle and state persistence.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}initializeSidebarToggle\(\)/,
        /^\s{4}getSidebarCollapsedPreference\(\)/,
        /^\s{4}setSidebarCollapsedPreference\(collapsed\)/,
        /^\s{4}setSidebarCollapsed\(collapsed,/,
    ],
    'sidebarModule'
);

processModule('src/ui/modals/disclaimer.js',
    `// src/ui/modals/disclaimer.js — Wave 8: Disclaimer banner modal.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}initializeDisclaimerBanner\(\)/,
        /^\s{4}showDisclaimerBanner\(\)/,
        /^\s{4}hideDisclaimerBanner\(/,
        /^\s{4}acceptDisclaimer\(\)/,
        /^\s{4}getDisclaimerAcceptance\(\)/,
        /^\s{4}setDisclaimerAcceptance\(value\)/,
    ],
    'disclaimerModule'
);

processModule('src/ui/modals/ai-coach-consent.js',
    `// src/ui/modals/ai-coach-consent.js — Wave 8: AI Coach consent modal.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}initializeAICoachConsent\(\)/,
        /^\s{4}showAICoachConsent\(\)/,
        /^\s{4}hideAICoachConsent\(/,
        /^\s{4}promptAICoachConsent\(nextAction = null\)/,
        /^\s{4}acceptAICoachConsent\(\)/,
        /^\s{4}cancelAICoachConsent\(\)/,
        /^\s{4}hasAICoachConsent\(\)/,
        /^\s{4}getAICoachConsent\(\)/,
        /^\s{4}setAICoachConsent\(value\)/,
    ],
    'aiCoachConsentModule'
);

processModule('src/ui/filters.js',
    `// src/ui/filters.js — Wave 8: Trade filter UI logic.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}getSelectedFilterValues\(selectElement\)/,
        /^\s{4}normalizeFilterSelect\(selectElement\)/,
        /^\s{4}resetFilterSelect\(selectElement\)/,
        /^\s{4}restoreMultiSelectSelection\(selectElement, previousValues = \[\]\)/,
        /^\s{4}getSortableValue\(trade, sortKey\)/,
        /^\s{4}compareSortableValues\(a, b\)/,
        /^\s{4}applySortToTrades\(trades, sortKey, direction = 'asc'\)/,
        /^\s{4}populateFilters\(\)/,
        /^\s{4}filterTrades\(\)/,
        /^\s{4}openTradesFilteredByTicker\(ticker\)/,
        /^\s{4}setupResponsiveFilters\(\)/,
    ],
    'filtersModule'
);

// =============================================================
// WAVE 9 — Charts
// =============================================================

processModule('src/ui/charts/dashboard-charts.js',
    `// src/ui/charts/dashboard-charts.js — Wave 9: Dashboard chart updates.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}updateAllCharts\(\)/,
        /^\s{4}updatePerformanceGauges\(\)/,
        /^\s{4}renderRatioGauge\(/,
        /^\s{4}updateCommissionImpactChart\(\)/,
        /^\s{4}renderTickerHeatmap\(\)/,
        /^\s{4}updateTimeInTradeChart\(\)/,
        /^\s{4}updateMonteCarloChart\(\)/,
        /^\s{4}ensureMonteCarloBaseline\(chart\)/,
        /^\s{4}generateMonteCarloProjection\(/,
        /^\s{4}updateMonthlyPLChart\(\)/,
        /^\s{4}updateStrategyPerformanceChart\(\)/,
        /^\s{4}updateWinRateByStrategyChart\(\)/,
        /^\s{4}inferOptionFlavor\(trade = \{\}\)/,
    ],
    'dashboardChartsModule'
);

processModule('src/ui/charts/cumulative-pl.js',
    `// src/ui/charts/cumulative-pl.js — Wave 9: Cumulative P&L chart.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}initializeCumulativePLControls\(\)/,
        /^\s{4}setCumulativePLRange\(range\)/,
        /^\s{4}syncCumulativePLControls\(\)/,
        /^\s{4}updateCumulativePLChart\(\)/,
    ],
    'cumulativePLModule'
);

processModule('src/ui/tables/highlights.js',
    `// src/ui/tables/highlights.js — Wave 9: Row highlight utilities (ITM, expiry).\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}applyPositionHighlight\(row, trade, currentPrice = null\)/,
        /^\s{4}updateExpirationHighlight\(cell, trade\)/,
        /^\s{4}updateItmHighlight\(row, trade, currentPrice\)/,
        /^\s{4}resolveStrikeForHighlight\(trade, row\)/,
        /^\s{4}isInTheMoney\(trade, currentPrice, row\)/,
    ],
    'highlightsModule'
);

processModule('src/ui/tables/trades-table.js',
    `// src/ui/tables/trades-table.js — Wave 9: Trades table rendering and actions.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}updateTradesList\(\)/,
        /^\s{4}renderTradesTable\(/,
        /^\s{4}sortTrades\(sortBy\)/,
        /^\s{4}deleteTrade\(id\)/,
        /^\s{4}editTrade\(id\)/,
    ],
    'tradesTableModule'
);

processModule('src/ui/credit-playbook/data.js',
    `// src/ui/credit-playbook/data.js — Wave 9: Credit playbook data extraction.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}extractCreditPlaybookLegPairs\(entries = \[\]\)/,
        /^\s{4}sortCreditPlaybook\(sortKey\)/,
    ],
    'creditPlaybookDataModule'
);

processModule('src/ui/credit-playbook/render.js',
    `// src/ui/credit-playbook/render.js — Wave 9: Credit playbook rendering.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}renderCreditPlaybookDetailCell\(cell, entry\)/,
        /^\s{4}createCreditStage\(label, variant = 'default'\)/,
    ],
    'creditPlaybookRenderModule'
);

// =============================================================
// WAVE 10 — Share card / dashboard / chat
// =============================================================

processModule('src/ui/share-card.js',
    `// src/ui/share-card.js — Wave 10: Share card generation and cumulative P&L series.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}normalizeCumulativePLRange\(range\)/,
        /^\s{4}getCumulativePLRangeLabel\(/,
        /^\s{4}getClosedTradesInRange\(/,
        /^\s{4}getCumulativePLRangeWindow\(range\)/,
        /^\s{4}initializeShareCard\(\)/,
        /^\s{4}updateShareCardRangeLabel\(/,
        /^\s{4}computeCumulativePLSeries\(/,
        /^\s{4}updateShareCard\(stats\)/,
        /^\s{4}refreshShareCardChart\(\)/,
    ],
    'shareCardModule'
);

processModule('src/ai/chat.js',
    `// src/ai/chat.js — Wave 10: AI chat UI panel.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}setupAIChatResizeHandle\(\)/,
        /^\s{4}initializeAIChat\(\)/,
        /^\s{4}toggleAIChat\(/,
        /^\s{4}appendAIChatMessage\(sender, text, options = \{\}\)/,
        /^\s{4}renderAIChatMessages\(\)/,
        /^\s{4}updateAIChatHeader\(\)/,
    ],
    'aiChatModule'
);

processModule('src/ui/dashboard.js',
    `// src/ui/dashboard.js — Wave 10: Main dashboard update orchestration.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}updateDashboard\(\)/,
        /^\s{4}initializeAssignedPositionsStatusFilter\(\)/,
        /^\s{4}setAssignedPositionsStatusFilter\(status\)/,
        /^\s{4}syncAssignedPositionsStatusFilter\(\)/,
    ],
    'dashboardModule'
);

// =============================================================
// WAVE 11 — Database and storage
// =============================================================

processModule('src/database/persist.js',
    `// src/database/persist.js — Wave 11: Database persistence (save/load/export/import).\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}getStorageTrades\(\)/,
        /^\s{4}buildTradeStorageSnapshot\(trade\)/,
        /^\s{4}buildLegStorageSnapshot\(leg\)/,
        /^\s{4}buildDatabasePayload\(\)/,
        /^\s{4}saveWithDownload\(data\)/,
        /^\s{4}loadWithFileInput\(\)/,
        /^\s{4}exportToCSV\(\)/,
        /^\s{4}processLoadedData\(data, metadata = \{\}\)/,
        /^\s{4}newDatabase\(\)/,
    ],
    'persistModule'
);

// =============================================================
// WAVE 11 — Leg form
// =============================================================

processModule('src/trades/leg-form.js',
    `// src/trades/leg-form.js — Wave 11: Leg form UI helpers.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}getLegsContainer\(\)/,
        /^\s{4}generateLegId\(index = 0\)/,
        /^\s{4}clearLegFormRows\(\)/,
        /^\s{4}getSelectedUnderlyingType\(/,
        /^\s{4}getDefaultMultiplierForLegType\(legType, underlyingType = 'Stock'\)/,
        /^\s{4}syncLegMultiplierVisibility\(row,/,
        /^\s{4}syncLegTypeFieldVisibility\(row\)/,
        /^\s{4}applyUnderlyingTypeToLegMultipliers\(/,
        /^\s{4}renderLegForms\(legs = \[\]\)/,
        /^\s{4}addLegFormRow\(leg = null\)/,
        /^\s{4}removeLegFormRow\(row\)/,
        /^\s{4}createClosingLegFromRow\(sourceRow\)/,
        /^\s{4}updateLegRowNumbers\(\)/,
        /^\s{4}collectLegsFromForm\(\)/,
    ],
    'legFormModule'
);

// =============================================================
// Add all imports to app.js
// =============================================================
console.log('\n=== Adding wave 8-11 imports to app.js ===');
{
    let lines = readLines();
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^import \* as importOfxModule/.test(lines[i])) { idx = i; break; }
    }
    if (idx === -1) {
        for (let i = 0; i < lines.length; i++) {
            if (/^import \* as payoffRenderModule/.test(lines[i])) { idx = i; break; }
        }
    }
    if (idx === -1) { console.warn('Cannot find import insertion point'); }
    else {
        lines.splice(idx + 1, 0,
            `import * as notificationsModule from '../ui/notifications.js';`,
            `import * as sidebarModule from '../ui/sidebar.js';`,
            `import * as disclaimerModule from '../ui/modals/disclaimer.js';`,
            `import * as aiCoachConsentModule from '../ui/modals/ai-coach-consent.js';`,
            `import * as filtersModule from '../ui/filters.js';`,
            `import * as dashboardChartsModule from '../ui/charts/dashboard-charts.js';`,
            `import * as cumulativePLModule from '../ui/charts/cumulative-pl.js';`,
            `import * as highlightsModule from '../ui/tables/highlights.js';`,
            `import * as tradesTableModule from '../ui/tables/trades-table.js';`,
            `import * as creditPlaybookDataModule from '../ui/credit-playbook/data.js';`,
            `import * as creditPlaybookRenderModule from '../ui/credit-playbook/render.js';`,
            `import * as shareCardModule from '../ui/share-card.js';`,
            `import * as aiChatModule from '../ai/chat.js';`,
            `import * as dashboardModule from '../ui/dashboard.js';`,
            `import * as persistModule from '../database/persist.js';`,
            `import * as legFormModule from '../trades/leg-form.js';`,
        );
        writeLines(lines);
        console.log(`  Added 16 imports after line ${idx + 1}`);
    }
}

console.log('\n✓ Wave 8-11 extraction complete.');
console.log('Run: npm run build to verify');

