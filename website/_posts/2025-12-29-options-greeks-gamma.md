---
layout: post
title: "Options Greeks: Gamma"
slug: options-greeks-gamma
date: 2025-12-29
description: "Understanding gamma in options trading: how it measures delta's change and its implications for risk and strategy."
tags: [options, greeks, gamma, risk, guide]
image: /assets/img/gamma.png
---

<p>The Greeks are essential metrics used by options traders to evaluate the impact of changes in various factors on an option's price. One of these metrics is delta, which measures the sensitivity of an option's price to changes in the price of the underlying security.</p>
<p>However, the relationship between delta and the underlying stock price is not linear. For instance, if a stock price rises, call options become more sensitive to further price movements. This effect is known as gamma, which measures the change in delta or the sensitivity to stock price movements.</p>
<p>Positive gamma means that as a stock price rises, the option's price becomes more sensitive to further changes. Conversely, negative gamma means that as the stock price rises, the option's price becomes less sensitive.</p>
<h2 id="why-should-we-be-concerned-about-gamma">Why Should We Be Concerned About Gamma?</h2>
<p>Gamma is a significant risk factor for many options strategies. It tends to increase as an option approaches its expiration date. In the final week of an option's life, small changes in the stock price can cause large and accelerating swings in the option's price.</p>
<p>This is problematic because many popular strategies, such as the <a href="https://gammaledger.com/blog/advanced-options-spreads/">iron condor</a> or calendar spread, rely on <a href="https://gammaledger.com/blog/options-greeks-theta/">time decay</a> to generate profits. Traders must balance the potential profits from time decay against the increasing risk of stock movements wiping out those profits.</p>
<p>For this reason, experienced options traders rarely hold a position until expiration. We take a risk-averse approach, typically exiting time decay-exploiting trades at least two weeks before expiration to avoid gamma risk. For example, in our trade rules for a calendar spread, the last 'Trade Management – Exit' rule specifies exiting the trade within two weeks of expiration to mitigate gamma risk.</p>
<p>Trading positions with high gamma, such as those in the expiration week, is colloquially known as 'riding the gamma bull' and is not for the faint-hearted.</p>
<h2 id="uses-of-gamma">Uses of Gamma</h2>
<p>While gamma is often seen as a risk, it can be advantageous in certain strategies that do not rely on time decay. Some trades exploit the accelerating price sensitivity from gamma to profit from expected stock price movements.</p>
<p>One example is the simultaneous purchase of an at-the-money put and call, known as a straddle. Suppose a stock is trading at $650, and we expect significant movement due to a product launch. We might buy a $650 call and a $650 put. This straddle has strong gamma, meaning stock movements will not only increase the spread's price but also amplify these price changes as the stock moves further in either direction.</p>
<p>The primary risk here is time decay. If the stock does not move, the spread will gradually lose value. The trader must be confident that the stock will move quickly to make the trade profitable.</p>
<h2 id="gamma-scalping">Gamma Scalping</h2>
<p>An advanced use of gamma is 'gamma scalping,' a complex strategy that takes advantage of the boost in option price changes from excessive stock movement while managing delta risk. This strategy is typically used by experienced traders and may be covered in a later advanced post. For now, most traders should focus on understanding the basics of gamma.</p>
        </div>
        <!-- Disclaimer -->
        <div class="article-disclaimer">
            <strong>Disclaimer:</strong> The content provided on GammaLedger is for informational and educational purposes only and does not constitute financial, investment, or professional advice. The information is based on publicly available data and personal analysis and is not guaranteed to be accurate, complete, or current. Readers are advised to conduct their own research and consult a qualified financial advisor or professional before making any investment or trading decisions. GammaLedger and its affiliates do not accept any liability for losses or damages resulting from reliance on the information presented. The opinions expressed are those of the author and do not necessarily reflect the views of any affiliated organizations or sponsors. Please read our full <a href="https://gammaledger.com/disclaimer.html">Risk Disclaimer</a>.
