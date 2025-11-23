# Step-by-Step Tutorial: Setting Up and Tracking Your Options Trades with GammaLedger

GammaLedger is designed to be your comprehensive options trading journal and analytics platform. This step-by-step tutorial will guide you through setting up your account, logging trades, and leveraging powerful analytics to improve your trading performance.

## Why Use a Trading Journal?

Before diving into the tutorial, understand why tracking trades is crucial:

- **Performance Analysis**: Identify which strategies work best for you
- **Pattern Recognition**: Spot recurring mistakes before they become costly
- **Tax Reporting**: Comprehensive records simplify year-end tax preparation
- **Continuous Improvement**: Data-driven insights lead to better decisions
- **Accountability**: Written plans reduce emotional trading

Studies show traders who maintain detailed journals outperform those who don't by 15-25% annually.

## Part 1: Initial Setup

### Step 1: Download and Install GammaLedger

1. Visit [GammaLedger GitHub Repository](https://github.com/r-brown/GammaLedger)
2. Click "Releases" in the right sidebar
3. Download the latest version for your operating system
4. Install the application following the prompts

**Privacy First**: GammaLedger runs 100% locally. Your data never leaves your computer.

### Step 2: First Launch Configuration

On first launch, you'll see the welcome screen:

1. **Set Your Currency**: USD, EUR, GBP, etc.
2. **Choose Your Timezone**: For accurate timestamps
3. **Select Date Format**: MM/DD/YYYY or DD/MM/YYYY
4. **Set Starting Capital**: Your initial portfolio value (can be changed later)

Click "Continue" to access the main dashboard.

### Step 3: Configure Your Trading Preferences

Navigate to **Settings → Preferences**:

**Display Options**:
- Theme: Light or Dark mode
- Default view: Dashboard, Positions, or Trade Log
- Chart preferences: Candlestick, line, or bar

**Trading Defaults**:
- Default commission: Set your broker's per-contract fee
- Position sizing: Maximum percentage per trade
- Risk warnings: Enable alerts for concentrated positions

**Notifications**:
- Profit/Loss alerts
- Expiration reminders
- Portfolio threshold notifications

## Part 2: Importing Your First Trades

### Method 1: Manual Entry

Perfect for learning the system and entering individual trades.

**Navigate to**: Trades → Add New Trade

**Enter Trade Details**:

1. **Basic Information**:
   - Symbol: AAPL
   - Strategy: Covered Call
   - Open Date: 2025-11-01
   
2. **Position Details**:
   - Underlying Price: $180.00
   - Quantity: 1 contract (100 shares)
   
3. **Options Details**:
   - Strike: $185
   - Expiration: 2025-11-29
   - Type: Call
   - Action: Sell to Open
   - Premium: $2.50 per share
   
4. **Additional Info**:
   - Commission: $0.65
   - Notes: "Conservative covered call, willing to sell at $185"

Click "Save Trade" to add to your journal.

### Method 2: Broker Import (OFX/CSV)

Most efficient for bulk imports.

**Step 1: Download from Broker**:
- Log into your broker (TD Ameritrade, Interactive Brokers, etc.)
- Navigate to Trade History or Account Statements
- Export trades as OFX or CSV format
- Select date range (last month, year, etc.)

**Step 2: Import to GammaLedger**:
- Navigate to: **Trades → Import Trades**
- Click "Choose File" and select your download
- Map fields if necessary:
  - Symbol → Symbol
  - Quantity → Contracts
  - Price → Premium
- Review mapping preview
- Click "Import"

GammaLedger automatically:
- Detects strategy type
- Calculates Greeks
- Links related legs (spreads)
- Updates portfolio metrics

### Method 3: API Connection (Advanced)

For real-time sync with supported brokers:

**Navigate to**: Settings → Broker Connections

1. Select your broker from the dropdown
2. Enter API credentials (read-only recommended)
3. Authorize connection
4. Set sync frequency (manual, hourly, daily)

**Supported Brokers**:
- TD Ameritrade
- Interactive Brokers
- Tastytrade
- E*TRADE
- More added regularly

## Part 3: Understanding the Dashboard

### Portfolio Overview Section

**Current Value**: Total portfolio value including cash and open positions

**Today's P&L**: Daily profit/loss
- Green = profitable day
- Red = losing day

**Total P&L**: All-time profit/loss since starting

**Win Rate**: Percentage of profitable trades (target: 60%+)

### Greek Exposure Dashboard

Critical for risk management:

**Delta**: Overall directional exposure
- Positive delta: Bullish
- Negative delta: Bearish
- Zero delta: Neutral
- Target: -50 to +50 for balanced portfolio

**Gamma**: Rate of delta change
- High gamma = risk near expiration
- Monitor before Friday expiration

**Theta**: Daily time decay
- Positive theta = collecting time decay
- Negative theta = paying time decay
- Shows expected daily profit/loss from time

**Vega**: Volatility exposure
- Positive vega = benefit from IV increase
- Negative vega = benefit from IV decrease

### Open Positions Table

Displays all active trades:
- Symbol
- Strategy type
- Days to expiration
- Current P&L
- Percentage return
- Greeks

Click any position to view details and adjustment options.

### Upcoming Expirations Calendar

Visual calendar showing:
- Positions expiring this week (red)
- Positions expiring next week (yellow)
- Positions expiring later (green)

Click any date to see expiring positions and plan adjustments.

## Part 4: Logging Different Strategy Types

### Simple Strategies

#### Long Call/Put

**Fields to Enter**:
- Symbol: SPY
- Strategy: Long Call
- Strike: $450
- Expiration: 2025-12-20
- Premium Paid: $8.50
- Contracts: 3

GammaLedger calculates:
- Total cost: $2,550 ($8.50 × 100 × 3)
- Break-even: $458.50
- Maximum loss: $2,550
- Maximum profit: Unlimited

#### Covered Call

**Method 1: Log as Single Strategy**
- Strategy: Covered Call
- Shares owned: 100
- Cost basis: $175
- Strike sold: $180
- Premium collected: $3.00

**Method 2: Log Separately (Advanced)**
- First: Log stock purchase
- Second: Log short call
- GammaLedger auto-links them as covered call

### Spread Strategies

#### Bull Call Spread

**Enter as Multi-Leg**:
1. Click "Add Multi-Leg Strategy"
2. Select "Bull Call Spread"
3. **Leg 1 (Long)**:
   - Buy Call
   - Strike: $100
   - Premium: $5.00
4. **Leg 2 (Short)**:
   - Sell Call
   - Strike: $105
   - Premium: $2.00

GammaLedger calculates:
- Net debit: $3.00 ($300)
- Max profit: $2.00 ($200)
- Max loss: $3.00 ($300)
- Risk/reward ratio: 1.5:1

#### Iron Condor

**Four Legs**:
1. Buy Put at $435 (protection)
2. Sell Put at $440 (income)
3. Sell Call at $460 (income)
4. Buy Call at $465 (protection)

GammaLedger automatically:
- Calculates total credit
- Shows profit zone graphically
- Displays probability of profit
- Tracks all four legs together

### Advanced Strategies

#### Calendar Spread

**Two Expirations**:
- **Front Month**: Sell 30-day option
- **Back Month**: Buy 60-day option

**Enter Both Legs**:
- Link them using "Related Position" field
- GammaLedger tracks as single strategy
- Shows P&L accounting for both expirations

## Part 5: Tracking and Adjusting Positions

### Daily Monitoring Routine

**Morning Check (5 minutes)**:

1. Open GammaLedger dashboard
2. Review overnight P&L
3. Check Greek exposure (any concerning changes?)
4. Review positions expiring within 7 days
5. Set any new alerts

### Position Management Actions

#### Rolling a Position

When a short option is threatened:

1. Navigate to the position
2. Click "Roll Position"
3. Select new expiration date
4. Adjust strike if needed
5. Review credit/debit for roll
6. Confirm

GammaLedger:
- Closes original position
- Opens new position
- Links them in history
- Updates all Greeks

#### Closing a Winner

When reaching profit target:

1. Click on position
2. Click "Close Position"
3. Enter closing details:
   - Exit date
   - Exit premium
   - Commission
4. Add closing notes: "Hit 50% profit target"

GammaLedger:
- Marks position closed
- Calculates final P&L
- Updates win/loss statistics
- Moves to closed positions

#### Adjusting a Loser

If a trade goes against you:

**Option 1: Add Protective Leg**
- Click "Add Leg" on position
- Buy protective option
- Convert to defined risk

**Option 2: Convert Strategy**
- Transform bull call spread to butterfly
- Add additional legs
- Reduce risk

## Part 6: Advanced Analytics

### Performance Reports

**Navigate to**: Analytics → Performance

**Win/Loss Analysis**:
- Win rate by strategy
- Average win vs average loss
- Largest winners/losers
- Profit factor (gross profit / gross loss)

**Time Analysis**:
- Best/worst days of week
- Monthly performance trends
- Hold time vs profitability

**Strategy Comparison**:
```
Covered Calls: 75% win rate, +$4,250 YTD
Bull Put Spreads: 68% win rate, +$3,100 YTD
Iron Condors: 71% win rate, +$2,890 YTD
```

Identify your most profitable strategies and focus there.

### Risk Metrics

**Navigate to**: Analytics → Risk

**Portfolio Heat Map**:
- Concentration risk by symbol
- Sector exposure
- Strategy diversification

**Drawdown Analysis**:
- Maximum drawdown
- Current drawdown from peak
- Recovery time analysis

**VaR (Value at Risk)**:
- Estimated 95% confidence loss limit
- Based on historical volatility
- Alerts if threshold exceeded

### Greek Analytics

**Navigate to**: Analytics → Greeks

**Historical Greek Exposure**:
- Charts showing delta, gamma, theta, vega over time
- Identify patterns in risk exposure
- Correlate Greek exposure with P&L

**Scenario Analysis**:
- "What if stock moves 10%?"
- "What if volatility increases 20%?"
- Model different outcomes before they happen

## Part 7: Custom Features and Workflows

### Creating Watchlists

Track potential trade opportunities:

1. Navigate to: Tools → Watchlists
2. Click "New Watchlist"
3. Name it (e.g., "High IV Opportunities")
4. Add symbols
5. Set criteria:
   - IV Rank > 70%
   - Upcoming earnings
   - Price alerts

GammaLedger alerts when criteria are met.

### Setting Trade Rules

Automate your discipline:

**Navigate to**: Settings → Trade Rules

**Position Sizing Rules**:
- Maximum % of portfolio per trade: 5%
- Maximum % in single symbol: 15%
- Alert when exceeded

**Profit/Loss Rules**:
- Take profit at: 50% of max profit
- Stop loss at: 2x initial credit
- Alert when targets hit

**Expiration Rules**:
- Close positions < 7 DTE
- Avoid holding through earnings
- Warning alerts

### Custom Tags and Notes

Organize trades your way:

**Tags**: Create custom tags
- #HighConviction
- #EarningsPlay
- #DefensiveIncome
- #Experimental

**Notes**: Rich text notes on each trade
- Why you entered
- What you expected
- What actually happened
- Lessons learned

Filter and analyze by tags to find patterns.

## Part 8: Review and Improvement Workflow

### Weekly Review (30 minutes)

**Every Sunday**:

1. **Review Closed Trades**:
   - What worked?
   - What didn't?
   - Any pattern?

2. **Analyze Open Positions**:
   - Upcoming expirations?
   - Adjustments needed?
   - Take profits available?

3. **Check Portfolio Metrics**:
   - Greek exposure balanced?
   - Concentration risk?
   - Cash reserves adequate?

4. **Plan Next Week**:
   - Watchlist opportunities
   - Earnings calendar
   - Economic events (Fed, jobs report)

**Document in Journal**: GammaLedger includes a weekly journal feature for narrative notes.

### Monthly Deep Dive (2 hours)

**First Sunday of Month**:

1. **Performance Analysis**:
   - Compare to benchmark (SPY, etc.)
   - Win rate trends
   - Strategy performance rankings

2. **Goal Progress**:
   - Monthly income target
   - Risk-adjusted return goals
   - Personal development objectives

3. **Adjustment Planning**:
   - Which strategies to emphasize?
   - Which to reduce/eliminate?
   - New strategies to test?

4. **Tax Planning**:
   - Realized gains/losses YTD
   - Tax loss harvesting opportunities
   - Record keeping compliance

## Part 9: Troubleshooting and Tips

### Common Issues

**Issue**: Greek calculations seem off
**Solution**: Ensure underlying price is current. Update market data in Settings → Data Refresh.

**Issue**: Spread not linking properly
**Solution**: Use "Multi-Leg Strategy" entry, not individual legs.

**Issue**: Import file rejected
**Solution**: Check file format matches broker type. Some brokers need specific OFX versions.

### Pro Tips

**Tip 1: Screenshot Before Entering**
Take a screenshot of your broker's trade ticket before entering in GammaLedger. Helps ensure accuracy.

**Tip 2: Daily 5-Minute Routine**
Set a recurring calendar alert at market close to update GammaLedger daily.

**Tip 3: Use Templates**
Create strategy templates for your most common trades. One-click entry for covered calls, iron condors, etc.

**Tip 4: Backup Regularly**
Navigate to Settings → Backup. Export your data weekly to cloud storage.

**Tip 5: Learn Keyboard Shortcuts**
- Ctrl+N: New trade
- Ctrl+D: Dashboard
- Ctrl+P: Positions
- Ctrl+A: Analytics

## Part 10: Advanced Integrations

### Exporting Data

**For Tax Software**:
- Navigate to: Reports → Tax Report
- Select tax year
- Export as CSV or PDF
- Import to TurboTax, etc.

**For Spreadsheet Analysis**:
- Export trades to Excel/Google Sheets
- Perform custom analysis
- Create additional visualizations

**For Sharing**:
- Generate performance reports
- Redact sensitive info if needed
- Share with trading groups or mentors

### API for Developers

GammaLedger offers API access:

**Use Cases**:
- Build custom dashboards
- Integrate with other tools
- Automate trade logging from algorithms
- Create custom alerts

**Documentation**: Available in Settings → API

## Conclusion

GammaLedger transforms your options trading from guesswork to data-driven decisions. By consistently tracking every trade, analyzing performance, and learning from both wins and losses, you'll develop an edge that compounds over time.

**Key Takeaways**:
- Log every single trade (no exceptions)
- Review weekly and monthly
- Use analytics to identify your edge
- Continuously improve based on data
- Maintain discipline through rules and alerts

The traders who succeed are those who treat trading as a business, not gambling. GammaLedger is your business intelligence platform.

## Next Steps

1. Download GammaLedger if you haven't already
2. Import your last 30 days of trades
3. Set up your dashboard preferences
4. Create your first watchlist
5. Schedule your weekly review time

Welcome to data-driven options trading!

## Related Articles

- [Getting Started with GammaLedger](./getting-started)
- [Essential Options Trading Strategies](./essential-options-strategies-2025)
- [Risk Management Techniques](./risk-management-techniques)
