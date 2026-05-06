#!/usr/bin/env node
/**
 * Extract wave 6 (payoff) and wave 7 (imports) methods from app.js.
 * Usage: node scripts/extract-wave6-7.mjs
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
    if (firstLine.startsWith('async ')) {
        firstLine = 'export async function ' + firstLine.slice('async '.length);
    } else {
        firstLine = 'export function ' + firstLine;
    }
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
    const names = params.map(p => {
        if (p.startsWith('{') || p.startsWith('[')) return null;
        return p.split(/\s*=\s*/)[0].trim().split(/\s+/)[0];
    });
    return names.filter(Boolean).join(', ');
}

function processModule(outFile, header, methodSigs, moduleAlias, importLine) {
    console.log(`\n=== Extracting ${outFile} ===`);
    let lines = readLines();
    const exportBlocks = [];

    for (const sig of methodSigs) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) { console.warn(`  WARN: Not found: ${sig}`); continue; }
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) { console.warn(`  WARN: No end for method at ${startIdx + 1}`); continue; }
        const methodLines = lines.slice(startIdx, endIdx + 1);
        const stripped = methodLines.map(l => l.startsWith('    ') ? l.slice(4) : l);
        exportBlocks.push(buildExportFunction(stripped));
        console.log(`  ${startIdx + 1}-${endIdx + 1}: ${stripped[0].split('(')[0].trim()}`);
    }

    writeFileSync(join(ROOT, outFile), header + '\n' + exportBlocks.join('\n\n') + '\n', 'utf-8');
    console.log(`  → Wrote ${outFile}`);

    // Now add delegators (process in reverse to keep indices stable)
    lines = readLines(); // re-read fresh
    const toReplace = [];
    for (const sig of methodSigs) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) continue;
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) continue;
        const rawLine = lines[startIdx].trim();
        const parsed = parseMethodSig(rawLine);
        if (!parsed) { console.warn(`  WARN: Cannot parse: ${rawLine}`); continue; }
        const { name, paramsStr } = parsed;
        const callArgs = buildCallArgs(paramsStr);
        const isAsync = rawLine.startsWith('async ');
        const methodSigLine = isAsync ? `async ${name}${paramsStr}` : `${name}${paramsStr}`;
        const delegator = `${methodSigLine} { return ${moduleAlias}.${name}.call(this${callArgs ? ', ' + callArgs : ''}); }`;
        toReplace.push({ startIdx, endIdx, delegator });
    }
    toReplace.sort((a, b) => b.startIdx - a.startIdx);
    for (const { startIdx, endIdx, delegator } of toReplace) {
        lines = replaceDelegator(lines, startIdx, endIdx, delegator);
    }
    writeLines(lines);
    console.log(`  → Updated app.js delegators`);
    return importLine;
}

// ============================================================
// WAVE 6: Payoff modules
// ============================================================

processModule(
    'src/payoff/series.js',
    `// src/payoff/series.js — Wave 6: Payoff data series calculation.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}getFallbackUnderlyingPrice\(trade = \{\}\)/,
        /^\s{4}calculatePayoffSeries\(trade\)/,
        /^\s{4}determinePayoffModel\(trade\)/,
        /^\s{4}calculateSingleLegSeries\(trade, model\)/,
        /^\s{4}calculateMultiLegSeries\(trade, model\)/,
        /^\s{4}calculateVerticalSpreadSeries\(trade, model\)/,
        /^\s{4}calculateCoveredCallSeries\(trade\)/,
        /^\s{4}calculatePmccSeries\(trade, model\)/,
    ],
    'payoffSeriesModule',
    `import * as payoffSeriesModule from '../payoff/series.js';`
);

processModule(
    'src/payoff/pricing.js',
    `// src/payoff/pricing.js — Wave 6: Payoff pricing helpers and option math.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}analyzeMultiLegStrategy\(trade, activeLegs, strategy\)/,
        /^\s{4}calculateSpreadBreakeven\(/,
        /^\s{4}optionIntrinsic\(optionType, price, strike\)/,
        /^\s{4}extractPmccLegs\(trade = \{\}\)/,
        /^\s{4}buildPriceRange\(/,
    ],
    'payoffPricingModule',
    `import * as payoffPricingModule from '../payoff/pricing.js';`
);

processModule(
    'src/payoff/summary.js',
    `// src/payoff/summary.js — Wave 6: Payoff summary and footnote builders.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}buildPayoffSummary\(/,
        /^\s{4}formatPayoffFooter\(payoff, formatter\)/,
        /^\s{4}getTradePayoffMeta\(trade\)/,
    ],
    'payoffSummaryModule',
    `import * as payoffSummaryModule from '../payoff/summary.js';`
);

processModule(
    'src/payoff/render.js',
    `// src/payoff/render.js — Wave 6: Payoff chart toggle and rendering.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}toggleTradePayoffDetail\(row, detailRow, trade, chartId, footnoteId\)/,
        /^\s{4}destroyTradePayoffChart\(chartId, footnoteId\)/,
    ],
    'payoffRenderModule',
    `import * as payoffRenderModule from '../payoff/render.js';`
);

// ============================================================
// WAVE 7: Import modules
// ============================================================

processModule(
    'src/imports/controls.js',
    `// src/imports/controls.js — Wave 7: Import UI controls setup.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}setupImportControls\(\)/,
        /^\s{4}setupTradesMergeControls\(\)/,
        /^\s{4}toggleTradesMergePanel\(/,
        /^\s{4}updateTradesMergeToggleLabel\(\)/,
        /^\s{4}updateMergeColumnVisibility\(\)/,
        /^\s{4}refreshTradesMergePanelContents\(\)/,
    ],
    'importControlsModule',
    `import * as importControlsModule from '../imports/controls.js';`
);

processModule(
    'src/imports/log.js',
    `// src/imports/log.js — Wave 7: Import log rendering.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}appendImportLog\(entry = \{\}\)/,
        /^\s{4}renderImportLog\(\)/,
        /^\s{4}renderImportSummary\(\)/,
    ],
    'importLogModule',
    `import * as importLogModule from '../imports/log.js';`
);

processModule(
    'src/imports/merge.js',
    `// src/imports/merge.js — Wave 7: Trade merge logic.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}countMergeableTickerGroups\(\)/,
        /^\s{4}refreshImportMergeList\(\)/,
        /^\s{4}updateImportMergeButtonState\(\)/,
        /^\s{4}resolveMergedExitReason\(trades = \[\]\)/,
        /^\s{4}buildMergedTradeNote\(trades = \[\], prefix = ''\)/,
        /^\s{4}createMergedTradeFromTrades\(trades = \[\], options = \{\}\)/,
        /^\s{4}mergeSelectedImportTrades\(\)/,
        /^\s{4}mergeSelectedTradesFromList\(\)/,
        /^\s{4}renderTradeMergeSelectionSummary\(\)/,
        /^\s{4}renderTradeMergeGroups\(/,
        /^\s{4}updateTradesMergeButtonState\(\)/,
        /^\s{4}pruneTradeMergeSelection\(\)/,
    ],
    'importMergeModule',
    `import * as importMergeModule from '../imports/merge.js';`
);

processModule(
    'src/imports/position-keys.js',
    `// src/imports/position-keys.js — Wave 7: Position key building for trade matching.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}buildPositionKey\(ticker, leg, options = \{\}\)/,
        /^\s{4}buildLegFromTransaction\(transaction\)/,
    ],
    'importPositionKeysModule',
    `import * as importPositionKeysModule from '../imports/position-keys.js';`
);

processModule(
    'src/imports/robinhood.js',
    `// src/imports/robinhood.js — Wave 7: Robinhood CSV import parser.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}handleRobinhoodCsvFileSelection\(event\)/,
        /^\s{4}parseRobinhoodCsv\(raw\)/,
        /^\s{4}parseRobinhoodTransaction\(row\)/,
        /^\s{4}parseRobinhoodOptionTransaction\(data\)/,
        /^\s{4}parseRobinhoodStockTransaction\(data\)/,
        /^\s{4}parseRobinhoodAssignedStockTransaction\(row\)/,
        /^\s{4}parseRobinhoodAssignmentClosingLeg\(row\)/,
        /^\s{4}mapRobinhoodTransCode\(transCode\)/,
        /^\s{4}parseRobinhoodDate\(value\)/,
        /^\s{4}normalizeRobinhoodDate\(value\)/,
        /^\s{4}parseRobinhoodNumber\(value\)/,
        /^\s{4}calculateRobinhoodFees\(quantity, premium, total\)/,
        /^\s{4}buildRobinhoodImportPayload\(parsed, context = \{\}\)/,
        /^\s{4}buildLegFromRobinhoodTransaction\(transaction\)/,
        /^\s{4}applyRobinhoodImportResult\(importResult, context = \{\}\)/,
    ],
    'importRobinhoodModule',
    `import * as importRobinhoodModule from '../imports/robinhood.js';`
);

processModule(
    'src/imports/ofx.js',
    `// src/imports/ofx.js — Wave 7: OFX/brokerage statement import parser.
// Uses the .call(this, …) delegation pattern.
`,
    [
        /^\s{4}parseOfx\(raw\)/,
        /^\s{4}extractOfxSecurities\(doc\)/,
        /^\s{4}parseOfxDate\(value\)/,
        /^\s{4}mapOfxOrderType\(tag, rawType, units = 0\)/,
        /^\s{4}extractOfxTransactions\(doc, securities\)/,
        /^\s{4}buildOfxImportPayload\(parsed, context = \{\}\)/,
        /^\s{4}applyOfxImportResult\(importResult, context = \{\}\)/,
    ],
    'importOfxModule',
    `import * as importOfxModule from '../imports/ofx.js';`
);

// Add all imports to app.js
console.log('\n=== Adding wave 6-7 imports to app.js ===');
{
    let lines = readLines();
    const insertAfter = /^import \* as defaultFeeModule from/;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (insertAfter.test(lines[i])) { idx = i; break; }
    }
    if (idx === -1) {
        console.warn('Could not find insert point - trying mcpModule');
        for (let i = 0; i < lines.length; i++) {
            if (/^import \* as mcpModule/.test(lines[i])) { idx = i; break; }
        }
    }
    if (idx === -1) {
        console.warn('Could not find insert point for imports');
    } else {
        lines.splice(idx + 1, 0,
            `import * as payoffSeriesModule from '../payoff/series.js';`,
            `import * as payoffPricingModule from '../payoff/pricing.js';`,
            `import * as payoffSummaryModule from '../payoff/summary.js';`,
            `import * as payoffRenderModule from '../payoff/render.js';`,
            `import * as importControlsModule from '../imports/controls.js';`,
            `import * as importLogModule from '../imports/log.js';`,
            `import * as importMergeModule from '../imports/merge.js';`,
            `import * as importPositionKeysModule from '../imports/position-keys.js';`,
            `import * as importRobinhoodModule from '../imports/robinhood.js';`,
            `import * as importOfxModule from '../imports/ofx.js';`,
        );
        writeLines(lines);
        console.log(`  Added 10 imports after line ${idx + 1}`);
    }
}

console.log('\n✓ Wave 6-7 extraction complete.');
console.log('Run: npm run build to verify');

