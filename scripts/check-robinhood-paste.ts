import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parsePastedLegs } from '../src/trades/leg-paste.ts'

const referenceDate = new Date('2026-08-10T12:00:00Z')
const parse = (text: string) => parsePastedLegs(text, referenceDate)

const newCsp = parse(`Sell IREN $30 Put 8/14
Position effect
Open
Filled quantity
10 contracts at $0.22
Filled
8/7, 7:12 AM PDT
Est regulatory fees
$0.40`)
assert.equal(newCsp.activityType, 'opening')
assert.deepEqual(newCsp.legs[0], {
  ticker: 'IREN', type: 'PUT', orderType: 'STO', quantity: 10, strike: 30,
  expirationDate: '2026-08-14', executionDate: '2026-08-07',
  executionTimestamp: '2026-08-07T07:12:00-07:00', brokerTimeZone: 'PDT',
  premium: 0.22, fees: 0.4, multiplier: 100, importSource: 'Robinhood',
})

const closeCsp = parse(`Buy UBER $65 Put 8/14
Position effect
Close
Filled quantity
7 contracts at $0.10
Filled
8/6, 11:03 AM PDT
Est regulatory fees
$0.28`)
assert.equal(closeCsp.legs[0]?.orderType, 'BTC')
assert.equal(closeCsp.legs[0]?.fees, 0.28)

const cspRoll = parse(`OUST Short Put Roll
Est regulatory fees
$0.48
Buy OUST $37 Put 7/31
Position effect
Close
Filled quantity
6 contracts at $3.25
Filled
7/30, 8:55 AM PDT
Sell OUST $34 Put 8/7
Position effect
Open
Filled quantity
6 contracts at $3.70
Filled
7/30, 8:55 AM PDT`)
assert.equal(cspRoll.activityType, 'roll')
assert.deepEqual(cspRoll.legs.map(leg => [leg.orderType, leg.fees]), [['BTC', 0.24], ['STO', 0.24]])

const ccRoll = parse(`HIMS Short Call Roll
Est regulatory fees
$1.60
Buy HIMS $37 Call 7/2
Position effect
Close
Filled quantity
20 contracts at $0.53
Filled
7/2, 9:02 AM PDT
Sell HIMS $42 Call 7/10
Position effect
Open
Filled quantity
20 contracts at $0.48
Filled
7/2, 9:02 AM PDT`)
assert.deepEqual(ccRoll.legs.map(leg => [leg.orderType, leg.fees]), [['BTC', 0.8], ['STO', 0.8]])

const callSpread = parse(`IREN Call Debit Spread
Est regulatory fees
$0.40
Buy IREN $50 Call 6/17/2027
Position effect
Open
Filled quantity
5 contracts at $15.40
Filled
7/21, 10:57 AM PDT
Sell IREN $100 Call 6/17/2027
Position effect
Open
Filled quantity
5 contracts at $7.65
Filled
7/21, 10:57 AM PDT`)
assert.equal(callSpread.activityType, 'multi-leg')
assert.deepEqual(callSpread.legs.map(leg => [leg.orderType, leg.strike, leg.fees]), [['BTO', 50, 0.2], ['STO', 100, 0.2]])

const longCall = parse(`Buy NFLX $105 Call 12/17/2027
Position effect
Open
Filled quantity
9 contracts at $5.50
Filled
7/22, 11:30 AM PDT
Est regulatory fees
$0.36`)
assert.equal(longCall.legs[0]?.orderType, 'BTO')
assert.equal(longCall.legs[0]?.expirationDate, '2027-12-17')

const assignment = parse(`CIFR $17.5 Put Assignment
Contracts
15
Price at Expiration
$17.18
Date
8/7/2026
Status
Completed
Cost
$26,250.00`)
assert.equal(assignment.activityType, 'assignment')
assert.deepEqual(assignment.legs[0], {
  ticker: 'CIFR', type: 'STOCK', orderType: 'BTO', quantity: 1500, strike: 17.5,
  expirationDate: '', executionDate: '2026-08-07', premium: 0, fees: 0,
  multiplier: 1, underlyingPrice: 17.18, isAssignment: true, importSource: 'Robinhood',
})

const addTradeMarkup = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
assert.match(addTradeMarkup, /id="leg-paste-toggle"[^>]*>📋 Paste fills…<\/button>/)
assert.match(addTradeMarkup, /id="robinhood-paste-toggle"[^>]*>📋 Paste from Robinhood<\/button>/)
assert.equal(addTradeMarkup.match(/id="leg-paste-toggle"/g)?.length, 1)
assert.equal(addTradeMarkup.match(/id="robinhood-paste-toggle"/g)?.length, 1)

console.log('Robinhood paste parser checks passed.')
