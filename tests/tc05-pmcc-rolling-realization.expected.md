# tc05 expected values (leg-level realization, as of any date in [2026-03-21, 2026-09-18))

Leg cash flow = ±premium·multiplier·qty − fees (STO/STC positive, BTO/BTC negative).

## TRD-TC5P (open PMCC)
| Group (type|strike|exp) | Legs | Terminated? | Realized CF |
|---|---|---|---|
| CALL|50|2027-01-15  | L1 (−1200.65) | no (open, unexpired) | — |
| CALL|60|2026-02-20  | L2 (+149.35)  | yes (expired)        | +149.35 |
| CALL|62|2026-03-20  | L3 (+119.35), L4 (−30.65) | yes (net 0) | +88.70 |
| CALL|65|2026-09-18  | L5 (+199.35)  | no (open, unexpired) | — |

realizedCashFlow = 238.05; hasOpenGroups = true
realizedMonthly (termination-month attribution): 2026-02 → +149.35 (expiry), 2026-03 → +88.70 (cycle closed 2026-03-10)

## TRD-TC5R (Rolling CSP)
| Group | Legs | Terminated? | Realized CF |
|---|---|---|---|
| PUT|100|2026-04-17 | L1 (+249.35), L2 (−320.65) | yes (net 0) | −71.30 |
| PUT|95|2026-07-17  | L3 (+309.35) | no (open, unexpired) | — |

realizedCashFlow = −71.30; hasOpenGroups = true
realizedMonthly (termination-month attribution): 2026-04 → −71.30 (cycle closed 2026-04-10)

## Combined (Monthly P&L bars for this fixture alone)
2026-02: +149.35 | 2026-03: +88.70 | 2026-04: −71.30
Bar sum = realizedPL stat = 166.75
A terminated group's NET P&L lands in the month the group terminated (last
closing execution, or expiration for expired groups) — roll cycles stay atomic.
Pre-change behavior (for contrast): both trades contribute 0.
