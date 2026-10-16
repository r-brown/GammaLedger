/* Generated from the game sources (content.js + engine.js + shared.js). Do not edit by hand. */
/* ============================================================
   CONTENT — tools, events, levels, ranks, achievements, cards.
   To add a level: append an object to LEVELS (see LEVEL SCHEMA
   in the README block at the bottom of this file).
   ============================================================ */

const CONFIG = {
  shareUrl: 'https://gammaledger.com',
  // Base URL of the score server (see server/README.md). Leave empty for local-only leaderboards.
  apiBase: '',
  gameName: 'Keep the Economy Afloat',
  version: 1
};

/* ---------- Policy tools ---------- */
const TOOLS = {
  rate: { name: 'Policy rate', who: 'Central bank', blurb: 'The price of money. Higher rates cool spending and inflation, with a delay.' },
  guidance: { name: 'Forward guidance', who: 'Central bank', cost: 1,
    blurb: 'Tell markets what you plan to do. Moves expectations now, but breaking a promise costs credibility.',
    options: [ { id: 'hawk', label: 'Hawkish', hint: 'Expectations ↓' }, { id: 'dove', label: 'Dovish', hint: 'Expectations ↑' } ] },
  qe: { name: 'Bond buying (QE)', who: 'Central bank', cost: 1,
    blurb: 'Buy or sell government bonds. Buying pushes long-term yields down and calms markets.',
    options: [ { id: 'buy', label: 'Buy bonds', hint: 'Yields ↓ Fear ↓' }, { id: 'sell', label: 'Sell (QT)', hint: 'Yields ↑' } ] },
  spend: { name: 'Government spending', who: 'Treasury', cost: 1,
    blurb: 'Spend more to lift demand directly. Adds to the deficit.',
    options: [ { id: 'up', label: '+1% of GDP', hint: 'Growth ↑ Debt ↑' }, { id: 'down', label: '−1% of GDP', hint: 'Debt ↓ Trust ↓' } ] },
  tax: { name: 'Tax rate', who: 'Treasury', cost: 1,
    blurb: 'Cut taxes to leave households more to spend, or raise them to cool demand and repair the budget.',
    options: [ { id: 'down', label: 'Cut 1 pt', hint: 'Growth ↑ Trust ↑' }, { id: 'up', label: 'Raise 1 pt', hint: 'Debt ↓ Trust ↓' } ] },
  liquidity: { name: 'Emergency lending', who: 'Central bank', cost: 2,
    blurb: 'Lend freely to solvent banks against good collateral. Stops panics, but bailouts breed risk-taking.',
    options: [ { id: 'open', label: 'Open the window', hint: 'Fear ↓↓ Banks ↑' } ] },
  macropru: { name: 'Mortgage rules', who: 'Regulator', cost: 1,
    blurb: 'Tighten or loosen loan-to-value limits and bank capital rules. Targets credit without moving rates.',
    options: [ { id: 'tighten', label: 'Tighten', hint: 'Bubble ↓' }, { id: 'loosen', label: 'Loosen', hint: 'Bubble ↑' } ] },
  trade: { name: 'Your trade this quarter', who: 'GammaLedger', cost: 1,
    blurb: 'Three-month positions, priced with Black–Scholes at today’s implied volatility. Pick nothing to sit in cash and earn the policy rate.',
    options: [ { id: 'long', label: 'Buy the index', hint: 'Full upside and downside' }, { id: 'put', label: 'Sell a put', hint: 'Collect premium, risk a crash' },
               { id: 'call', label: 'Covered call', hint: 'Own index, cap the upside' }, { id: 'hedge', label: 'Index + protective put', hint: 'Pay for insurance' } ] },
  fx: { name: 'Currency reserves', who: 'Central bank', cost: 1,
    blurb: 'Sell foreign reserves to prop up your currency, or buy them to rebuild the war chest.',
    options: [ { id: 'sell', label: 'Defend currency', hint: 'Currency ↑ Reserves ↓' }, { id: 'buy', label: 'Rebuild reserves', hint: 'Reserves ↑ Currency ↓' } ] }
};
const TOOL_ORDER = ['rate', 'guidance', 'qe', 'spend', 'tax', 'liquidity', 'macropru', 'fx', 'trade'];

/* ---------- Metrics (the tanks) ---------- */
const METRICS = {
  infl:     { name: 'Inflation', unit: '%', min: -3, max: 15, dec: 1, good: 'band' },
  unemp:    { name: 'Unemployment', unit: '%', min: 0, max: 16, dec: 1, good: 'low' },
  growth:   { name: 'Growth (annualised)', unit: '%', min: -14, max: 12, dec: 1, good: 'high' },
  stress:   { name: 'Market fear', unit: '', min: 0, max: 100, dec: 0, good: 'low' },
  approval: { name: 'Public trust', unit: '%', min: 0, max: 100, dec: 0, good: 'high' },
  debt:     { name: 'Public debt', unit: '% GDP', min: 0, max: 200, dec: 0, good: 'low' },
  bubble:   { name: 'Housing bubble', unit: '', min: 0, max: 100, dec: 0, good: 'low' },
  bank:     { name: 'Bank health', unit: '', min: 0, max: 100, dec: 0, good: 'high' },
  fx:       { name: 'Currency', unit: '', min: 40, max: 140, dec: 0, good: 'high' },
  reserves: { name: 'FX reserves', unit: '$bn', min: 0, max: 60, dec: 0, good: 'high' },
  expInfl:  { name: 'Expected inflation', unit: '%', min: -2, max: 14, dec: 1 },
  rate:     { name: 'Policy rate', unit: '%', min: 0, max: 12, dec: 2 },
  y10:      { name: '10-year yield', unit: '%', min: 0, max: 20, dec: 1 },
  cred:     { name: 'Credibility', unit: '', min: 0, max: 100, dec: 0 },
  stocks:   { name: 'Stock index', unit: '', min: 40, max: 180, dec: 0 },
  book:     { name: 'Your book', unit: '', min: 60, max: 140, dec: 1, good: 'high' },
  iv:       { name: 'Implied volatility', unit: '%', min: 0, max: 80, dec: 0 }
};

/* ---------- Events ----------
   kind: 'news' (auto-applied) | 'dilemma' (player chooses) | 'info'
   effects: { add:{metric:delta}, shock:{demand|supply|fin|tp:[amount, decay]}, tags:[...] }
   bot: index of the option the benchmark bots choose                       */
const EVENTS = {
  welcome: { kind: 'info', tag: 'Briefing', headline: 'You have the keys to the machine',
    body: 'Each tank is part of the economy. Keep every water level inside its shaded safe zone. Make your moves, then run the quarter.' },
  election: { kind: 'info', tag: 'Election', headline: 'Election day',
    body: 'Voters head to the polls. Whoever wins, the central bank is still yours to run.' },

  consumer_boom: { kind: 'news', tag: 'Demand', headline: 'Shoppers go on a spending spree',
    body: 'Credit card balances jump and malls are packed. Demand is running ahead of what the economy can produce.',
    effects: { shock: { demand: [1.4, 0.85] }, add: { stocks: 4 } } },
  confidence_crash: { kind: 'news', tag: 'Demand', headline: 'Business confidence collapses',
    body: 'Firms freeze hiring and cancel investment plans. Orders for machinery fall off a cliff.',
    effects: { shock: { demand: [-2.8, 0.85] }, add: { stress: 10, stocks: -8 } } },
  export_slump: { kind: 'news', tag: 'Trade', headline: 'Export orders slump abroad',
    body: 'A slowdown in your biggest trading partners hits factories that sell overseas.',
    effects: { shock: { demand: [-1.4, 0.8] }, add: { stocks: -3 } } },
  oil_spike: { kind: 'news', tag: 'Supply', headline: 'Oil jumps 40% overnight',
    body: 'Fuel and shipping costs surge. Prices rise while spending power falls: a supply shock.',
    effects: { shock: { supply: [1.6, 0.7], demand: [-0.6, 0.8] }, add: { stress: 5, approval: -2 } } },
  oil_embargo: { kind: 'news', tag: 'Supply', headline: 'Oil exporters cut off supply',
    body: 'Petrol queues stretch around the block. Energy prices quadruple and factories cut shifts.',
    effects: { shock: { supply: [2.6, 0.72], demand: [-1.2, 0.85] }, add: { stress: 10, approval: -4, stocks: -10 } } },
  energy_crisis: { kind: 'news', tag: 'Supply', headline: 'Energy prices spike across the continent',
    body: 'Gas and electricity bills soar. Households cut back on everything else.',
    effects: { shock: { supply: [1.8, 0.75], demand: [-0.8, 0.85] }, add: { stress: 6, approval: -3 } } },
  supply_heals: { kind: 'news', tag: 'Supply', headline: 'Shipping jams finally clear',
    body: 'Container rates collapse and shelves refill. Goods prices start to cool on their own.',
    effects: { shock: { supply: [-1.1, 0.8] }, add: { stocks: 4 } } },
  supply_chain: { kind: 'news', tag: 'Supply', headline: 'Chip shortage halts car plants',
    body: 'A missing part worth a few dollars idles assembly lines worth billions.',
    effects: { shock: { supply: [1.2, 0.8], demand: [-0.4, 0.8] } } },
  ai_boom: { kind: 'news', tag: 'Productivity', headline: 'AI tools lift productivity',
    body: 'Firms produce more with the same staff. Costs fall, profits rise, and some jobs change shape.',
    effects: { shock: { supply: [-0.9, 0.9], demand: [0.6, 0.85] }, add: { stocks: 10, unemp: 0.4 } } },
  record_harvest: { kind: 'news', tag: 'Supply', headline: 'Record harvest cuts food prices',
    body: 'Perfect weather fills the silos. Grocery bills ease.',
    effects: { shock: { supply: [-0.7, 0.7] }, add: { approval: 2 } } },
  wage_spiral: { kind: 'news', tag: 'Expectations', headline: 'Workers demand catch-up raises',
    body: 'After a year of rising prices, unions push for double-digit wage deals. Firms plan to pass the cost on.',
    effects: { add: { expInfl: 0.7 }, shock: { supply: [0.8, 0.8] } } },
  deflation_scare: { kind: 'news', tag: 'Expectations', headline: 'Prices start falling',
    body: 'Shoppers delay purchases, expecting things to get cheaper. Falling prices make debts heavier.',
    effects: { add: { expInfl: -0.6 }, shock: { demand: [-1.0, 0.8] } } },
  strike_wave: { kind: 'news', tag: 'Labour', headline: 'Nationwide strikes shut ports and rail',
    body: 'Goods pile up at the docks. Output dips and prices tick up.',
    effects: { shock: { supply: [0.7, 0.7], demand: [-0.6, 0.7] }, add: { approval: -3 } } },
  trade_war: { kind: 'news', tag: 'Trade', headline: 'Tariff war erupts',
    body: 'New import taxes raise prices at home while exporters lose customers abroad.',
    effects: { shock: { supply: [0.9, 0.85], demand: [-1.2, 0.85] }, add: { stress: 8, stocks: -6, fx: -4 } } },
  housing_mania: { kind: 'news', tag: 'Credit', headline: 'House prices up 20% in a year',
    body: 'Buyers queue at open houses and flip apartments before they are built.',
    effects: { add: { bubble: 10, stocks: 4 }, shock: { demand: [0.6, 0.85] } } },
  teaser_mortgages: { kind: 'news', tag: 'Credit', headline: 'Lenders offer 0% teaser mortgages',
    body: 'No deposit, no income checks, two years of near-zero payments. What could go wrong?',
    effects: { add: { bubble: 8 } } },
  bubble_pop: { kind: 'news', tag: 'Crash', headline: 'The housing bubble bursts',
    body: 'Prices fall for the first time in a decade. Borrowers default, banks book losses, and credit dries up.',
    effects: { add: { stress: 32, stocks: -18, bank: -25, bubble: -60 }, shock: { demand: [-3.0, 0.88] } } },
  lehman: { kind: 'news', tag: 'Crash', headline: 'A giant investment bank collapses',
    body: 'Over a single weekend no buyer appears. Money markets freeze and every bank stops trusting every other bank.',
    effects: { add: { stress: 30, stocks: -25, bank: -20 }, shock: { demand: [-3.2, 0.88], fin: [12, 0.75] } } },
  bank_run: { kind: 'news', tag: 'Banks', headline: 'Depositors line up to pull their money',
    body: 'Rising rates have left banks sitting on bond losses. Word spreads, and withdrawals snowball.',
    effects: { add: { stress: 22, bank: -15, stocks: -10 }, shock: { demand: [-1.0, 0.8], fin: [8, 0.7] } } },
  bank_run_app: { kind: 'news', tag: 'Banks', headline: 'A $40bn bank run happens in one day',
    body: 'Founders warn each other in group chats. Deposits leave by phone app faster than any run in history.',
    effects: { add: { stress: 24, bank: -18, stocks: -8 }, shock: { demand: [-0.8, 0.8], fin: [10, 0.7] } } },
  yields_jump: { kind: 'news', tag: 'Bonds', headline: 'Bond yields jump to 15-year highs',
    body: 'Long-term borrowing costs surge. Banks holding long bonds see their value shrink.',
    effects: { shock: { tp: [0.7, 0.85] }, add: { bank: -6, stocks: -4 } } },
  rating_downgrade: { kind: 'news', tag: 'Bonds', headline: 'Credit rating cut',
    body: 'A ratings agency downgrades government debt, citing weak budget plans.',
    effects: { shock: { tp: [0.7, 0.8] }, add: { stress: 7, stocks: -3 } } },
  lockdown: { kind: 'news', tag: 'Pandemic', headline: 'The country goes into lockdown',
    body: 'Shops, offices and restaurants close overnight. Millions are sent home. Nobody knows for how long.',
    effects: { add: { gap: -7, unemp: 6, stress: 30, stocks: -25, approval: 6 }, shock: { demand: [-2.5, 0.65], supply: [1.0, 0.6] } } },
  vaccine: { kind: 'news', tag: 'Pandemic', headline: 'Vaccine approved',
    body: 'A path out of the crisis appears. Markets rally and households start planning holidays again.',
    effects: { add: { stress: -12, stocks: 15, approval: 4 }, shock: { demand: [2.0, 0.8] } } },
  reopening: { kind: 'news', tag: 'Pandemic', headline: 'Reopening rush meets empty shelves',
    body: 'Savings built up during lockdown pour into shops just as factories and ports struggle to restart.',
    effects: { shock: { supply: [1.6, 0.85], demand: [1.4, 0.85] } } },
  taper_tantrum: { kind: 'news', tag: 'Capital flows', headline: 'Rates rise abroad: hot money heads home',
    body: 'A hint of tighter policy in a big economy sends investors pulling cash out of emerging markets.',
    effects: { add: { foreignRate: 1.0, fx: -8, stress: 12, stocks: -8 } } },
  fed_hikes_abroad: { kind: 'news', tag: 'Capital flows', headline: 'The world’s biggest central bank hikes again',
    body: 'Dollar borrowing gets more expensive everywhere. Your currency is under pressure.',
    effects: { add: { foreignRate: 1.25, fx: -5, stress: 6 } } },
  farm_protest: { kind: 'news', tag: 'Politics', headline: 'Farmers blockade the central bank with tractors',
    body: 'High borrowing costs are crushing farmers and builders. The protest makes the evening news.',
    effects: { add: { approval: -5 } } },
  pre_election_handout: { kind: 'news', tag: 'Politics', headline: 'Government announces pre-election handouts',
    body: 'Tax rebates and spending pledges arrive just in time for the campaign. That is extra fuel for demand.',
    effects: { add: { spend: 2.5, approval: 4 } } },

  /* ---------- Macro to Markets ---------- */
  trader_welcome: { kind: 'info', tag: 'Briefing', headline: 'Welcome to the trading desk',
    body: 'This time you don’t run the economy. You run an options book worth 100, tracked in GammaLedger. Hints arrive at the start of each quarter; the news itself lands after you place your trade.' },
  credit_whispers: { kind: 'info', tag: 'Rumour', headline: 'Rumours swirl about a big bank’s mortgage losses',
    body: 'Credit spreads are widening and nobody will say which bank is in trouble. Implied volatility is still cheap. For now.' },
  rescue_talks: { kind: 'info', tag: 'Rumour', headline: 'Weekend talks to rescue a bank have stalled',
    body: 'Regulators and bankers are locked in a room. No buyer has stepped forward.' },
  emergency_meeting: { kind: 'info', tag: 'Central bank', headline: 'The central bank calls an emergency meeting',
    body: 'Officials hint they will “use every tool available”. Markets are betting on a big announcement.' },
  hawkish_pivot: { kind: 'info', tag: 'Central bank', headline: 'The central bank signals rapid rate hikes',
    body: 'Inflation is far above target. The Governor says rates will rise “as fast as needed”. Bond yields are already climbing.' },
  peak_talk: { kind: 'info', tag: 'Analysts', headline: 'Economists debate whether inflation has peaked',
    body: 'Goods prices are easing, but wages are still rising fast. Nobody agrees on when rate hikes end.' },
  virus_rumours: { kind: 'info', tag: 'Health', headline: 'A new virus is spreading abroad',
    body: 'Health officials say the risk is low. Supply chains through Asia are already slowing. Implied volatility is near record lows.' },
  qe_launch: { kind: 'news', tag: 'Central bank', headline: 'Central bank launches unlimited bond buying',
    body: 'The central bank promises to buy “whatever it takes”. Yields drop, spreads tighten and fear starts to ebb.',
    effects: { add: { qe: 15, stress: -16, stocks: 9 }, shock: { tp: [-0.6, 0.85], fin: [-6, 0.7], demand: [0.8, 0.85] } } },
  fiscal_bazooka: { kind: 'news', tag: 'Fiscal', headline: 'Government unveils a record rescue package',
    body: 'Wage subsidies, grants and cheap loans for business. The deficit will be enormous, and so will the support for spending.',
    effects: { add: { spend: 4, stress: -6, stocks: 5 } } },

  /* ---------- Dilemmas ---------- */
  pres_pressure: { kind: 'dilemma', tag: 'Politics', headline: 'The President wants lower rates. Now.',
    body: 'In a televised interview the President calls your policy "a disaster" and demands a cut before the next vote.',
    bot: 1,
    choices: [
      { label: 'Cut half a point as asked', effects: { add: { rate: -0.5, cred: -12, approval: 4, expInfl: 0.3 }, tags: ['caved'] },
        note: 'Markets now wonder who really sets rates. Expectations drift up.' },
      { label: 'Hold firm and say nothing', effects: { add: { cred: 6, approval: -3 }, tags: ['independent'] },
        note: 'Independence protects the long-run value of money, even when it is unpopular.' },
      { label: 'Give a speech explaining your plan', effects: { add: { cred: 2, approval: -1, expInfl: -0.1 }, tags: ['independent'] },
        note: 'Clear communication earns some public understanding.' } ] },
  midterm_pressure: { kind: 'dilemma', tag: 'Politics', headline: 'Congress threatens to curb your powers',
    body: 'Lawmakers draft a bill to put the central bank under direct political control unless rates come down.',
    bot: 1,
    choices: [
      { label: 'Ease off to calm Congress', effects: { add: { rate: -1.0, cred: -14, approval: 5, expInfl: 0.6 }, tags: ['caved'] },
        note: 'The inflation fight just got longer. Markets price in higher future inflation.' },
      { label: 'Stay the course', effects: { add: { cred: 8, approval: -4 }, tags: ['independent'] },
        note: 'Painful now, but credibility is what finally breaks inflation expectations.' } ] },
  appoint_doves: { kind: 'dilemma', tag: 'Politics', headline: 'Government plans to pack your board',
    body: 'Two loyalists will be appointed to the rate-setting committee unless you "cooperate" on rates.',
    bot: 1,
    choices: [
      { label: 'Cooperate quietly', effects: { add: { rate: -0.5, cred: -15, expInfl: 0.5 }, tags: ['caved'] },
        note: 'Captured central banks tend to deliver higher inflation over time.' },
      { label: 'Publish the threat', effects: { add: { cred: 7, approval: -2, stress: 5 }, tags: ['independent'] },
        note: 'Transparency raises the political cost of interfering.' },
      { label: 'Negotiate a new mandate', effects: { add: { cred: 1, approval: 1 } },
        note: 'A clear legal mandate can protect independence without a public fight.' } ] },
  deficit_financing: { kind: 'dilemma', tag: 'Politics', headline: 'The Treasury asks you to print money for it',
    body: 'The Finance Minister wants the central bank to buy new government bonds directly, at whatever price.',
    bot: 1,
    choices: [
      { label: 'Agree to direct financing', effects: { add: { qe: 8, cred: -15, expInfl: 0.8, spend: 1 }, tags: ['caved'] },
        note: 'Monetary financing of deficits is the classic road to high inflation.' },
      { label: 'Refuse', effects: { add: { cred: 5, approval: -2 }, shock: { tp: [0.3, 0.8] }, tags: ['independent'] },
        note: 'The government must now fund itself in the market, at market prices.' },
      { label: 'Buy existing bonds only, temporarily', effects: { add: { qe: 4, cred: -3 } },
        note: 'A grey zone: market purchases ease conditions without directly funding spending.' } ] },
  infra_bill: { kind: 'dilemma', tag: 'Fiscal', headline: 'A big infrastructure bill lands on your desk',
    body: 'Bridges, broadband and rail. Supporters say it will create jobs. Critics point at the price tag.',
    bot: 1,
    choices: [
      { label: 'Pass the full package', effects: { add: { spend: 2, approval: 3 } },
        note: 'Public investment adds demand now and capacity later.' },
      { label: 'Pass a smaller, targeted bill', effects: { add: { spend: 1, approval: 1 } },
        note: 'Smaller, faster projects often deliver more bang per buck.' },
      { label: 'Block it', effects: { add: { approval: -3 } },
        note: 'The deficit stays smaller, but so does the recovery.' } ] },
  austerity_push: { kind: 'dilemma', tag: 'Fiscal', headline: 'Creditors demand austerity',
    body: 'Investors and international partners want a plan to cut the deficit, starting now.',
    bot: 1,
    choices: [
      { label: 'Deep cuts now', effects: { add: { spend: -2, approval: -6 }, shock: { tp: [-0.4, 0.8] } },
        note: 'Cutting in a slump can shrink the economy faster than the debt.' },
      { label: 'Gradual plan, start next year', effects: { add: { spend: -0.5, approval: -1 }, shock: { tp: [-0.2, 0.8] } },
        note: 'A credible medium-term plan often calms markets without killing demand.' },
      { label: 'Refuse', effects: { add: { approval: 1, stress: 6 }, shock: { tp: [0.6, 0.8] } },
        note: 'Borrowing costs climb as investors demand a higher premium.' } ] },
  megabank_bailout: { kind: 'dilemma', tag: 'Banks', headline: 'MegaBank says it will fail by Monday',
    body: 'It is too big to fail, or so its executives say. The board asks for a rescue.',
    bot: 2,
    choices: [
      { label: 'Full bailout, no strings', effects: { add: { stress: -18, debt: 4, approval: -8, cred: -4, bank: 15 }, tags: ['bailout'] },
        note: 'Panic eases, but bankers learn that losses will be covered next time too: moral hazard.' },
      { label: 'Let it fail', effects: { add: { stress: 22, approval: 3, bank: -15, stocks: -10 }, shock: { demand: [-1.2, 0.85] } },
        note: 'Discipline matters, but a disorderly failure can take the whole system down with it.' },
      { label: 'Wind it down, protect depositors', effects: { add: { stress: -8, debt: 2, approval: -1, bank: 8 } },
        note: 'Shareholders lose, depositors are protected. Bagehot would approve.' } ] },
  bank_lobby: { kind: 'dilemma', tag: 'Credit', headline: 'Banks lobby to relax mortgage rules',
    body: 'Lenders say tight rules lock young families out of home ownership.',
    bot: 1,
    choices: [
      { label: 'Relax the rules', effects: { add: { bubble: 12, stocks: 4, approval: 2 } },
        note: 'More credit flows straight into house prices.' },
      { label: 'Keep the rules', effects: { add: { approval: -1 } },
        note: 'Boring, and exactly what the rules are for.' },
      { label: 'Tighten, but help first-time buyers', effects: { add: { bubble: -5, spend: 0.3, approval: 1 } },
        note: 'Targeted help can ease access without fuelling a credit boom.' } ] },
  wage_indexation: { kind: 'dilemma', tag: 'Labour', headline: 'Unions demand wages linked to inflation',
    body: 'Automatic cost-of-living raises would protect workers. Employers warn of a wage-price spiral.',
    bot: 1,
    choices: [
      { label: 'Back automatic indexation', effects: { add: { expInfl: 0.8, approval: 4 } },
        note: 'Indexation locks today’s inflation into tomorrow’s wages.' },
      { label: 'Stay neutral', effects: { add: { expInfl: 0.2 } },
        note: 'Wage bargaining carries on, case by case.' },
      { label: 'Push one-off support instead', effects: { add: { spend: 0.8, approval: 2 } },
        note: 'Targeted help protects the vulnerable without hard-wiring inflation.' } ] },
  price_controls: { kind: 'dilemma', tag: 'Politics', headline: 'Politicians want price caps on energy',
    body: 'A cap would cut bills overnight. Economists warn of shortages and a huge subsidy bill.',
    bot: 1,
    choices: [
      { label: 'Cap prices', effects: { add: { infl: -1.2, debt: 3, approval: 4 }, shock: { supply: [0.5, 0.85], demand: [-0.4, 0.8] } },
        note: 'Measured inflation falls now, but suppressed prices tend to come back later.' },
      { label: 'Targeted payments to poorer households', effects: { add: { spend: 0.8, approval: 2 } },
        note: 'Protects those hit hardest while letting prices still signal scarcity.' },
      { label: 'Let prices adjust', effects: { add: { approval: -4 } },
        note: 'High prices cut demand and draw in new supply, but it hurts.' } ] },
  unfunded_tax_cut: { kind: 'dilemma', tag: 'Fiscal', headline: 'Your party wants a giant unfunded tax cut',
    body: 'The biggest tax cut in 50 years, paid for with borrowing, announced with no independent costing.',
    bot: 2,
    choices: [
      { label: 'Announce it in full', effects: { add: { tax: -3, approval: 3, stress: 26, fx: -9, stocks: -6 }, shock: { tp: [1.6, 0.75], fin: [8, 0.7] }, tags: ['vigilantes'] },
        note: 'Bond markets revolt. Yields spike, the currency slides and leveraged pension funds face margin calls.' },
      { label: 'Smaller cut, funded by spending cuts', effects: { add: { tax: -1.5, spend: -1.5, approval: -1 } },
        note: 'A funded package keeps investors on side.' },
      { label: 'Shelve it until it is costed', effects: { add: { approval: -3, cred: 3 } },
        note: 'Fiscal credibility is cheap to keep and expensive to rebuild.' } ] },
  capital_controls: { kind: 'dilemma', tag: 'Capital flows', headline: 'Advisers urge capital controls',
    body: 'Limits on moving money abroad would stop the outflow. Investors may never forgive you.',
    bot: 1,
    choices: [
      { label: 'Impose controls', effects: { add: { fx: 6, stress: -6, stocks: -10, cred: -6, reserves: 4 } },
        note: 'The bleeding stops, but foreign investment dries up for years.' },
      { label: 'Keep markets open', effects: { add: { stress: 3 } },
        note: 'You keep investors’ trust, but must defend the currency with rates or reserves.' },
      { label: 'Ask the IMF for a credit line', effects: { add: { reserves: 10, approval: -5, stress: -4 } },
        note: 'A bigger war chest calms markets, but conditions attached are unpopular.' } ] }
};

/* Events the daily challenge and endless mode draw from */
const RANDOM_POOL = ['consumer_boom', 'confidence_crash', 'export_slump', 'oil_spike', 'energy_crisis', 'supply_chain', 'ai_boom',
  'record_harvest', 'wage_spiral', 'deflation_scare', 'strike_wave', 'trade_war', 'rating_downgrade', 'pres_pressure',
  'infra_bill', 'austerity_push', 'deficit_financing', 'wage_indexation', 'price_controls', 'supply_heals'];

/* ---------- Levels ----------
   Year labels: start.year >= 1000 shows "Q3 2008", otherwise "Year 1 · Q3"   */
const CHAPTERS = [
  { id: 1, name: 'Turn the Tap', blurb: 'Interest rates and the speed of money' },
  { id: 2, name: 'The Treasury Pipe', blurb: 'Taxes, spending and the zero lower bound' },
  { id: 3, name: 'Shocks and Expectations', blurb: 'When prices rise for the wrong reasons' },
  { id: 4, name: 'Financial Plumbing', blurb: 'Bubbles, banks and panics' },
  { id: 5, name: 'Modern Turbulence', blurb: 'Pandemics and the return of inflation' },
  { id: 6, name: 'Power and the World', blurb: 'Bond markets, hot money and politics' },
  { id: 7, name: 'Macro to Markets', blurb: 'Trade options on the economy you learned to run' }
];

const LEVELS = [
  { id: 'L1', chapter: 1, title: 'Turn the Tap', concept: 'Interest rates steer demand', era: 'Fictional',
    start: { year: 1, q: 1 }, quarters: 6, tools: ['rate'],
    brief: 'Your economy is running hot: everyone has a job, but prices are climbing too fast. The only control you have is the interest rate.',
    goal: 'Bring inflation back inside the safe zone.',
    state: { rate: 1.5, infl: 3.2, expInfl: 2.4, gap: 1.8, unemp: 3.6, stress: 16, approval: 58 },
    targets: { infl: [1, 3] },
    events: [ { q: 1, id: 'welcome' }, { q: 4, id: 'consumer_boom' } ],
    tutorial: {
      1: 'Inflation is above its safe zone. Press + on the policy rate a couple of times, then run the quarter.',
      2: 'See the dashed marker on each tank? That is the GammaLedger forecast for next quarter. Rates take time to bite.',
      3: 'Green quarters build a streak, and a streak multiplies your points.',
      4: 'A spending boom just hit. You may need one more hike.'
    },
    objective: { type: 'streak', value: 5, label: 'Build a streak of 5 green quarters' },
    lesson: { title: 'Interest rates steer demand',
      points: [ 'A higher policy rate makes borrowing more expensive and saving more attractive, so households and firms spend less.',
                'Less spending means firms can raise prices less easily, so inflation cools.',
                'The same lever works in reverse: cutting rates encourages borrowing and spending.' ],
      history: 'Bill Phillips built the MONIAC in 1949 to show exactly this: open a valve and watch money flow through the economy.' },
    quiz: { q: 'Your economy is overheating. What does raising the policy rate do first?',
      options: [ 'Makes borrowing more expensive, so spending slows', 'Prints money for the government', 'Cuts taxes for households', 'Raises wages directly' ],
      answer: 0, explain: 'Rates work through the cost of credit: dearer loans mean less spending, which takes pressure off prices.' } },

  { id: 'L2', chapter: 1, title: 'Slow Water', concept: 'Long and variable lags', era: 'Fictional',
    start: { year: 2, q: 1 }, quarters: 8, tools: ['rate'],
    brief: 'Inflation is rising and the newspapers want you to slam on the brakes. But rate changes take 2 to 4 quarters to work. Overdo it and you cause a recession.',
    goal: 'Cool inflation without tipping into recession.',
    state: { rate: 2.0, infl: 3.6, expInfl: 2.6, gap: 2.4, unemp: 3.4 },
    events: [ { q: 3, id: 'consumer_boom' }, { q: 6, id: 'export_slump' } ],
    tutorial: { 1: 'Rates act with a lag. If you keep hiking until inflation is back to target, you will have hiked too much.' },
    objective: { type: 'all', label: 'Inflation at 3% or lower at the end, with no recession', parts: [
      { type: 'end', metric: 'infl', op: '<=', value: 3 }, { type: 'noRecession' } ] },
    lesson: { title: 'Long and variable lags',
      points: [ 'Monetary policy hits the economy with a delay of roughly a year or more.',
                'Central banks must act on forecasts, not on today’s numbers.',
                'Policymakers who react only to current inflation tend to overshoot in both directions.' ],
      history: 'Milton Friedman popularised the phrase "long and variable lags" around 1960. It remains one of the hardest parts of the job.' },
    quiz: { q: 'Why do central banks often stop hiking before inflation is back to target?',
      options: [ 'Because past hikes are still working their way through the economy', 'Because they run out of money', 'Because the law forbids high rates', 'Because inflation always falls by itself' ],
      answer: 0, explain: 'Hikes already made keep cooling demand for quarters after. Waiting for target before stopping usually means overshooting.' } },

  { id: 'L3', chapter: 1, title: 'Cold Snap', concept: 'The Taylor rule and forward guidance', era: 'Fictional',
    start: { year: 3, q: 1 }, quarters: 8, tools: ['rate', 'guidance'],
    brief: 'Business confidence just collapsed and unemployment is about to climb. Time to cut. You also have a new tool: words.',
    goal: 'Stop unemployment from spiralling.',
    state: { rate: 3.0, infl: 2.2, expInfl: 2.1, gap: 0.2, unemp: 4.6 },
    events: [ { q: 1, id: 'confidence_crash' }, { q: 3, id: 'export_slump' } ],
    tutorial: {
      1: 'The GammaLedger Desk suggests a rate using the Taylor rule, a rule of thumb from economist John Taylor (1993). It weighs inflation against slack in the economy.',
      2: 'Forward guidance moves expectations now. Just don’t promise one thing and do another.'
    },
    objective: { type: 'end', metric: 'unemp', op: '<=', value: 5.5, label: 'Finish with unemployment at 5.5% or lower' },
    lesson: { title: 'The Taylor rule',
      points: [ 'Taylor rule: rate = neutral rate + inflation + ½ × (inflation − target) + ½ × output gap.',
                'In a downturn it calls for cuts; when inflation overshoots it calls for hikes larger than the overshoot.',
                'Forward guidance (telling markets your plans) shifts expectations before you even move.' ],
      history: 'John Taylor proposed his rule in 1993. Central banks still publish it in their briefing books as a benchmark.' },
    quiz: { q: 'Inflation is 2% above target. By the Taylor rule, the policy rate should rise by about…',
      options: [ '3 points: more than one-for-one', '1 point', '0.5 points', 'Nothing until unemployment rises' ],
      answer: 0, explain: '2 points of extra inflation plus ½ × 2 on top: real rates must rise, so the nominal rate moves more than inflation.' } },

  { id: 'L4', twoStar: 85, chapter: 2, title: 'The Multiplier', concept: 'Fiscal policy and automatic stabilizers', era: 'Fictional',
    start: { year: 4, q: 1 }, quarters: 8, tools: ['rate', 'spend', 'tax'],
    brief: 'A recession is under way and rates are already low. The Treasury can step in, but every dollar borrowed adds to the debt.',
    goal: 'Get people back to work without letting debt run away.',
    state: { rate: 0.75, infl: 1.2, expInfl: 1.8, gap: -3.2, unemp: 6.6, debt: 70, approval: 44, stress: 28 },
    shocks: { demand: [-1.2, 0.92] },
    targets: { unempMax: 5.5, debtMax: 85 },
    events: [ { q: 1, id: 'export_slump' }, { q: 3, id: 'infra_bill' }, { q: 6, id: 'austerity_push' } ],
    tutorial: { 1: 'Government spending lifts demand directly. When rates are near zero the multiplier is bigger, because the central bank does not offset it.' },
    objective: { type: 'all', label: 'Unemployment at 5% or lower and debt at 82% or lower at the end', parts: [
      { type: 'end', metric: 'unemp', op: '<=', value: 5 }, { type: 'end', metric: 'debt', op: '<=', value: 82 } ] },
    lesson: { title: 'The fiscal multiplier',
      points: [ 'Each dollar of government spending can raise output by more or less than a dollar: that ratio is the multiplier.',
                'Multipliers are larger in deep slumps and when interest rates are stuck near zero.',
                'Automatic stabilizers (tax receipts falling, benefits rising) cushion recessions without any new law.' ],
      history: 'Research such as Auerbach and Gorodnichenko (2012) estimated spending multipliers well above 1 in recessions and much smaller in expansions.' },
    quiz: { q: 'When is a spending increase likely to boost output the most?',
      options: [ 'In a deep recession with rates near zero', 'At full employment with high inflation', 'When the central bank is hiking fast', 'When debt is already very high' ],
      answer: 0, explain: 'With idle resources and no offsetting rate hikes, extra spending mostly adds output rather than prices.' } },

  { id: 'L5', chapter: 2, title: 'Zero Lower Bound', concept: 'Liquidity traps and QE', era: '2009',
    start: { year: 2009, q: 1 }, quarters: 8, tools: ['rate', 'guidance', 'qe', 'spend', 'tax'],
    brief: 'The financial crisis has left a deep hole. Your policy rate is already 0.25% and you cannot cut much further. Prices are close to falling.',
    goal: 'Escape the liquidity trap and avoid deflation.',
    state: { rate: 0.25, infl: 0.6, expInfl: 1.4, gap: -4.5, unemp: 8.2, debt: 75, stress: 46, stocks: 70, approval: 40, qe: 12 },
    shocks: { demand: [-1.2, 0.9] },
    targets: { unempMax: 7.5, debtMax: 100 },
    events: [ { q: 2, id: 'deflation_scare' }, { q: 5, id: 'austerity_push' } ],
    tutorial: { 1: 'Rates cannot go below zero here. Bond buying (QE) pushes down long-term yields instead, and fiscal policy packs a bigger punch.' },
    objective: { type: 'end', metric: 'infl', op: '>=', value: 1.5, label: 'Finish with inflation at 1.5% or higher' },
    lesson: { title: 'The zero lower bound',
      points: [ 'When rates hit zero, the usual tool stops working: people can just hold cash.',
                'Quantitative easing buys long bonds to push down long-term rates and calm markets.',
                'Forward guidance ("rates will stay low for a long time") and fiscal policy become the main levers.' ],
      history: 'From 2008 to 2014 the Fed’s balance sheet grew from under $1 trillion to about $4.5 trillion, mostly through QE.' },
    quiz: { q: 'With the policy rate at zero, how does QE try to stimulate the economy?',
      options: [ 'By pushing down long-term interest rates', 'By sending cash to every household', 'By raising taxes', 'By lowering the minimum wage' ],
      answer: 0, explain: 'Buying long bonds raises their price and lowers their yield, which cuts mortgage and corporate borrowing costs.' } },

  { id: 'L6', twoStar: 68, chapter: 3, title: 'Oil Shock', concept: 'Supply shocks and stagflation', era: '1973',
    start: { year: 1973, q: 4 }, quarters: 8, tools: ['rate', 'guidance', 'spend', 'tax'],
    brief: 'Oil exporters have cut supply and energy prices have quadrupled. Prices are rising and output is falling at the same time. The old rulebook says you can only fix one.',
    goal: 'Stop the inflation from becoming permanent without crushing jobs.',
    params: { rN: 1.0 },
    state: { rate: 7, infl: 6, expInfl: 5, gap: 1, unemp: 4.8, debt: 35, cred: 50, stress: 22 },
    targets: { infl: [1, 5], unempMax: 7, debtMax: 60 },
    events: [ { q: 1, id: 'oil_embargo' }, { q: 3, id: 'wage_indexation' }, { q: 5, id: 'price_controls' } ],
    tutorial: { 1: 'A supply shock pushes prices up and output down at once. Watch expected inflation: if it rises, the shock becomes permanent.' },
    objective: { type: 'end', metric: 'expInfl', op: '<=', value: 5, label: 'Keep expected inflation at 5% or lower' },
    lesson: { title: 'Supply shocks and stagflation',
      points: [ 'A supply shock raises prices while cutting output, so there is no painless response.',
                'The real danger is second-round effects: wages and expectations chasing the first price jump.',
                'Central banks often "look through" a one-off shock, but only if expectations stay anchored.' ],
      history: 'The 1973 oil embargo quadrupled oil prices. Inflation in the US and UK went on to reach double digits.' },
    quiz: { q: 'What makes a one-off oil price jump turn into lasting inflation?',
      options: [ 'Wages and expectations adjusting upward in response', 'Oil prices staying high', 'Interest rates being too high', 'Government spending cuts' ],
      answer: 0, explain: 'A one-off level shift fades. It becomes persistent when people bake it into wages and prices: second-round effects.' } },

  { id: 'L7', twoStar: 70, chapter: 3, title: 'The Volcker Gambit', concept: 'Credibility and disinflation', era: '1979',
    start: { year: 1979, q: 4 }, quarters: 10, tools: ['rate', 'guidance'],
    brief: 'Inflation is in double digits and nobody believes it will fall. To break expectations you may need painfully high rates and a recession. Politicians will hate you.',
    goal: 'Break the back of inflation and win back credibility.',
    params: { rN: 1.5 },
    state: { rate: 11, infl: 12, expInfl: 10.5, gap: 0.5, unemp: 6, cred: 25, debt: 30, approval: 45, stress: 25 },
    targets: { infl: [1, 6], unempMax: 9, growthMin: -2, approvalMin: 25, debtMax: 60 },
    fail: { inflMax: 20, approvalMin: 10 },
    events: [ { q: 3, id: 'midterm_pressure' }, { q: 5, id: 'farm_protest' }, { q: 7, id: 'pres_pressure' } ],
    tutorial: { 1: 'Credibility is the key gauge here. When it is low, expectations ignore your target. It recovers when inflation actually falls.' },
    objective: { type: 'all', label: 'Inflation below 6% and credibility at 50 or more at the end', parts: [
      { type: 'end', metric: 'infl', op: '<', value: 6 }, { type: 'end', metric: 'cred', op: '>=', value: 50 } ] },
    lesson: { title: 'Credibility and disinflation',
      points: [ 'Once high inflation is expected, it feeds itself through wage deals and price setting.',
                'Breaking it requires real interest rates high enough to hurt, held long enough to be believed.',
                'The cost in lost output (the "sacrifice ratio") is lower when the central bank is credible.' ],
      history: 'Under Paul Volcker the Fed funds rate peaked near 20% in 1981. Inflation fell from about 13% to under 4% by 1983, after two recessions.' },
    quiz: { q: 'Why does central bank credibility make fighting inflation cheaper?',
      options: [ 'Expectations fall faster, so less recession is needed', 'Credible banks can print more money', 'Credibility lowers taxes', 'It does not matter at all' ],
      answer: 0, explain: 'If people believe inflation will fall, they ask for smaller raises and set smaller price increases. Less pain is needed.' } },

  { id: 'L8', twoStar: 85, chapter: 4, title: 'Bubble Trouble', concept: 'Asset bubbles and macroprudential policy', era: '2005',
    start: { year: 2004, q: 3 }, quarters: 10, tools: ['rate', 'guidance', 'macropru'],
    features: { bubble: true },
    brief: 'Inflation looks fine, but house prices are soaring on cheap credit. Raise rates and you hurt the whole economy. Ignore it and the bubble may burst.',
    goal: 'Deflate the housing bubble without a crash.',
    state: { rate: 1.5, infl: 2.3, expInfl: 2.2, gap: 0.8, unemp: 4.8, bubble: 55, stocks: 110 },
    targets: { bubbleMax: 70 },
    events: [ { q: 2, id: 'teaser_mortgages' }, { q: 4, id: 'bank_lobby' }, { q: 7, id: 'housing_mania' } ],
    tutorial: { 1: 'If the bubble tank tops out, it bursts. Mortgage rules hit housing credit directly without raising rates for everyone.' },
    objective: { type: 'end', metric: 'bubble', op: '<=', value: 45, label: 'Finish with the bubble at 45 or lower' },
    lesson: { title: 'Lean or clean?',
      points: [ 'Low inflation does not mean financial stability: credit booms can build quietly.',
                'Macroprudential tools (loan-to-value limits, capital buffers) target credit without raising rates for everyone.',
                'Bursting bubbles can hurt far more than the boom ever helped.' ],
      history: 'House prices in major US cities roughly doubled between 2000 and 2006 (Case-Shiller 20-city index). The crash that followed was at the heart of the 2008 financial crisis.' },
    quiz: { q: 'Which tool targets a housing boom most directly?',
      options: [ 'Tighter loan-to-value limits on mortgages', 'Cutting the policy rate', 'Buying government bonds', 'Raising government spending' ],
      answer: 0, explain: 'Limits on how much people can borrow against a house cool mortgage credit without raising borrowing costs economy-wide.' } },

  { id: 'L9', chapter: 4, title: 'Lehman Weekend', concept: 'Lender of last resort', era: '2008',
    start: { year: 2008, q: 3 }, quarters: 8, tools: ['rate', 'guidance', 'liquidity', 'qe', 'spend'],
    features: { banks: true },
    brief: 'A major investment bank is about to collapse. Money markets are seizing up. You have to stop a panic while deciding who deserves rescue.',
    goal: 'Stop the panic and keep the banking system standing.',
    state: { rate: 2.0, infl: 3.8, expInfl: 2.5, gap: -0.5, unemp: 5.8, stress: 42, stocks: 85, bank: 52, debt: 65, approval: 40 },
    targets: { infl: [0.5, 3.5], unempMax: 8, growthMin: -1, debtMax: 100, bankMin: 30 },
    events: [ { q: 1, id: 'lehman' }, { q: 2, id: 'megabank_bailout' }, { q: 5, id: 'deflation_scare' } ],
    tutorial: { 1: 'In a panic, the lender of last resort lends freely to solvent banks against good collateral. Emergency lending costs 2 policy points.' },
    objective: { type: 'end', metric: 'stress', op: '<=', value: 30, label: 'Finish with market fear at 30 or lower' },
    lesson: { title: 'The lender of last resort',
      points: [ 'In a panic, even healthy banks fail because everyone wants cash at once.',
                'Bagehot’s rule: lend freely, at a penalty rate, against good collateral.',
                'Rescues stop panics but create moral hazard: risk-takers expect to be saved again.' ],
      history: 'Lehman Brothers filed for bankruptcy on 15 September 2008. Within weeks central banks had launched emergency lending on an unprecedented scale.' },
    quiz: { q: 'What is the main downside of rescuing failing banks?',
      options: [ 'Moral hazard: banks take more risk expecting future rescues', 'It always causes hyperinflation', 'It is illegal everywhere', 'It raises unemployment' ],
      answer: 0, explain: 'If losses are covered, risk-taking pays. That is why rescues usually wipe out shareholders.' } },

  { id: 'L10', chapter: 4, title: 'Group-Chat Bank Run', concept: 'Duration risk and financial stability', era: '2023',
    start: { year: 2023, q: 1 }, quarters: 8, tools: ['rate', 'guidance', 'liquidity', 'qe'],
    features: { banks: true },
    brief: 'You are mid-way through the fastest hiking cycle in decades. Banks loaded up on long-dated bonds when rates were low, and those bonds are now worth a lot less.',
    goal: 'Finish the inflation fight without breaking the banks.',
    state: { rate: 3.5, infl: 6.0, expInfl: 4.4, gap: 1.6, unemp: 3.5, bank: 50, stress: 24, debt: 115, approval: 42, qe: 30, cred: 55 },
    targets: { infl: [1, 3.5], unempMax: 5.5, debtMax: 130, bankMin: 30 },
    events: [ { q: 2, id: 'yields_jump' }, { q: 3, id: 'bank_run_app' } ],
    tutorial: { 1: 'Rising long yields shrink bank health. Separate your tools: rates for inflation, emergency lending for bank runs.' },
    objective: { type: 'all', label: 'Inflation at 3.5% or lower at the end, and bank health never below 25', parts: [
      { type: 'end', metric: 'infl', op: '<=', value: 3.5 }, { type: 'always', metric: 'bank', op: '>=', value: 25 } ] },
    lesson: { title: 'Duration risk',
      points: [ 'When rates rise, the market value of long bonds falls. Banks holding them face hidden losses.',
                'Digital banking lets uninsured depositors run in hours, not weeks.',
                'Central banks can keep raising rates for inflation while using lending facilities for stability: two goals, two tools.' ],
      history: 'In March 2023 depositors tried to pull $42bn from Silicon Valley Bank in a single day. Regulators shut it within 48 hours.' },
    quiz: { q: 'Why did rising interest rates hurt banks in 2023?',
      options: [ 'Their long-dated bonds lost market value', 'Their loans became illegal', 'Deposits paid no interest', 'They had too much cash' ],
      answer: 0, explain: 'A bond paying 1% is worth much less when new bonds pay 4%. Forced to sell, a bank realises the loss.' } },

  { id: 'L11', twoStar: 70, chapter: 5, title: 'The Great Pause', concept: 'Pandemic policy and combined shocks', era: '2020',
    start: { year: 2020, q: 1 }, quarters: 10, tools: ['rate', 'guidance', 'qe', 'spend', 'tax', 'liquidity'], pp: 3,
    brief: 'A virus forces the economy into an induced coma. Then it reopens all at once into broken supply chains. You have every tool. Use them in the right order.',
    goal: 'Bridge the lockdown, then keep the reopening from overheating.',
    state: { rate: 1.75, infl: 2.0, expInfl: 2.0, gap: 0.5, unemp: 3.6, debt: 105, stress: 18, approval: 52 },
    targets: { infl: [1, 3.5], unempMax: 6.5, growthMin: -1, debtMax: 140, approvalMin: 30 },
    events: [ { q: 1, id: 'lockdown' }, { q: 4, id: 'vaccine' }, { q: 6, id: 'reopening' }, { q: 8, id: 'supply_chain' } ],
    tutorial: { 1: 'This is not a normal recession: the economy is closed on purpose. Bridge incomes with fiscal support and keep markets working.' },
    objective: { type: 'end', metric: 'unemp', op: '<=', value: 5.5, label: 'Get unemployment back to 5.5% or lower by the end' },
    lesson: { title: 'When shocks collide',
      points: [ 'A lockdown is a supply and a demand shock at once. Income support keeps firms and households alive until reopening.',
                'Reopening released pent-up demand into constrained supply, so inflation rose.',
                'Whether inflation is "transitory" depends on whether it spreads to wages and expectations.' ],
      history: 'US unemployment jumped from 3.5% to 14.7% in April 2020, the sharpest rise on record. By 2022 inflation hit 40-year highs.' },
    quiz: { q: 'Why did inflation surge after the 2020 reopening?',
      options: [ 'Pent-up demand met supply that could not keep up', 'Interest rates were too high', 'Governments cut spending', 'Oil prices fell' ],
      answer: 0, explain: 'Savings plus stimulus lifted demand just as factories, ports and workers were still getting back to normal.' } },

  { id: 'L12', twoStar: 55, chapter: 5, title: 'Inflation Strikes Back', concept: 'Behind the curve and the soft landing', era: '2022',
    start: { year: 2022, q: 1 }, quarters: 10, tools: ['rate', 'guidance', 'qe', 'spend', 'tax'],
    brief: 'Inflation is 7.5% and your rate is still 0.25%. You are behind the curve. Catch up fast enough to stop a spiral, but not so fast that you cause a crash.',
    goal: 'Achieve the soft landing.',
    state: { rate: 0.25, infl: 7.5, expInfl: 3.8, gap: 1.8, unemp: 3.8, debt: 120, qe: 35, stress: 22, cred: 60, approval: 45 },
    targets: { infl: [1, 4], unempMax: 5.5, growthMin: -0.5, debtMax: 135 },
    events: [ { q: 2, id: 'energy_crisis' }, { q: 5, id: 'supply_heals' }, { q: 7, id: 'pres_pressure' } ],
    tutorial: { 1: 'Real rates are deeply negative: the rate is far below inflation. Large early hikes plus hawkish guidance can stop expectations from drifting.' },
    objective: { type: 'all', label: 'Soft landing: inflation at 3% or lower at the end, with no recession', parts: [
      { type: 'end', metric: 'infl', op: '<=', value: 3 }, { type: 'noRecession' } ] },
    lesson: { title: 'The soft landing',
      points: [ 'Being "behind the curve" means real interest rates are too low for the inflation you face.',
                'Fast, early hikes plus credible guidance can stop expectations de-anchoring.',
                'A soft landing (inflation down without a recession) is rare, but anchored expectations make it possible.' ],
      history: 'In 2022 the Fed raised rates by 4.25 points in nine months, its fastest pace since the early 1980s.' },
    quiz: { q: 'What does being "behind the curve" mean?',
      options: [ 'Policy rates are too low relative to inflation', 'The central bank has run out of reserves', 'Inflation is below target', 'Rates are rising too fast' ],
      answer: 0, explain: 'If inflation is 7% and rates are near zero, real rates are deeply negative, still stimulating an overheating economy.' } },

  { id: 'L13', twoStar: 55, chapter: 6, title: 'Bond Vigilantes', concept: 'Fiscal credibility and the bond market', era: '2022',
    start: { year: 2022, q: 3 }, quarters: 8, tools: ['spend', 'tax', 'liquidity'],
    features: { fx: true },
    brief: 'Role swap: this time you are the Finance Minister. The central bank sets rates by its own rule. Inflation is high, debt is near 100% of GDP, and bond investors are watching your every word.',
    goal: 'Keep markets calm while supporting households.',
    state: { rate: 2.25, infl: 9, expInfl: 3.5, gap: 0.3, unemp: 3.6, debt: 98, cred: 55, stress: 25, fx: 95, approval: 28 },
    targets: { infl: [1, 4], unempMax: 5.5, debtMax: 105, approvalMin: 35, fxMin: 88 },
    events: [ { q: 1, id: 'unfunded_tax_cut' }, { q: 2, id: 'energy_crisis' }, { q: 4, id: 'rating_downgrade' }, { q: 6, id: 'strike_wave' } ],
    tutorial: { 1: 'You do not control rates here. Your weapons are the budget and credibility. Bond investors punish plans they do not trust.' },
    objective: { type: 'always', metric: 'stress', op: '<=', value: 50, label: 'Keep market fear at 50 or lower every quarter' },
    lesson: { title: 'Fiscal credibility',
      points: [ 'Governments borrow at rates set by investors. Lose their trust and borrowing costs spike.',
                'A spike in yields can trigger forced selling by leveraged investors, a doom loop.',
                'Fiscal and monetary policy pulling in opposite directions is a recipe for market chaos.' ],
      history: 'In September 2022 an unfunded UK tax-cut plan sent gilt yields soaring. The Bank of England had to intervene to protect pension funds. The Prime Minister resigned weeks later.' },
    quiz: { q: 'What are "bond vigilantes"?',
      options: [ 'Investors who sell government bonds to punish policies they distrust', 'Police who guard the treasury', 'Central bankers who buy bonds', 'Ratings agencies' ],
      answer: 0, explain: 'By selling, they push up borrowing costs, a market check on fiscal plans.' } },

  { id: 'L14', chapter: 6, title: 'Hot Money', concept: 'Capital flows and the impossible trinity', era: '2013',
    start: { year: 2013, q: 2 }, quarters: 8, tools: ['rate', 'guidance', 'fx', 'tax'],
    features: { fx: true },
    params: { rN: 2, target: 4, uStar: 6.5 },
    brief: 'You run the central bank of a fast-growing emerging market. A hint of higher rates in a big economy abroad and investors stampede for the exit. Your currency is sliding.',
    goal: 'Defend the currency without burning all your reserves.',
    state: { rate: 6, infl: 5, expInfl: 4.5, gap: 0.5, unemp: 7, debt: 55, reserves: 26, fx: 100, foreignRate: 0.25, stress: 25, approval: 48, cred: 45 },
    targets: { infl: [2, 6], unempMax: 8.5, debtMax: 70, fxMin: 85 },
    events: [ { q: 1, id: 'taper_tantrum' }, { q: 3, id: 'capital_controls' }, { q: 4, id: 'fed_hikes_abroad' }, { q: 6, id: 'trade_war' } ],
    tutorial: { 1: 'A weaker currency makes imports dearer, which feeds inflation. Higher rates attract capital back, but slow the economy. Reserves buy you time, not a solution.' },
    objective: { type: 'all', label: 'Finish with the currency at 85 or higher and at least $12bn of reserves', parts: [
      { type: 'end', metric: 'fx', op: '>=', value: 85 }, { type: 'end', metric: 'reserves', op: '>=', value: 12 } ] },
    lesson: { title: 'The impossible trinity',
      points: [ 'No country can have all three at once: a fixed exchange rate, free capital movement and independent monetary policy.',
                'When rates rise abroad, money flows out of emerging markets and their currencies fall.',
                'Reserves can smooth the fall, but defending a level forever usually ends with empty coffers.' ],
      history: 'In the 2013 "taper tantrum", the Indian rupee, Indonesian rupiah and Brazilian real fell sharply after the Fed hinted at slowing QE.' },
    quiz: { q: 'Which three goals does the "impossible trinity" say you cannot have at once?',
      options: [ 'Fixed exchange rate, free capital flows, independent monetary policy', 'Low inflation, low unemployment, low debt', 'High growth, high wages, high profits', 'Low taxes, high spending, balanced budget' ],
      answer: 0, explain: 'Pick two. With free capital flows and a peg, your rates must follow the anchor country.' } },

  { id: 'L15', chapter: 6, title: 'Election Year', concept: 'Central bank independence', era: 'Fictional',
    start: { year: 7, q: 1 }, quarters: 8, tools: ['rate', 'guidance', 'qe'],
    brief: 'Inflation is above target and an election is coming. The government is spending freely and wants you to keep money cheap. Your job, and your institution, are on the line.',
    goal: 'Hit your inflation target and protect the bank’s independence.',
    state: { rate: 2.25, infl: 3.6, expInfl: 2.7, gap: 1.5, unemp: 3.8, cred: 70, approval: 50 },
    events: [ { q: 1, id: 'pre_election_handout' }, { q: 2, id: 'pres_pressure' }, { q: 4, id: 'appoint_doves' }, { q: 5, id: 'deficit_financing' }, { q: 7, id: 'election' } ],
    tutorial: { 1: 'Every pressure event you resist builds credibility. Every one you give in to costs it, and expectations follow credibility.' },
    objective: { type: 'all', label: 'Inflation at 3% or lower and credibility at 80 or more at the end', parts: [
      { type: 'end', metric: 'infl', op: '<=', value: 3 }, { type: 'end', metric: 'cred', op: '>=', value: 80 } ] },
    lesson: { title: 'Why independence matters',
      points: [ 'Politicians face a temptation to boost the economy before elections: the political business cycle.',
                'If people expect that, they raise prices and wages in advance, and inflation rises with no lasting gain.',
                'Independent central banks with clear mandates resist that pressure, which keeps expectations anchored.' ],
      history: 'Classic studies such as Alesina and Summers (1993) found that more independent central banks delivered lower average inflation in advanced economies. Most countries gave their central banks independence in the 1990s.' },
    quiz: { q: 'Why does central bank independence tend to lower inflation?',
      options: [ 'It makes promises of low inflation believable', 'It lets the bank print unlimited money', 'It removes the need for interest rates', 'It cuts government spending' ],
      answer: 0, explain: 'If politicians can’t override the bank for short-term gains, people trust the target and set prices accordingly.' } },

  /* ---------- Chapter 7: Macro to Markets (you trade; the central bank follows the Taylor rule) ---------- */
  { id: 'L16', twoStar: 85, chapter: 7, title: 'Selling Fear', concept: 'Implied volatility and tail risk', era: '2008',
    start: { year: 2008, q: 1 }, quarters: 8, tools: ['trade'], pp: 1, features: { book: true },
    brief: 'Calm markets, cheap insurance, and a banking system with a hidden hole in it. You run an options book. Selling puts pays a steady premium, until the day it doesn’t.',
    goal: 'Grow your book without getting caught in the crash.',
    state: { rate: 3.0, infl: 3.5, expInfl: 2.5, gap: 0.5, unemp: 4.8, stress: 20, debt: 65 },
    events: [ { q: 1, id: 'trader_welcome' }, { q: 2, id: 'credit_whispers' }, { q: 3, id: 'confidence_crash' }, { q: 4, id: 'rescue_talks' }, { q: 4, id: 'lehman' },
              { q: 6, id: 'emergency_meeting' }, { q: 6, id: 'qe_launch' } ],
    tutorial: { 1: 'Implied volatility prices the insurance. When fear is low, puts are cheap to buy and pay little to sell. Read each hint before you choose.', 4: 'Selling puts into a crisis pays a fat premium, but the hint says the worst may be ahead. Protection can still pay if things get worse.' },
    objective: { type: 'end', metric: 'book', op: '>=', value: 106, label: 'Finish with your book at 106 or higher' },
    lesson: { title: 'Selling insurance',
      points: [ 'An option’s price depends on implied volatility: the market’s fear gauge.',
                'Implied volatility is usually a little higher than the volatility that follows, so selling options earns a premium on average (the variance risk premium).',
                'That premium is payment for crash risk. Sizing and timing matter more than the average.' ],
      history: 'In October 2008 the VIX index closed above 80 for the first time. Investors who had sold cheap crash insurance in 2007 faced huge losses.' },
    quiz: { q: 'Why do put sellers usually earn a premium over time?',
      options: [ 'They are paid for bearing crash risk', 'Puts always expire worthless', 'Central banks pay them', 'Stocks never fall more than 5%' ],
      answer: 0, explain: 'Buyers pay a little extra for protection. The seller keeps it in calm times and pays out in crashes.' } },

  { id: 'L17', twoStar: 85, chapter: 7, title: 'Higher for Longer', concept: 'Interest rates and asset prices', era: '2022',
    start: { year: 2022, q: 1 }, quarters: 8, tools: ['trade'], pp: 1, features: { book: true },
    brief: 'Inflation is 7.5% and the central bank is about to hike faster than it has in forty years. Rising yields make future profits worth less today. For the first time in years, cash pays.',
    goal: 'Beat a cash-only book while rates climb.',
    state: { rate: 0.25, infl: 7.5, expInfl: 3.8, gap: 1.8, unemp: 3.8, debt: 120, qe: 35, stress: 22, cred: 60 },
    events: [ { q: 1, id: 'hawkish_pivot' }, { q: 2, id: 'energy_crisis' }, { q: 2, id: 'yields_jump' }, { q: 5, id: 'peak_talk' }, { q: 6, id: 'supply_heals' } ],
    tutorial: { 1: 'When long-term yields rise, stock valuations fall: future profits are discounted at a higher rate. Watch the policy-rate tank: your cash earns it too.' },
    objective: { type: 'beatCash', label: 'Finish ahead of a cash-only book' },
    lesson: { title: 'The discount rate',
      points: [ 'A stock is worth its future profits, discounted back to today. Higher real yields mean lower valuations.',
                'When rates rise, cash and short-term bills become a real alternative to stocks.',
                'Option prices include the interest rate too: higher rates make calls a little dearer and puts a little cheaper.' ],
      history: 'In 2022 the S&P 500 fell about 19% and the US 10-year yield rose from about 1.5% to near 4%. Short-term cash beat both stocks and long bonds.' },
    quiz: { q: 'Why do stock prices tend to fall when real interest rates rise sharply?',
      options: [ 'Future profits are discounted at a higher rate', 'Companies stop paying taxes', 'Higher rates always cause instant recessions', 'Options become illegal' ],
      answer: 0, explain: 'A dollar of profit in ten years is worth less today when the discount rate is higher.' } },

  { id: 'L18', twoStar: 85, chapter: 7, title: 'Don’t Fight the Central Bank', concept: 'Policy backstops and volatility crush', era: '2020',
    start: { year: 2020, q: 1 }, quarters: 8, tools: ['trade'], pp: 1, features: { book: true },
    brief: 'A virus is spreading and implied volatility is near record lows. What follows is the fastest crash in history, then the biggest policy response in history. Read the policymakers, not just the headlines.',
    goal: 'Survive the crash and catch the rebound.',
    state: { rate: 1.75, infl: 2.0, expInfl: 2.0, gap: 0.5, unemp: 3.6, debt: 105, stress: 16 },
    events: [ { q: 1, id: 'virus_rumours' }, { q: 1, id: 'lockdown' }, { q: 2, id: 'emergency_meeting' }, { q: 2, id: 'qe_launch' }, { q: 2, id: 'fiscal_bazooka' },
              { q: 4, id: 'vaccine' }, { q: 6, id: 'reopening' } ],
    tutorial: { 1: 'Insurance is cheapest when nobody thinks they need it.', 2: 'When the central bank and the government both promise unlimited support, fear usually falls. Falling fear makes options cheaper: a volatility crush.' },
    objective: { type: 'end', metric: 'book', op: '>=', value: 115, label: 'Finish with your book at 115 or higher' },
    lesson: { title: 'Don’t fight the central bank',
      points: [ 'Massive bond buying and fiscal support put a floor under markets and pull fear down.',
                'When fear collapses, implied volatility falls too, and option sellers profit from the “volatility crush”.',
                'Buying protection before a shock is cheap; buying it during the panic is expensive.' ],
      history: 'In March 2020 the S&P 500 fell about 34% in 23 trading days. After the Fed and Congress acted, it regained its old high by August.' },
    quiz: { q: 'What usually happens to implied volatility after a credible policy backstop?',
      options: [ 'It falls as fear eases', 'It rises forever', 'It stays exactly the same', 'It becomes negative' ],
      answer: 0, explain: 'Support reduces the chance of a disaster, so the price of insurance falls.' } }
];

/* Example levels made with the editor (shown in Community) */
const SAMPLE_COMMUNITY = [
  { id: 'C_tulip', custom: true, author: 'GammaLedger', title: 'Tulip Mania', concept: 'Speculative manias', era: '1637',
    start: { year: 1636, q: 3 }, quarters: 6, tools: ['rate', 'macropru'], features: { bubble: true },
    brief: 'In Amsterdam a single tulip bulb now trades for the price of a canal house. Merchants are borrowing to buy bulbs they have never seen.',
    goal: 'Let the air out before the bubble bursts.',
    state: { rate: 3, infl: 2.5, expInfl: 2.3, gap: 1.5, unemp: 3.5, bubble: 72, stocks: 130, debt: 20 },
    targets: { bubbleMax: 75, debtMax: 60 },
    events: [ { q: 2, id: 'housing_mania', headline: 'A Semper Augustus bulb sells for 10,000 guilders' }, { q: 4, id: 'confidence_crash' } ],
    objective: { type: 'end', metric: 'bubble', op: '<=', value: 50, label: 'Finish with the bubble at 50 or lower' },
    lesson: { title: 'Manias', points: [ 'Prices detached from any real return are kept up only by the hope of selling to someone else.', 'Credit turns a fad into a systemic risk.' ], history: 'Tulip prices in the Dutch Republic collapsed in February 1637.' } },
  { id: 'C_robots', custom: true, author: 'GammaLedger', title: 'Robot Economy', concept: 'Productivity shocks', era: '2035',
    start: { year: 2035, q: 1 }, quarters: 8, tools: ['rate', 'guidance', 'spend', 'tax'],
    brief: 'Cheap AI agents make firms wildly more productive. Prices are falling, profits are booming, and some jobs are vanishing.',
    goal: 'Share the gains: keep jobs up and prices stable.',
    state: { rate: 3, infl: 1.5, expInfl: 2, gap: 0, unemp: 5, debt: 90 },
    events: [ { q: 1, id: 'ai_boom' }, { q: 3, id: 'ai_boom', headline: 'Robots now write most of the code' }, { q: 5, id: 'infra_bill' } ],
    objective: { type: 'end', metric: 'unemp', op: '<=', value: 5, label: 'Finish with unemployment at 5% or lower' },
    lesson: { title: 'Good deflation?', points: [ 'A positive supply shock lowers prices and raises output at the same time.', 'Policy can lean against falling inflation and help displaced workers move.' ], history: 'Economists still debate how AI will split gains between profits, wages and prices.' } }
];

/* ---------- Ranks & cosmetics ---------- */
const RANKS = [
  { xp: 0, name: 'Intern' }, { xp: 250, name: 'Analyst' }, { xp: 700, name: 'Economist' }, { xp: 1400, name: 'Senior Economist' },
  { xp: 2400, name: 'Chief Economist' }, { xp: 3600, name: 'Board Member' }, { xp: 5000, name: 'Deputy Governor' },
  { xp: 7000, name: 'Governor' }, { xp: 10000, name: 'Chair' }, { xp: 15000, name: 'MONIAC Legend' }
];
const SKINS = [
  { id: 'classic', name: 'Classic violet', rank: 0, a: '#8b5cf6', b: '#3b82f6' },
  { id: 'lagoon', name: 'Lagoon', rank: 2, a: '#2dd4bf', b: '#3b82f6' },
  { id: 'copper', name: 'Copper 1949', rank: 4, a: '#f59e0b', b: '#b45309' },
  { id: 'gold', name: 'Governor gold', rank: 7, a: '#fde68a', b: '#d97706' },
  { id: 'aurora', name: 'Aurora', rank: 9, a: '#f0abfc', b: '#22d3ee' }
];

/* ---------- Achievements ---------- */
const ACHIEVEMENTS = [
  { id: 'first', name: 'Hands on the Valve', desc: 'Complete your first level' },
  { id: 'soft', name: 'Soft Landing', desc: 'Finish Inflation Strikes Back with the soft-landing objective' },
  { id: 'volcker', name: 'Iron Will', desc: 'Raise rates by 4 points or more in one level' },
  { id: 'brrr', name: 'Money Printer', desc: 'Grow the central bank balance sheet to 40% of GDP' },
  { id: 'steady', name: 'Steady Hand', desc: 'Reach a streak of 8 green quarters' },
  { id: 'independent', name: 'Independent Thinker', desc: 'Resist political pressure 3 times' },
  { id: 'storm', name: 'Eye of the Storm', desc: 'Finish a level after market fear passed 70' },
  { id: 'hawk', name: 'Debt Hawk', desc: 'Finish a level with lower debt than you started with' },
  { id: 'perfect', name: 'Perfectionist', desc: 'Earn 3 stars on 5 levels' },
  { id: 'bot', name: 'Better than a Rule', desc: 'Beat the Taylor-rule autopilot on 3 levels' },
  { id: 'scholar', name: 'Scholar', desc: 'Answer 5 debrief quizzes correctly' },
  { id: 'habit', name: 'Daily Habit', desc: 'Play the daily challenge 3 days in a row' },
  { id: 'architect', name: 'Architect', desc: 'Create a level in the editor' },
  { id: 'historian', name: 'Historian', desc: 'Complete every historical level' },
  { id: 'zero', name: 'Zero Hero', desc: 'Earn 3 stars on Zero Lower Bound' },
  { id: 'endless20', name: 'Unsinkable', desc: 'Survive 20 quarters in Endless mode' },
  { id: 'unassisted', name: 'No Training Wheels', desc: 'Finish a level without the staff forecast' },
  { id: 'campaign', name: 'Full Tour', desc: 'Complete every campaign level' },
  { id: 'theta', name: 'Premium Collector', desc: 'Beat buy-and-hold on a Macro to Markets level' },
  { id: 'insured', name: 'Insured', desc: 'Make money in a quarter when the index fell 10% or more' }
];

/* ---------- Concept cards (collectibles) ---------- */
const CARDS = {
  L1: { term: 'Policy rate', def: 'The short-term interest rate a central bank sets. It ripples out to mortgages, loans and savings.' },
  L2: { term: 'Policy lag', def: 'The delay, often a year or more, between a rate change and its full effect on the economy.' },
  L3: { term: 'Taylor rule', def: 'A benchmark: rate = neutral rate + inflation + ½(inflation gap) + ½(output gap).' },
  L4: { term: 'Fiscal multiplier', def: 'How much output rises for each extra dollar of government spending.' },
  L5: { term: 'Quantitative easing', def: 'Central bank purchases of long-term bonds to lower long rates when short rates are at zero.' },
  L6: { term: 'Stagflation', def: 'High inflation and weak growth at the same time, often caused by a supply shock.' },
  L7: { term: 'Credibility', def: 'How much the public believes the central bank will hit its target. It anchors expectations.' },
  L8: { term: 'Macroprudential policy', def: 'Rules on credit and bank capital that target financial risks rather than inflation.' },
  L9: { term: 'Lender of last resort', def: 'The central bank’s role of lending to solvent banks in a panic. Lend freely, at a penalty rate, on good collateral.' },
  L10: { term: 'Duration risk', def: 'The loss in value of long-dated bonds when interest rates rise.' },
  L11: { term: 'Supply and demand shock', def: 'A shock that hits both what the economy can produce and what people want to buy.' },
  L12: { term: 'Soft landing', def: 'Bringing inflation down without causing a recession.' },
  L13: { term: 'Term premium', def: 'The extra yield investors demand to hold long-term government bonds. It jumps when fiscal credibility falls.' },
  L14: { term: 'Impossible trinity', def: 'You cannot have a fixed exchange rate, free capital flows and independent monetary policy all at once.' },
  L15: { term: 'Political business cycle', def: 'The temptation to stimulate the economy before elections, and the inflation it leaves behind.' },
  L16: { term: 'Implied volatility', def: 'The volatility priced into options. The market’s fear gauge, and the price of insurance.' },
  L17: { term: 'Discount rate', def: 'The rate used to value future cash flows today. When it rises, long-dated assets like stocks lose value.' },
  L18: { term: 'Volatility crush', def: 'A sharp fall in implied volatility, often after a policy backstop or a feared event passes.' }
};

/* ============================================================
   LEVEL SCHEMA (for new levels, by hand or through the editor)
   {
     id, title, concept, era, chapter?,
     start: { year, q }, quarters: 4–16,
     tools: subset of TOOL_ORDER (without 'rate', the central bank follows the Taylor rule),
     features: { bubble?, banks?, fx?, book? (trading level: tools ['trade'], rates follow the Taylor rule) },
     params: { rN (neutral real rate), target (inflation target), uStar (natural unemployment) },
     state: starting values for any metric (rate, infl, expInfl, gap, unemp, debt, stress, approval, cred, ...),
     shocks: { demand|supply|fin|tp: [amount, decay] } present at the start,
     targets: { infl:[lo,hi], unempMax, growthMin, stressMax, debtMax, approvalMin, bubbleMax, bankMin, fxMin },
     fail: { approvalMin, stressMax, inflMax, debtMax },
     events: [ { q, id, headline? } ],    random: 0–1 chance of a random event each quarter,
     objective: { type:'end'|'always', metric, op, value, label } | { type:'noRecession' } | { type:'streak', value } | { type:'beatCash' } | { type:'all', parts:[...] },
     twoStar: average score for the 2nd star (default 70),
     brief, goal, tutorial: { quarter: text }, lesson: { title, points[], history }, quiz: { q, options[], answer, explain }
   }
   ============================================================ */
/* ============================================================
   ENGINE — a small quarterly New Keynesian-style macro model.
   Demand: IS curve with lagged real rates, long real yields, fiscal
   impulse and financial stress. Prices: expectations-augmented
   Phillips curve. Expectations anchored by credibility. Okun's law,
   debt dynamics, term premium, housing credit, bank duration risk,
   an open-economy currency block, and Black–Scholes option pricing.
   Fully deterministic for a given level + seed + action log, so
   games can be resumed and scores re-verified on a server.
   ============================================================ */

const DEFAULT_TARGETS = { infl: [1, 3], unempMax: 6, growthMin: 0, stressMax: 40, debtMax: 120, approvalMin: 35, bubbleMax: 70, bankMin: 30, fxMin: 80, bookMin: 95 };
const DEFAULT_FAIL = { approvalMin: 12, stressMax: 93, inflMax: 16, debtMax: 175, fxMin: 45, bookMin: 70 };
const BASE_PARAMS = { rN: 0.5, target: 2, uStar: 4.5, potential: 2 };
const BASE_STATE = { rate: 2.5, infl: 2, expInfl: 2, gap: 0, unemp: 4.5, debt: 80, spend: 38, tax: 36, qe: 10, stress: 18,
  stocks: 100, approval: 55, cred: 70, bubble: 20, bank: 80, fx: 100, reserves: 30, foreignRate: 2.5, book: 100 };

const FAIL_REASONS = {
  fired: { title: 'You have been replaced', body: 'Public trust collapsed and the government found someone new. Economic pain that lasts too long becomes a political problem.' },
  meltdown: { title: 'Financial meltdown', body: 'Market fear went off the scale. Credit froze, and the panic fed on itself faster than policy could respond.' },
  spiral: { title: 'Runaway inflation', body: 'Prices spiralled out of control. Once everyone expects high inflation, it becomes self-fulfilling.' },
  debt: { title: 'Debt crisis', body: 'Investors refused to roll over the government’s debt. Borrowing costs exploded.' },
  currency: { title: 'Currency collapse', body: 'The currency went into free fall, pushing up import prices and wiping out anyone who borrowed in dollars.' },
  margin: { title: 'Margin call', body: 'Your book lost 30% of its value and the risk desk closed every position. Selling insurance pays steadily, right up until the disaster you insured.' }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- Black–Scholes (European, no dividends) ---------- */
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}
function blackScholes(S, K, r, sigma, T) {
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / sq, d2 = d1 - sq;
  const df = Math.exp(-r * T);
  return { call: S * normCdf(d1) - K * df * normCdf(d2), put: K * df * normCdf(-d2) - S * normCdf(-d1), deltaCall: normCdf(d1), deltaPut: normCdf(d1) - 1 };
}
/* Three-month options, 5% out of the money, priced off the fear index as implied volatility */
function optionQuotes(s) {
  const S = s.stocks, r = Math.log(1 + s.rate / 100), sig = s.iv / 100, T = 0.25;
  const Kp = 0.95 * S, Kc = 1.05 * S;
  const p = blackScholes(S, Kp, r, sig, T), c = blackScholes(S, Kc, r, sig, T);
  return { S, Kp, Kc, put: p.put, call: c.call, putPct: p.put / Kp * 100, callPct: c.call / S * 100, cashPct: s.rate / 4, iv: s.iv,
    deltaPut: p.deltaPut, deltaCall: c.deltaCall };
}
const impliedVol = stress => clamp(6 + 0.6 * stress, 8, 85);

function hasTool(g, t) { return (g.level.tools || []).includes(t); }
function visibleMetrics(level) {
  const tools = level.tools || [], F = level.features || {}, T = level.targets || {};
  if (F.book) return ['book', 'stocks', 'iv', 'rate', 'infl', 'growth'];
  const m = ['infl', 'unemp', 'growth', 'stress', 'approval'];
  if (tools.includes('spend') || tools.includes('tax') || tools.includes('liquidity') || T.debtMax != null) m.push('debt');
  if (F.bubble) m.push('bubble');
  if (F.banks) m.push('bank');
  if (F.fx) m.push('fx');
  if (F.fx && tools.includes('fx')) m.push('reserves');
  return m;
}

function createGame(level, opts = {}) {
  const params = Object.assign({}, BASE_PARAMS, level.params || {});
  const s = Object.assign({}, BASE_STATE, level.state || {});
  if (!level.state || level.state.unemp == null) s.unemp = params.uStar - 0.5 * s.gap;
  if (!level.state || level.state.expInfl == null) s.expInfl = s.infl;
  s.tp = 0.6 + 0.035 * Math.max(0, s.debt - 90) + 0.02 * Math.max(0, 60 - s.cred) - 0.03 * (s.qe - 10);
  s.y10 = clamp(0.4 * s.rate + 0.6 * (params.rN + s.expInfl) + s.tp, 0, 30);
  s.effRate = s.y10;
  s.growth = params.potential;
  s.deficit = (s.spend - s.tax) - 0.35 * s.gap + s.effRate * s.debt / 100;
  s.iv = impliedVol(s.stress);
  const seed = opts.seed != null ? opts.seed : hashStr(level.id || level.title || 'x');
  const g = {
    level, params, s,
    targets: Object.assign({}, DEFAULT_TARGETS, level.targets || {}),
    fail: Object.assign({}, DEFAULT_FAIL, level.fail || {}),
    metrics: visibleMetrics(level),
    q: 1, quarters: level.quarters || 8, endless: !!level.endless,
    rrLag: (s.rate - s.expInfl) - params.rN,
    shocks: [], history: [], qScores: [], streak: 0, bestStreak: 0, points: 0,
    tags: {}, status: 'playing', failReason: null, rng: makeRng(seed), seed,
    pp: level.pp || 2, lastGuidance: null, minRate: s.rate, maxRateRise: 0, maxStress: s.stress, maxQe: s.qe,
    recession: false, negRun: 0, flags: {}, forced: [], hazard: 0, pendingNews: [], lastNews: [],
    spend0: s.spend, tax0: s.tax, debt0: s.debt, foreign0: s.foreignRate, risk0: 0, rateExp0: s.rate - s.expInfl,
    gapQStart: s.gap, fxQStart: s.fx, assisted: false, eventLog: [], lastScore: null, lastWhy: null,
    cashBook: 100, insuredWin: false, actions: [], choices: [], retired: false
  };
  g.risk0 = riskPremium(g);
  const sh = level.shocks || {};
  Object.keys(sh).forEach(k => addShock(g, k, sh[k][0], sh[k][1]));
  g.history.push(snap(g));
  return g;
}

function snap(g) {
  const s = g.s;
  return { q: g.q - 1, infl: s.infl, expInfl: s.expInfl, unemp: s.unemp, growth: s.growth, stress: s.stress, approval: s.approval,
    debt: s.debt, rate: s.rate, y10: s.y10, cred: s.cred, bubble: s.bubble, bank: s.bank, fx: s.fx, reserves: s.reserves, qe: s.qe,
    stocks: s.stocks, gap: s.gap, book: s.book, iv: s.iv };
}

function addShock(g, kind, amt, decay) { if (amt) g.shocks.push({ kind, amt, decay: decay == null ? 0.8 : decay }); }
function shockSum(g, kind) { return g.shocks.reduce((a, x) => a + (x.kind === kind ? x.amt : 0), 0); }

function riskPremium(g) {
  const s = g.s;
  return 0.05 * Math.max(0, s.stress - 20) + 0.03 * Math.max(0, s.debt - 60) + (s.reserves < 8 ? 2 : 0) + 0.04 * Math.max(0, 60 - s.cred);
}

/* Taylor (1993): i = r* + π + 0.5(π − π*) + 0.5 × output gap */
function taylorRate(g) {
  const s = g.s, p = g.params;
  return Math.max(0, p.rN + s.infl + 0.5 * (s.infl - p.target) + 0.5 * s.gap);
}
function taylorMove(g, cap = 0.75) {
  const want = Math.round(taylorRate(g) * 4) / 4;
  return clamp(Math.round((want - g.s.rate) * 4) / 4, -cap, cap);
}

const LIMITS = { infl: [-10, 40], expInfl: [-5, 30], gap: [-15, 10], unemp: [1, 30], debt: [0, 300], spend: [20, 60], tax: [15, 60],
  qe: [0, 80], stress: [3, 99], stocks: [5, 999], approval: [0, 100], cred: [0, 100], bubble: [0, 100], bank: [0, 100],
  fx: [30, 180], reserves: [0, 120], rate: [0, 25], foreignRate: [0, 15] };

function applyEffects(g, eff, scale = 1) {
  if (!eff) return;
  const s = g.s;
  const add = eff.add || {};
  Object.keys(add).forEach(k => {
    if (!(k in s)) return;
    s[k] += add[k] * (['stress', 'gap', 'unemp', 'infl', 'expInfl'].includes(k) ? scale : 1);
    if (LIMITS[k]) s[k] = clamp(s[k], LIMITS[k][0], LIMITS[k][1]);
  });
  if (add.rate) s.rate = Math.round(s.rate * 4) / 4;
  const sh = eff.shock || {};
  Object.keys(sh).forEach(k => addShock(g, k, sh[k][0] * scale, sh[k][1]));
  (eff.tags || []).forEach(t => { g.tags[t] = (g.tags[t] || 0) + 1; });
}

/* Start of a quarter. Policy levels: news lands now, before you act.
   Trading levels (features.book): you only see hints now; the news
   itself hits during the quarter, after your position is set. */
function beginQuarter(g) {
  g.gapQStart = g.s.gap; g.fxQStart = g.s.fx;
  const out = [];
  const lvl = g.level, book = !!(lvl.features && lvl.features.book);
  (lvl.events || []).filter(e => e.q === g.q).forEach(e => { if (EVENTS[e.id]) out.push({ id: e.id, def: EVENTS[e.id], headline: e.headline || EVENTS[e.id].headline }); });
  g.forced.splice(0).forEach(id => out.push({ id, def: EVENTS[id], headline: EVENTS[id].headline, forced: true }));
  let chance = lvl.random || 0;
  if (g.endless) chance = Math.min(0.85, 0.45 + g.q * 0.012);
  if (chance && g.q > 1 && g.rng() < chance) {
    const pool = (lvl.pool || RANDOM_POOL).filter(id => !out.some(o => o.id === id) && g.lastRandom !== id);
    const id = pool[Math.floor(g.rng() * pool.length)];
    g.lastRandom = id;
    out.push({ id, def: EVENTS[id], headline: EVENTS[id].headline, random: true });
  }
  const scale = g.endless ? 1 + (g.q - 1) / 18 : 1;
  const shown = [];
  out.forEach(ev => {
    if (book && ev.def.kind === 'news') { g.pendingNews.push(Object.assign({ scale }, ev)); return; }
    if (ev.def.kind === 'news') applyEffects(g, ev.def.effects, scale);
    g.eventLog.push({ q: g.q, id: ev.id, headline: ev.headline });
    shown.push(ev);
  });
  if (lvl.features && lvl.features.bubble && out.some(e => e.id === 'bubble_pop')) g.flags.popped = true;
  return shown;
}

function resolveDilemma(g, ev, idx) {
  const n = ev.def.choices.length;
  const i = clamp(Math.round(+idx || 0), 0, n - 1);
  const ch = ev.def.choices[i];
  applyEffects(g, ch.effects, 1);
  g.choices.push({ q: g.q, id: ev.id, c: i });
  g.eventLog.push({ q: g.q, id: ev.id, choice: i });
  return ch;
}

/* Enforce the rules on any action (a server replaying a log relies on this) */
function sanitizeAction(g, act) {
  const out = { rateDelta: 0, tools: {} };
  if (hasTool(g, 'rate')) out.rateDelta = clamp(Math.round((+act.rateDelta || 0) * 4) / 4, -1, 1);
  let budget = g.pp;
  const t = (act && act.tools) || {};
  TOOL_ORDER.forEach(k => {
    if (k === 'rate' || !t[k] || !hasTool(g, k)) return;
    const T = TOOLS[k];
    if (!T.options.some(o => o.id === t[k]) || T.cost > budget) return;
    out.tools[k] = t[k]; budget -= T.cost;
  });
  return out;
}

/* One quarter of the model */
function step(g, actIn = {}) {
  const s = g.s, p = g.params, F = g.level.features || {};
  const act = sanitizeAction(g, actIn);
  g.actions.push({ r: act.rateDelta, t: act.tools });
  const notes = [];

  // 0. Trading levels: price the position at the start of the quarter, then the news hits
  let trade = null;
  if (F.book) {
    trade = { pos: act.tools.trade || 'cash', q: optionQuotes(s), rf: s.rate / 400 };
    g.lastNews = g.pendingNews.splice(0);
    g.lastNews.forEach(ev => { applyEffects(g, ev.def.effects, ev.scale || 1); g.eventLog.push({ q: g.q, id: ev.id, headline: ev.headline }); });
  }
  const prev = Object.assign({}, s);

  // 1. Policy rate (with no rate tool, the central bank follows the Taylor rule)
  let dr = hasTool(g, 'rate') ? act.rateDelta : taylorMove(g, 0.75);
  const newRate = clamp(Math.round((s.rate + dr) * 100) / 100, 0, 25);
  dr = newRate - s.rate; s.rate = newRate;
  if (g.lastGuidance === 'dove' && dr > 0.01) { s.cred -= 6; notes.push('You hiked after promising to stay easy. Credibility −6.'); }
  if (g.lastGuidance === 'hawk' && dr < -0.01) { s.cred -= 6; notes.push('You cut after promising to stay tough. Credibility −6.'); }
  let surprise = Math.max(0, Math.abs(dr) - 0.5) * 8;
  if ((g.lastGuidance === 'hawk' && dr > 0) || (g.lastGuidance === 'dove' && dr < 0)) surprise *= 0.4;
  g.lastGuidance = null;
  g.minRate = Math.min(g.minRate, s.rate);
  g.maxRateRise = Math.max(g.maxRateRise, s.rate - g.minRate);

  // 2. Other tools
  const t = act.tools;
  if (t.guidance === 'hawk') { s.expInfl -= 0.35 * s.cred / 100 + 0.05; addShock(g, 'tp', 0.15, 0.7); g.lastGuidance = 'hawk'; }
  if (t.guidance === 'dove') { s.expInfl += 0.12 * s.cred / 100 + 0.05; addShock(g, 'tp', -0.35, 0.7); g.lastGuidance = 'dove'; }
  if (t.qe === 'buy') { s.qe += 6; s.stress -= 5; s.stocks *= 1.03; }
  if (t.qe === 'sell') { s.qe = Math.max(0, s.qe - 5); s.stress += 2; }
  if (t.spend === 'up') { s.spend += 1; s.approval += 1.5; }
  if (t.spend === 'down') { s.spend -= 1; s.approval -= 2.5; }
  if (t.tax === 'down') { s.tax -= 1; s.approval += 2; }
  if (t.tax === 'up') { s.tax += 1; s.approval -= 3; }
  // Lender of last resort: calms the panic; the cost is moral hazard (more risk-taking later), not inflation credibility
  if (t.liquidity === 'open') { s.stress -= 18; s.bank += 18; addShock(g, 'fin', -8, 0.7); g.hazard += 1; if (F.bubble) s.bubble += 3; }
  if (t.macropru === 'tighten') { s.bubble -= 8; s.bank += 4; addShock(g, 'demand', -0.35, 0.8); s.approval -= 1; }
  if (t.macropru === 'loosen') { s.bubble += 6; s.bank -= 2; addShock(g, 'demand', 0.3, 0.8); }
  if (t.fx === 'sell' && s.reserves >= 1) { const used = Math.min(6, s.reserves); s.reserves -= used; s.fx += 5 * used / 6; }
  if (t.fx === 'buy') { s.reserves += 4; s.fx -= 3; }
  Object.keys(LIMITS).forEach(k => { s[k] = clamp(s[k], LIMITS[k][0], LIMITS[k][1]); });

  // 3. Shocks currently in play
  const D = shockSum(g, 'demand'), S = shockSum(g, 'supply'), FN = shockSum(g, 'fin'), TP = shockSum(g, 'tp');

  // 4. Long-term yields: expected path of short rates + term premium (debt, credibility, QE)
  s.tp = clamp(0.6 + 0.035 * Math.max(0, s.debt - 90) + 0.02 * Math.max(0, 60 - s.cred) - 0.03 * (s.qe - 10) + TP
    + (F.fx ? 0.03 * Math.max(0, 95 - s.fx) : 0), -1.5, 9);
  s.y10 = clamp(0.4 * s.rate + 0.6 * (p.rN + s.expInfl) + s.tp, 0, 30);

  // 5. Currency: interest-parity style, relative to the starting balance
  let fxChg = 0;
  if (F.fx) {
    const carry = (s.rate - s.expInfl) - g.rateExp0 - (s.foreignRate - g.foreign0) - (riskPremium(g) - g.risk0);
    fxChg = clamp(1.3 * carry + (g.rng() - 0.5) * 1.5, -9, 9);
    s.fx = clamp(s.fx * (1 + fxChg / 100), 30, 180);
  }
  const deprec = F.fx ? clamp((g.fxQStart - s.fx) / g.fxQStart * 100, -8, 15) : 0;

  // 6. Demand (IS curve)
  const realGap = (s.rate - s.expInfl) - p.rN;
  g.rrLag = 0.45 * g.rrLag + 0.55 * realGap;
  const longGap = (s.y10 - s.expInfl) - (p.rN + 0.6);
  const impulse = 0.65 * g.rrLag + 0.35 * longGap;
  const mult = (s.rate < 0.75 || s.gap < -2 ? 1.4 : 0.85) * (s.debt > 120 ? 0.75 : 1);
  const fiscal = mult * (s.spend - g.spend0) - 0.55 * (s.tax - g.tax0);
  const stressDrag = 0.09 * Math.max(0, s.stress - 22);
  const bubbleBoost = F.bubble ? 0.025 * (s.bubble - 40) : 0;
  const fxBoost = F.fx ? 0.02 * (100 - s.fx) : 0;
  const gapPrev = s.gap;
  const gNoise = (g.rng() - 0.5) * 0.3;
  s.gap = clamp(0.76 * gapPrev + 0.24 * (fiscal - 2.1 * impulse - stressDrag + bubbleBoost + fxBoost) + 0.45 * D + gNoise, -15, 10);

  // 7. Inflation: expectations-augmented Phillips curve + supply shocks + import prices
  const inflPrev = s.infl, expPrev = s.expInfl;
  const iNoise = (g.rng() - 0.5) * 0.15;
  s.infl = clamp(0.5 * expPrev + 0.5 * inflPrev + 0.28 * s.gap + S + 0.1 * deprec + iNoise, -10, 40);
  const w = 0.06 + 0.3 * s.cred / 100;
  s.expInfl = clamp(w * p.target + (1 - w) * (0.55 * s.infl + 0.45 * expPrev), -5, 30);

  // 8. Jobs (Okun's law) and growth (annualised quarter-on-quarter: potential + 4 × change in the output gap)
  s.unemp = clamp(0.55 * s.unemp + 0.45 * (p.uStar - 0.5 * s.gap), 1, 30);
  s.growth = clamp(p.potential + 4 * (s.gap - g.gapQStart), -40, 30);

  // 9. Public finances: d' = d + deficit/4 − d × nominal growth/400
  s.effRate = 0.88 * s.effRate + 0.12 * s.y10;
  s.deficit = (s.spend - s.tax) - 0.35 * s.gap + s.effRate * s.debt / 100;
  s.debt = clamp(s.debt + s.deficit / 4 - s.debt * (s.growth + s.infl) / 400, 0, 300);

  // 10. Financial stress (a fear index)
  const base = 15 + 0.12 * Math.max(0, s.debt - 100) + 2.5 * Math.max(0, -s.gap - 1.5) + (F.banks ? 0.35 * Math.max(0, 60 - s.bank) : 0)
    + (F.bubble && s.bubble > 75 ? 0.4 * (s.bubble - 75) : 0) + 0.6 * Math.max(0, s.infl - 6) + (F.fx ? 0.3 * Math.max(0, 90 - s.fx) : 0) + FN;
  s.stress = clamp(0.7 * s.stress + 0.3 * base + surprise + (g.rng() - 0.5) * 3, 3, 99);

  // 11. Stocks: earnings follow the economy; valuations fall when real yields rise; fear lowers prices
  const amp = 4 + 0.15 * prev.stress;
  const ret = 1.5 + 1.5 * (s.gap - g.gapQStart) - 6.5 * (s.y10 - prev.y10) - 0.25 * (s.stress - prev.stress) + (F.bubble ? 0.05 * (s.bubble - 50) : 0) + (g.rng() + g.rng() - 1) * amp;
  s.stocks = clamp(s.stocks * (1 + clamp(ret, -45, 45) / 100), 5, 999);
  s.iv = impliedVol(s.stress);

  // 12. Public trust
  const mood = 60 - 5 * Math.max(0, s.unemp - p.uStar) - 3.5 * Math.max(0, s.infl - 3) - 1.5 * Math.max(0, -Math.max(-12, s.growth))
    + clamp(s.growth - 1.5, -3, 3) - 0.1 * Math.max(0, s.stress - 40);
  s.approval = clamp(0.8 * s.approval + 0.2 * mood, 0, 100);

  // 13. Credibility of the inflation target
  const dev = Math.abs(s.infl - p.target);
  let dc = dev < 1 ? 2 : -0.5 * Math.min(4, dev - 1);
  if (prev.infl - s.infl > 0.2 && s.infl > p.target) dc += 2.5;
  if (s.infl - prev.infl > 0.3 && s.infl > p.target + 1) dc -= 1.5;
  if (s.infl > p.target + 2 && dr > 0) dc += 1.5;
  s.cred = clamp(s.cred + dc, 0, 100);

  // 14. Housing credit: grows when real rates sit below neutral; prices feed on their own momentum
  if (F.bubble) {
    s.bubble = clamp(s.bubble + 1.5 * ((p.rN + s.expInfl) - s.rate) + 0.6 * Math.max(0, s.gap) + 0.04 * (s.bubble - 40), 0, 100);
    if (s.bubble >= 92 && !g.flags.popped) { g.forced.push('bubble_pop'); g.flags.popped = true; notes.push('The bubble tank is overflowing.'); }
  }
  // 15. Banks: long-bond losses when yields rise; rescues weaken the incentive to rebuild buffers
  if (F.banks) {
    s.bank = clamp(s.bank + Math.max(0, 1.5 - 0.4 * g.hazard) - 9 * Math.max(0, s.y10 - prev.y10) - 0.2 * Math.max(0, s.stress - 45), 0, 100);
    if (s.bank < 22 && !g.flags.run) { g.forced.push('bank_run'); g.flags.run = true; notes.push('Banks look shaky. Depositors are getting nervous.'); }
  }

  // 16. Options book (trading levels): settle the quarter's position
  let bookWhy = null;
  if (trade) {
    const Q = trade.q, S0 = Q.S, S1 = s.stocks, rf = trade.rf;
    let R = rf, parts = [['Interest on cash', rf]];
    if (trade.pos === 'long') { R = S1 / S0 - 1; parts = [['Index move', R]]; }
    if (trade.pos === 'put') {
      const n = 1 / Q.Kp, prem = Q.put * n * (1 + rf), pay = -n * Math.max(Q.Kp - S1, 0);
      R = rf + prem + pay; parts = [['Interest on collateral', rf], ['Put premium collected', prem], ['Put assigned below strike', pay]];
    }
    if (trade.pos === 'call') {
      const n = 1 / S0, prem = Q.call * n * (1 + rf), mv = n * Math.min(S1, Q.Kc) - 1;
      R = mv + prem; parts = [['Index move (capped)', mv], ['Call premium collected', prem]];
    }
    if (trade.pos === 'hedge') {
      const n = 1 / (S0 + Q.put), mv = n * S1 - 1, ins = n * Math.max(Q.Kp - S1, 0);
      R = mv + ins; parts = [['Index move', n * S1 - n * S0], ['Put insurance cost', -n * Q.put], ['Insurance payout', ins]];
    }
    s.book = s.book * (1 + R);
    g.cashBook = g.cashBook * (1 + rf);
    if (S1 / S0 <= 0.9 && R > 0) g.insuredWin = true;
    g.lastTrade = { pos: trade.pos, R, rf, idx: S1 / S0 - 1 };
    bookWhy = { from: 0, to: R * 100, parts: parts.map(([l, v]) => [l, v * 100]) };
  }

  // 17. Decay shocks
  g.shocks.forEach(x => { x.amt *= x.decay; });
  g.shocks = g.shocks.filter(x => Math.abs(x.amt) > 0.03);

  // 18. Why did this happen? (contributions to this quarter's changes)
  const gr = (v) => 4 * v;
  g.lastWhy = {
    infl: { from: inflPrev, to: s.infl, parts: [
      ['Expected inflation pull', 0.5 * (expPrev - inflPrev)],
      [s.gap >= 0 ? 'Economy running hot' : 'Slack in the economy', 0.28 * s.gap],
      ['Supply shocks', S],
      [deprec >= 0 ? 'Weaker currency' : 'Stronger currency', 0.1 * deprec],
      ['Random noise', iNoise] ] },
    growth: { from: p.potential, to: s.growth, parts: [
      ['News this quarter', gr(gapPrev - g.gapQStart)],
      [gapPrev < 0 ? 'Natural recovery' : 'Boom fading', gr(-0.24 * gapPrev)],
      [impulse > 0 ? 'Interest rates above neutral' : 'Interest rates below neutral', gr(0.24 * -2.1 * impulse)],
      ['Government budget', gr(0.24 * fiscal)],
      ['Market fear', gr(-0.24 * stressDrag)],
      ['Housing', gr(0.24 * bubbleBoost)],
      ['Exports and currency', gr(0.24 * fxBoost)],
      ['Demand shocks', gr(0.45 * D)],
      ['Random noise', gr(gNoise)] ] },
    book: bookWhy
  };

  // 19. Trackers
  g.maxStress = Math.max(g.maxStress, s.stress);
  g.maxQe = Math.max(g.maxQe, s.qe);
  if (s.growth < 0) { g.negRun++; if (g.negRun >= 2) g.recession = true; } else g.negRun = 0;

  // 20. Score
  const sc = scoreQuarter(g);
  if (sc.score >= 80) g.streak++; else g.streak = 0;
  g.bestStreak = Math.max(g.bestStreak, g.streak);
  const mult2 = 1 + 0.1 * Math.min(g.streak, 5);
  const pts = Math.round(sc.score * mult2);
  g.points += pts;
  g.qScores.push(sc.score);
  g.lastScore = Object.assign({ pts, mult: mult2, notes }, sc);
  g.history.push(snap(g));
  g.history[g.history.length - 1].q = g.q;

  // 21. Failure
  const f = g.fail;
  let fail = null;
  if (F.book) { if (s.book < f.bookMin) fail = 'margin'; }
  else if (s.approval < f.approvalMin) fail = 'fired';
  else if (s.stress >= f.stressMax) fail = 'meltdown';
  else if (s.infl >= f.inflMax) fail = 'spiral';
  else if (s.debt >= f.debtMax) fail = 'debt';
  else if (F.fx && s.fx < f.fxMin) fail = 'currency';
  if (fail) { g.status = 'failed'; g.failReason = fail; return g.lastScore; }

  g.q++;
  if (!g.endless && g.q > g.quarters) g.status = 'complete';
  return g.lastScore;
}

function scoreQuarter(g) {
  const s = g.s, T = g.targets, F = g.level.features || {};
  if (F.book) {
    // Matching cash scores 80 (a green quarter); beating it scores more; losses are penalised twice
    const R = g.lastTrade ? g.lastTrade.R * 100 : 0, rf = g.lastTrade ? g.lastTrade.rf * 100 : 0;
    const raw = 80 + 6 * (R - rf) - 5 * Math.max(0, -R);
    const sc = Math.round(clamp(raw, 0, 100));
    return { score: sc, raw, parts: sc < 80 ? { book: 80 - sc } : {} };
  }
  const d = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
  const di = d(s.infl, T.infl[0], T.infl[1]), du = Math.max(0, s.unemp - T.unempMax), dg = Math.max(0, T.growthMin - Math.max(-12, s.growth));
  const ds = Math.max(0, s.stress - T.stressMax);
  const parts = {
    infl: 12 * di + 5 * di * di,
    unemp: 10 * du + 4 * du * du,
    growth: 3 * dg + 0.5 * dg * dg,
    stress: ds + 0.02 * ds * ds,
    approval: 1.2 * Math.max(0, T.approvalMin - s.approval)
  };
  if (g.metrics.includes('debt')) parts.debt = 1.2 * Math.max(0, s.debt - T.debtMax);
  if (F.bubble) parts.bubble = 1.2 * Math.max(0, s.bubble - T.bubbleMax);
  if (F.banks) parts.bank = 1.2 * Math.max(0, T.bankMin - s.bank);
  if (F.fx) parts.fx = 1.2 * Math.max(0, T.fxMin - s.fx);
  Object.keys(parts).forEach(k => { parts[k] = Math.min(75, parts[k]); });
  const raw = 100 - Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Math.round(clamp(raw, 0, 100)), raw, parts };
}

function inZone(g, m) {
  const z = zoneOf(g, m);
  if (!z) return true;
  const v = g.s[m];
  return v >= z[0] - 1e-9 && v <= z[1] + 1e-9;
}
function zoneOf(g, m) {
  const T = g.targets, M = METRICS[m];
  if (g.level.features && g.level.features.book) return m === 'book' ? [T.bookMin, M.max] : null;
  switch (m) {
    case 'infl': return [T.infl[0], T.infl[1]];
    case 'unemp': return [M.min, T.unempMax];
    case 'growth': return [T.growthMin, M.max];
    case 'stress': return [M.min, T.stressMax];
    case 'approval': return [T.approvalMin, M.max];
    case 'debt': return [M.min, T.debtMax];
    case 'bubble': return [M.min, T.bubbleMax];
    case 'bank': return [T.bankMin, M.max];
    case 'fx': return [T.fxMin, M.max];
    default: return null;
  }
}

function cmp(a, op, b) {
  switch (op) { case '<=': return a <= b; case '<': return a < b; case '>=': return a >= b; case '>': return a > b; default: return false; }
}
function checkObjective(obj, g) {
  if (!obj) return false;
  if (obj.type === 'end') return cmp(g.s[obj.metric], obj.op, obj.value);
  if (obj.type === 'always') return g.history.every(h => cmp(h[obj.metric], obj.op, obj.value));
  if (obj.type === 'noRecession') return !g.recession;
  if (obj.type === 'streak') return g.bestStreak >= obj.value;
  if (obj.type === 'beatCash') return g.s.book > g.cashBook + 0.01;
  if (obj.type === 'all') return (obj.parts || []).every(p => checkObjective(p, g));
  return false;
}

function finalResult(g) {
  const avg = g.qScores.length ? g.qScores.reduce((a, b) => a + b, 0) / g.qScores.length : 0;
  const twoStar = g.level.twoStar || 80;
  if (g.endless) {
    // Endless: there is no finish line; sinking still banks your points
    const stars = [true, avg >= 80, g.bestStreak >= 8];
    return { complete: true, endless: true, avg: Math.round(avg), stars, starCount: stars.filter(Boolean).length, total: g.points, unassisted: false, twoStar: 80, quarters: g.q - 1 };
  }
  const complete = g.status === 'complete';
  const stars = [complete, complete && avg >= twoStar, complete && checkObjective(g.level.objective, g)];
  let total = g.points;
  if (complete) total += 100;
  if (stars[2]) total += 150;
  const unassisted = complete && !g.assisted;
  if (unassisted) total = Math.round(total * 1.15);
  return { complete, avg: Math.round(avg), stars, starCount: stars.filter(Boolean).length, total, unassisted, twoStar, quarters: g.q - 1 };
}

function cloneGame(g) {
  const { level, rng, ...rest } = g;
  const c = JSON.parse(JSON.stringify(rest));
  c.level = level; c.rng = () => 0.5;
  return c;
}
/* Staff forecast: one quarter ahead with no noise and no knowledge of surprises */
function forecast(g, act) { const c = cloneGame(g); c.pendingNews = []; step(c, act); return c.s; }

/* ---------- Benchmark bots ---------- */
function botAction(g, kind) {
  if (g.level.features && g.level.features.book) return { rateDelta: 0, tools: kind === 'taylor' ? { trade: 'long' } : {} };
  return { rateDelta: kind === 'taylor' ? taylorMove(g, 0.75) : 0, tools: {} };
}
function runBot(level, kind, seed) {
  const g = createGame(level, { seed });
  while (g.status === 'playing' && g.q < 200) {
    const evs = beginQuarter(g);
    evs.forEach(ev => { if (ev.def.kind === 'dilemma') resolveDilemma(g, ev, ev.def.bot || 0); });
    step(g, botAction(g, kind));
  }
  return { result: finalResult(g), game: g };
}

/* ---------- Replay: rebuild a game from its log ----------
   Used to resume after a reload and by the score-verification server. */
function replayGame(level, log) {
  const g = createGame(level);
  const actions = (log && log.actions) || [], choices = (log && log.choices) || [];
  let i = 0;
  while (g.status === 'playing' && g.q <= 400) {
    const evs = beginQuarter(g);
    const open = [];
    evs.forEach(ev => {
      if (ev.def.kind !== 'dilemma') { open.push(ev); return; }
      const c = choices.find(x => x.q === g.q && x.id === ev.id);
      if (c) resolveDilemma(g, ev, c.c); else open.push(ev);
    });
    if (i >= actions.length) {
      if (log && log.retired && g.endless) { g.retired = true; g.status = 'complete'; }
      return { g, open, missingChoice: open.some(e => e.def.kind === 'dilemma') };
    }
    if (open.some(e => e.def.kind === 'dilemma')) return { g, open, missingChoice: true };
    const a = actions[i++] || {};
    step(g, { rateDelta: a.r, tools: a.t });
  }
  return { g, open: [], missingChoice: false };
}
/* ============================================================
   SHARED — used by the game and by the score-verification server.
   No DOM access in this file.
   ============================================================ */

const ENDLESS = { id: 'endless', endless: true, title: 'Endless Economy', concept: 'How long can you stay afloat?', era: 'Endless',
  start: { year: 1, q: 1 }, quarters: 999, tools: ['rate', 'guidance', 'qe', 'spend', 'tax', 'liquidity'], features: { banks: true },
  brief: 'No script, no end. Random shocks arrive faster and hit harder every year. Survive as many quarters as you can.',
  goal: 'Stay afloat. Retire whenever you like to bank your score.', state: {}, events: [ { q: 1, id: 'welcome' } ],
  objective: { type: 'streak', value: 8, label: 'Reach a streak of 8 green quarters' } };

function makeDailyLevel(key) {
  const rng = makeRng(hashStr('daily:' + key));
  const r = (a, b) => a + rng() * (b - a);
  const infl = +r(0.8, 5.5).toFixed(1), gap = +r(-2.5, 2.5).toFixed(1);
  const expInfl = +(2 + (infl - 2) * r(0.3, 0.7)).toFixed(1);
  const rate = Math.max(0, Math.round((0.5 + expInfl + r(-1.5, 1.5)) * 4) / 4);
  const pool = RANDOM_POOL.slice(); const evs = []; const qs = [2, 3, 4, 5, 6, 7];
  for (let i = 0; i < 3; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const q = qs.splice(Math.floor(rng() * qs.length), 1)[0];
    evs.push({ q, id });
  }
  evs.sort((a, b) => a.q - b.q);
  const objs = [
    { type: 'end', metric: 'infl', op: '<=', value: 3, label: 'Finish with inflation at 3% or lower' },
    { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' },
    { type: 'end', metric: 'unemp', op: '<=', value: 5, label: 'Finish with unemployment at 5% or lower' },
    { type: 'always', metric: 'stress', op: '<=', value: 45, label: 'Keep market fear at 45 or lower every quarter' },
    { type: 'streak', value: 5, label: 'Build a streak of 5 green quarters' } ];
  const [Y, M, Dd] = key.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { id: 'daily-' + key, daily: true, title: 'Daily Challenge', concept: 'Same economy for everyone today',
    era: Dd + ' ' + months[M - 1] + ' ' + Y, start: { year: Y, q: Math.floor((M - 1) / 3) + 1 }, quarters: 8, tools: ['rate', 'guidance', 'qe', 'spend', 'tax'],
    brief: 'A fresh economy, generated for today. Everyone playing gets the same starting point and the same shocks. Come back tomorrow for a new one.',
    goal: 'Score as high as you can.', twoStar: 75,
    state: { rate, infl, expInfl, gap, debt: Math.round(r(50, 120)), stress: Math.round(r(14, 38)), approval: Math.round(r(42, 60)), cred: Math.round(r(45, 80)) },
    events: evs, objective: objs[Math.floor(rng() * objs.length)] };
}

/* ---------- Level codes (player-made levels) ---------- */
const OBJ_METRICS = ['infl', 'unemp', 'growth', 'stress', 'approval', 'debt', 'bubble', 'bank', 'fx', 'reserves', 'expInfl', 'cred'];
const EDIT_STATE = { rate: [0, 20, 0.25], infl: [-3, 15, 0.1], expInfl: [-2, 12, 0.1], gap: [-8, 6, 0.1], unemp: [2, 15, 0.1], debt: [5, 200, 1], stress: [5, 80, 1], approval: [15, 85, 1], cred: [5, 95, 1], bubble: [0, 90, 1], bank: [15, 100, 1], fx: [60, 130, 1], reserves: [0, 60, 1] };
const EDIT_TARGETS = { unempMax: [3, 12, 0.5], growthMin: [-4, 2, 0.5], stressMax: [20, 80, 1], debtMax: [30, 200, 1], approvalMin: [10, 60, 1], bubbleMax: [30, 95, 1], bankMin: [10, 70, 1], fxMin: [50, 100, 1] };
const fmtN = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
function objectiveLabel(type, metric, op, value) {
  const M = METRICS[metric], words = { '<=': 'at or below', '>=': 'at or above', '<': 'below', '>': 'above' }[op];
  const v = fmtN(value, M.dec) + (M.unit === '%' ? '%' : '');
  return type === 'always' ? 'Keep ' + M.name.toLowerCase() + ' ' + words + ' ' + v + ' every quarter' : 'Finish with ' + M.name.toLowerCase() + ' ' + words + ' ' + v;
}
function sanitizeObjective(o) {
  if (!o || typeof o !== 'object') return { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' };
  if (o.type === 'noRecession') return { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' };
  if (o.type === 'streak') { const v = Math.round(clamp(+o.value || 4, 2, 16)); return { type: 'streak', value: v, label: 'Build a streak of ' + v + ' green quarters' }; }
  if (o.type === 'end' || o.type === 'always') {
    const metric = OBJ_METRICS.includes(o.metric) ? o.metric : 'infl';
    const op = ['<=', '>=', '<', '>'].includes(o.op) ? o.op : '<=';
    const value = Number.isFinite(+o.value) ? clamp(+o.value, -50, 300) : 3;
    return { type: o.type, metric, op, value, label: objectiveLabel(o.type, metric, op, value) };
  }
  return { type: 'noRecession', label: 'Avoid a recession (two quarters of negative growth)' };
}
function sanitizeLevel(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const str = (v, n, d = '') => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : d;
  const num = (v, a, b, d) => v !== null && v !== '' && Number.isFinite(+v) ? clamp(+v, a, b) : d;
  const L = { custom: true };
  L.title = str(raw.title, 60, 'Untitled economy') || 'Untitled economy';
  L.author = str(raw.author, 32, 'A player') || 'A player';
  L.concept = str(raw.concept, 80, 'Player-made level');
  L.era = str(raw.era, 20, 'Custom');
  L.start = { year: Math.round(num(raw.start && raw.start.year, 1, 3000, 1)), q: Math.round(num(raw.start && raw.start.q, 1, 4, 1)) };
  L.quarters = Math.round(num(raw.quarters, 4, 16, 8));
  L.tools = Array.isArray(raw.tools) ? TOOL_ORDER.filter(t => t !== 'trade' && raw.tools.includes(t)) : ['rate'];
  if (!L.tools.length) L.tools = ['rate'];
  L.pp = Math.round(num(raw.pp, 1, 3, 2));
  const F = raw.features || {};
  L.features = { bubble: !!F.bubble, banks: !!F.banks, fx: !!F.fx };
  const pr = raw.params || {};
  L.params = { rN: num(pr.rN, -1, 4, 0.5), target: num(pr.target, 0, 8, 2), uStar: num(pr.uStar, 2, 12, 4.5) };
  L.state = {};
  const st = raw.state || {};
  Object.keys(EDIT_STATE).forEach(k => { const v = num(st[k], EDIT_STATE[k][0], EDIT_STATE[k][1], null); if (v != null) L.state[k] = v; });
  const tg = raw.targets || {};
  L.targets = {};
  if (Array.isArray(tg.infl)) { const lo = num(tg.infl[0], -2, 10, 1), hi = num(tg.infl[1], -1, 12, 3); L.targets.infl = [Math.min(lo, hi), Math.max(lo, hi)]; }
  Object.keys(EDIT_TARGETS).forEach(k => { const v = num(tg[k], EDIT_TARGETS[k][0], EDIT_TARGETS[k][1], null); if (v != null) L.targets[k] = v; });
  L.events = (Array.isArray(raw.events) ? raw.events : []).filter(e => e && EVENTS[e.id] && e.id !== 'bubble_pop' && EVENTS[e.id].tag !== 'Briefing').slice(0, 24)
    .map(e => { const o = { q: Math.round(num(e.q, 1, L.quarters, 1)), id: e.id }; const hl = str(e.headline, 120); if (hl) o.headline = hl; return o; });
  L.random = num(raw.random, 0, 0.6, 0);
  L.objective = sanitizeObjective(raw.objective);
  L.twoStar = Math.round(num(raw.twoStar, 40, 95, 75));
  L.brief = str(raw.brief, 500, 'A player-made economy.');
  L.goal = str(raw.goal, 160, 'Keep every tank in its safe zone.');
  const ls = raw.lesson || {};
  L.lesson = { title: str(ls.title, 80, L.concept), points: (Array.isArray(ls.points) ? ls.points : []).map(p => str(p, 240)).filter(Boolean).slice(0, 4), history: str(ls.history, 400) };
  if (!L.lesson.points.length && !L.lesson.history) delete L.lesson;
  // The id is derived from the content, so the same level always has the same leaderboard
  const body = Object.assign({}, L); delete body.author;
  L.id = 'U_' + hashStr(JSON.stringify(body)).toString(36);
  return L;
}
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let c = s.replace(/[^A-Za-z0-9_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (c.length % 4) c += '=';
  const bin = atob(c);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}
function encodeLevel(L) {
  const clean = sanitizeLevel(L);
  delete clean.id; delete clean.custom;
  return 'AFL1.' + b64urlEncode(JSON.stringify(clean));
}
function decodeLevel(code) {
  try {
    let c = String(code).trim();
    const at = c.indexOf('AFL1.');
    if (at >= 0) c = c.slice(at + 5);
    if (c.length > 20000) return null;
    return sanitizeLevel(JSON.parse(b64urlDecode(c)));
  } catch (e) { return null; }
}

/* ---------- Level references (what a saved game or a score submission points at) ---------- */
function levelRefOf(level, kind) {
  if (kind === 'endless' || level.endless) return { kind: 'endless' };
  if (kind === 'daily' || level.daily) return { kind: 'daily', key: level.id.slice(6) };
  if (LEVELS.some(l => l.id === level.id)) return { kind: 'campaign', id: level.id };
  if (SAMPLE_COMMUNITY.some(l => l.id === level.id)) return { kind: 'sample', id: level.id };
  return { kind: 'custom', code: encodeLevel(level) };
}
function levelFromRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  if (ref.kind === 'endless') return ENDLESS;
  if (ref.kind === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(ref.key || '')) return makeDailyLevel(ref.key);
  if (ref.kind === 'campaign') return LEVELS.find(l => l.id === ref.id) || null;
  if (ref.kind === 'sample') return SAMPLE_COMMUNITY.find(l => l.id === ref.id) || null;
  if (ref.kind === 'custom' && typeof ref.code === 'string') return decodeLevel(ref.code);
  return null;
}
function boardIdOf(level) { return level.endless ? 'endless' : level.id; }

/* ---------- Score verification (run this on the server) ----------
   submission = { v: 1, level: ref, actions: [{ r, t }], choices: [{ q, id, c }], retired, claimed } */
function verifySubmission(sub, opts = {}) {
  if (!sub || sub.v !== 1) return { ok: false, error: 'Unsupported submission version' };
  const level = levelFromRef(sub.level);
  if (!level) return { ok: false, error: 'Unknown level' };
  if (level.daily && opts.today) {
    const key = sub.level.key, t = Date.parse(opts.today + 'T12:00:00Z'), d = Date.parse(key + 'T12:00:00Z');
    if (!(Math.abs(t - d) <= 864e5 * 1.01)) return { ok: false, error: 'This daily challenge is closed' };
  }
  if (!Array.isArray(sub.actions) || sub.actions.length > 420) return { ok: false, error: 'Bad action log' };
  if (!Array.isArray(sub.choices) || sub.choices.length > 420) return { ok: false, error: 'Bad choice log' };
  const { g, missingChoice } = replayGame(level, { actions: sub.actions, choices: sub.choices, retired: !!sub.retired });
  if (missingChoice) return { ok: false, error: 'A decision is missing from the log' };
  if (!level.endless && g.status !== 'complete') return { ok: false, error: g.status === 'failed' ? 'Failed runs are not ranked' : 'The run is not finished' };
  if (level.endless && g.status === 'playing') return { ok: false, error: 'The run is not finished' };
  const res = finalResult(g);
  const claimed = +sub.claimed || 0;
  return { ok: true, board: boardIdOf(level), pts: res.total, stars: res.starCount, quarters: res.quarters,
    matchesClaim: Math.abs(claimed - res.total) <= Math.max(5, res.total * 0.02) };
}
export { LEVELS, EVENTS, createGame, beginQuarter, resolveDilemma, step, finalResult, replayGame, verifySubmission, decodeLevel, encodeLevel, sanitizeLevel, makeDailyLevel, levelRefOf, levelFromRef, runBot, taylorMove };
