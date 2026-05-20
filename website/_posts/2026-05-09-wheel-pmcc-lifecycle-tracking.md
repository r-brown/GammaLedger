---
layout: post
title: "Wheel and PMCC Tracking: Following the Full Lifecycle"
slug: wheel-pmcc-lifecycle-tracking
date: 2026-05-09
description: "How GammaLedger tracks assignments, covered-call coverage, rolls, cost basis, and long-call coverage for Wheel and PMCC traders."
tags: [gammaledger, wheel, pmcc, covered-calls, assignment, options]
image: /assets/img/gammaledger-wheel-pmcc-lifecycle.png
---

The Wheel and Poor Man's Covered Call are lifecycle strategies. They are not just isolated option trades. The results depend on how puts, stock, calls, assignments, rolls, and cost basis interact over time.

GammaLedger treats these strategies as connected positions rather than disconnected fills. That lets traders answer the questions that matter: Are shares covered? How much premium has reduced cost basis? Which call leg is still active? Did a roll improve or hide the real outcome?

## The Wheel as a sequence

A Wheel position often begins with a short put. If the put expires worthless, the trade may simply close as a win. If assignment occurs, the position changes into long stock. From there, covered calls may collect additional premium or lead to a stock sale.

GammaLedger tracks that sequence through legs:

- STO puts for initial premium.
- BTC or expiration activity for closes.
- STOCK legs for assigned shares.
- STO calls for covered-call income.
- BTC/STC legs for call closes and stock exits.

The app can identify Wheel-like trades, compute share exposure, and evaluate whether active short calls are covered by shares.

## Cost basis needs premium history

A simple stock cost basis is not enough for Wheel trading. Premium collected from puts and calls changes the economics of the position. GammaLedger keeps option-leg cash flows available so the effective cost basis can reflect the full history rather than only the assignment price.

That helps separate two different questions:

- What did the shares cost at assignment?
- What is the effective basis after option premium?

Both matter. Assignment cost explains stock exposure; effective cost basis explains strategy progress.

## PMCC coverage is different

A Poor Man's Covered Call uses a long call as stock replacement and sells shorter-dated calls against it. That means "coverage" cannot be checked only by counting shares. GammaLedger includes PMCC-aware logic so long-call exposure can be evaluated alongside short-call obligations.

For PMCC traders, the useful view is not only whether a short call exists. It is whether the short call is supported by the long call structure, whether expiration timing is sensible, and whether rolling activity is changing the risk profile.

## Rolls should stay in the same story

Rolling can make options performance look cleaner than it is if every roll becomes a separate trade. GammaLedger's merge and import workflows help keep related legs together, especially when a BTC and a new STO represent an adjustment to the same thesis.

Within the trade, roll history remains visible as legs. You can inspect when the debit or credit occurred, how strikes changed, and whether the cumulative outcome improved.

## Assigned positions get their own attention

Assigned stock is not a bookkeeping footnote. It changes capital usage and risk. GammaLedger's assigned-position tooling highlights share counts, active short-call coverage, uncovered shares, premium history, and effective cost basis where the data is available.

That makes the review more actionable:

- Fully covered positions can be monitored for call management.
- Partially covered positions can be sized correctly.
- Uncovered assigned shares are visible instead of buried in a trade note.

## A better Wheel journal

The Wheel and PMCC both reward patient recordkeeping. You need to know what happened across weeks or months, not just whether the latest option leg won.

GammaLedger's lifecycle model is built for that kind of review. It keeps the trade narrative intact, preserves leg-level cash flow, and surfaces coverage and assignment context where traders actually need it.
