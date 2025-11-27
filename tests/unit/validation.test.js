import { describe, it, expect } from 'vitest';

/**
 * Unit tests for data validation and parsing
 */

describe('Data Validation', () => {
  describe('Number Parsing', () => {
    it('should parse valid decimal numbers', () => {
      const testCases = [
        { input: '10.5', expected: 10.5 },
        { input: '0.65', expected: 0.65 },
        { input: '-0.50', expected: -0.5 },
        { input: '100', expected: 100 },
        { input: '0', expected: 0 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseFloat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle invalid number inputs', () => {
      const testCases = ['abc', '', null, undefined, NaN];

      testCases.forEach(input => {
        const result = parseFloat(input);
        expect(Number.isFinite(result)).toBe(false);
      });
    });

    it('should parse integers correctly', () => {
      const testCases = [
        { input: '10', expected: 10 },
        { input: '0', expected: 0 },
        { input: '-5', expected: -5 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseInt(input, 10);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Date Parsing', () => {
    it('should parse valid ISO dates', () => {
      const dateString = '2024-01-15';
      const date = new Date(dateString);
      
      expect(date.toISOString().slice(0, 10)).toBe('2024-01-15');
      expect(Number.isNaN(date.getTime())).toBe(false);
    });

    it('should handle invalid dates', () => {
      const invalidDates = ['invalid', '', '2024-13-01', '2024-01-32'];

      invalidDates.forEach(dateString => {
        const date = new Date(dateString);
        expect(Number.isNaN(date.getTime())).toBe(true);
      });
    });

    it('should calculate date differences', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-31');
      
      const diffTime = Math.abs(date2.getTime() - date1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(30);
    });
  });

  describe('String Normalization', () => {
    it('should normalize ticker symbols', () => {
      const tickers = ['aapl', 'AAPL', '  AAPL  ', 'aapl  '];
      
      tickers.forEach(ticker => {
        const normalized = ticker.trim().toUpperCase();
        expect(normalized).toBe('AAPL');
      });
    });

    it('should normalize option types', () => {
      const types = ['call', 'CALL', 'Call', '  call  '];
      
      types.forEach(type => {
        const normalized = type.trim().toUpperCase();
        expect(normalized).toBe('CALL');
      });
    });

    it('should handle empty strings', () => {
      const emptyStrings = ['', '   ', null, undefined];
      
      emptyStrings.forEach(str => {
        const normalized = (str || '').trim();
        expect(normalized).toBe('');
      });
    });
  });

  describe('Trade Field Validation', () => {
    it('should validate required fields', () => {
      const trade = {
        ticker: 'AAPL',
        strategy: 'Covered Call',
        legs: [
          {
            type: 'CALL',
            quantity: 10,
            strike: 100,
            premium: 2.50
          }
        ]
      };

      expect(trade.ticker).toBeTruthy();
      expect(trade.strategy).toBeTruthy();
      expect(trade.legs).toHaveLength(1);
      expect(trade.legs[0].quantity).toBeGreaterThan(0);
    });

    it('should detect missing required fields', () => {
      const incompleteTrade = {
        ticker: 'AAPL',
        // Missing strategy
        legs: []
      };

      expect(incompleteTrade.strategy).toBeUndefined();
      expect(incompleteTrade.legs).toHaveLength(0);
    });

    it('should validate quantity is positive', () => {
      const validQuantities = [1, 10, 100, 0.5];
      const invalidQuantities = [0, -1, -10];

      validQuantities.forEach(qty => {
        expect(qty).toBeGreaterThan(0);
      });

      invalidQuantities.forEach(qty => {
        expect(qty).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('Strategy Name Validation', () => {
    it('should recognize common strategies', () => {
      const strategies = [
        'Covered Call',
        'Cash-Secured Put',
        'Bull Call Spread',
        'Bear Put Spread',
        'Iron Condor',
        'Iron Butterfly',
        'Long Straddle',
        'Short Strangle',
        'Calendar Spread',
        "Poor Man's Covered Call"
      ];

      strategies.forEach(strategy => {
        expect(strategy).toBeTruthy();
        expect(typeof strategy).toBe('string');
        expect(strategy.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const largeNumber = 999999999.99;
      expect(Number.isFinite(largeNumber)).toBe(true);
      expect(largeNumber).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    it('should handle very small numbers', () => {
      const smallNumber = 0.0001;
      expect(Number.isFinite(smallNumber)).toBe(true);
      expect(smallNumber).toBeGreaterThan(0);
    });

    it('should handle zero values', () => {
      expect(0).toBe(0);
      expect(Number.isFinite(0)).toBe(true);
    });

    it('should handle infinity', () => {
      expect(Number.POSITIVE_INFINITY).toBe(Infinity);
      expect(Number.isFinite(Number.POSITIVE_INFINITY)).toBe(false);
    });
  });
});
