# What Is Gamma?

The Greeks are essential metrics used by options traders to evaluate the impact of changes in various factors on an option's price. One of these metrics is delta, which measures the sensitivity of an option's price to changes in the price of the underlying security.

However, the relationship between delta and the underlying stock price is not linear. For instance, if a stock price rises, call options become more sensitive to further price movements. This effect is known as gamma, which measures the change in delta or the sensitivity to stock price movements.

Positive gamma means that as a stock price rises, the option's price becomes more sensitive to further changes. Conversely, negative gamma means that as the stock price rises, the option's price becomes less sensitive.

## Why Should We Be Concerned About Gamma?

Gamma is a significant risk factor for many options strategies. It tends to increase as an option approaches its expiration date. In the final week of an option's life, small changes in the stock price can cause large and accelerating swings in the option's price.

This is problematic because many popular strategies, such as the [iron condor](post.html#/advanced-options-spreads) or calendar spread, rely on [time decay](post.html#/options-greeks-theta) to generate profits. Traders must balance the potential profits from time decay against the increasing risk of stock movements wiping out those profits.

For this reason, experienced options traders rarely hold a position until expiration. We take a risk-averse approach, typically exiting time decay-exploiting trades at least two weeks before expiration to avoid gamma risk. For example, in our trade rules for a calendar spread, the last 'Trade Management – Exit' rule specifies exiting the trade within two weeks of expiration to mitigate gamma risk.

Trading positions with high gamma, such as those in the expiration week, is colloquially known as 'riding the gamma bull' and is not for the faint-hearted.

## Uses of Gamma

While gamma is often seen as a risk, it can be advantageous in certain strategies that do not rely on time decay. Some trades exploit the accelerating price sensitivity from gamma to profit from expected stock price movements.

One example is the simultaneous purchase of an at-the-money put and call, known as a straddle. Suppose a stock is trading at $650, and we expect significant movement due to a product launch. We might buy a $650 call and a $650 put. This straddle has strong gamma, meaning stock movements will not only increase the spread's price but also amplify these price changes as the stock moves further in either direction.

The primary risk here is time decay. If the stock does not move, the spread will gradually lose value. The trader must be confident that the stock will move quickly to make the trade profitable.

## Gamma Scalping

An advanced use of gamma is 'gamma scalping,' a complex strategy that takes advantage of the boost in option price changes from excessive stock movement while managing delta risk. This strategy is typically used by experienced traders and may be covered in a later advanced post. For now, most traders should focus on understanding the basics of gamma.