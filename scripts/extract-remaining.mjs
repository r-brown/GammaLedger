#!/usr/bin/env node
/**
 * Extract remaining methods from app.js into final module files.
 * Usage: node scripts/extract-remaining.mjs
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
    let first = stripped[0];
    if (first.startsWith('async ')) first = 'export async function ' + first.slice('async '.length);
    else first = 'export function ' + first;
    return [first, ...stripped.slice(1)].join('\n');
}

function replaceDelegator(lines, startIdx, endIdx, body) {
    const nl = [...lines];
    nl.splice(startIdx, endIdx - startIdx + 1, `    ${body}`);
    return nl;
}

function parseMethodSig(s) {
    const m = s.trim().match(/^(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)(\(.*\))\s*\{?\s*$/);
    return m ? { name: m[1], paramsStr: m[2] } : null;
}

function buildCallArgs(paramsStr) {
    const inner = paramsStr.slice(1, -1).trim();
    if (!inner) return '';
    const params = [];
    let depth = 0, cur = '';
    for (const ch of inner) {
        if ('({['.includes(ch)) depth++;
        else if (')}]'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) { params.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    if (cur.trim()) params.push(cur.trim());
    return params.map(p => {
        if (p.startsWith('{') || p.startsWith('[')) return null;
        return p.split(/\s*=\s*/)[0].trim().split(/\s+/)[0];
    }).filter(Boolean).join(', ');
}

function processModule(outFile, header, methodSigs, alias) {
    console.log(`\n=== Extracting ${outFile} ===`);
    let lines = readLines();
    const blocks = [];

    for (const sig of methodSigs) {
        const si = findMethodStart(lines, sig);
        if (si === -1) { console.warn(`  WARN: Not found: ${sig}`); continue; }
        const ei = findMethodEnd(lines, si);
        if (ei === -1) { console.warn(`  WARN: No end at ${si + 1}`); continue; }
        const stripped = lines.slice(si, ei + 1).map(l => l.startsWith('    ') ? l.slice(4) : l);
        blocks.push(buildExportFunction(stripped));
        console.log(`  ${si + 1}-${ei + 1}: ${stripped[0].split('(')[0].trim()}`);
    }

    writeFileSync(join(ROOT, outFile), header + '\n' + blocks.join('\n\n') + '\n', 'utf-8');
    console.log(`  → Wrote ${outFile}`);

    lines = readLines();
    const toReplace = [];
    for (const sig of methodSigs) {
        const si = findMethodStart(lines, sig);
        if (si === -1) continue;
        const ei = findMethodEnd(lines, si);
        if (ei === -1) continue;
        const raw = lines[si].trim();
        const parsed = parseMethodSig(raw);
        if (!parsed) continue;
        const { name, paramsStr } = parsed;
        const args = buildCallArgs(paramsStr);
        const isAsync = raw.startsWith('async ');
        const sigLine = isAsync ? `async ${name}${paramsStr}` : `${name}${paramsStr}`;
        const d = `${sigLine} { return ${alias}.${name}.call(this${args ? ', ' + args : ''}); }`;
        toReplace.push({ si, ei, d });
    }
    toReplace.sort((a, b) => b.si - a.si);
    for (const { si, ei, d } of toReplace) lines = replaceDelegator(lines, si, ei, d);
    writeLines(lines);
    console.log(`  → Updated app.js delegators`);
}

// ============================================================
// Remaining trade helper methods
// ============================================================

processModule('src/ui/tables/active-positions.js',
    `// src/ui/tables/active-positions.js — Wave 9: Active positions table rendering.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}updateActivePositionsTable\(/,
    ],
    'activePositionsModule'
);

processModule('src/ui/tables/recent-trades.js',
    `// src/ui/tables/recent-trades.js — Wave 9: Recent trades table rendering.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}updateRecentTradesTable\(/,
    ],
    'recentTradesModule'
);

processModule('src/ui/tables/assigned-positions.js',
    `// src/ui/tables/assigned-positions.js — Wave 9: Assigned positions table rendering.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}updateAssignedPositionsTable\(\)/,
        /^\s{4}updateAssignedPositionMetrics\(entry, quote\)/,
        /^\s{4}initializeAssignedPositionsStatusFilter\(\)/, // might already be done
    ],
    'assignedPositionsModule'
);

processModule('src/ui/credit-playbook/index.js',
    `// src/ui/credit-playbook/index.js — Wave 9: Credit playbook controls and orchestration.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}initializeCreditPlaybookControls\(\)/,
        /^\s{4}syncCreditPlaybookStatusControls\(\)/,
        /^\s{4}setCreditPlaybookStatus\(status\)/,
        /^\s{4}normalizeCreditPlaybookStrategyValue\(strategy\)/,
        /^\s{4}setCreditPlaybookStrategy\(strategy\)/,
        /^\s{4}setCreditPlaybookHorizon\(horizon\)/,
        /^\s{4}setCreditPlaybookSymbol\(symbol\)/,
        /^\s{4}updateCreditPlaybookView\(\)/,
        /^\s{4}getCreditPlaybookEntries\(\)/,
    ],
    'creditPlaybookModule'
);

processModule('src/ui/views.js',
    `// src/ui/views.js — Wave 9: View switching, form resets, and trade submission.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}showView\(viewName\)/,
        /^\s{4}resetAddTradeForm\(\)/,
        /^\s{4}handleTradeSubmit\(\)/,
        /^\s{4}updateTrade\(tradeData\)/,
        /^\s{4}setTodayDate\(\)/,
        /^\s{4}updateTickerPreview\(ticker\)/,
    ],
    'viewsModule'
);

processModule('src/utils/dom.js',
    `// src/utils/dom.js additions — markdown rendering helpers.\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}renderMarkdownToHTML\(markdown = ''\)/,
        /^\s{4}renderMarkdownTextSegment\(text = ''\)/,
        /^\s{4}formatMarkdownInline\(text = ''\)/,
        /^\s{4}applyBasicInlineFormatting\(text = ''\)/,
        /^\s{4}sanitizeMarkdownUrl\(url = ''\)/,
    ],
    'dom'
);

// Stats calculation
processModule('src/calculations/stats.js',
    `// src/calculations/stats.js additions from app.js\n// Uses the .call(this, …) delegation pattern.\n`,
    [
        /^\s{4}calculateAdvancedStats\(\)/,
        /^\s{4}calculateAssignmentStats\(assignedTrades\)/,
        /^\s{4}calculateTickerPerformance\(trades = \[\]\)/,
    ],
    'statsModule'
);

// Add remaining imports
console.log('\n=== Adding remaining module imports to app.js ===');
{
    let lines = readLines();
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^import \* as legFormModule/.test(lines[i])) { idx = i; break; }
    }
    if (idx === -1) {
        for (let i = 0; i < lines.length; i++) {
            if (/^import \* as persistModule/.test(lines[i])) { idx = i; break; }
        }
    }
    if (idx !== -1) {
        lines.splice(idx + 1, 0,
            `import * as activePositionsModule from '../ui/tables/active-positions.js';`,
            `import * as recentTradesModule from '../ui/tables/recent-trades.js';`,
            `import * as assignedPositionsModule from '../ui/tables/assigned-positions.js';`,
            `import * as creditPlaybookModule from '../ui/credit-playbook/index.js';`,
            `import * as viewsModule from '../ui/views.js';`,
        );
        writeLines(lines);
        console.log(`  Added 5 imports after line ${idx + 1}`);
    } else {
        console.warn('Could not find insertion point for imports');
    }
}

console.log('\n✓ Remaining extraction complete.');
console.log('Run: npm run build to verify');

