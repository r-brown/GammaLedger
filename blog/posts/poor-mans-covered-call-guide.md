# Poor Man's Covered Call Guide: Income Strategies for Small Accounts

*Generate covered call income with 70-80% less capital using LEAPS options*

---

## What is a Poor Man's Covered Call (PMCC)?

The Poor Man's Covered Call is a capital-efficient options strategy that replicates [traditional covered calls](post.html#/cash-secured-puts-vs-covered-calls) while requiring significantly less capital. Instead of buying 100 shares of stock (which could cost $10,000-$40,000), you buy a long-term deep in-the-money call option (LEAPS) as a stock replacement, then sell short-term calls against it.

**The core concept:**
- **Traditional Covered Call:** Own 100 shares + sell call = Requires full stock price × 100
- **Poor Man's Covered Call:** Own LEAPS call + sell call = Requires only 20-30% of stock cost

This strategy is perfect for traders with smaller accounts who want to generate income through covered calls but don't have the capital to own hundreds of shares of expensive stocks. For a more traditional approach with full stock ownership, see the [Complete Wheel Strategy Guide](post.html#/complete-wheel-strategy-guide).

---

## Why the PMCC Works

### Capital Efficiency

**Traditional Covered Call Example:**
- Stock: AMD at $120
- Buy 100 shares: $12,000 capital required
- Sell weekly $125 call: Collect $85 premium
- Weekly return: 0.71%

**Poor Man's Covered Call Example:**
- Stock: AMD at $120
- Buy Jan 2026 $80 LEAPS call: $4,200 capital required
- Sell weekly $125 call: Collect $85 premium
- Weekly return: 2.0%

**Result:** Nearly 3x better capital efficiency with similar profit potential.

### The LEAPS as Stock Replacement

A LEAPS (Long-term Equity AnticiPation Security) is simply an option with more than 12 months until expiration. When you buy a deep in-the-money LEAPS with high delta (0.70-0.85), it behaves very similarly to owning the stock:

**If stock moves up $1:**
- Owning 100 shares: Gain $100
- Owning LEAPS with 0.75 delta: Gain ~$75

The LEAPS captures 75-85% of stock movement while costing only 20-35% of the stock price.

### Limited Downside Risk

Unlike owning stock where you can lose the entire purchase price if the stock crashes to zero, your maximum loss with a PMCC is limited to the LEAPS cost. Plus, any premium collected from short calls reduces this risk further.

**Example:**
- Own AMD shares at $120: Maximum loss = $12,000
- Own AMD $80 LEAPS at $42: Maximum loss = $4,200 (minus premiums collected)

---

## How to Set Up a PMCC: Step-by-Step

### Step 1: Select the Right Stock

Not every stock works well for PMCCs. Look for:

1. **High liquidity**
   - Daily volume >1 million shares
   - Tight bid-ask spreads on options
   - Plenty of open interest (100+ contracts) on LEAPS

2. **Moderate to high volatility**
   - Implied Volatility (IV): 35-70%
   - Higher IV = better premium collection
   - But not so high that LEAPS are prohibitively expensive

3. **Bullish to neutral bias**
   - Stock in uptrend or stable range
   - Above 50-day and 200-day moving averages preferred
   - Positive technical momentum

4. **Reasonable stock price**
   - Sweet spot: $50-$200 per share
   - Below $50: Premium too small
   - Above $200: LEAPS too expensive

**Top PMCC stocks for 2025:**
- **AMD** (great liquidity, good volatility)
- **The Trade Desk (TTD)** (strong growth, active options)
- **Palantir (PLTR)** (high IV, popular with traders)
- **Apple (AAPL)** (stable, huge liquidity)
- **Tesla (TSLA)** (expert level - very volatile)
- **Microsoft (MSFT)** (stable, consistent)
- **NVIDIA (NVDA)** (high volatility, requires larger capital)

### Step 2: Buy Your LEAPS Call

**Using AMD as example (stock at $120):**

1. Open your broker's options chain
2. Navigate to expiration 12-24 months out (e.g., Jan 2026)
3. Find strikes with delta 0.70-0.85
4. Look for strike around $80-$90 for AMD

**What you'll see:**
- Jan 2026 $80 call
- Bid: $41.50 / Ask: $42.50
- Delta: 0.78
- **Cost: $42.00 = $4,200 per contract**

**Before entering:**
- Check bid-ask spread (should be tight)
- Verify delta is in target range
- Confirm you have at least 12 months of time

**Execute:** Buy to open 1 contract of Jan 2026 $80 call at $42.00

### Step 3: Sell Your First Short Call

**Immediately after buying LEAPS (or within same day):**

1. Navigate to near-term expiration (7-45 days out)
2. Find OTM strike with 0.20-0.35 delta
3. For weekly: typically 2-5% above current price
4. For monthly: typically 5-8% above current price

**Example - Weekly approach:**
- Current price: $120
- Target strike: $125 (4.2% above current)
- Expiration: This Friday (7 DTE)
- Premium: $0.85 ($85)

**Execute:** Sell to open 1 contract of $125 call at $0.85

**Your complete position:**
- Long: 1 Jan 2026 $80 call (cost $4,200)
- Short: 1 weekly $125 call (credit $85)
- **Net investment: $4,115**

---

## Managing Your PMCC: The Weekly Routine

### Monday: Position Review

**Check each PMCC position:**
- Current stock price vs your strikes
- Short call delta (is it still <0.35?)
- Days to expiration on short call
- Overall P&L on position

**Action items:**
- If short call is at 50-70% profit, consider closing early
- If short call went ITM over weekend, plan adjustment
- If short call expires this week, prepare next week's strike

### Tuesday-Thursday: Monitoring and Adjustments

**If stock moved up (short call threatened):**
- **Option A:** Roll up and out (close current, sell higher strike, later date)
- **Option B:** Let it run if you have profit buffer
- **Option C:** Take profit on entire PMCC if gains are substantial (20-30%)

**If stock moved down:**
- **Option A:** Close short call early for profit, sell new one immediately
- **Option B:** Let it expire and sell next week's call
- **Option C:** Consider "doubling down" - sell a put to generate additional income

**If stock sideways:**
- Perfect scenario
- Let theta decay work in your favor
- Prepare next week's call sale

### Friday: Expiration Management

**For weekly calls expiring today:**

**Scenario 1: Stock below strike (profitable)**
- Short call expires worthless ✓
- Immediately sell next week's call
- Strike selection: 2-5% above current price

**Scenario 2: Stock near strike (danger zone)**
- If stock within $0.50 of strike, close the call
- Cost might be $0.05-$0.15
- Eliminates assignment risk
- Sell new call on Monday

**Scenario 3: Stock above strike (challenged)**
- LEAPS went up in value significantly
- Short call deep ITM
- Consider: Take entire profit and close PMCC
- Or: Roll short call up and out for credit

### Weekend: Performance Review

**Calculate weekly results:**
- Premium collected this week
- Current LEAPS value vs cost
- Total position P&L
- Weekly return on capital

**Plan next week:**
- Which strikes to target
- Evaluate if stock still meets criteria
- Consider earnings calendar
- Adjust position size if needed

---

## Real Trade Examples with Numbers

### Example 1: AMD PMCC - Smooth Winning Trade

**Week 0: Setup**
- AMD trading at $118
- Buy Jan 2026 $80 call @ $42.00 (cost: $4,200)
- Sell weekly $124 call @ $0.70 (credit: $70)
- Net cost: $4,130

**Week 1: First expiration**
- AMD closes at $121 (below $124 strike) ✓
- Short call expires worthless
- Profit: $70
- Sell next week $126 call @ $0.75 (credit: $75)

**Week 2-4: Continued execution**
- Week 2: Collect $0.72 ($72) - AMD at $123
- Week 3: Collect $0.80 ($80) - AMD at $125
- Week 4: Collect $0.68 ($68) - AMD at $122

**Four-week results:**
- Total premium collected: $265
- LEAPS value: $43.50 ($4,350)
- Total gain: $265 + ($4,350 - $4,200) = $415
- Return: 10% in one month
- **Annualized: 120%**

### Example 2: The Trade Desk (TTD) - Managing Pullback

**Week 0: Setup**
- TTD trading at $70
- Buy Jan 2026 $45 call @ $28.50 (cost: $2,850)
- Sell weekly $74 call @ $0.85 (credit: $85)
- Net cost: $2,765

**Week 1: Stock drops**
- TTD drops to $66 (below $74 strike) ✓
- Short call expires worthless
- Profit: $85
- LEAPS value dropped to $23.50 (unrealized loss: $500)
- Sell $70 call @ $0.95 (credit: $95) - adjust strike down

**Week 2: Recovery begins**
- TTD rises to $68
- Close $70 call at $0.45 (profit: $50)
- Sell $72 call @ $0.88 (credit: $88)

**Week 3-4: Back to profit**
- TTD rises to $72
- Collect another $0.90 weekly
- LEAPS value back to $29.00

**Four-week results despite pullback:**
- Total premium: $318
- LEAPS value: $29.00 (gain: $150)
- Total gain: $468
- Return: 16.9% in one month
- **Handled 6% stock drop successfully**

### Example 3: Palantir (PLTR) - Taking Profits on Rally

**Week 0: Setup**
- PLTR trading at $22
- Buy Jan 2026 $14 call @ $10.20 (cost: $1,020)
- Sell weekly $23.50 call @ $0.35 (credit: $35)
- Net cost: $985

**Week 1: Rocket ship** 🚀
- PLTR surges to $26 (way above $23.50)
- Short call now ITM
- LEAPS value: $13.50 ($1,350)
- Short call value: $2.50 (loss: $215 on short call)

**Decision: Take profits**
- Close short $23.50 call @ $2.50 (loss: $215)
- Sell LEAPS @ $13.50 (gain: $330)
- Total profit: $330 - $215 + $35 = $150
- Return: 15.2% in one week

**Key lesson:** When you hit 15-25% total return on PMCC, consider taking profit. Don't be greedy.

---

## PMCC vs Traditional Covered Calls: The Real Comparison

Let's compare identical strategies with different capital requirements:

### Scenario: AAPL at $180

**Traditional Covered Call:**
- Buy 100 shares @ $180 = $18,000 capital
- Sell weekly $185 call @ $1.50 = $150 premium
- Weekly return: 0.83%
- Capital requirement: $18,000

**PMCC Approach:**
- Buy Jan 2026 $140 LEAPS @ $44.00 = $4,400 capital
- Sell weekly $185 call @ $1.45 = $145 premium
- Weekly return: 3.3%
- Capital requirement: $4,400

**Key differences:**

| Factor | Covered Call | PMCC |
|--------|--------------|------|
| Capital required | $18,000 | $4,400 |
| Weekly premium | $150 | $145 |
| Weekly ROI | 0.83% | 3.3% |
| Downside risk | Unlimited below $180 | Limited to LEAPS cost |
| Upside potential | Limited to strike | Limited to strike |
| Dividend income | Yes | No |
| Time decay on long | None | Yes (but minimal on deep ITM) |

**When to choose Covered Calls:**
- You have ample capital
- You want dividends
- You prefer no expiration concern
- Stock is very stable

**When to choose PMCC:**
- Smaller account (<$50k)
- Want to trade multiple positions
- Comfortable with options mechanics
- Don't need dividends

---

## Advanced PMCC Techniques

### The "Doubling Down" Strategy

When your PMCC stock drops but fundamentals remain solid:

**Add a short put for extra income:**
- Already have: Long LEAPS + Short call
- Add: Sell cash-secured put below current price
- Collect double premium
- Risk: Could be assigned shares

**Example:**
- PMCC on AMD: Long Jan 2026 $80 call, Short weekly $125 call
- AMD drops from $120 to $115
- Sell $110 put for $1.20 ($120 premium)
- Total weekly income: Call premium + Put premium

### The "Weekly Sprint" Approach

Instead of 30-45 DTE short calls, sell weekly options:

**Advantages:**
- More frequent premium collection
- Faster compounding
- Can adjust strikes weekly based on momentum

**Disadvantages:**
- More gamma risk
- Requires more active management
- Higher chance of assignment

**Best for:** Traders who can monitor daily

### The "Layered" PMCC

For larger accounts, layer multiple PMCCs at different strikes:

**Example on MSFT:**
- Position 1: Long $300 LEAPS, Sell $360 calls
- Position 2: Long $320 LEAPS, Sell $370 calls
- Position 3: Long $340 LEAPS, Sell $380 calls

**Benefits:**
- Diversified entry points
- Average out timing risk
- Some positions profit even if stock pulls back

---

## Risk Management for PMCC

### Maximum Loss Scenarios

**Worst case:** Stock crashes to zero
- Loss: Entire LEAPS cost (e.g., $4,200)
- Partially offset by short call premiums collected
- This is why stock selection is critical

**Manageable case:** Stock drops 20-30%
- LEAPS loses value but doesn't expire for 12+ months
- Continue selling calls to collect premium
- LEAPS may recover as stock recovers

### Position Sizing Rules

**Rule 1: Never allocate more than 10-15% per PMCC**
- $10,000 account: Max $1,000-$1,500 per PMCC
- $25,000 account: Max $2,500-$3,750 per PMCC
- $50,000 account: Max $5,000-$7,500 per PMCC

**Rule 2: Start with 1-2 positions**
- Master the mechanics before scaling
- Learn adjustment strategies
- Build confidence through experience

**Rule 3: Reserve capital for adjustments**
- Keep 20% cash for rolling or closing positions
- Don't deploy 100% of capital immediately

### When to Close a PMCC Early

**Close for profit when:**
- Total position gain reaches 20-30% (take wins)
- Stock had major rally and LEAPS significantly increased
- You need capital for better opportunity

**Close for loss when:**
- Company fundamentals deteriorate
- LEAPS has lost 50%+ and stock broken key support
- Better to redeploy capital elsewhere

**Close before earnings if:**
- Stock has binary event (earnings, FDA approval, etc.)
- IV crush could hurt your LEAPS value
- Reenter after event if still attractive

---

## Common PMCC Mistakes

### Mistake 1: Buying LEAPS with Delta <0.70

**The problem:** Acts less like stock, more price risk, loses value faster

**Example:**
- Buy $100 call with 0.50 delta (at-the-money)
- Stock rises $5
- LEAPS only gains $2.50 (50% of move)
- Meanwhile, your short call moved against you

**The fix:** Always buy delta 0.70+ for true stock replacement behavior

### Mistake 2: Selling Short Calls Too Far OTM

**The problem:** Chasing "safety" by selling very far OTM strikes with tiny premium

**Example:**
- Stock at $100
- Sell $120 call (20% OTM) for $0.15
- Premium too small to be worthwhile
- Better to take slight risk for meaningful premium

**The fix:** Target 0.25-0.35 delta, even if slightly uncomfortable

### Mistake 3: Not Allowing Enough Time on LEAPS

**The problem:** Buying 6-9 month LEAPS instead of 12-24 months

**Issues:**
- Faster time decay
- Less flexibility to manage short calls
- Forced to close position sooner

**The fix:** Always buy LEAPS with at least 12 months, prefer 18+ months

### Mistake 4: Ignoring the Cost Basis

**The problem:** Not tracking total cost after all premiums collected

**Example:**
- LEAPS cost: $4,200
- Collected $600 in premiums over 3 months
- True cost basis: $3,600
- Easier to close profitably when you know this

**The fix:** Track net cost basis in a spreadsheet

### Mistake 5: Panic Rolling Short Calls

**The problem:** Stock rises, short call goes ITM, trader panics and rolls for debit

**Example:**
- Short $125 call, stock at $128
- Panic close at $3.20 (loss: $235)
- Roll to $130 for only $0.80 credit
- Net debit: $240

**The fix:** If stock surges, evaluate closing entire PMCC for profit instead of throwing good money after bad

---

## PMCC Spreadsheet Template

Track these metrics for each PMCC position:

### Position Details
- Ticker
- Entry date
- LEAPS: Strike, Expiration, Cost, Current Value
- Stock price at entry

### Weekly Short Calls
- Week 1: Strike, Expiration, Premium Collected, Outcome
- Week 2: Strike, Expiration, Premium Collected, Outcome
- Week 3: Strike, Expiration, Premium Collected, Outcome
- (Continue for all weeks held)

### Calculations
- Total premium collected: SUM(all short call credits)
- Net LEAPS cost: Original cost - Total premium
- Current position value: LEAPS value - Short call value
- Total P&L: Current position value - Net LEAPS cost
- ROI: (Total P&L / Original capital) × 100
- Days held
- Annualized return: (ROI / Days held) × 365

---

## Conclusion: Is PMCC Right for You?

The Poor Man's Covered Call strategy is ideal if you:

✅ Have a smaller account ($5,000-$25,000)
✅ Want to generate weekly/monthly income
✅ Understand options mechanics (not a complete beginner)
✅ Can monitor positions weekly
✅ Have a bullish to neutral market outlook
✅ Want defined risk with leverage

**It may not be right if you:**
❌ Need dividends from stock ownership
❌ Can't monitor positions weekly
❌ Are brand new to options (start with covered calls first)
❌ Have very large account where capital efficiency doesn't matter
❌ Are extremely risk-averse

**Your 30-Day Action Plan:**

**Week 1:** Paper trade 2-3 PMCC positions
**Week 2:** Open your first real PMCC with small capital
**Week 3:** Add second position, manage first one through adjustments
**Week 4:** Review results, refine stock selection, scale up

The PMCC strategy has helped thousands of traders generate meaningful income without tying up massive capital. With proper execution, risk management, and patience, you can join them in building a sustainable income stream through options.

---

## Related Articles

- [The Complete Wheel Strategy Guide: From Theory to Execution](post.html#/complete-wheel-strategy-guide)
- [Cash-Secured Puts vs Covered Calls: Complete Strategy Comparison](post.html#/cash-secured-puts-vs-covered-calls)
- [Essential Options Trading Strategies for 2025: A Beginner's Guide](post.html#/essential-options-strategies-2025)

---

*Track your Poor Man's Covered Call positions with GammaLedger's advanced analytics. Monitor LEAPS delta, calculate net cost basis after premiums, and optimize your weekly call selection.*
