---
layout: post
title: "Export, Backup, and Share: Keeping Your Options Portfolio Portable"
slug: export-backup-share-options-portfolio
date: 2026-06-22
description: "How GammaLedger supports local JSON backups, CSV export, portfolio snapshot sharing, and privacy-conscious reporting workflows."
tags: [gammaledger, export, backup, portfolio, reporting]
image: /assets/img/gammaledger-export-share-backup.png
---

Local-first software gives traders control, but control only works if the data is portable. GammaLedger is designed so your options journal can be exported, backed up, reviewed outside the app, and shared selectively.

That portability supports three different needs:

- Recovery if browser storage is cleared or a device changes.
- External analysis in spreadsheets or other tools.
- Clean portfolio snapshots for review or sharing.

## JSON backup is the foundation

The most important export is the full JSON database backup. This is the portable copy of your GammaLedger state. It is the file you keep after a major import, before clearing browser storage, before changing devices, or after a month-end review.

Because GammaLedger does not maintain a cloud account copy, the JSON backup is your recovery path. Treat it as sensitive financial data. Store it somewhere private and avoid sending it through public support channels.

## CSV for tabular analysis

CSV export is useful when you want to inspect trades outside the app. Spreadsheet tools are still valuable for ad hoc reconciliation, custom summaries, tax-prep staging, and strategy experiments.

CSV is not as complete as a native database backup, but it is convenient. Use JSON when you want to restore GammaLedger state. Use CSV when you want rows for analysis.

## Portfolio snapshot sharing

GammaLedger includes a portfolio snapshot card designed for visual sharing. The card focuses on high-level metrics such as realized P&L, win rate, profit factor, total ROI, and cumulative P&L.

This is different from posting screenshots of broker statements or raw trade tables. A clean snapshot can communicate performance without exposing account identifiers, every ticker, or detailed broker records.

Still, review before sharing. Even aggregated metrics can reveal more than you intend.

## What not to share

Avoid sharing:

- Broker account numbers.
- Raw broker exports.
- Full JSON database files.
- API keys.
- Screenshots with balances, tax IDs, names, or addresses.
- AI prompts containing sensitive personal or account information.

When asking for help, create a minimal example whenever possible. A synthetic trade with the same structure is usually safer than a real database.

## Build a backup routine

A practical GammaLedger backup routine can be simple:

1. Export a JSON backup after every import session.
2. Export again after major manual cleanup or merge work.
3. Keep dated copies, not just one overwritten file.
4. Store backups somewhere you control.
5. Test restore occasionally by loading a backup in a separate browser profile or local copy.

This is not busywork. Options histories are expensive to reconstruct. A few seconds of exporting can protect months of trade review.

## Reporting versus accounting

GammaLedger is an analytics and journal tool. It helps you understand trades, but broker statements and official tax documents remain the accounting source of truth. Use exports to support review and preparation, then reconcile against broker records before making tax or financial decisions.

The strength of GammaLedger's export model is that it keeps your data movable. You can analyze inside the app, back up outside it, and share only the pieces you choose.
