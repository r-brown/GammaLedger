---
layout: post
title: "Tracking Multi-Leg Options Trades Without Losing the Story"
slug: multi-leg-options-tracking-gammaledger
date: 2026-05-01
description: "How GammaLedger models option legs, cash flows, rolls, closes, stock assignments, and cash settlement inside one coherent trade record."
tags: [gammaledger, multi-leg, options, trade-management, analytics]
image: /assets/img/gammaledger-multi-leg-lifecycle.png
---

A useful options journal has to preserve the story of a position. A trade is rarely just one row. It might start as a cash-secured put, become assigned stock, collect covered-call premium, roll out, close partially, and finish with a stock sale. If each execution lives in isolation, the trader loses the real lifecycle.

GammaLedger models that lifecycle with trade legs. Each leg records the execution details that matter: order type, instrument type, quantity, execution date, expiration date, strike, premium, fees, multiplier, and optional underlying price. The trade is the container; the legs explain how the position changed over time.

## Why leg order matters

Leg order is more than cosmetic. Traders read a position chronologically: first entry, later adjustment, roll, close, assignment, settlement. GammaLedger's trade breakdown uses the leg sequence and execution dates to show cumulative cash flow and explain how the trade got from entry to current status.

That is especially important after imports. Broker files and AI screenshot drafts can arrive as separate records. When you merge imported trades into an existing position, new imported legs should append to the trade rather than becoming the first leg. The journal should show what happened in the order the trader experienced it.

## Supported leg types

GammaLedger normalizes common option activity into a small set of leg types and order types:

- CALL and PUT option legs.
- STOCK legs for shares bought, sold, or assigned.
- CASH legs for cash settlement events.
- BTO, STO, BTC, and STC order types.

That consistent internal model lets different workflows share the same analytics. Manual entry, OFX/QFX import, Robinhood CSV import, and AI screenshot drafts all end up as normalized legs that downstream calculations can understand.

## Cash flow from the leg up

Realized P&L starts with leg cash flow. GammaLedger calculates the cash effect of each leg from action, premium, multiplier, quantity, and fees. Sell-side legs add credit; buy-side legs create debit. Stock legs and cash-settlement legs are handled with their own semantics so assignments and settlement events do not disappear into notes.

Once each leg has a cash flow, GammaLedger can summarize:

- Total credit and debit.
- Total fees.
- Open and close cash flow.
- Net cash flow.
- Open and closed contract counts.
- Entry and exit prices where applicable.

This is the foundation for dashboard charts, strategy attribution, and trade detail panels.

## Lifecycle status is derived, not guessed

Options positions need lifecycle logic. A trade may be open, rolling, closed, assigned, expired, or awaiting coverage. GammaLedger evaluates legs to infer whether open contracts remain, whether closing legs offset openings, whether stock assignment changed the position, and whether expiration or post-expiration activity should affect status.

That means status is not just a label you set once. It is a calculation driven by the shape of the legs, with room for manual overrides where needed.

## Manual entry still matters

Imports are efficient, but manual trade entry remains the cleanest path for planned positions. The add-trade form lets you build a multi-leg trade directly, set defaults like fee per contract, add notes, and create closing legs from existing rows.

For active traders, that creates a practical rhythm:

1. Enter planned trades with full context.
2. Import broker fills to reconcile execution.
3. Merge related imported records into the existing trade.
4. Use the breakdown to confirm cash flow and lifecycle status.

The payoff is clarity. Instead of a list of disconnected executions, GammaLedger gives you one position narrative with leg-level detail.
