#!/usr/bin/env node
/**
 * Final cleanup: extract remaining methods with special handling for multi-line signatures.
 * Usage: node scripts/extract-final.mjs
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

// ============================================================
// Fix: updateActivePositionsTable (multi-line default arg)
// ============================================================
console.log('\n=== Fixing updateActivePositionsTable delegator ===');
{
    let lines = readLines();
    const si = findMethodStart(lines, /^\s{4}updateActivePositionsTable\(/);
    if (si !== -1) {
        const ei = findMethodEnd(lines, si);
        const stripped = lines.slice(si, ei + 1).map(l => l.startsWith('    ') ? l.slice(4) : l);

        // Write/append to the module
        const existing = readFileSync(join(ROOT, 'src/ui/tables/active-positions.js'), 'utf-8');
        // Check if already extracted
        if (!existing.includes('export function updateActivePositionsTable')) {
            const exportFn = buildExportFunction(stripped);
            writeFileSync(join(ROOT, 'src/ui/tables/active-positions.js'),
                existing.trim() + '\n\n' + exportFn + '\n', 'utf-8');
            console.log(`  Appended to active-positions.js`);
        }

        // Replace with delegator
        const delegator = `updateActivePositionsTable(openTrades) { return activePositionsModule.updateActivePositionsTable.call(this, openTrades); }`;
        lines = replaceDelegator(lines, si, ei, delegator);
        writeLines(lines);
        console.log(`  Replaced lines ${si + 1}-${ei + 1}: updateActivePositionsTable`);
    } else {
        console.log('  Not found (already delegated)');
    }
}

// ============================================================
// Fix: updateRecentTradesTable (multi-line default arg)
// ============================================================
console.log('\n=== Fixing updateRecentTradesTable delegator ===');
{
    let lines = readLines();
    const si = findMethodStart(lines, /^\s{4}updateRecentTradesTable\(/);
    if (si !== -1) {
        const ei = findMethodEnd(lines, si);
        const stripped = lines.slice(si, ei + 1).map(l => l.startsWith('    ') ? l.slice(4) : l);

        const existing = readFileSync(join(ROOT, 'src/ui/tables/recent-trades.js'), 'utf-8');
        if (!existing.includes('export function updateRecentTradesTable')) {
            const exportFn = buildExportFunction(stripped);
            writeFileSync(join(ROOT, 'src/ui/tables/recent-trades.js'),
                existing.trim() + '\n\n' + exportFn + '\n', 'utf-8');
            console.log(`  Appended to recent-trades.js`);
        }

        const delegator = `updateRecentTradesTable(closedTrades, activeCount) { return recentTradesModule.updateRecentTradesTable.call(this, closedTrades, activeCount); }`;
        lines = replaceDelegator(lines, si, ei, delegator);
        writeLines(lines);
        console.log(`  Replaced lines ${si + 1}-${ei + 1}: updateRecentTradesTable`);
    } else {
        console.log('  Not found (already delegated)');
    }
}

// ============================================================
// Append to legs.js: remaining leg analysis methods
// ============================================================
console.log('\n=== Appending to trades/legs.js + trades/positions.js ===');

function appendToModule(outFile, methodSigs) {
    let lines = readLines();
    let existing = readFileSync(join(ROOT, outFile), 'utf-8');
    const blocks = [];
    const toReplace = [];

    for (const { sig, alias, delegator: customDelegator } of methodSigs) {
        const si = findMethodStart(lines, sig);
        if (si === -1) { console.warn(`  WARN: Not found: ${sig}`); continue; }
        const ei = findMethodEnd(lines, si);
        if (ei === -1) continue;
        const stripped = lines.slice(si, ei + 1).map(l => l.startsWith('    ') ? l.slice(4) : l);
        const fnName = stripped[0].split('(')[0].trim().replace(/^async /, '');

        if (!existing.includes(`export function ${fnName}`) && !existing.includes(`export async function ${fnName}`)) {
            blocks.push(buildExportFunction(stripped));
            console.log(`  ${si + 1}-${ei + 1}: ${fnName} → ${outFile}`);
        } else {
            console.log(`  ${fnName} already in ${outFile}`);
        }

        // Build delegator
        const rawLine = lines[si].trim();
        const firstLineStripped = stripped[0];
        const isAsync = firstLineStripped.startsWith('async ');
        const sigStr = (isAsync ? 'async ' : '') + firstLineStripped.split(' ').slice(isAsync ? 1 : 0).join(' ').replace(' {', '').trim();
        const d = customDelegator || `${sigStr} { return ${alias}.${fnName}.call(this); }`;
        toReplace.push({ si, ei, d });
    }

    if (blocks.length > 0) {
        writeFileSync(join(ROOT, outFile), existing.trim() + '\n\n' + blocks.join('\n\n') + '\n', 'utf-8');
    }

    toReplace.sort((a, b) => b.si - a.si);
    for (const { si, ei, d } of toReplace) {
        lines = replaceDelegator(lines, si, ei, d);
    }
    writeLines(lines);
}

// Append leg analysis methods to legs.js
appendToModule('src/trades/legs.js', [
    {
        sig: /^\s{4}hasNetOpenOptionLegs\(trade = \{\}\)/,
        alias: 'legsModule',
        delegator: `hasNetOpenOptionLegs(trade = {}) { return legsModule.hasNetOpenOptionLegs.call(this, trade); }`
    },
    {
        sig: /^\s{4}hasNonExpiredOpenShortOptions\(trade = \{\}\)/,
        alias: 'legsModule',
        delegator: `hasNonExpiredOpenShortOptions(trade = {}) { return legsModule.hasNonExpiredOpenShortOptions.call(this, trade); }`
    },
    {
        sig: /^\s{4}getNetOpenOptionContracts\(legs = \[\]\)/,
        alias: 'legsModule',
        delegator: `getNetOpenOptionContracts(legs = []) { return legsModule.getNetOpenOptionContracts.call(this, legs); }`
    },
    {
        sig: /^\s{4}getNetOpenShortCalls\(legs = \[\]\)/,
        alias: 'legsModule',
        delegator: `getNetOpenShortCalls(legs = []) { return legsModule.getNetOpenShortCalls.call(this, legs); }`
    },
    {
        sig: /^\s{4}buildLegLifecycleKey\(leg = \{\}\)/,
        alias: 'legsModule',
        delegator: `buildLegLifecycleKey(leg = {}) { return legsModule.buildLegLifecycleKey.call(this, leg); }`
    },
    {
        sig: /^\s{4}getNormalizedLegOrderType\(leg = \{\}\)/,
        alias: 'legsModule',
        delegator: `getNormalizedLegOrderType(leg = {}) { return legsModule.getNormalizedLegOrderType.call(this, leg); }`
    },
    {
        sig: /^\s{4}determineTradeLifecycleStatus\(trade = \{\}, summary = \{\}\)/,
        alias: 'legsModule',
        delegator: `determineTradeLifecycleStatus(trade = {}, summary = {}) { return legsModule.determineTradeLifecycleStatus.call(this, trade, summary); }`
    },
    {
        sig: /^\s{4}enrichTradeData\(trade\)/,
        alias: 'legsModule',
        delegator: `enrichTradeData(trade) { return legsModule.enrichTradeData.call(this, trade); }`
    },
    {
        sig: /^\s{4}getPrimaryLeg\(trade = \{\}\)/,
        alias: 'legsModule',
        delegator: `getPrimaryLeg(trade = {}) { return legsModule.getPrimaryLeg.call(this, trade); }`
    },
    {
        sig: /^\s{4}deriveTradeTypeFromLeg\(leg\)/,
        alias: 'legsModule',
        delegator: `deriveTradeTypeFromLeg(leg) { return legsModule.deriveTradeTypeFromLeg.call(this, leg); }`
    },
    {
        sig: /^\s{4}deriveTradeDirectionFromLeg\(leg\)/,
        alias: 'legsModule',
        delegator: `deriveTradeDirectionFromLeg(leg) { return legsModule.deriveTradeDirectionFromLeg.call(this, leg); }`
    },
    {
        sig: /^\s{4}getTradeType\(trade\)/,
        alias: 'legsModule',
        delegator: `getTradeType(trade) { return legsModule.getTradeType.call(this, trade); }`
    },
    {
        sig: /^\s{4}inferTradeDirection\(trade\)/,
        alias: 'legsModule',
        delegator: `inferTradeDirection(trade) { return legsModule.inferTradeDirection.call(this, trade); }`
    },
]);

// Append trade type/status helpers to positions.js
appendToModule('src/trades/positions.js', [
    {
        sig: /^\s{4}normalizeStatus\(status\)/,
        alias: 'positionsModule',
        delegator: `normalizeStatus(status) { return positionsModule.normalizeStatus.call(this, status); }`
    },
    {
        sig: /^\s{4}normalizeTradeStatusInput\(status\)/,
        alias: 'positionsModule',
        delegator: `normalizeTradeStatusInput(status) { return positionsModule.normalizeTradeStatusInput.call(this, status); }`
    },
    {
        sig: /^\s{4}isClosedStatus\(status\)/,
        alias: 'positionsModule',
        delegator: `isClosedStatus(status) { return positionsModule.isClosedStatus.call(this, status); }`
    },
    {
        sig: /^\s{4}isAssignedStatus\(status\)/,
        alias: 'positionsModule',
        delegator: `isAssignedStatus(status) { return positionsModule.isAssignedStatus.call(this, status); }`
    },
    {
        sig: /^\s{4}isActiveStatus\(status\)/,
        alias: 'positionsModule',
        delegator: `isActiveStatus(status) { return positionsModule.isActiveStatus.call(this, status); }`
    },
    {
        sig: /^\s{4}isAssignmentReason\(reason\)/,
        alias: 'positionsModule',
        delegator: `isAssignmentReason(reason) { return positionsModule.isAssignmentReason.call(this, reason); }`
    },
    {
        sig: /^\s{4}isCashSettlementReason\(reason\)/,
        alias: 'positionsModule',
        delegator: `isCashSettlementReason(reason) { return positionsModule.isCashSettlementReason.call(this, reason); }`
    },
    {
        sig: /^\s{4}isCashSettledTrade\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isCashSettledTrade(trade = {}) { return positionsModule.isCashSettledTrade.call(this, trade); }`
    },
    {
        sig: /^\s{4}getDisplayStatus\(trade\)/,
        alias: 'positionsModule',
        delegator: `getDisplayStatus(trade) { return positionsModule.getDisplayStatus.call(this, trade); }`
    },
    {
        sig: /^\s{4}normalizeUnderlyingType\(type,/,
        alias: 'positionsModule',
        delegator: `normalizeUnderlyingType(type, options = {}) { return positionsModule.normalizeUnderlyingType.call(this, type, options); }`
    },
    {
        sig: /^\s{4}isWheelPut\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isWheelPut(trade = {}) { return positionsModule.isWheelPut.call(this, trade); }`
    },
    {
        sig: /^\s{4}isWheelTrade\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isWheelTrade(trade = {}) { return positionsModule.isWheelTrade.call(this, trade); }`
    },
    {
        sig: /^\s{4}isWheelOrPmccTrade\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isWheelOrPmccTrade(trade = {}) { return positionsModule.isWheelOrPmccTrade.call(this, trade); }`
    },
    {
        sig: /^\s{4}isCoveredCall\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isCoveredCall(trade = {}) { return positionsModule.isCoveredCall.call(this, trade); }`
    },
    {
        sig: /^\s{4}isPmccBaseLeg\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isPmccBaseLeg(trade = {}) { return positionsModule.isPmccBaseLeg.call(this, trade); }`
    },
    {
        sig: /^\s{4}isPmccShortCall\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isPmccShortCall(trade = {}) { return positionsModule.isPmccShortCall.call(this, trade); }`
    },
    {
        sig: /^\s{4}isPmccTrade\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isPmccTrade(trade = {}) { return positionsModule.isPmccTrade.call(this, trade); }`
    },
    {
        sig: /^\s{4}isAssignmentTrade\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isAssignmentTrade(trade = {}) { return positionsModule.isAssignmentTrade.call(this, trade); }`
    },
    {
        sig: /^\s{4}getTradeOpenStockShares\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `getTradeOpenStockShares(trade = {}) { return positionsModule.getTradeOpenStockShares.call(this, trade); }`
    },
    {
        sig: /^\s{4}getNetOpenLongCallContracts\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `getNetOpenLongCallContracts(trade = {}) { return positionsModule.getNetOpenLongCallContracts.call(this, trade); }`
    },
    {
        sig: /^\s{4}getTradeWheelCoverage\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `getTradeWheelCoverage(trade = {}) { return positionsModule.getTradeWheelCoverage.call(this, trade); }`
    },
    {
        sig: /^\s{4}isAwaitingCoverage\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `isAwaitingCoverage(trade = {}) { return positionsModule.isAwaitingCoverage.call(this, trade); }`
    },
    {
        sig: /^\s{4}computeWheelEffectiveCostBasis\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `computeWheelEffectiveCostBasis(trade = {}) { return positionsModule.computeWheelEffectiveCostBasis.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateOptionPremium\(trade = \{\}\)/,
        alias: 'positionsModule',
        delegator: `calculateOptionPremium(trade = {}) { return positionsModule.calculateOptionPremium.call(this, trade); }`
    },
]);

// Append calculation wrappers to pnl.js
appendToModule('src/calculations/pnl.js', [
    {
        sig: /^\s{4}calculateDTE\(expirationDate, trade\)/,
        alias: 'pnlModule',
        delegator: `calculateDTE(expirationDate, trade) { return pnlModule.calculateDTE.call(this, expirationDate, trade); }`
    },
    {
        sig: /^\s{4}calculatePL\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculatePL(trade) { return pnlModule.calculatePL.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateROI\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculateROI(trade) { return pnlModule.calculateROI.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateDaysHeld\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculateDaysHeld(trade) { return pnlModule.calculateDaysHeld.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateMaxRisk\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculateMaxRisk(trade) { return pnlModule.calculateMaxRisk.call(this, trade); }`
    },
    {
        sig: /^\s{4}getCapitalAtRisk\(trade\)/,
        alias: 'pnlModule',
        delegator: `getCapitalAtRisk(trade) { return pnlModule.getCapitalAtRisk.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateAnnualizedROI\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculateAnnualizedROI(trade) { return pnlModule.calculateAnnualizedROI.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateWeeklyROI\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculateWeeklyROI(trade) { return pnlModule.calculateWeeklyROI.call(this, trade); }`
    },
    {
        sig: /^\s{4}calculateMonthlyROI\(trade\)/,
        alias: 'pnlModule',
        delegator: `calculateMonthlyROI(trade) { return pnlModule.calculateMonthlyROI.call(this, trade); }`
    },
]);

// Append import helpers to persist.js
appendToModule('src/database/persist.js', [
    {
        sig: /^\s{4}saveToStorage\(metadata = \{\}\)/,
        alias: 'persistModule',
        delegator: `saveToStorage(metadata = {}) { return persistModule.saveToStorage.call(this, metadata); }`
    },
]);

// Append credit playbook helpers
appendToModule('src/ui/credit-playbook/render.js', [
    {
        sig: /^\s{4}isCreditStrategyTrade\(trade = \{\}\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `isCreditStrategyTrade(trade = {}) { return creditPlaybookRenderModule.isCreditStrategyTrade.call(this, trade); }`
    },
    {
        sig: /^\s{4}mapCreditTradeToEntry\(trade = \{\}\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `mapCreditTradeToEntry(trade = {}) { return creditPlaybookRenderModule.mapCreditTradeToEntry.call(this, trade); }`
    },
    {
        sig: /^\s{4}resolveCreditPlaybookOpenedAt\(trade = \{\}, summary = \{\}\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `resolveCreditPlaybookOpenedAt(trade = {}, summary = {}) { return creditPlaybookRenderModule.resolveCreditPlaybookOpenedAt.call(this, trade, summary); }`
    },
    {
        sig: /^\s{4}deriveCreditPlaybookPrice\(trade = \{\}\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `deriveCreditPlaybookPrice(trade = {}) { return creditPlaybookRenderModule.deriveCreditPlaybookPrice.call(this, trade); }`
    },
    {
        sig: /^\s{4}filterCreditPlaybookEntries\(entries = \[\]\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `filterCreditPlaybookEntries(entries = []) { return creditPlaybookRenderModule.filterCreditPlaybookEntries.call(this, entries); }`
    },
    {
        sig: /^\s{4}filterCreditPlaybookLegPairs\(legPairs = \[\]\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `filterCreditPlaybookLegPairs(legPairs = []) { return creditPlaybookRenderModule.filterCreditPlaybookLegPairs.call(this, legPairs); }`
    },
    {
        sig: /^\s{4}applyCreditPlaybookSort\(entries = \[\]\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `applyCreditPlaybookSort(entries = []) { return creditPlaybookRenderModule.applyCreditPlaybookSort.call(this, entries); }`
    },
    {
        sig: /^\s{4}applyCreditPlaybookSortToLegPairs\(legPairs = \[\]\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `applyCreditPlaybookSortToLegPairs(legPairs = []) { return creditPlaybookRenderModule.applyCreditPlaybookSortToLegPairs.call(this, legPairs); }`
    },
    {
        sig: /^\s{4}applyCreditPlaybookSortIndicators\(\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `applyCreditPlaybookSortIndicators() { return creditPlaybookRenderModule.applyCreditPlaybookSortIndicators.call(this); }`
    },
    {
        sig: /^\s{4}renderCreditPlaybookMetrics\(legPairs = \[\]\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `renderCreditPlaybookMetrics(legPairs = []) { return creditPlaybookRenderModule.renderCreditPlaybookMetrics.call(this, legPairs); }`
    },
    {
        sig: /^\s{4}renderCreditPlaybookTableFromLegPairs\(legPairs = \[\]\)/,
        alias: 'creditPlaybookRenderModule',
        delegator: `renderCreditPlaybookTableFromLegPairs(legPairs = []) { return creditPlaybookRenderModule.renderCreditPlaybookTableFromLegPairs.call(this, legPairs); }`
    },
]);

// Append import helpers to position-keys.js
appendToModule('src/imports/position-keys.js', [
    {
        sig: /^\s{4}consolidateImportLegs\(legs = \[\]\)/,
        alias: 'importPositionKeysModule',
        delegator: `consolidateImportLegs(legs = []) { return importPositionKeysModule.consolidateImportLegs.call(this, legs); }`
    },
    {
        sig: /^\s{4}parseOptionContractSymbol\(symbol = ''\)/,
        alias: 'importPositionKeysModule',
        delegator: `parseOptionContractSymbol(symbol = '') { return importPositionKeysModule.parseOptionContractSymbol.call(this, symbol); }`
    },
    {
        sig: /^\s{4}sanitizeExternalLegId\(value\)/,
        alias: 'importPositionKeysModule',
        delegator: `sanitizeExternalLegId(value) { return importPositionKeysModule.sanitizeExternalLegId.call(this, value); }`
    },
    {
        sig: /^\s{4}groupTransactionsForImport\(transactions = \[\]\)/,
        alias: 'importPositionKeysModule',
        delegator: `groupTransactionsForImport(transactions = []) { return importPositionKeysModule.groupTransactionsForImport.call(this, transactions); }`
    },
    {
        sig: /^\s{4}sanitizeImportedLeg\(leg\)/,
        alias: 'importPositionKeysModule',
        delegator: `sanitizeImportedLeg(leg) { return importPositionKeysModule.sanitizeImportedLeg.call(this, leg); }`
    },
    {
        sig: /^\s{4}buildPositionIndex\(trades = \[\]\)/,
        alias: 'importPositionKeysModule',
        delegator: `buildPositionIndex(trades = []) { return importPositionKeysModule.buildPositionIndex.call(this, trades); }`
    },
    {
        sig: /^\s{4}consumePositionMatches\(index, key, leg\)/,
        alias: 'importPositionKeysModule',
        delegator: `consumePositionMatches(index, key, leg) { return importPositionKeysModule.consumePositionMatches.call(this, index, key, leg); }`
    },
    {
        sig: /^\s{4}buildExistingExternalIdSet\(\)/,
        alias: 'importPositionKeysModule',
        delegator: `buildExistingExternalIdSet() { return importPositionKeysModule.buildExistingExternalIdSet.call(this); }`
    },
    {
        sig: /^\s{4}tradeContainsExternalId\(trade, externalId\)/,
        alias: 'importPositionKeysModule',
        delegator: `tradeContainsExternalId(trade, externalId) { return importPositionKeysModule.tradeContainsExternalId.call(this, trade, externalId); }`
    },
    {
        sig: /^\s{4}inferStrategyFromLegs\(legs = \[\]\)/,
        alias: 'importPositionKeysModule',
        delegator: `inferStrategyFromLegs(legs = []) { return importPositionKeysModule.inferStrategyFromLegs.call(this, legs); }`
    },
    {
        sig: /^\s{4}composeImportNotes\(context = \{\}, options = \{\}\)/,
        alias: 'importPositionKeysModule',
        delegator: `composeImportNotes(context = {}, options = {}) { return importPositionKeysModule.composeImportNotes.call(this, context, options); }`
    },
]);

// Import helpers (import summary/review)
appendToModule('src/imports/controls.js', [
    {
        sig: /^\s{4}updateImportSummary\(details = \{\}\)/,
        alias: 'importControlsModule',
        delegator: `updateImportSummary(details = {}) { return importControlsModule.updateImportSummary.call(this, details); }`
    },
    {
        sig: /^\s{4}countImportReviewTrades\(batchId = null\)/,
        alias: 'importControlsModule',
        delegator: `countImportReviewTrades(batchId = null) { return importControlsModule.countImportReviewTrades.call(this, batchId); }`
    },
    {
        sig: /^\s{4}getImportReviewTrades\(\)/,
        alias: 'importControlsModule',
        delegator: `getImportReviewTrades() { return importControlsModule.getImportReviewTrades.call(this); }`
    },
    {
        sig: /^\s{4}syncTradeSelectionCheckboxes\(\)/,
        alias: 'importControlsModule',
        delegator: `syncTradeSelectionCheckboxes() { return importControlsModule.syncTradeSelectionCheckboxes.call(this); }`
    },
    {
        sig: /^\s{4}syncSelectAllCheckbox\(\)/,
        alias: 'importControlsModule',
        delegator: `syncSelectAllCheckbox() { return importControlsModule.syncSelectAllCheckbox.call(this); }`
    },
    {
        sig: /^\s{4}handleSelectAllTrades\(checked\)/,
        alias: 'importControlsModule',
        delegator: `handleSelectAllTrades(checked) { return importControlsModule.handleSelectAllTrades.call(this, checked); }`
    },
]);

console.log('\n✓ Final cleanup complete.');
console.log('Run: npm run build to verify');

