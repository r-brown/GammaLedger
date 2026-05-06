#!/usr/bin/env node
/**
 * Extract wave 5 integration methods from app.js into module files.
 * Reads method bodies from app.js, creates module files, adds delegators.
 * Usage: node scripts/extract-wave5.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APP_JS = join(ROOT, 'src/legacy/app.js');

function readLines() {
    return readFileSync(APP_JS, 'utf-8').split('\n');
}

function writeLines(lines) {
    writeFileSync(APP_JS, lines.join('\n'), 'utf-8');
}

/** Find the line index where a specific method starts */
function findMethodStart(lines, sigRe) {
    for (let i = 0; i < lines.length; i++) {
        if (sigRe.test(lines[i])) return i;
    }
    return -1;
}

/** Find the closing brace line of a method starting at startLine */
function findMethodEnd(lines, startLine) {
    let depth = 0;
    let foundOpen = false;
    for (let i = startLine; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') { depth++; foundOpen = true; }
            else if (ch === '}') { depth--; }
        }
        if (foundOpen && depth === 0) return i;
    }
    return -1;
}

/**
 * Extract a method from the lines array and return:
 * - extracted: the method body as a string (with leading indentation stripped to class method level)
 * - methodName: the method name
 * - methodParams: the params string
 */
function extractMethod(lines, sigRe) {
    const startIdx = findMethodStart(lines, sigRe);
    if (startIdx === -1) {
        console.warn(`  WARN: Could not find method matching ${sigRe}`);
        return null;
    }
    const endIdx = findMethodEnd(lines, startIdx);
    if (endIdx === -1) {
        console.warn(`  WARN: Could not find end of method at line ${startIdx + 1}`);
        return null;
    }
    const methodLines = lines.slice(startIdx, endIdx + 1);
    // Strip 4-space leading indent (class method indent) from all lines
    const stripped = methodLines.map(l => l.startsWith('    ') ? l.slice(4) : l);
    return { startIdx, endIdx, stripped };
}

/**
 * Build an export function from extracted method lines.
 * Handles both regular methods and async methods.
 */
function buildExportFunction(stripped) {
    // First line: "methodName(...) {" or "async methodName(...) {"
    // We need to prepend "export function " or "export async function "
    let firstLine = stripped[0];
    if (firstLine.startsWith('async ')) {
        firstLine = 'export async function ' + firstLine.slice('async '.length);
    } else {
        firstLine = 'export function ' + firstLine;
    }
    return [firstLine, ...stripped.slice(1)].join('\n');
}

/**
 * Replace method in lines array with a delegator.
 * Returns updated lines array.
 */
function replaceDelegator(lines, startIdx, endIdx, delegatorBody) {
    const indent = '    ';
    const newLines = [...lines];
    newLines.splice(startIdx, endIdx - startIdx + 1, `${indent}${delegatorBody}`);
    return newLines;
}

/** Parse a method signature to extract name and params */
function parseMethodSig(sigLine) {
    // "async methodName(p1, p2 = default) {" or "methodName(p1, p2) {"
    const m = sigLine.trim().match(/^(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)(\([^)]*\))/);
    if (!m) return null;
    return { name: m[1], paramsStr: m[2] };
}

/** Extract just the parameter names (without defaults) from a param string like "(p1, p2 = 'x', {a=1}={}) */
function extractParamNames(paramsStr) {
    // This is a rough extraction - just get the positional param names
    const inner = paramsStr.slice(1, -1).trim();
    if (!inner) return '';
    // Split by commas (naive - doesn't handle nested objects), get first word of each
    return inner.split(',').map(p => {
        const trimmed = p.trim();
        // Handle destructured params - pass as-is with spread would be complex
        // For simple params, just get the name before "="
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return null; // handled specially below
        }
        return trimmed.split(/[\s=]/)[0];
    }).filter(Boolean).join(', ');
}

// =============================================
// WAVE 5: Integrations
// =============================================

// Define what goes in each module
// Format: { module: 'path', methods: [{ sigRe, delegateTemplate }] }
// delegateTemplate: a function(name, paramsStr) => string
const wave5Modules = [
    {
        outFile: 'src/integrations/finnhub.js',
        header: `// src/integrations/finnhub.js — Wave 5: Finnhub API integration.
// Uses the .call(this, …) delegation pattern so all this.* refs work.
`,
        methods: [
            { sig: /^\s{4}initializeFinnhubControls\(\)/ },
            { sig: /^\s{4}initializeFinnhubRateLimitControls\(\)/ },
            { sig: /^\s{4}updateFinnhubRateStatus\(element, message = null, variant = 'neutral'\)/ },
            { sig: /^\s{4}loadFinnhubRateLimitFromStorage\(\)/ },
            { sig: /^\s{4}saveFinnhubRateLimitToStorage\(\)/ },
            { sig: /^\s{4}removeFinnhubRateLimitFromStorage\(\)/ },
            { sig: /^\s{4}updateFinnhubStatus\(message, variant = 'neutral', autoClearMs = 0\)/ },
            { sig: /^\s{4}setFinnhubApiKey\(value,/ },
            { sig: /^\s{4}getFinnhubStorageKey\(\)/ },
            { sig: /^\s{4}saveFinnhubConfigToStorage\(\)/ },
            { sig: /^\s{4}removeFinnhubConfigFromStorage\(\)/ },
            { sig: /^\s{4}getFinnhubSecretStorageKey\(\)/ },
            { sig: /^\s{4}getQuoteEntryKey\(trade\)/ },
            { sig: /^\s{4}rebuildQuoteRefreshSchedule\(\)/ },
            { sig: /^\s{4}startQuoteAutoRefreshIfNeeded\(\)/ },
            { sig: /^\s{4}stopQuoteAutoRefresh\(\)/ },
            { sig: /^\s{4}restartQuoteRefreshWithNewRate\(\)/ },
            { sig: /^\s{4}refreshActivePositionsQuotes\(/ },
            { sig: /^\s{4}refreshAssignedPositionsQuotes\(/ },
            { sig: /^\s{4}refreshCreditPlaybookQuotes\(/ },
            { sig: /^\s{4}populateQuoteCell\(cell, trade, row, options = \{\}\)/ },
            { sig: /^\s{4}renderQuoteValue\(cell, row, trade, quote\)/ },
            { sig: /^\s{4}getQuoteChangePercent\(quote\)/ },
            { sig: /^\s{4}getQuoteChangeValue\(quote\)/ },
            { sig: /^\s{4}setQuoteCellError\(cell, row, trade, message\)/ },
            { sig: /^\s{4}getQuoteErrorMessage\(error\)/ },
            { sig: /^\s{4}getCachedQuote\(ticker\)/ },
            { sig: /^\s{4}setCachedQuote\(ticker, value\)/ },
            { sig: /^\s{4}enqueueFinnhubRequest\(symbol\)/ },
        ]
    },
    {
        outFile: 'src/integrations/gemini.js',
        header: `// src/integrations/gemini.js — Wave 5: Gemini API settings & UI controls.
// The agent class itself lives in src/ai/gemini-agent.js.
// Uses the .call(this, …) delegation pattern so all this.* refs work.
`,
        methods: [
            { sig: /^\s{4}initializeGeminiControls\(\)/ },
            { sig: /^\s{4}initializeGeminiMaxTokensControls\(\)/ },
            { sig: /^\s{4}updateGeminiTokensStatus\(element, message = null, variant = 'neutral'\)/ },
            { sig: /^\s{4}syncGeminiControlsFromState\(/ },
            { sig: /^\s{4}flushPendingGeminiStatus\(\)/ },
            { sig: /^\s{4}getGeminiModelLabel\(model = ''\)/ },
            { sig: /^\s{4}getGeminiChatDisplayName\(\)/ },
            { sig: /^\s{4}updateGeminiStatus\(message, variant = 'neutral', autoClearMs = 0\)/ },
            { sig: /^\s{4}setGeminiApiKey\(value,/ },
            { sig: /^\s{4}setGeminiModel\(value\)/ },
            { sig: /^\s{4}saveGeminiConfigToStorage\(/ },
            { sig: /^\s{4}removeGeminiEncryptionKey\(\)/ },
            { sig: /^\s{4}loadGeminiMaxTokensFromStorage\(\)/ },
            { sig: /^\s{4}saveGeminiMaxTokensToStorage\(\)/ },
            { sig: /^\s{4}removeGeminiMaxTokensFromStorage\(\)/ },
        ]
    },
    {
        outFile: 'src/settings/default-fee.js',
        header: `// src/settings/default-fee.js — Wave 5: Default fee per contract settings.
// Uses the .call(this, …) delegation pattern so all this.* refs work.
`,
        methods: [
            { sig: /^\s{4}initializeDefaultFeeControls\(\)/ },
            { sig: /^\s{4}loadDefaultFeeFromStorage\(\)/ },
            { sig: /^\s{4}saveDefaultFeeToStorage\(\)/ },
            { sig: /^\s{4}removeDefaultFeeFromStorage\(\)/ },
            { sig: /^\s{4}updateDefaultFeeStatus\(element, message = null, variant = 'neutral', duration = 4000\)/ },
            { sig: /^\s{4}getDefaultFeeForQuantity\(quantity = 1\)/ },
        ]
    },
];

// Also need to find MCP methods
// Let's find them separately
const mcpMethods = [];

// Process each wave5 module
const extractedNames = []; // track all method names extracted

for (const mod of wave5Modules) {
    console.log(`\n=== Extracting ${mod.outFile} ===`);
    let lines = readLines();
    const exportBlocks = [];
    const delegatorInfo = []; // { startIdx, endIdx, delegatorLine }

    for (const { sig } of mod.methods) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) {
            console.warn(`  WARN: Not found: ${sig}`);
            continue;
        }
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) {
            console.warn(`  WARN: No end found for method at line ${startIdx + 1}`);
            continue;
        }

        // Extract method body
        const methodLines = lines.slice(startIdx, endIdx + 1);
        const stripped = methodLines.map(l => l.startsWith('    ') ? l.slice(4) : l);
        const exportFn = buildExportFunction(stripped);
        exportBlocks.push(exportFn);

        // Build delegator
        const sig_parsed = parseMethodSig(stripped[0]);
        if (!sig_parsed) {
            console.warn(`  WARN: Could not parse sig: ${stripped[0]}`);
            continue;
        }

        const { name, paramsStr } = sig_parsed;
        extractedNames.push(name);

        // For delegation, we need the param names. Let's use the raw params string
        // but for .call(this, ...) we need to pass the params through
        const rawParams = methodLines[0].trim();
        const isAsync = rawParams.startsWith('async ');

        // Build delegator line - use the original signature but replace body
        // We need to build something like:
        // methodName(p1, p2 = 'x') { return module.methodName.call(this, p1, p2); }
        // or for async: async methodName(p1) { return module.methodName.call(this, p1); }

        // Get the module alias from the outFile
        const moduleName = getModuleAlias(mod.outFile);

        // Build the call args (just the param names without defaults)
        // For complex default values like {a=1}={}, we need to be careful
        const callArgs = buildCallArgs(paramsStr);

        const methodSig = isAsync ? `async ${name}${paramsStr}` : `${name}${paramsStr}`;
        const delegatorLine = `${methodSig} { return ${moduleName}.${name}.call(this${callArgs ? ', ' + callArgs : ''}); }`;

        console.log(`  ${startIdx + 1}-${endIdx + 1}: ${name}`);
        delegatorInfo.push({ startIdx, endIdx, delegatorLine });
    }

    // Write module file
    const content = mod.header + '\n' + exportBlocks.join('\n\n') + '\n';
    writeFileSync(join(ROOT, mod.outFile), content, 'utf-8');
    console.log(`  → Wrote ${mod.outFile}`);

    // Now replace methods in app.js (process in reverse order to preserve line numbers)
    lines = readLines();
    // Re-find each method and replace (in reverse order)
    const toReplace = [];
    for (const { sig } of mod.methods) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) continue;
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) continue;

        const rawParams = lines[startIdx].trim();
        const sig_parsed = parseMethodSig(rawParams);
        if (!sig_parsed) continue;

        const { name, paramsStr } = sig_parsed;
        const moduleName = getModuleAlias(mod.outFile);
        const callArgs = buildCallArgs(paramsStr);
        const isAsync = rawParams.startsWith('async ');
        const methodSig = isAsync ? `async ${name}${paramsStr}` : `${name}${paramsStr}`;
        const delegatorLine = `${methodSig} { return ${moduleName}.${name}.call(this${callArgs ? ', ' + callArgs : ''}); }`;

        toReplace.push({ startIdx, endIdx, delegatorLine });
    }

    // Sort in reverse order to preserve indices
    toReplace.sort((a, b) => b.startIdx - a.startIdx);

    for (const { startIdx, endIdx, delegatorLine } of toReplace) {
        lines = replaceDelegator(lines, startIdx, endIdx, delegatorLine);
    }

    writeLines(lines);
    console.log(`  → Updated app.js delegators`);
}

// Find and extract MCP methods
console.log('\n=== Extracting src/integrations/mcp.js ===');
{
    let lines = readLines();
    const mcpSigs = [
        /^\s{4}buildMCPContext\(\)/,
        /^\s{4}buildMCPTrade\(trade,/,
        /^\s{4}buildMCPAssignment\(a\)/,
    ];

    const exportBlocks = [];
    for (const sig of mcpSigs) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) { console.warn(`  WARN: ${sig} not found`); continue; }
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) { console.warn(`  WARN: no end for ${sig}`); continue; }

        const methodLines = lines.slice(startIdx, endIdx + 1);
        const stripped = methodLines.map(l => l.startsWith('    ') ? l.slice(4) : l);
        exportBlocks.push(buildExportFunction(stripped));
        console.log(`  ${startIdx + 1}-${endIdx + 1}: ${stripped[0].split('(')[0]}`);
    }

    const header = `// src/integrations/mcp.js — Wave 5: MCP context building functions.
// Uses the .call(this, …) delegation pattern so all this.* refs work.
`;
    writeFileSync(join(ROOT, 'src/integrations/mcp.js'), header + '\n' + exportBlocks.join('\n\n') + '\n', 'utf-8');

    // Replace in app.js
    for (const sig of mcpSigs) {
        const startIdx = findMethodStart(lines, sig);
        if (startIdx === -1) continue;
        const endIdx = findMethodEnd(lines, startIdx);
        if (endIdx === -1) continue;

        const rawParams = lines[startIdx].trim();
        const sig_parsed = parseMethodSig(rawParams);
        if (!sig_parsed) continue;

        const { name, paramsStr } = sig_parsed;
        const callArgs = buildCallArgs(paramsStr);
        const delegatorLine = `${name}${paramsStr} { return mcpModule.${name}.call(this${callArgs ? ', ' + callArgs : ''}); }`;
        lines = replaceDelegator(lines, startIdx, endIdx, delegatorLine);
        console.log(`  Delegated: ${name}`);
    }
    writeLines(lines);
}

// Add module imports to app.js
console.log('\n=== Adding wave 5 imports to app.js ===');
{
    let lines = readLines();
    const insertAfter = /^import \* as spreadsModule from/;
    const idx = findMethodStart(lines, insertAfter);
    if (idx === -1) {
        console.warn('Could not find insert point for imports');
    } else {
        lines.splice(idx + 1, 0,
            `import * as finnhubModule from '../integrations/finnhub.js';`,
            `import * as geminiIntegrationModule from '../integrations/gemini.js';`,
            `import * as mcpModule from '../integrations/mcp.js';`,
            `import * as defaultFeeModule from '../settings/default-fee.js';`,
        );
        writeLines(lines);
        console.log(`  Added 4 imports after line ${idx + 1}`);
    }
}

// Helper functions
function getModuleAlias(outFile) {
    const map = {
        'src/integrations/finnhub.js': 'finnhubModule',
        'src/integrations/gemini.js': 'geminiIntegrationModule',
        'src/settings/default-fee.js': 'defaultFeeModule',
        'src/integrations/mcp.js': 'mcpModule',
    };
    return map[outFile] || 'unknownModule';
}

function buildCallArgs(paramsStr) {
    // Extract parameter names from signature like "(p1, p2 = 'x', { a = 1 } = {})"
    const inner = paramsStr.slice(1, -1).trim();
    if (!inner) return '';

    // Split by top-level commas
    const params = [];
    let depth = 0;
    let current = '';
    for (const ch of inner) {
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') depth--;

        if (ch === ',' && depth === 0) {
            params.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) params.push(current.trim());

    // For each param, get just the name (before "=" for defaults)
    const names = params.map(p => {
        if (p.startsWith('{') || p.startsWith('[')) {
            // Destructured: for .call() we can't easily reconstruct, use the full param
            // But since it's a class method call pattern and we're just delegating args through,
            // we need an alias. Use a simple pattern:
            // "{ a, b } = {}" -> we'd need a named param. Let's check if there's a var name before =
            // Common pattern: "{ preserveStatus = true } = {}" - no variable name
            // In this case, we need to create a parameter name
            // Look for "} = " and if no name after, this is a complex case
            return null; // Mark for special handling
        }
        // "param = default" -> "param"
        return p.split(/\s*=\s*/)[0].trim().split(/\s+/)[0];
    });

    // If any null (destructured without name), we have a problem
    // These need special handling in the caller
    const validNames = names.filter(Boolean);
    return validNames.join(', ');
}

console.log('\n✓ Wave 5 extraction complete.');
console.log('Run: npm run build to verify');

