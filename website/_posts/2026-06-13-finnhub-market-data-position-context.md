---
layout: post
title: "Adding Market Context with Finnhub: Quotes, Earnings, News, and Position Detail"
slug: finnhub-market-data-position-context
date: 2026-06-13
description: "How GammaLedger uses optional Finnhub integration to enrich position review with quotes, company data, earnings, news, recommendations, and risk context."
tags: [gammaledger, finnhub, market-data, position-detail, options]
image: /assets/img/gammaledger-market-data-context.png
---

Trade history explains what you did. Market context helps explain what you are holding now. GammaLedger's optional Finnhub integration adds that context to open positions and detail panels without changing the local-first nature of the core journal.

The key word is optional. You can track trades, calculate P&L, review strategies, and export data without a market-data key. Finnhub is useful when you want live or refreshed context around tickers, prices, earnings, and related company information.

## What the integration adds

With a Finnhub API key configured, GammaLedger can enrich position review with data such as:

- Current quote information.
- Company profile context.
- Earnings calendar and earnings-surprise data.
- News snippets.
- Analyst recommendation trends.
- Insider transaction context.
- Related signals used in position detail panels.

This does not turn GammaLedger into a broker terminal. It adds reference data around the trades you already track.

## Rate limits matter

Finnhub plans have rate limits. GammaLedger includes a configurable requests-per-minute setting so users can tune behavior for their plan. Free accounts commonly need more conservative limits than paid accounts.

If data appears delayed or incomplete, check three things:

1. The API key is saved correctly.
2. The rate limit setting fits the account plan.
3. The requested data is available for that ticker and market.

Market-data APIs can return missing, delayed, or limited data. Always confirm critical data with your broker or official sources.

## Position detail is where context pays off

The most useful place for market context is the position detail panel. When reviewing an open options position, the trader often wants to see more than P&L:

- Is earnings approaching before expiration?
- Is the underlying close to a strike?
- Is recent news changing the risk story?
- Are recommendation trends or company context relevant?
- Is a Wheel or PMCC stock leg exposed to live price movement?

GammaLedger combines leg-level trade data with optional market context so those questions can be reviewed in one place.

## Local journal, external quotes

When Finnhub is enabled, requests may include API keys, ticker symbols, date ranges, and query parameters. The provider returns market data that GammaLedger displays or uses for enrichment.

Your trade database is still local, but quote requests necessarily involve the provider. That is the right mental model: journal locally, enrich selectively.

## When to use it

Finnhub is most useful if you actively manage open positions. It can help with:

- Wheel assignments and covered-call decisions.
- PMCC exposure checks.
- Earnings-aware expiration review.
- Position detail context before rolling or closing.
- Dashboard refreshes where current prices matter.

If you only journal closed trades after the fact, you may not need live market context. If you review open positions daily, the integration can save time.

## Keep the source of truth clear

Market data is context, not confirmation. Broker statements and execution records remain the source of truth for fills, cash, fees, and tax records. GammaLedger uses market data to make review easier, but your journal accuracy still depends on correct trade entries and imports.
