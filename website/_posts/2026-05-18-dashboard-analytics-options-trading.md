---
layout: post
title: "Reading the GammaLedger Dashboard: From P&L to Strategy Attribution"
slug: dashboard-analytics-options-trading
date: 2026-05-18
description: "A walkthrough of GammaLedger dashboard analytics, including cumulative P&L, win rates, strategy performance, fees, heatmaps, time in trade, and Monte Carlo projection."
tags: [gammaledger, dashboard, analytics, pnl, options]
image: /assets/img/gammaledger-dashboard-analytics.png
---

An options journal is only useful if it turns execution history into feedback. GammaLedger's dashboard is designed to answer a trader's recurring review questions: What is working? What is dragging? Which strategies justify their capital? Are fees eating the edge? How long do winners and losers stay open?

The dashboard is not a prediction engine. It is a measurement surface. It gives structure to the trading history you have entered or imported.

## Core performance metrics

At the top level, GammaLedger summarizes realized P&L, win rate, profit factor, ROI, active positions, and related portfolio statistics. These numbers provide a quick read on whether the account history is moving in the right direction.

The important habit is to treat top-line metrics as a starting point, not a conclusion. A high win rate can still hide large losses. A strong P&L can come from one ticker. A low ROI can reflect idle capital or oversized collateral. The rest of the dashboard helps explain the top line.

## Cumulative P&L

The cumulative P&L chart shows how realized results developed over time. This is one of the clearest ways to see whether performance is smooth, lumpy, seasonal, or dependent on a few outsized events.

GammaLedger includes range controls so you can review different timeframes. That matters because a strategy can look healthy over all history and weak over the last month, or noisy over the last week and robust over a year.

## Strategy performance

Strategy attribution is where an options tracker becomes more than a trade list. GammaLedger groups results by strategy so you can compare cash-secured puts, covered calls, spreads, PMCCs, Wheel trades, and other position types.

Useful review questions include:

- Which strategies produce consistent credit relative to risk?
- Which strategies generate the most fees?
- Which strategies close quickly and which tie up capital?
- Do complex spreads outperform simpler trades after commissions?

The dashboard does not force a conclusion. It makes the comparison visible.

## Win rate by strategy

A strategy-level win-rate chart helps separate "I feel good about this setup" from "this setup has actually worked in my journal." For premium sellers, win rate often matters, but it must be read with profit factor and average loss size.

A strategy that wins often but loses heavily needs different risk rules. A lower win-rate strategy may still work if winners are materially larger than losers.

## Commission impact

Options strategies can be fee-intensive. Multi-leg spreads, rolls, and partial closes add transaction costs quickly. GammaLedger's commission-impact chart helps show how much realized turnover is consumed by fees.

That view is especially useful when comparing complex defined-risk strategies against simpler single-leg or two-leg trades. If the gross edge is small, fees may decide whether the strategy is worth repeating.

## Heatmaps, time in trade, and projections

GammaLedger includes a ticker performance heatmap to surface concentration and symbol-specific performance. It also tracks time in trade, helping you identify whether losses stay open longer than winners or whether certain strategies require more patience than expected.

The Monte Carlo projection uses historical return behavior to visualize possible forward paths. It should be treated as a scenario tool, not a forecast. Its value is in stress-testing expectations and making uncertainty visible.

## Review rhythm

A practical dashboard review can be short:

1. Check cumulative P&L and recent range.
2. Review strategy performance and win rate by strategy.
3. Check ticker concentration.
4. Inspect fees.
5. Open trade details for outliers.
6. Write down one change to test next.

GammaLedger's dashboard is built for that loop: measure, investigate, adjust, and keep the journal honest.
