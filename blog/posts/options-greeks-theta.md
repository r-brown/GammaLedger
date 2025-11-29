# Options Greeks: Theta

## What Is Theta?

Theta measures the time decay of an option or option spread. As we've seen in other parts of the course, options are decaying assets: they lose value over time. All things being equal, an option with a longer time until expiration is worth more. For example, an option with 60 days until expiration will be worth more than one with only 30 days left.

Theta, expressed as a negative value, represents the expected daily drop in an option's value, assuming no other factors change. For instance, at the time of writing, you can buy an at-the-money (ATM) June 13 445 AAPL call with 23 days until expiration for about $12. It has a Theta of -0.24, meaning it will lose $0.24 in the next 24 hours if nothing else changes, such as the share price or volatility.

## Uses of Theta

Theta is fundamental to many standard options trading strategies, particularly those involving selling options. Strategies where there are more sales than purchases have positive theta, meaning they increase in value over time.

For example, if you sell the above AAPL call options for $12 and nothing changes, you could buy them back the next day for $11.76, making a $0.24 profit. This simplistic example illustrates how theta can be used to profit. Consider a vertical spread: if you believe Apple's stock won't rise in the next 23 days, you could sell a 450 call and buy a 480 call, receiving a net credit of $4.70. The 450 call has a theta of -0.24, and the 480 call has a theta of -0.14, resulting in a net theta of -0.10. This strategy reduces the risk of a significant share price increase while still generating $0.10 per day, all things being equal.

## Effect of Time on Theta

Theta measures the impact of time on options pricing, but it also changes over time. Generally, theta increases as the option approaches expiration, meaning time decay accelerates closer to the expiration date.

Looking at the sold AAPL 445 call, it will lose $0.24 between day 23 and day 22. If theta were constant, the option would only lose 23 x $0.24 = $5.52 of its value by expiration. However, the option is worth $12, which must all be lost by day 23. Therefore, theta must increase at some point to account for this. The graph below illustrates this acceleration:

![Options Time Decay](path/to/graph.png)  <!-- Placeholder for the graph -->

Notice how the option's time value accelerates near the end of its life, reflecting the increase in theta.

## Gamma and Theta

You might wonder why not wait until the last few days to sell options, given the accelerating time decay. Unfortunately, it's not that simple. While theta increases, so does [gamma](#/options-greeks-gamma), which is the acceleration of the effect of stock price changes on the option price. Increasing time decay is matched by increasing sensitivity to price changes, meaning any time decay benefits could be wiped out by adverse stock price movements.

This interplay between theta and gamma is a good example of how the Greeks interact. Strategies that exploit theta must contend with gamma, and vice versa.