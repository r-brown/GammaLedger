---
layout: post
title: "GammaLedger's Local-First Options Journal: Private by Default"
slug: gammaledger-local-first-options-journal
date: 2026-04-13
description: "How GammaLedger keeps options trade tracking local, private, portable, and practical for active traders."
tags: [gammaledger, privacy, local-first, options, trade-journal]
image: /assets/img/gammaledger-local-first-privacy.png
---

Options trading records are unusually sensitive. A single journal can reveal account size, risk appetite, preferred tickers, assignment history, losses, timing habits, and strategy concentration. GammaLedger is built around a simple rule: the application should help you analyze that data without requiring an account, a cloud database, or a hosted portfolio backend.

GammaLedger runs in the browser and stores the working database locally on your device. That makes it different from a broker portal, a subscription journal, or a SaaS analytics dashboard. The default workflow is deliberately direct: open the app, load or create a local database, enter or import trades, review analytics, then export a backup when you want a portable copy.

## What local-first means in practice

Local-first does not mean "no integrations." It means your trade ledger is not automatically uploaded to GammaLedger servers. Core portfolio state, trade notes, settings, and imported data live in browser storage and in files you choose to import or export.

That design gives traders three practical benefits:

- You can use GammaLedger without creating an account.
- You can keep a full JSON backup of your database under your own storage process.
- You decide when optional providers receive data.

The trade-off is equally important: because the app does not maintain a cloud copy for you, backups are your responsibility. If you clear browser storage, change devices, or lose local files, GammaLedger cannot recover data from a remote account.

## What leaves your device

Most GammaLedger functionality is local. Adding trades, calculating P&L, grouping legs, rendering dashboard charts, filtering trades, and reviewing strategy performance all happen in the app.

Data can leave your device only when you choose workflows that require an outside service. Examples include:

- Fetching market data with a Finnhub API key.
- Sending a portfolio question to a Gemini-compatible AI provider.
- Attaching a broker screenshot for AI draft-leg extraction.
- Opening project links, docs, GitHub, or third-party resources.

Those integrations are useful, but they are optional. The app makes the boundary explicit because traders should understand when a local analytics workflow becomes a third-party request.

## API keys stay local

GammaLedger settings include local controls for Finnhub and Gemini-compatible API keys. When browser cryptography is available, the app encrypts stored keys before keeping them in the browser. That is a useful local protection, not a replacement for device security.

Treat API keys like credentials. Use provider-side limits where available, avoid sharing exported databases that contain secrets, and clear keys if you are using a shared machine.

## Backups are part of the workflow

The safest way to use a local-first trading journal is to make backups routine. Export a JSON database after major import sessions, after end-of-week reviews, and before clearing browser data or changing devices.

A good backup habit looks like this:

1. Keep the current working database in GammaLedger.
2. Export JSON snapshots on a regular schedule.
3. Store those snapshots somewhere you control.
4. Avoid posting database files, screenshots, or broker exports in public support channels.

The point is not to make privacy complicated. The point is to make ownership clear. GammaLedger gives you the analytical surface; you keep custody of the ledger.

## Why this matters for options traders

Options portfolios can change shape quickly. A cash-secured put can become assigned stock, assigned stock can become a covered call, a covered call can be rolled, and a spread can close across multiple executions. A journal that understands that lifecycle becomes more valuable as history grows.

Keeping that history local means you can analyze strategy performance without turning your trade archive into a hosted dataset. You still get the dashboard, the review queue, the AI Coach when configured, and the export workflow. You simply choose which features stay offline and which integrations earn access to context.

That is GammaLedger's privacy model: local by default, explicit when external, and portable when you need a backup.
