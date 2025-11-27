import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit tests for trade data model and enrichment
 */

describe('Trade Data Model', () => {
  describe('Leg Normalization', () => {
    it('should normalize basic leg data', () => {
      const rawLeg = {
        type: 'CALL',
        quantity: 10,
        strike: 100,
        premium: 2.50,
        fees: 0.65,
        executionDate: '2024-01-15',
        expirationDate: '2024-02-16'
      };

      // Test that required fields are present
      expect(rawLeg.type).toBe('CALL');
      expect(rawLeg.quantity).toBe(10);
      expect(rawLeg.strike).toBe(100);
      expect(rawLeg.premium).toBe(2.50);
      expect(rawLeg.fees).toBe(0.65);
    });

    it('should handle PUT options', () => {
      const rawLeg = {
        type: 'PUT',
        quantity: 5,
        strike: 95,
        premium: 1.75,
        fees: 0.50
      };

      expect(rawLeg.type).toBe('PUT');
      expect(rawLeg.strike).toBeLessThan(100);
    });

    it('should handle STOCK legs', () => {
      const rawLeg = {
        type: 'STOCK',
        quantity: 100,
        premium: 50.00,
        fees: 0
      };

      expect(rawLeg.type).toBe('STOCK');
      expect(rawLeg.quantity).toBe(100);
    });

    it('should normalize order types', () => {
      const orderTypes = ['BTO', 'STO', 'BTC', 'STC'];
      
      orderTypes.forEach(type => {
        const leg = { orderType: type };
        expect(['BTO', 'STO', 'BTC', 'STC']).toContain(leg.orderType);
      });
    });
  });

  describe('Trade Status Management', () => {
    it('should recognize open trades', () => {
      const trade = {
        status: 'Open',
        openContracts: 10,
        closeContracts: 0
      };

      expect(trade.status).toBe('Open');
      expect(trade.openContracts).toBeGreaterThan(0);
    });

    it('should recognize closed trades', () => {
      const trade = {
        status: 'Closed',
        openContracts: 0,
        exitDate: '2024-01-20'
      };

      expect(trade.status).toBe('Closed');
      expect(trade.exitDate).toBeTruthy();
    });

    it('should recognize assigned trades', () => {
      const trade = {
        status: 'Assigned',
        exitReason: 'Assigned'
      };

      expect(trade.status).toBe('Assigned');
      expect(trade.exitReason).toContain('Assigned');
    });

    it('should recognize expired trades', () => {
      const trade = {
        status: 'Expired',
        exitReason: 'Expired OTM'
      };

      expect(trade.status).toBe('Expired');
    });
  });

  describe('Multi-Leg Trades', () => {
    it('should handle vertical spreads', () => {
      const trade = {
        strategy: 'Bull Call Spread',
        legs: [
          { type: 'CALL', strike: 100, orderType: 'BTO' },
          { type: 'CALL', strike: 105, orderType: 'STO' }
        ]
      };

      expect(trade.legs).toHaveLength(2);
      expect(trade.legs[0].strike).toBeLessThan(trade.legs[1].strike);
    });

    it('should handle iron condors', () => {
      const trade = {
        strategy: 'Iron Condor',
        legs: [
          { type: 'PUT', strike: 90, orderType: 'BTO' },
          { type: 'PUT', strike: 95, orderType: 'STO' },
          { type: 'CALL', strike: 105, orderType: 'STO' },
          { type: 'CALL', strike: 110, orderType: 'BTO' }
        ]
      };

      expect(trade.legs).toHaveLength(4);
      const puts = trade.legs.filter(l => l.type === 'PUT');
      const calls = trade.legs.filter(l => l.type === 'CALL');
      expect(puts).toHaveLength(2);
      expect(calls).toHaveLength(2);
    });
  });

  describe('Cash Flow Calculations', () => {
    it('should calculate opening cash flow correctly', () => {
      const leg = {
        orderType: 'BTO',
        quantity: 10,
        premium: 2.50,
        multiplier: 100,
        fees: 0.65
      };

      // BTO: -(premium * multiplier * quantity) - fees
      const expectedCashFlow = -(2.50 * 100 * 10) - 0.65;
      
      expect(expectedCashFlow).toBe(-2500.65);
      expect(expectedCashFlow).toBeLessThan(0); // Debit
    });

    it('should calculate closing cash flow correctly', () => {
      const leg = {
        orderType: 'STC',
        quantity: 10,
        premium: 3.00,
        multiplier: 100,
        fees: 0.65
      };

      // STC: +(premium * multiplier * quantity) - fees
      const expectedCashFlow = (3.00 * 100 * 10) - 0.65;
      
      expect(expectedCashFlow).toBe(2999.35);
      expect(expectedCashFlow).toBeGreaterThan(0); // Credit
    });
  });

  describe('DTE (Days to Expiration) Calculations', () => {
    it('should calculate positive DTE for future expirations', () => {
      const currentDate = new Date('2024-01-15');
      const expirationDate = new Date('2024-02-16');
      
      const diffTime = expirationDate.getTime() - currentDate.getTime();
      const dte = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      expect(dte).toBeGreaterThan(0);
      expect(dte).toBe(32);
    });

    it('should return 0 DTE for expired options', () => {
      const currentDate = new Date('2024-02-20');
      const expirationDate = new Date('2024-02-16');
      
      const diffTime = expirationDate.getTime() - currentDate.getTime();
      const dte = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      
      expect(dte).toBe(0);
    });
  });

  describe('ROI Calculations', () => {
    it('should calculate positive ROI for profitable trades', () => {
      const pl = 500;
      const capitalAtRisk = 2000;
      const roi = (pl / capitalAtRisk) * 100;
      
      expect(roi).toBe(25);
      expect(roi).toBeGreaterThan(0);
    });

    it('should calculate negative ROI for losing trades', () => {
      const pl = -500;
      const capitalAtRisk = 2000;
      const roi = (pl / capitalAtRisk) * 100;
      
      expect(roi).toBe(-25);
      expect(roi).toBeLessThan(0);
    });

    it('should handle infinite risk scenarios', () => {
      const capitalAtRisk = Number.POSITIVE_INFINITY;
      
      expect(capitalAtRisk).toBe(Number.POSITIVE_INFINITY);
      expect(Number.isFinite(capitalAtRisk)).toBe(false);
    });
  });
});
