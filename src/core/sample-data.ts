// Static demo dataset injected on first run when no database is loaded.
import { CURRENT_STORAGE_VERSION } from '@core/config'

export const BUILTIN_SAMPLE_DATA = (() => {
    const reference = new Date();
    reference.setUTCHours(0, 0, 0, 0);

    const toIso = (date: Date): string => date.toISOString().slice(0, 10);
    const offset = (days: number): string => {
        const date = new Date(reference);
        date.setUTCDate(date.getUTCDate() + days);
        return toIso(date);
    };

    const trades = [
        {
            id: 'TRD-3001',
            ticker: 'SPY',
            strategy: 'Iron Condor',
            status: 'Closed',
            openedDate: offset(-280),
            closedDate: offset(-265),
            expirationDate: offset(-260),
            exitReason: 'Closed at 60% of max profit.',
            notes: 'Wide wings with low probability of touch.',
            legs: [
                {
                    id: 'TRD-3001-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-280),
                    expirationDate: offset(-260),
                    strike: 585,
                    premium: 2.1,
                    fees: 0.35
                },
                {
                    id: 'TRD-3001-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-280),
                    expirationDate: offset(-260),
                    strike: 595,
                    premium: 0.85,
                    fees: 0.25
                },
                {
                    id: 'TRD-3001-L3',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-280),
                    expirationDate: offset(-260),
                    strike: 545,
                    premium: 2.3,
                    fees: 0.35
                },
                {
                    id: 'TRD-3001-L4',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-280),
                    expirationDate: offset(-260),
                    strike: 535,
                    premium: 0.9,
                    fees: 0.25
                },
                {
                    id: 'TRD-3001-L5',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-265),
                    expirationDate: offset(-260),
                    strike: 585,
                    premium: 0.95,
                    fees: 0.35
                },
                {
                    id: 'TRD-3001-L6',
                    orderType: 'STC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-265),
                    expirationDate: offset(-260),
                    strike: 595,
                    premium: 0.4,
                    fees: 0.25
                },
                {
                    id: 'TRD-3001-L7',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-265),
                    expirationDate: offset(-260),
                    strike: 545,
                    premium: 1.0,
                    fees: 0.35
                },
                {
                    id: 'TRD-3001-L8',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-265),
                    expirationDate: offset(-260),
                    strike: 535,
                    premium: 0.42,
                    fees: 0.25
                }
            ]
        },
        {
            id: 'TRD-3002',
            ticker: 'AAPL',
            strategy: 'Put Credit Spread',
            status: 'Closed',
            openedDate: offset(-270),
            closedDate: offset(-258),
            expirationDate: offset(-250),
            exitReason: 'Took profit before product announcement.',
            notes: 'Bullish on seasonal strength.',
            legs: [
                {
                    id: 'TRD-3002-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-270),
                    expirationDate: offset(-250),
                    strike: 220,
                    premium: 3.2,
                    fees: 0.35
                },
                {
                    id: 'TRD-3002-L2',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-270),
                    expirationDate: offset(-250),
                    strike: 210,
                    premium: 1.4,
                    fees: 0.3
                },
                {
                    id: 'TRD-3002-L3',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-258),
                    expirationDate: offset(-250),
                    strike: 220,
                    premium: 0.85,
                    fees: 0.35
                },
                {
                    id: 'TRD-3002-L4',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-258),
                    expirationDate: offset(-250),
                    strike: 210,
                    premium: 0.38,
                    fees: 0.25
                }
            ]
        },
        {
            id: 'TRD-3003',
            ticker: 'MSFT',
            strategy: 'Cash-Secured Put',
            status: 'Closed',
            openedDate: offset(-258),
            closedDate: offset(-246),
            expirationDate: offset(-238),
            exitReason: 'Quick 70% profit capture.',
            notes: 'Sold during cloud earnings optimism.',
            legs: [
                {
                    id: 'TRD-3003-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-258),
                    expirationDate: offset(-238),
                    strike: 415,
                    premium: 2.6,
                    fees: 0.35
                },
                {
                    id: 'TRD-3003-L2',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-246),
                    expirationDate: offset(-238),
                    strike: 415,
                    premium: 0.75,
                    fees: 0.35
                }
            ]
        },
        {
            id: 'TRD-3004',
            ticker: 'NVDA',
            strategy: 'Strangle',
            status: 'Closed',
            openedDate: offset(-245),
            closedDate: offset(-232),
            expirationDate: offset(-225),
            exitReason: 'Volatility collapsed post-earnings.',
            notes: 'High IV rank play after AI chip announcement.',
            legs: [
                {
                    id: 'TRD-3004-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-245),
                    expirationDate: offset(-225),
                    strike: 560,
                    premium: 8.5,
                    fees: 0.45
                },
                {
                    id: 'TRD-3004-L2',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-245),
                    expirationDate: offset(-225),
                    strike: 420,
                    premium: 7.8,
                    fees: 0.45
                },
                {
                    id: 'TRD-3004-L3',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-232),
                    expirationDate: offset(-225),
                    strike: 560,
                    premium: 2.1,
                    fees: 0.45
                },
                {
                    id: 'TRD-3004-L4',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-232),
                    expirationDate: offset(-225),
                    strike: 420,
                    premium: 1.9,
                    fees: 0.45
                }
            ]
        },
        {
            id: 'TRD-3005',
            ticker: 'TSLA',
            strategy: 'Call Credit Spread',
            status: 'Closed',
            openedDate: offset(-232),
            closedDate: offset(-218),
            expirationDate: offset(-210),
            exitReason: 'Target profit reached.',
            notes: 'Bearish setup at resistance.',
            legs: [
                {
                    id: 'TRD-3005-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-232),
                    expirationDate: offset(-210),
                    strike: 285,
                    premium: 4.6,
                    fees: 0.4
                },
                {
                    id: 'TRD-3005-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-232),
                    expirationDate: offset(-210),
                    strike: 300,
                    premium: 1.9,
                    fees: 0.3
                },
                {
                    id: 'TRD-3005-L3',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-218),
                    expirationDate: offset(-210),
                    strike: 285,
                    premium: 1.2,
                    fees: 0.4
                },
                {
                    id: 'TRD-3005-L4',
                    orderType: 'STC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-218),
                    expirationDate: offset(-210),
                    strike: 300,
                    premium: 0.55,
                    fees: 0.25
                }
            ]
        },
        {
            id: 'TRD-3006',
            ticker: 'AMZN',
            strategy: 'Iron Condor',
            status: 'Closed',
            openedDate: offset(-215),
            closedDate: offset(-198),
            expirationDate: offset(-190),
            exitReason: 'Closed at 65% of max profit.',
            notes: 'Theta play during consolidation.',
            legs: [
                {
                    id: 'TRD-3006-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-215),
                    expirationDate: offset(-190),
                    strike: 205,
                    premium: 3.8,
                    fees: 0.35
                },
                {
                    id: 'TRD-3006-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-215),
                    expirationDate: offset(-190),
                    strike: 215,
                    premium: 1.5,
                    fees: 0.3
                },
                {
                    id: 'TRD-3006-L3',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-215),
                    expirationDate: offset(-190),
                    strike: 170,
                    premium: 3.4,
                    fees: 0.35
                },
                {
                    id: 'TRD-3006-L4',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-215),
                    expirationDate: offset(-190),
                    strike: 160,
                    premium: 1.3,
                    fees: 0.3
                },
                {
                    id: 'TRD-3006-L5',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-198),
                    expirationDate: offset(-190),
                    strike: 205,
                    premium: 1.45,
                    fees: 0.35
                },
                {
                    id: 'TRD-3006-L6',
                    orderType: 'STC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-198),
                    expirationDate: offset(-190),
                    strike: 215,
                    premium: 0.6,
                    fees: 0.25
                },
                {
                    id: 'TRD-3006-L7',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-198),
                    expirationDate: offset(-190),
                    strike: 170,
                    premium: 1.25,
                    fees: 0.35
                },
                {
                    id: 'TRD-3006-L8',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-198),
                    expirationDate: offset(-190),
                    strike: 160,
                    premium: 0.5,
                    fees: 0.25
                }
            ]
        },
        {
            id: 'TRD-3007',
            ticker: 'META',
            strategy: 'Put Credit Spread',
            status: 'Closed',
            openedDate: offset(-195),
            closedDate: offset(-182),
            expirationDate: offset(-175),
            exitReason: 'Profit-taking before social media policy hearing.',
            notes: 'Positioned for support bounce.',
            legs: [
                {
                    id: 'TRD-3007-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-195),
                    expirationDate: offset(-175),
                    strike: 480,
                    premium: 3.2,
                    fees: 0.35
                },
                {
                    id: 'TRD-3007-L2',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-195),
                    expirationDate: offset(-175),
                    strike: 460,
                    premium: 1.55,
                    fees: 0.3
                },
                {
                    id: 'TRD-3007-L3',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-182),
                    expirationDate: offset(-175),
                    strike: 480,
                    premium: 1.1,
                    fees: 0.35
                },
                {
                    id: 'TRD-3007-L4',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-182),
                    expirationDate: offset(-175),
                    strike: 460,
                    premium: 0.6,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3008',
            ticker: 'GOOGL',
            strategy: 'Call Credit Spread',
            status: 'Closed',
            openedDate: offset(-178),
            closedDate: offset(-165),
            expirationDate: offset(-160),
            exitReason: 'Closed ahead of earnings volatility.',
            notes: 'Selling premium into tech sector rotation.',
            legs: [
                {
                    id: 'TRD-3008-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-178),
                    expirationDate: offset(-160),
                    strike: 145,
                    premium: 2.1,
                    fees: 0.35
                },
                {
                    id: 'TRD-3008-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-178),
                    expirationDate: offset(-160),
                    strike: 155,
                    premium: 0.85,
                    fees: 0.3
                },
                {
                    id: 'TRD-3008-L3',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-165),
                    expirationDate: offset(-160),
                    strike: 145,
                    premium: 0.55,
                    fees: 0.35
                },
                {
                    id: 'TRD-3008-L4',
                    orderType: 'STC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-165),
                    expirationDate: offset(-160),
                    strike: 155,
                    premium: 0.25,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3009',
            ticker: 'AMD',
            strategy: 'Strangle',
            status: 'Closed',
            openedDate: offset(-162),
            closedDate: offset(-148),
            expirationDate: offset(-142),
            exitReason: 'Closed after favorable semiconductor guidance.',
            notes: 'Volatility trade around chip sector conference.',
            legs: [
                {
                    id: 'TRD-3009-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-162),
                    expirationDate: offset(-142),
                    strike: 125,
                    premium: 3.2,
                    fees: 0.35
                },
                {
                    id: 'TRD-3009-L2',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-162),
                    expirationDate: offset(-142),
                    strike: 90,
                    premium: 2.8,
                    fees: 0.35
                },
                {
                    id: 'TRD-3009-L3',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-148),
                    expirationDate: offset(-142),
                    strike: 125,
                    premium: 0.95,
                    fees: 0.35
                },
                {
                    id: 'TRD-3009-L4',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-148),
                    expirationDate: offset(-142),
                    strike: 90,
                    premium: 0.75,
                    fees: 0.35
                }
            ]
        },
        {
            id: 'TRD-3010',
            ticker: 'JPM',
            strategy: 'Iron Condor',
            status: 'Closed',
            openedDate: offset(-142),
            closedDate: offset(-128),
            expirationDate: offset(-122),
            exitReason: 'Closed at 60% max profit before banking sector volatility.',
            notes: 'Balanced credit strategy in financial sector.',
            legs: [
                {
                    id: 'TRD-3010-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-142),
                    expirationDate: offset(-122),
                    strike: 165,
                    premium: 1.45,
                    fees: 0.3
                },
                {
                    id: 'TRD-3010-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-142),
                    expirationDate: offset(-122),
                    strike: 175,
                    premium: 0.6,
                    fees: 0.25
                },
                {
                    id: 'TRD-3010-L3',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-142),
                    expirationDate: offset(-122),
                    strike: 145,
                    premium: 1.35,
                    fees: 0.3
                },
                {
                    id: 'TRD-3010-L4',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-142),
                    expirationDate: offset(-122),
                    strike: 135,
                    premium: 0.55,
                    fees: 0.25
                },
                {
                    id: 'TRD-3010-L5',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-128),
                    expirationDate: offset(-122),
                    strike: 165,
                    premium: 0.5,
                    fees: 0.3
                },
                {
                    id: 'TRD-3010-L6',
                    orderType: 'STC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-128),
                    expirationDate: offset(-122),
                    strike: 175,
                    premium: 0.2,
                    fees: 0.25
                },
                {
                    id: 'TRD-3010-L7',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-128),
                    expirationDate: offset(-122),
                    strike: 145,
                    premium: 0.45,
                    fees: 0.3
                },
                {
                    id: 'TRD-3010-L8',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-128),
                    expirationDate: offset(-122),
                    strike: 135,
                    premium: 0.15,
                    fees: 0.25
                }
            ]
        },
        {
            id: 'TRD-3011',
            ticker: 'BAC',
            strategy: 'Put Credit Spread',
            status: 'Closed',
            openedDate: offset(-122),
            closedDate: offset(-108),
            expirationDate: offset(-102),
            exitReason: 'Took profit after favorable rate guidance.',
            notes: 'Bullish banking sector play on regional strength.',
            legs: [
                {
                    id: 'TRD-3011-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-122),
                    expirationDate: offset(-102),
                    strike: 32,
                    premium: 1.15,
                    fees: 0.3
                },
                {
                    id: 'TRD-3011-L2',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-122),
                    expirationDate: offset(-102),
                    strike: 28,
                    premium: 0.45,
                    fees: 0.25
                },
                {
                    id: 'TRD-3011-L3',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-108),
                    expirationDate: offset(-102),
                    strike: 32,
                    premium: 0.35,
                    fees: 0.3
                },
                {
                    id: 'TRD-3011-L4',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-108),
                    expirationDate: offset(-102),
                    strike: 28,
                    premium: 0.15,
                    fees: 0.25
                }
            ]
        },
        {
            id: 'TRD-3012',
            ticker: 'WMT',
            strategy: 'Covered Call',
            status: 'Closed',
            openedDate: offset(-102),
            closedDate: offset(-88),
            expirationDate: offset(-82),
            exitReason: 'Rolled forward after retail earnings strength.',
            notes: 'Weekly premium income on long shares.',
            legs: [
                {
                    id: 'TRD-3012-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-102),
                    expirationDate: offset(-82),
                    strike: 168,
                    premium: 1.3,
                    fees: 0.3
                },
                {
                    id: 'TRD-3012-L2',
                    orderType: 'BTC',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-88),
                    expirationDate: offset(-82),
                    strike: 168,
                    premium: 0.35,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3013',
            ticker: 'JNJ',
            strategy: 'Cash-Secured Put',
            status: 'Closed',
            openedDate: offset(-82),
            closedDate: offset(-68),
            expirationDate: offset(-62),
            exitReason: 'Closed after pharma sector rotation.',
            notes: 'Selling premium on healthcare defensive play.',
            legs: [
                {
                    id: 'TRD-3013-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-82),
                    expirationDate: offset(-62),
                    strike: 155,
                    premium: 1.85,
                    fees: 0.35
                },
                {
                    id: 'TRD-3013-L2',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-68),
                    expirationDate: offset(-62),
                    strike: 155,
                    premium: 0.5,
                    fees: 0.35
                }
            ]
        },
        {
            id: 'TRD-3014',
            ticker: 'V',
            strategy: 'Put Credit Spread',
            status: 'Closed',
            openedDate: offset(-62),
            closedDate: offset(-48),
            expirationDate: offset(-42),
            exitReason: 'Exited before payment sector volatility.',
            notes: 'Bullish on consumer spending trends.',
            legs: [
                {
                    id: 'TRD-3014-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-62),
                    expirationDate: offset(-42),
                    strike: 270,
                    premium: 2.5,
                    fees: 0.35
                },
                {
                    id: 'TRD-3014-L2',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-62),
                    expirationDate: offset(-42),
                    strike: 260,
                    premium: 1.2,
                    fees: 0.3
                },
                {
                    id: 'TRD-3014-L3',
                    orderType: 'BTC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-48),
                    expirationDate: offset(-42),
                    strike: 270,
                    premium: 0.85,
                    fees: 0.35
                },
                {
                    id: 'TRD-3014-L4',
                    orderType: 'STC',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-48),
                    expirationDate: offset(-42),
                    strike: 260,
                    premium: 0.45,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3015',
            ticker: 'MA',
            strategy: 'Call Credit Spread',
            status: 'Open',
            openedDate: offset(-35),
            closedDate: '',
            expirationDate: offset(28),
            exitReason: '',
            notes: 'Bearish spread on payment sector resistance.',
            legs: [
                {
                    id: 'TRD-3015-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-35),
                    expirationDate: offset(28),
                    strike: 510,
                    premium: 2.8,
                    fees: 0.35
                },
                {
                    id: 'TRD-3015-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-35),
                    expirationDate: offset(28),
                    strike: 520,
                    premium: 1.4,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3016',
            ticker: 'DIS',
            strategy: 'Cash-Secured Put',
            status: 'Open',
            openedDate: offset(-32),
            closedDate: '',
            expirationDate: offset(35),
            exitReason: '',
            notes: 'Premium collection on entertainment sector support.',
            legs: [
                {
                    id: 'TRD-3016-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-32),
                    expirationDate: offset(35),
                    strike: 88,
                    premium: 1.95,
                    fees: 0.35
                }
            ]
        },
        {
            id: 'TRD-3017',
            ticker: 'NFLX',
            strategy: 'Strangle',
            status: 'Open',
            openedDate: offset(-28),
            closedDate: '',
            expirationDate: offset(42),
            exitReason: '',
            notes: 'Volatility play around streaming earnings.',
            legs: [
                {
                    id: 'TRD-3017-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-28),
                    expirationDate: offset(42),
                    strike: 740,
                    premium: 6.5,
                    fees: 0.4
                },
                {
                    id: 'TRD-3017-L2',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-28),
                    expirationDate: offset(42),
                    strike: 620,
                    premium: 5.8,
                    fees: 0.4
                }
            ]
        },
        {
            id: 'TRD-3018',
            ticker: 'INTC',
            strategy: 'Covered Call',
            status: 'Open',
            openedDate: offset(-25),
            closedDate: '',
            expirationDate: offset(28),
            exitReason: '',
            notes: 'Weekly income on chip sector holding.',
            legs: [
                {
                    id: 'TRD-3018-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-25),
                    expirationDate: offset(28),
                    strike: 50,
                    premium: 1.05,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3019',
            ticker: 'ORCL',
            strategy: 'Diagonal Put Spread',
            status: 'Open',
            openedDate: offset(-22),
            closedDate: '',
            expirationDate: offset(50),
            exitReason: '',
            notes: 'Long-dated protection with near-term premium income.',
            legs: [
                {
                    id: 'TRD-3019-L1',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-22),
                    expirationDate: offset(120),
                    strike: 165,
                    premium: 7.2,
                    fees: 0.4
                },
                {
                    id: 'TRD-3019-L2',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-22),
                    expirationDate: offset(50),
                    strike: 155,
                    premium: 3.5,
                    fees: 0.35
                }
            ]
        },
        {
            id: 'TRD-3020',
            ticker: 'XOM',
            strategy: 'Put Credit Spread',
            status: 'Open',
            openedDate: offset(-18),
            closedDate: '',
            expirationDate: offset(38),
            exitReason: '',
            notes: 'Energy sector play on crude oil support.',
            legs: [
                {
                    id: 'TRD-3020-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-18),
                    expirationDate: offset(38),
                    strike: 115,
                    premium: 2.1,
                    fees: 0.35
                },
                {
                    id: 'TRD-3020-L2',
                    orderType: 'BTO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-18),
                    expirationDate: offset(38),
                    strike: 105,
                    premium: 0.95,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3021',
            ticker: 'CVX',
            strategy: 'Call Credit Spread',
            status: 'Open',
            openedDate: offset(-15),
            closedDate: '',
            expirationDate: offset(45),
            exitReason: '',
            notes: 'Bearish energy sector spread on resistance.',
            legs: [
                {
                    id: 'TRD-3021-L1',
                    orderType: 'STO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-15),
                    expirationDate: offset(45),
                    strike: 165,
                    premium: 1.85,
                    fees: 0.35
                },
                {
                    id: 'TRD-3021-L2',
                    orderType: 'BTO',
                    type: 'CALL',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-15),
                    expirationDate: offset(45),
                    strike: 175,
                    premium: 0.75,
                    fees: 0.3
                }
            ]
        },
        {
            id: 'TRD-3022',
            ticker: 'VIX',
            strategy: 'Cash-Secured Put',
            status: 'Closed',
            openedDate: offset(-55),
            closedDate: offset(-35),
            expirationDate: offset(-35),
            exitReason: 'Cash Settlement',
            notes: 'VIX put expired ITM — settled in cash at expiration. VIX settled at 14, strike was 18, settlement = $4.00/pt × 100 = $400 debit. Net P&L: $210 credit − $400 settlement = −$190 loss.',
            underlyingType: 'Index',
            legs: [
                {
                    id: 'TRD-3022-L1',
                    orderType: 'STO',
                    type: 'PUT',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-55),
                    expirationDate: offset(-35),
                    strike: 18,
                    premium: 2.1,
                    fees: 0.35
                },
                {
                    id: 'TRD-3022-L2',
                    orderType: 'BTC',
                    type: 'CASH',
                    quantity: 1,
                    multiplier: 100,
                    executionDate: offset(-35),
                    strike: 18,
                    premium: 4.0,
                    fees: 0
                }
            ]
        }
    ];

    return {
        trades,
        exportDate: reference.toISOString(),
        version: CURRENT_STORAGE_VERSION
    };
})();
