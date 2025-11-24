# Understanding the Wheel Strategy

The Wheel Strategy is one of the most popular income-generating options strategies for retail traders. This guide explains how it works and how to track it effectively using GammaLedger.

## What is the Wheel Strategy?

The Wheel Strategy is a systematic approach to selling options that generates premium income while potentially acquiring stock at a discount. It consists of three phases:

1. **Sell Cash-Secured Puts** (CSP)
2. **Get Assigned Stock** (if put expires ITM)
3. **Sell Covered Calls** (CC) on the assigned stock

The strategy "wheels" between these phases, hence the name.

## Phase 1: Cash-Secured Puts

### The Setup

You sell a put option on a stock you wouldn't mind owning, with strike price at or below your target entry price.

**Example:**
- Stock XYZ trading at $50
- Sell 1 PUT at $45 strike, 30 DTE
- Collect $1.00 premium ($100 total)

### Requirements
- **Cash Reserve**: $4,500 (strike × 100 shares)
- **Collateral**: Held in your account as margin

### Outcomes
- **Put expires OTM**: Keep premium, repeat
- **Put expires ITM**: Get assigned 100 shares at $45

## Phase 2: Assignment

If your put expires in-the-money, you're assigned 100 shares at the strike price.

**Continuing the example:**
- Stock drops to $44
- Assigned 100 shares at $45 = $4,500 cost
- Effective cost basis: $45 - $1.00 = $44/share
- **Unrealized Loss**: $100 (stock worth $4,400)

But you've collected $100 in premium, so break-even at current price!

## Phase 3: Covered Calls

Now that you own the stock, sell covered calls to generate additional income.

**Example:**
- Own 100 shares at $45 cost basis
- Stock currently at $44
- Sell 1 CALL at $47 strike, 30 DTE
- Collect $0.75 premium ($75 total)

### Outcomes
- **Call expires OTM**: Keep premium and stock, sell another call
- **Call expires ITM**: Shares called away at $47

## Completing the Wheel

If your shares get called away:

**Total P&L:**
- Initial PUT premium: +$100
- CALL premium: +$75
- Stock appreciation: $47 - $45 = +$200
- **Total Profit**: $375 on $4,500 capital = **8.3% return**

Then you start over with Phase 1!

## Tracking with GammaLedger

### Wheel/PMCC Tracker View

GammaLedger automatically identifies Wheel positions and provides:

- **Entry Date**: When you first sold the put
- **Ticker**: Stock symbol
- **Shares**: Current position (100 per contract)
- **Cost Basis**: Effective entry price (strike - premiums)
- **Market Value**: Current value of shares
- **Unrealized G/L**: Current profit/loss on position
- **DTE**: Days to expiration for active covered call
- **Strike**: Current covered call strike price

### Active Positions Integration

Assigned Wheel positions with open covered calls appear in the **Active Positions** table, showing:
- Current DTE
- Strike price of the covered call
- Status (assigned with call written)

## Advanced Wheel Strategies

### Rolling Puts

If a put is going ITM but you want to avoid assignment:

1. Buy to close (BTC) the current put
2. Sell to open (STO) a new put at lower strike or further DTE
3. Collect net credit on the roll

**GammaLedger tracks rolls automatically** and shows:
- Net premium collected
- Current strike and expiration
- Total premium earned on position

### Rolling Covered Calls

If stock price rises and your covered call is ITM but you want to keep shares:

1. BTC the current call
2. STO a new call at higher strike or further DTE
3. Collect net credit (or pay small debit)

**Example in GammaLedger:**
- Original CALL: 45 strike, collected $1.00
- Stock rises to $46
- Roll to 47 strike: pay $1.50 to close, collect $2.00 to open
- Net credit on roll: $0.50
- **Total premium**: $1.50 across both legs

## Risk Management

### Key Metrics to Monitor

1. **Cost Basis**: Track your effective entry price
2. **Unrealized Loss**: How far underwater on stock
3. **Total Premium Collected**: Income cushion
4. **DTE Management**: Don't let calls expire worthless too often

### When to Exit

Consider closing a Wheel position if:

- Stock fundamentals deteriorate
- Unrealized loss exceeds total premiums by 20%+
- Better opportunities elsewhere
- Position size too large relative to portfolio

## Best Practices

### Stock Selection

Choose stocks that:
- ✅ You'd be comfortable owning long-term
- ✅ Have liquid options (tight bid-ask spreads)
- ✅ Show stable price action (not extreme volatility)
- ✅ Have fundamental support (not meme stocks)

### Strike Selection

**For Puts:**
- Target 0.30 - 0.40 delta (30-40% probability of assignment)
- At or below key support levels
- Calculate yield: premium ÷ (strike × 100)

**For Calls:**
- Target 0.30 - 0.40 delta for covered calls
- Above your cost basis to ensure profit
- Balance premium vs. likelihood of assignment

### Position Sizing

- Limit individual positions to 5-10% of portfolio
- Ensure sufficient cash reserve for assignments
- Diversify across sectors

## Example Wheel Cycle in GammaLedger

Here's how a complete Wheel cycle appears in GammaLedger:

```
Trade ID: AAPL-WHEEL-001
Strategy: Wheel
Status: Closed

Legs:
1. 2025-09-15: STO 1 PUT AAPL 170 Oct 20, 2025 @ 3.50 [+$350]
2. 2025-10-20: ASSIGNED 100 AAPL @ $170 [-$17,000]
3. 2025-10-21: STO 1 CALL AAPL 175 Nov 17, 2025 @ 2.25 [+$225]
4. 2025-11-17: CALLED AWAY 100 AAPL @ $175 [+$17,500]

Summary:
Entry: $170 PUT premium
Exit: $175 CALL assignment
Premium Collected: $575
Stock Gain: $500
Total Profit: $1,075
Return: 6.3%
Duration: 63 days
Annualized: 36.5%
```

## Common Mistakes to Avoid

1. **Selling puts on stocks you don't want to own**
   - Solution: Only wheel quality stocks

2. **Selling calls below cost basis**
   - Solution: Wait for stock recovery or roll down carefully

3. **Ignoring unrealized losses**
   - Solution: Use GammaLedger's Unrealized G/L tracking

4. **Over-concentrating in one position**
   - Solution: Diversify across multiple Wheel positions

5. **Not rolling when appropriate**
   - Solution: Monitor DTE and be proactive

## Conclusion

The Wheel Strategy combines:
- Consistent premium income
- Potential stock ownership at discount
- Defined risk (cash-secured)
- Flexibility through rolling

GammaLedger makes tracking Wheel positions effortless with:
- Automatic strategy detection
- Real-time P&L calculations
- Visual tracking of phases
- Performance analytics

Ready to start tracking your Wheel trades? [Launch GammaLedger](https://gammaledger.com/app/) and import your positions today!

## Further Reading

- [Getting Started with GammaLedger](./getting-started-with-gammaledger)
- [PMCC Strategy Guide](#) *(coming soon)*
- [Options Greeks Explained](#) *(coming soon)*
