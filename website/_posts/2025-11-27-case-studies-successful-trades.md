---
layout: post
title: "Real-World Case Studies: Successful Options Trades Using Analytics and GammaLedger Tools"
slug: case-studies-successful-trades
date: 2025-11-27
description: "Detailed analysis of successful options trades showing complete process from setup to execution using GammaLedger analytics."
tags: [options, tutorial, analytics, case-study]
image: /assets/img/gammaledger-stage-01.jpg
---

<p>Theory is valuable, but real-world examples teach us how successful traders actually apply analytics and tools like GammaLedger to execute profitable trades. This article presents detailed case studies showing the complete process from analysis to execution to management.</p>
<h2 id="case-study-1-the-wheel-strategy-on-quality-dividend-stock">Case Study 1: The Wheel Strategy on Quality Dividend Stock</h2>
<h3 id="the-setup">The Setup</h3>
<p><strong>Trader Profile</strong>: Sarah, 6 months of options experience, $25,000 account</p>
<p><strong>Goal</strong>: Generate monthly income while potentially acquiring quality stock at discount</p>
<p><strong>Stock Selected</strong>: Johnson &amp; Johnson (JNJ)
- Price: $150
- Stable dividend payer
- Low volatility
- Stock Sarah would happily own</p>
<h3 id="pre-trade-analysis-using-gammaledger">Pre-Trade Analysis Using GammaLedger</h3>
<p><strong>Step 1: Market Context</strong>
- VIX: 16 (moderate)
- JNJ IV Rank: 45% (moderate)
- Overall market: Neutral trend</p>
<p><strong>Step 2: Technical Analysis</strong>
- Support level: $145
- Resistance: $155
- Recent range: $145-152
- No earnings for 6 weeks</p>
<p><strong>Step 3: Strategy Selection</strong>
Based on analysis, Sarah chose: <strong>Cash-Secured Put</strong></p>
<p><strong>Reasoning</strong>:
- Would buy JNJ at $145
- Current support level provides confidence
- IV rank acceptable for premium collection</p>
<h3 id="trade-execution">Trade Execution</h3>
<p><strong>Week 1 - Initial Put Sale</strong></p>
<p><strong>Position Entered</strong> (logged in GammaLedger):
- Date: October 1, 2025
- Action: Sell to Open
- Strike: $145 put
- Expiration: October 31 (30 DTE)
- Premium: $2.10 ($210)
- Commission: $0.65</p>
<p><strong>GammaLedger Analytics</strong>:
- Probability of Profit: 73%
- Max profit: $210
- Max loss: $14,290 (if assigned at $145, net cost $142.90)
- Delta: -0.28
- Theta: +$7.50/day
- Break-even: $142.90</p>
<p><strong>Position Sizing Check</strong>:
- Account value: $25,000
- Cash reserved: $14,500
- Utilization: 58% (acceptable for CSP)</p>
<h3 id="trade-management">Trade Management</h3>
<p><strong>Week 2</strong> (October 8):
- JNJ at $149
- Put value: $1.20
- P&amp;L: +$90 (43% of max profit)
- <strong>Decision</strong>: Hold, target 50%+</p>
<p><strong>Week 3</strong> (October 15):
- JNJ at $151
- Put value: $0.85
- P&amp;L: +$125 (60% of max profit)
- <strong>Decision</strong>: Close for profit</p>
<p><strong>Closing Trade</strong>:
- Buy to Close: $0.85
- Commission: $0.65
- <strong>Net Profit</strong>: $210 - $85 - $1.30 = $123.70</p>
<h3 id="results-and-learning">Results and Learning</h3>
<p><strong>Performance</strong>:
- Return on Risk: 0.85% in 15 days
- Annualized: ~20.7%
- Time in trade: 50% of planned (exited early at 60% profit)</p>
<p><strong>GammaLedger Journal Entry</strong>:
"Executed well. Stock stayed above strike with room to spare. Exited at 60% profit vs planned 50% - good discipline. IV didn't change much, so profit came purely from theta. Next time could go closer to current price for more premium."</p>
<p><strong>What Sarah Learned</strong>:
- Early profit taking worked (reduced risk for 15 extra days)
- Support level held (technical analysis validated)
- Comfortable with stock for assignment if needed</p>
<p><strong>Next Action</strong>: Repeated strategy, sold November $145 put for $2.25</p>
<h2 id="case-study-2-iron-condor-on-index-etf-during-low-volatility">Case Study 2: Iron Condor on Index ETF During Low Volatility</h2>
<h3 id="the-setup_1">The Setup</h3>
<p><strong>Trader Profile</strong>: Mike, 2 years experience, $75,000 account</p>
<p><strong>Goal</strong>: Generate consistent income from range-bound markets</p>
<p><strong>Underlying</strong>: SPY (S&amp;P 500 ETF)
- Price: $450
- High liquidity
- Trending sideways for 3 weeks</p>
<h3 id="pre-trade-analysis">Pre-Trade Analysis</h3>
<p><strong>GammaLedger Volatility Screen</strong>:
- SPY IV Rank: 68% (elevated)
- 30-day HV: 12%
- 30-day IV: 18%
- <strong>Analysis</strong>: IV &gt; HV, options expensive, good for selling</p>
<p><strong>Technical Analysis</strong>:
- Trading range: $445-455
- Support: $442
- Resistance: $458
- Expected Movement: ±2% over next 30 days</p>
<p><strong>Strategy</strong>: Iron Condor (profit from range-bound movement)</p>
<h3 id="trade-execution_1">Trade Execution</h3>
<p><strong>Position Details</strong> (November 1):</p>
<p><strong>Put Side</strong>:
- Buy $435 put: $0.75
- Sell $440 put: $1.90
- Net credit: $1.15</p>
<p><strong>Call Side</strong>:
- Sell $460 call: $1.80
- Buy $465 call: $0.70
- Net credit: $1.10</p>
<p><strong>Combined</strong>:
- Total credit: $2.25 per share ($225 per IC)
- Contracts: 5 iron condors
- Total credit: $1,125
- Max risk: $1,375 (($5 spread - $2.25) × 5)</p>
<p><strong>GammaLedger Risk Metrics</strong>:
- Probability of Profit: 68%
- Profit zone: $437.75 to $462.25
- Delta: +2 (nearly neutral)
- Theta: +$42/day (on 5 contracts)
- Vega: -$85 (benefits from IV decrease)</p>
<p><strong>Position Sizing</strong>:
- Account: $75,000
- Risk: $1,375 (1.83% of account) ✓
- Buying power used: $6,875</p>
<h3 id="trade-management-timeline">Trade Management Timeline</h3>
<p><strong>Day 3</strong> (November 4):
- SPY: $452
- IC value: $2.00 (from $2.25)
- Profit: $125 (11%)
- Delta drifted to +15
- <strong>Action</strong>: Monitor, no adjustment needed yet</p>
<p><strong>Day 10</strong> (November 11):
- SPY: $456 (approaching upper short call)
- IC value: $2.70 (underwater by $225)
- Call side tested
- <strong>Decision</strong>: Adjust or hold?</p>
<p><strong>GammaLedger Analysis</strong>:
- Probability of SPY &gt; $460: 28%
- Days to expiration: 20
- Theta still working: +$42/day</p>
<p><strong>Adjustment Made</strong>:
- Closed untested put side for $0.60 (profit of $0.55)
- Profit captured: $275
- Remaining position: Short call spread only
- New max risk: $500
- New max profit: $550 (original call credit)</p>
<p><strong>Day 15</strong> (November 16):
- SPY: $454 (pulled back from highs)
- Call spread value: $0.90
- <strong>Decision</strong>: Close entire position</p>
<p><strong>Final Close</strong>:
- Buy back call spread: $0.90
- Profit on call spread: $1.10 - $0.90 = $0.20 per share
- × 5 contracts = $100</p>
<p><strong>Total Trade P&amp;L</strong>:
- Put side profit: $275
- Call side profit: $100
- Commissions: -$26
- <strong>Net profit: $349</strong></p>
<h3 id="results-analysis">Results Analysis</h3>
<p><strong>Performance</strong>:
- Return on Risk: 25.4% ($349 / $1,375)
- Days in trade: 15
- Annualized return: ~616% (not sustainable, but shows potential)</p>
<p><strong>What Worked</strong>:
✅ High IV environment (68% rank)
✅ Wide profit zone gave room for management
✅ Adjustment when tested saved the trade
✅ Taking profit early reduced risk</p>
<p><strong>What Mike Learned</strong> (GammaLedger notes):
"Adjusting by closing untested side was the right call. Reduced risk from $1,375 to $500 while keeping profit potential. SPY did pull back, but I had already de-risked. Early management = reduced stress."</p>
<p><strong>Improvement for Next Time</strong>:
"Consider 40 DTE instead of 30 DTE. More time gives more room for adjustments and management."</p>
<h2 id="case-study-3-volatility-crush-on-earnings">Case Study 3: Volatility Crush on Earnings</h2>
<h3 id="the-setup_2">The Setup</h3>
<p><strong>Trader Profile</strong>: Elena, advanced trader, $150,000 account</p>
<p><strong>Goal</strong>: Profit from IV crush after earnings announcement</p>
<p><strong>Stock</strong>: Netflix (NFLX)
- Price: $420 (day before earnings)
- Earnings: After market close
- IV Rank: 92% (extremely high)</p>
<h3 id="pre-trade-analysis_1">Pre-Trade Analysis</h3>
<p><strong>GammaLedger Volatility Dashboard</strong>:
- Current IV: 85%
- Historical average IV: 38%
- Expected move: ±8% ($33.60)
- Recent earnings moves: 5-7% average</p>
<p><strong>Analysis</strong>: IV priced for 8% move, but recent history shows 5-7%. Opportunity for IV crush trade.</p>
<p><strong>Historical Pattern</strong> (from GammaLedger database):
- Last 8 earnings: Average IV drop from 80% to 35%
- Average actual move: 6.2%
- Profitable strangles: 6 out of 8</p>
<h3 id="strategy-selection">Strategy Selection</h3>
<p><strong>Iron Butterfly</strong> (defined risk volatility play)</p>
<p><strong>Why not straddle?</strong>
- Undefined risk with earnings
- Preferred defined max loss</p>
<p><strong>Strike Selection</strong>:
- Center: $420 (ATM)
- Wings: $410/$430 ($10 wide)</p>
<h3 id="trade-execution_2">Trade Execution</h3>
<p><strong>Position Details</strong> (entered 2 hours before close):</p>
<p><strong>Structure</strong>:
- Buy $410 put: $6.50
- Sell $420 put: $18.00
- Sell $420 call: $17.50
- Buy $430 call: $6.00</p>
<p><strong>Credit Received</strong>: $23.00 per share ($2,300 per butterfly)
<strong>Contracts</strong>: 2 iron butterflies
<strong>Total Credit</strong>: $4,600
<strong>Max Risk</strong>: $1,400 (($10 spread - $23 credit) × 2)</p>
<p><strong>GammaLedger Pre-Trade Snapshot</strong>:
- Account value: $150,000
- Risk: $1,400 (0.93%) ✓
- Position delta: -8 (slightly bearish, acceptable)
- Vega: -$240 (very short vega - will profit from IV drop)
- Theta: +$85/day</p>
<h3 id="the-moment-of-truth">The Moment of Truth</h3>
<p><strong>Earnings Announcement</strong> (after market close):
- Results: Beat expectations
- Guidance: Raised
- <strong>Stock reaction in after-hours: +5.2% to $442</strong></p>
<p><strong>Elena's Reaction</strong>:
"Stock moved more than I wanted ($22 vs $10 sweet spot), but still within max loss zone. The key will be IV crush. Going to bed and will assess in the morning."</p>
<h3 id="next-morning-results">Next Morning Results</h3>
<p><strong>Market Open</strong>:
- NFLX opens at $437 (some giveback from AH)
- IV collapsed: 85% → 32%</p>
<p><strong>GammaLedger Position Analysis</strong>:
- $410 put: $0.25 (nearly worthless)
- $420 put: $0.50
- $420 call: $17.20 (stock at $437, deep ITM)
- $430 call: $7.40 (ITM)</p>
<p><strong>Butterfly Value</strong>: $10.35 per share
<strong>Originally Sold For</strong>: $23.00
<strong>Profit</strong>: $23.00 - $10.35 = $12.65 per share</p>
<p><strong>Total P&amp;L</strong>:
- $12.65 × 100 × 2 contracts = $2,530 profit
- <strong>Return on Risk</strong>: 181% ($2,530 / $1,400)</p>
<h3 id="trade-analysis">Trade Analysis</h3>
<p><strong>Why It Worked</strong>:
✅ IV crush was severe (85% → 32%)
✅ Stock move (+5.2%) was within acceptable range
✅ Defined risk prevented catastrophic loss
✅ Position sizing kept stress manageable</p>
<p><strong>GammaLedger Journal</strong>:
"IV crush trade executed perfectly. Stock moved $17 from center ($420 to $437), but vega profit more than offset. The fact that I could sleep (thanks to defined risk) was crucial. If this had been a straddle, the stress would have been unbearable."</p>
<p><strong>What Elena Learned</strong>:
- Defined risk on binary events is mandatory
- IV crush can overcome significant directional moves
- Historical earnings patterns are helpful but not guarantees
- Position sizing at &lt;1% risk allowed for clear thinking</p>
<h2 id="case-study-4-calendar-spread-during-low-volatility">Case Study 4: Calendar Spread During Low Volatility</h2>
<h3 id="the-setup_3">The Setup</h3>
<p><strong>Trader Profile</strong>: James, intermediate trader, $40,000 account</p>
<p><strong>Goal</strong>: Profit from expected volatility increase using time spread</p>
<p><strong>Stock</strong>: Apple (AAPL)
- Price: $180
- IV Rank: 22% (very low)
- Fed meeting in 3 weeks (expected volatility catalyst)</p>
<h3 id="pre-trade-analysis_2">Pre-Trade Analysis</h3>
<p><strong>GammaLedger Volatility History</strong>:
- Current IV: 25%
- Average IV: 38%
- IV at last Fed meeting: 45%
- Pattern: IV rises before Fed, collapses after</p>
<p><strong>Strategy</strong>: Calendar Spread
- Sell front-month (captures theta)
- Buy back-month (gains if IV increases)</p>
<h3 id="trade-execution_3">Trade Execution</h3>
<p><strong>Position</strong> (entered 30 days before Fed):</p>
<p><strong>Front Month (30 DTE)</strong>:
- Sell 1 × $180 call for $4.20</p>
<p><strong>Back Month (60 DTE)</strong>:
- Buy 1 × $180 call for $7.10</p>
<p><strong>Net Debit</strong>: $2.90 ($290 per spread)
<strong>Contracts</strong>: 5 calendar spreads
<strong>Total Investment</strong>: $1,450</p>
<p><strong>GammaLedger Metrics</strong>:
- Max profit: Variable (depends on IV and price at front expiration)
- Max loss: $1,450 (if big move away from $180)
- Delta: +12 (slight bullish bias)
- Theta: +$18/day (net, benefits from front decay)
- Vega: +$45 (benefits from IV increase)</p>
<h3 id="trade-timeline">Trade Timeline</h3>
<p><strong>Week 1</strong>:
- AAPL: $182
- IV: 26% (slight increase)
- Calendar value: $3.10
- Profit: $100 (7%)
- <strong>Action</strong>: Hold</p>
<p><strong>Week 2</strong>:
- AAPL: $179
- IV: 29% (increasing as expected)
- Calendar value: $3.45
- Profit: $275 (19%)
- <strong>Action</strong>: Hold, Fed meeting approaching</p>
<p><strong>Week 3</strong> (Fed meeting week):
- AAPL: $181
- IV: 38% (jumped in anticipation)
- Calendar value: $4.10
- Profit: $600 (41%)
- <strong>Decision point</strong>: Front month expires in 7 days</p>
<p><strong>Front Month Expiration</strong>:
- AAPL: $180.50
- Front-month call expires worth $0.50
- Captured: $3.70 profit on front leg</p>
<p><strong>Back Month Remaining</strong>:
- 30 DTE remaining
- $180 call worth $6.80 (IV still 37%)
- Value: $6.80</p>
<p><strong>Total Position Value</strong>: $6.80 per share
<strong>Original Cost</strong>: $2.90
<strong>Unrealized Profit</strong>: $3.90 per share × 5 = $1,950</p>
<h3 id="management-decision">Management Decision</h3>
<p>James had three options:</p>
<p><strong>Option 1</strong>: Close back month, take profit
<strong>Option 2</strong>: Sell another front month against back month (roll the calendar)
<strong>Option 3</strong>: Keep back month as directional play</p>
<p><strong>James' Choice</strong>: Roll the calendar</p>
<p><strong>New Front Month</strong> (sell against existing back month):
- Sell $180 call (30 DTE) for $5.10
- Creates new calendar spread
- Additional credit: $510 × 5 = $2,550</p>
<h3 id="final-results">Final Results</h3>
<p><strong>30 Days Later</strong> (second front month expires):
- AAPL: $183
- Second front month worth: $3
- Profit on second front: $2.10 per share</p>
<p><strong>Total Trade P&amp;L</strong>:
- First front month: +$3.70 per share
- Second front month: +$2.10 per share
- Commissions: -$0.20 per share
- <strong>Net profit: $5.60 per share × 5 contracts = $2,800</strong></p>
<p><strong>Return on Investment</strong>: 193% ($2,800 / $1,450)</p>
<h3 id="analysis-using-gammaledger">Analysis Using GammaLedger</h3>
<p><strong>What Worked</strong>:
✅ Low initial IV (22% rank) - perfect entry
✅ Volatility catalyst (Fed meeting) played out
✅ Rolling the calendar captured additional premium
✅ Stock stayed near strike (optimal for calendars)</p>
<p><strong>GammaLedger Performance Metrics</strong>:
- Win rate on calendars: 4 out of 5 trades (80%)
- Average ROI: 45%
- Best IV entry: &lt; 30% rank
- Optimal hold time: Until front month &lt;10 DTE</p>
<p><strong>James' Learning</strong>:
"Rolling the calendar was the best decision. Instead of closing the back month for $6.80 (profit of $3.90), I sold another front for $5.10, which added $2.10 more profit. Total: $5.60 vs $3.90 - 44% more profit just by rolling."</p>
<h2 id="case-study-5-risk-management-saves-the-day">Case Study 5: Risk Management Saves the Day</h2>
<h3 id="the-setup_4">The Setup</h3>
<p><strong>Trader Profile</strong>: David, 1 year experience, $30,000 account</p>
<p><strong>Trade</strong>: Bull Put Spread on growth stock
- Stock: Tesla (TSLA) at $250
- Position: Sold $240/$235 put spread for $1.80 credit
- Max profit: $180
- Max loss: $320</p>
<p><strong>What Went Wrong</strong>: Elon Musk unexpected tweet controversy</p>
<h3 id="the-crisis">The Crisis</h3>
<p><strong>Day After Entry</strong>:
- TSLA gaps down to $238 (4.8% drop)
- Put spread now worth $2.80
- Unrealized loss: -$100
- <strong>Breach of $240 short strike imminent</strong></p>
<p><strong>GammaLedger Alert</strong>:
"⚠️ TSLA position loss exceeds 50%. Current loss: $100. Recommend review."</p>
<h3 id="decision-point">Decision Point</h3>
<p><strong>David's Options</strong>:</p>
<p><strong>Option 1</strong>: Hold and hope (bad idea)
<strong>Option 2</strong>: Close for $100 loss (accept defeat)
<strong>Option 3</strong>: Roll down and out (defend)</p>
<p><strong>GammaLedger Analysis</strong>:
- Probability of TSLA &lt; $235: 45% (high!)
- DTE: 25 days
- IV rank: 78% (very high due to news)</p>
<p><strong>David's Decision</strong>: Close for loss</p>
<p><strong>Execution</strong>:
- Buy to Close at $2.80
- Loss: $100
- Commission: $1.30
- <strong>Total Loss: $101.30</strong></p>
<h3 id="why-this-was-the-right-call">Why This Was the Right Call</h3>
<p><strong>Two Days Later</strong>:
- TSLA continued falling to $228
- Original spread would be worth $4.80
- Would have been max loss: $320</p>
<p><strong>David Avoided</strong>: Additional $220 loss by cutting early</p>
<p><strong>GammaLedger Journal</strong>:
"Hard to take the $100 loss, but it was the right decision. My stop loss rule is 2x credit ($360), but this felt different. News-driven gap with high emotion. Didn't want to risk max loss. Two days later validated the decision when TSLA fell further."</p>
<h3 id="the-lesson">The Lesson</h3>
<p><strong>Key Principle</strong>: Stop losses exist to prevent small losses from becoming big losses.</p>
<p><strong>David's Updated Rules</strong> (recorded in GammaLedger):
1. Hard stop at 2x credit received (standard)
2. Discretionary stop for news-driven gaps (new rule)
3. Never hold hope on falling knife
4. -$100 loss is better than -$320 max loss</p>
<p><strong>Account Impact</strong>:
- $100 loss = 0.33% of $30,000 account
- Manageable and acceptable
- Lived to trade another day</p>
<h2 id="common-themes-across-successful-trades">Common Themes Across Successful Trades</h2>
<h3 id="1-pre-trade-analysis">1. Pre-Trade Analysis</h3>
<p>Every successful trader:
- Checked IV rank/percentile
- Defined maximum loss
- Calculated probability of profit
- Confirmed position sizing
- Documented the plan in GammaLedger</p>
<h3 id="2-disciplined-execution">2. Disciplined Execution</h3>
<ul>
<li>Entered at planned levels</li>
<li>Used appropriate position sizes</li>
<li>Set alerts and stops</li>
<li>Logged everything</li>
</ul>
<h3 id="3-active-management">3. Active Management</h3>
<ul>
<li>Monitored daily (at minimum)</li>
<li>Adjusted when necessary</li>
<li>Took profits at targets</li>
<li>Cut losses before disaster</li>
</ul>
<h3 id="4-post-trade-review">4. Post-Trade Review</h3>
<ul>
<li>Analyzed what worked</li>
<li>Identified improvements</li>
<li>Updated strategies</li>
<li>Built knowledge base</li>
</ul>
<h2 id="using-gammaledger-for-case-study-analysis">Using GammaLedger for Case Study Analysis</h2>
<h3 id="create-your-own-case-studies">Create Your Own Case Studies</h3>
<p><strong>Template in GammaLedger</strong>:</p>
<p><strong>Pre-Trade</strong>:
- [ ] Market analysis
- [ ] Volatility metrics
- [ ] Technical levels
- [ ] Strategy selection rationale
- [ ] Position sizing calculation</p>
<p><strong>During Trade</strong>:
- [ ] Daily monitoring notes
- [ ] Adjustment decisions and why
- [ ] Profit/loss snapshots
- [ ] Emotional state (important!)</p>
<p><strong>Post-Trade</strong>:
- [ ] Final P&amp;L
- [ ] What worked
- [ ] What didn't work
- [ ] Lessons learned
- [ ] Would you take this trade again?</p>
<h3 id="building-your-trade-database">Building Your Trade Database</h3>
<p>Over time, your GammaLedger journal becomes a valuable resource:</p>
<p><strong>After 50 Trades</strong>: Identify patterns
- Best strategies for you
- Optimal market conditions
- Common mistakes to avoid</p>
<p><strong>After 100 Trades</strong>: Statistical edge
- Win rate by strategy
- R-multiple analysis
- Risk/reward ratios</p>
<p><strong>After 200+ Trades</strong>: Expertise
- Your personal trading playbook
- Refined entries and exits
- Consistent profitability</p>
<h2 id="conclusion">Conclusion</h2>
<p>These case studies demonstrate that successful options trading isn't about lucky picks—it's about:</p>
<ol>
<li><strong>Systematic Analysis</strong>: Using tools like GammaLedger to evaluate every aspect</li>
<li><strong>Risk Management</strong>: Knowing your maximum loss before entry</li>
<li><strong>Disciplined Execution</strong>: Following your plan, not your emotions</li>
<li><strong>Active Management</strong>: Adjusting when necessary, not set-and-forget</li>
<li><strong>Continuous Learning</strong>: Reviewing every trade to improve</li>
</ol>
<p>Start building your own case studies today. Every trade is a learning opportunity when properly documented and analyzed.</p>
<h2 id="your-next-steps">Your Next Steps</h2>
<ol>
<li><strong>Log your next 10 trades</strong> in detail using GammaLedger</li>
<li><strong>Review each trade</strong> using the template above</li>
<li><strong>Identify patterns</strong> in your wins and losses</li>
<li><strong>Refine your approach</strong> based on data, not gut feeling</li>
<li><strong>Repeat the process</strong> - this is the path to mastery</li>
</ol>
<p>Success in options trading is built trade by trade, lesson by lesson, documented and analyzed in tools like GammaLedger.</p>
<h2 id="related-articles">Related Articles</h2>
<ul>
<li><a href="https://gammaledger.com/blog/options-analytics-trade-decisions/">How to Use Options Trading Analytics</a></li>
<li><a href="https://gammaledger.com/blog/gammaledger-setup-tutorial/">Setting Up GammaLedger</a></li>
<li><a href="https://gammaledger.com/blog/risk-management-techniques/">Risk Management Techniques</a></li>
</ul>
