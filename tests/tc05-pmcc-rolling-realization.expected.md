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
realizedMonthly: 2026-01 → +149.35, 2026-02 → +119.35, 2026-03 → −30.65

## TRD-TC5R (Rolling CSP)
| Group | Legs | Terminated? | Realized CF |
|---|---|---|---|
| PUT|100|2026-04-17 | L1 (+249.35), L2 (−320.65) | yes (net 0) | −71.30 |
| PUT|95|2026-07-17  | L3 (+309.35) | no (open, unexpired) | — |

realizedCashFlow = −71.30; hasOpenGroups = true
realizedMonthly: 2026-03 → +249.35, 2026-04 → −320.65

## Combined (Monthly P&L bars for this fixture alone)
2026-01: +149.35 | 2026-02: +119.35 | 2026-03: +218.70 | 2026-04: −320.65
Bar sum = realizedPL stat = 166.75
Pre-change behavior (for contrast): both trades contribute 0.
