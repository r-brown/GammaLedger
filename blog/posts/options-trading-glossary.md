# Options Trading Glossary: Essential Terms

New to options trading? This glossary covers the essential terms you'll encounter when using GammaLedger and trading options.

## Basic Option Terms

### Call Option
A contract giving the buyer the **right** (but not the obligation) to **buy** 100 shares of stock at a specified price (strike price) before expiration.

### Put Option
A contract giving the buyer the **right** (but not the obligation) to **sell** 100 shares of stock at a specified price (strike price) before expiration.

### Strike Price
The predetermined price at which the option contract can be exercised. Also called the "exercise price."

### Expiration Date
The last day the option contract is valid. For standard monthly options, this is the third Friday of the month. Options expire at 4:00 PM ET on expiration day.

### Premium
The price paid (or received) for an option contract. Quoted on a per-share basis but contracts are for 100 shares.

**Example:** Premium of $2.50 = $250 per contract (2.50 × 100)

### In-the-Money (ITM)
- **Call**: Stock price > Strike price
- **Put**: Stock price < Strike price

### At-the-Money (ATM)
Stock price ≈ Strike price (within a few dollars)

### Out-of-the-Money (OTM)
- **Call**: Stock price < Strike price
- **Put**: Stock price > Strike price

## Trading Actions

### Buy to Open (BTO)
Opening a new **long** position by purchasing an option. You pay the premium.

### Sell to Open (STO)
Opening a new **short** position by selling an option. You collect the premium.

### Buy to Close (BTC)
Closing an existing **short** position by purchasing back the option you previously sold.

### Sell to Close (STC)
Closing an existing **long** position by selling the option you previously bought.

### Assignment
When an option seller is required to fulfill their obligation:
- **Put seller**: Must buy 100 shares at strike price
- **Call seller**: Must sell 100 shares at strike price

### Exercise
When an option buyer chooses to use their right to buy or sell shares at the strike price.

## Option Strategies

### Covered Call
Owning 100+ shares of stock and selling a call option against those shares. Generates income but caps upside.

### Cash-Secured Put (CSP)
Selling a put option while holding enough cash to purchase the shares if assigned. Generates income and potentially acquires stock at a discount.

### Wheel Strategy
Systematic approach: Sell CSPs → Get assigned → Sell covered calls → Repeat. See our [full Wheel Strategy guide](./understanding-wheel-strategy).

### PMCC (Poor Man's Covered Call)
Buying a deep ITM LEAP call and selling shorter-term OTM calls against it. Cheaper alternative to owning 100 shares.

### Credit Spread
Selling one option and buying another option of the same type (both calls or both puts) at different strikes. Defined-risk strategy.

### Vertical Spread
Generic term for spreads using options at different strikes but same expiration. Can be bullish or bearish.

### Iron Condor
Selling an OTM put spread and an OTM call spread simultaneously. Profits from low volatility.

### Straddle
Buying (or selling) both a call and put at the same strike and expiration. Bets on volatility (long) or lack thereof (short).

## The Greeks

### Delta (Δ)
Rate of change in option price relative to $1 move in underlying stock.
- **Call delta**: 0 to 1.0 (or 0 to 100)
- **Put delta**: -1.0 to 0 (or -100 to 0)
- **30 delta** ≈ 30% probability of expiring ITM

### Gamma (Γ)
Rate of change of delta. Measures how fast delta changes as stock price moves. Highest for ATM options near expiration.

### Theta (Θ)
Time decay. Amount option loses in value per day, all else equal. Always negative for long options.

### Vega (ν)
Sensitivity to implied volatility changes. Higher vega = more sensitive to volatility shifts.

### Rho (ρ)
Sensitivity to interest rate changes. Usually less important for retail traders.

## Profit & Loss Terms

### Unrealized P&L
Paper profit or loss on current open positions. Not "real" until position is closed.

### Realized P&L
Actual profit or loss from closed positions. "Locked in" gains or losses.

### Cost Basis
The effective entry price including premiums collected/paid. Used to calculate true P&L.

**Example:**
- Assigned 100 shares at $50 strike
- Collected $2 premium on put
- **Cost basis**: $48/share ($50 - $2)

### Break-Even
Stock price where a position results in zero profit/loss, accounting for all premiums and costs.

### Max Profit
The maximum possible gain from a strategy (if it exists).

### Max Loss
The maximum possible loss from a strategy (if it exists).

### Defined Risk
Strategies where maximum loss is known upfront (e.g., spreads).

### Undefined Risk
Strategies where losses could be unlimited (e.g., naked calls) or very large (e.g., naked puts).

## Time-Related Terms

### DTE (Days to Expiration)
Number of calendar days until option expiration. Important metric for time decay.

### Theta Decay
The daily erosion of option value due to time passing. Accelerates as expiration approaches.

### LEAPS (Long-term Equity Anticipation Securities)
Options with expiration dates more than 1 year away. Often used for PMCC strategy.

### Weekly Options
Options that expire weekly instead of monthly. More trading opportunities but also faster theta decay.

## Volatility Terms

### Implied Volatility (IV)
Market's expectation of future volatility, derived from option prices. Higher IV = more expensive options.

### IV Percentile
Where current IV ranks relative to the past year. 50th percentile = median IV over past year.

### IV Rank
Current IV relative to its 52-week high/low range. Formula: (Current IV - 52w Low) / (52w High - 52w Low)

### Volatility Crush
Sharp drop in IV after an event (e.g., earnings), causing rapid option value decrease even if stock price doesn't move much.

### Historical Volatility (HV)
Actual past volatility of the stock price. Different from implied volatility.

## Position Management

### Rolling
Closing an existing option position and simultaneously opening a new one at a different strike and/or expiration.

**Types:**
- **Roll out**: Same strike, later expiration
- **Roll up**: Higher strike (calls), same or later expiration
- **Roll down**: Lower strike (puts), same or later expiration

### Leg
One component of a multi-part option strategy. A vertical spread has two legs; an iron condor has four.

### Legging In/Out
Entering or exiting a multi-leg strategy one leg at a time instead of as a single order. Usually not recommended due to execution risk.

### Closing Order
Order to exit an existing position (BTC or STC).

### Opening Order
Order to enter a new position (BTO or STO).

## GammaLedger-Specific Terms

### Trade Status
Classification of trade state in GammaLedger:
- **Open**: Active position
- **Closed**: Completed trade
- **Assigned**: Put was assigned, now holding stock
- **Rolling**: In process of rolling to new strike/expiration

### Strategy Auto-Detection
GammaLedger automatically categorizes trades into strategies (Wheel, PMCC, Credit Spread, etc.) based on leg structure.

### Effective Cost Basis
GammaLedger's calculation of true entry price accounting for all premiums collected/paid across rolls.

### Net Open Contracts
Total number of unclosed option contracts after netting all opening and closing legs.

## Risk Management Terms

### Position Sizing
Determining how much capital to allocate to each trade. Common rule: no more than 5-10% per position.

### Buying Power Reduction (BPR)
Amount of margin/cash required to maintain a position. Varies by broker and strategy.

### Maintenance Margin
Minimum equity required to keep position open. If account falls below this, you'll get a margin call.

### Win Rate
Percentage of trades that are profitable. High win rate doesn't guarantee overall profitability.

### Profit Factor
Ratio of gross profits to gross losses. Above 1.5 is generally considered good.

### Expectancy
Average profit per trade. Formula: (Win Rate × Avg Win) - (Loss Rate × Avg Loss)

## Quick Reference

| Term | Definition |
|------|------------|
| **Long** | You own/bought the option |
| **Short** | You sold the option (obligation) |
| **Naked** | Selling options without owning underlying |
| **Covered** | Selling options while owning underlying |
| **Synthetic** | Option strategy that mimics stock position |
| **Collar** | Protective put + covered call on same stock |
| **Dividend Risk** | Risk of early assignment before ex-dividend date |
| **Pin Risk** | Risk of assignment uncertainty when stock = strike at expiration |

## Learning Resources

- [Getting Started with GammaLedger](./getting-started-with-gammaledger)
- [Understanding the Wheel Strategy](./understanding-wheel-strategy)
- [Options Clearing Corporation (OCC)](https://www.theocc.com/)
- [CBOE Education](https://www.cboe.com/education/)

## Common Abbreviations

- **BTO** = Buy to Open
- **STO** = Sell to Open
- **BTC** = Buy to Close
- **STC** = Sell to Close
- **CSP** = Cash-Secured Put
- **CC** = Covered Call
- **PMCC** = Poor Man's Covered Call
- **DTE** = Days to Expiration
- **ITM** = In-the-Money
- **ATM** = At-the-Money
- **OTM** = Out-of-the-Money
- **IV** = Implied Volatility
- **HV** = Historical Volatility
- **P&L** = Profit and Loss

---

*This glossary is for educational purposes. Always understand the risks before trading options. Consider paper trading before risking real capital.*
