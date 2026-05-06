#!/usr/bin/env node
/**
 * Wire extracted modules into app.js by replacing method bodies with delegators.
 * Usage: node scripts/wire-modules.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APP_JS = join(ROOT, 'src/legacy/app.js');

const src = readFileSync(APP_JS, 'utf-8');
const lines = src.split('\n');

/**
 * Find the line index where a class method starts.
 * methodSig is a regex or string matching the method signature line.
 */
function findMethodStart(lines, methodSig) {
    const re = typeof methodSig === 'string' ? new RegExp(methodSig) : methodSig;
    for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) return i;
    }
    return -1;
}

/**
 * Find the closing brace of a method starting at `startLine`.
 * We track brace depth — the method opens with `{` at the end of startLine
 * and closes when depth returns to 0.
 */
function findMethodEnd(lines, startLine) {
    let depth = 0;
    let foundOpen = false;
    for (let i = startLine; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') { depth++; foundOpen = true; }
            else if (ch === '}') { depth--; }
        }
        if (foundOpen && depth === 0) {
            return i;
        }
    }
    return -1;
}

/**
 * Replace a method body with a delegator.
 * Returns the new lines array.
 */
function replaceMethodWithDelegator(lines, methodStartLine, delegatorLine) {
    const endLine = findMethodEnd(lines, methodStartLine);
    if (endLine === -1) {
        console.warn(`Could not find end of method starting at line ${methodStartLine + 1}`);
        return lines;
    }
    // Get the original method signature (first line)
    const sig = lines[methodStartLine];
    const indent = sig.match(/^(\s*)/)[1];
    const newLines = [...lines];
    // Replace lines from methodStartLine to endLine with delegator
    newLines.splice(methodStartLine, endLine - methodStartLine + 1, `${indent}${delegatorLine}`);
    console.log(`  Replaced lines ${methodStartLine + 1}–${endLine + 1}: ${delegatorLine}`);
    return newLines;
}

// ============================================================
// Define the rewrites: methodSignaturePattern -> delegatorBody
// ============================================================

// riskModule delegators
const riskDelegators = [
    {
        sig: /^\s{4}buildRiskFormulaContext\(trade = \{\}, details = null\)/,
        delegate: 'buildRiskFormulaContext(trade = {}, details = null) { return riskModule.buildRiskFormulaContext.call(this, trade, details); }'
    },
    {
        sig: /^\s{4}computeDefaultMaxRisk\(context\)/,
        delegate: 'computeDefaultMaxRisk(context) { return riskModule.computeDefaultMaxRisk.call(this, context); }'
    },
    {
        sig: /^\s{4}getStrategyRiskHandlers\(\)/,
        delegate: 'getStrategyRiskHandlers() { return riskModule.getStrategyRiskHandlers.call(this); }'
    },
    {
        sig: /^\s{4}evaluateStrategyMaxRisk\(strategyName, context\)/,
        delegate: 'evaluateStrategyMaxRisk(strategyName, context) { return riskModule.evaluateStrategyMaxRisk.call(this, strategyName, context); }'
    },
    {
        sig: /^\s{4}computeMaxRiskUsingFormula\(trade = \{\}, summary = null\)/,
        delegate: 'computeMaxRiskUsingFormula(trade = {}, summary = null) { return riskModule.computeMaxRiskUsingFormula.call(this, trade, summary); }'
    },
    {
        sig: /^\s{4}assessRisk\(trade, summary\)/,
        delegate: 'assessRisk(trade, summary) { return riskModule.assessRisk.call(this, trade, summary); }'
    },
    {
        sig: /^\s{4}getFormulaData\(\)/,
        delegate: 'getFormulaData() { return riskModule.getFormulaData.call(this); }'
    },
    {
        sig: /^\s{4}buildFormulaTooltipContent\(trade, metricType\)/,
        delegate: 'buildFormulaTooltipContent(trade, metricType) { return riskModule.buildFormulaTooltipContent.call(this, trade, metricType); }'
    },
    {
        sig: /^\s{4}buildMaxRiskTooltip\(strategyName, strategyInfo, context, trade\)/,
        delegate: 'buildMaxRiskTooltip(strategyName, strategyInfo, context, trade) { return riskModule.buildMaxRiskTooltip.call(this, strategyName, strategyInfo, context, trade); }'
    },
    {
        sig: /^\s{4}buildPLTooltip\(trade, details, context\)/,
        delegate: 'buildPLTooltip(trade, details, context) { return riskModule.buildPLTooltip.call(this, trade, details, context); }'
    },
    {
        sig: /^\s{4}buildVariablesWithExplanations\(context, formulaData, trade\)/,
        delegate: 'buildVariablesWithExplanations(context, formulaData, trade) { return riskModule.buildVariablesWithExplanations.call(this, context, formulaData, trade); }'
    },
    {
        sig: /^\s{4}buildPLVariables\(trade, details\)/,
        delegate: 'buildPLVariables(trade, details) { return riskModule.buildPLVariables.call(this, trade, details); }'
    },
    {
        sig: /^\s{4}createFormulaIcon\(trade, metricType\)/,
        delegate: 'createFormulaIcon(trade, metricType) { return riskModule.createFormulaIcon.call(this, trade, metricType); }'
    },
    {
        sig: /^\s{4}positionFormulaTooltip\(wrapper, tooltip\)/,
        delegate: 'positionFormulaTooltip(wrapper, tooltip) { return riskModule.positionFormulaTooltip.call(this, wrapper, tooltip); }'
    },
    {
        sig: /^\s{4}formatStrikeValue\(value\)/,
        delegate: 'formatStrikeValue(value) { return riskModule.formatStrikeValue.call(this, value); }'
    },
    {
        sig: /^\s{4}derivePrimaryStrike\(summary\)/,
        delegate: 'derivePrimaryStrike(summary) { return riskModule.derivePrimaryStrike.call(this, summary); }'
    },
    {
        sig: /^\s{4}getActiveStrikeForDisplay\(summary\)/,
        delegate: 'getActiveStrikeForDisplay(summary) { return riskModule.getActiveStrikeForDisplay.call(this, summary); }'
    },
    {
        sig: /^\s{4}buildStrikeDisplay\(trade, summary = null\)/,
        delegate: 'buildStrikeDisplay(trade, summary = null) { return riskModule.buildStrikeDisplay.call(this, trade, summary); }'
    },
];

// spreadsModule delegators
const spreadsDelegators = [
    {
        sig: /^\s{4}extractSpreadPair\(trade, legs, now, pairs\)/,
        delegate: 'extractSpreadPair(trade, legs, now, pairs) { return spreadsModule.extractSpreadPair.call(this, trade, legs, now, pairs); }'
    },
    {
        sig: /^\s{4}extractRolledSpread\(trade, allLegs, now, pairs\)/,
        delegate: 'extractRolledSpread(trade, allLegs, now, pairs) { return spreadsModule.extractRolledSpread.call(this, trade, allLegs, now, pairs); }'
    },
    {
        sig: /^\s{4}extractSingleSpread\(trade, groupLegs, expiration, now, pairs\)/,
        delegate: 'extractSingleSpread(trade, groupLegs, expiration, now, pairs) { return spreadsModule.extractSingleSpread.call(this, trade, groupLegs, expiration, now, pairs); }'
    },
    {
        sig: /^\s{4}extractIndividualLegPairs\(trade, legs, now, pairs\)/,
        delegate: 'extractIndividualLegPairs(trade, legs, now, pairs) { return spreadsModule.extractIndividualLegPairs.call(this, trade, legs, now, pairs); }'
    },
    {
        sig: /^\s{4}detectRollChain\(sortedLegs\)/,
        delegate: 'detectRollChain(sortedLegs) { return spreadsModule.detectRollChain.call(this, sortedLegs); }'
    },
    {
        sig: /^\s{4}extractRolledPositionAcrossStrikes\(trade, allLegs, type, now, pairs\)/,
        delegate: 'extractRolledPositionAcrossStrikes(trade, allLegs, type, now, pairs) { return spreadsModule.extractRolledPositionAcrossStrikes.call(this, trade, allLegs, type, now, pairs); }'
    },
    {
        sig: /^\s{4}extractRolledPosition\(trade, allLegs, strike, type, now, pairs\)/,
        delegate: 'extractRolledPosition(trade, allLegs, strike, type, now, pairs) { return spreadsModule.extractRolledPosition.call(this, trade, allLegs, strike, type, now, pairs); }'
    },
    {
        sig: /^\s{4}extractSingleLegPair\(trade, groupLegs, strike, type, expiration, now, pairs\)/,
        delegate: 'extractSingleLegPair(trade, groupLegs, strike, type, expiration, now, pairs) { return spreadsModule.extractSingleLegPair.call(this, trade, groupLegs, strike, type, expiration, now, pairs); }'
    },
];

let currentLines = [...lines];

// Apply risk delegators
console.log('\n=== Wiring riskModule delegators ===');
for (const { sig, delegate } of riskDelegators) {
    const start = findMethodStart(currentLines, sig);
    if (start === -1) {
        console.warn(`  WARNING: Could not find method matching ${sig}`);
        continue;
    }
    currentLines = replaceMethodWithDelegator(currentLines, start, delegate);
}

// Apply spreads delegators
console.log('\n=== Wiring spreadsModule delegators ===');
for (const { sig, delegate } of spreadsDelegators) {
    const start = findMethodStart(currentLines, sig);
    if (start === -1) {
        console.warn(`  WARNING: Could not find method matching ${sig}`);
        continue;
    }
    currentLines = replaceMethodWithDelegator(currentLines, start, delegate);
}

// Add imports for riskModule and spreadsModule near the top (after existing module imports)
console.log('\n=== Adding module imports ===');
const importInsertPattern = /^import \* as monteCarloModule/;
const importInsertIdx = findMethodStart(currentLines, importInsertPattern);
if (importInsertIdx === -1) {
    console.warn('Could not find insert point for imports - please add manually');
} else {
    currentLines.splice(importInsertIdx + 1, 0,
        `import * as riskModule from '../trades/risk.js';`,
        `import * as spreadsModule from '../trades/spreads.js';`
    );
    console.log(`  Added riskModule and spreadsModule imports after line ${importInsertIdx + 1}`);
}

// Write back
writeFileSync(APP_JS, currentLines.join('\n'), 'utf-8');
console.log(`\n✓ Wrote ${APP_JS} (${currentLines.length} lines)`);

