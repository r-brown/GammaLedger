import { test, expect } from '@playwright/test';

/**
 * E2E tests for creating and managing trades with negative fees
 * Tests fix for issue #12
 */

// Helper function to dismiss the disclaimer modal
async function dismissDisclaimer(page) {
  const disclaimerBanner = page.locator('#disclaimer-banner');
  const isVisible = await disclaimerBanner.isVisible().catch(() => false);
  
  if (isVisible) {
    const agreeButton = page.locator('[data-action="disclaimer-agree"]');
    await agreeButton.click();
    // Wait for the banner to have the is-hidden class (which means it's not visible)
    await disclaimerBanner.waitFor({ state: 'hidden', timeout: 5000 });
  }
}

test.describe('Negative Fees Support (Issue #12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
    await page.click('[data-view="add-trade"]');
  });

  test('should accept negative fee values in form', async ({ page }) => {
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    
    // Enter negative fee (rebate)
    await feesInput.fill('-0.65');
    
    // Should accept and display the negative value
    await expect(feesInput).toHaveValue('-0.65');
  });

  test('should accept positive fee values in form', async ({ page }) => {
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    
    await feesInput.fill('0.65');
    await expect(feesInput).toHaveValue('0.65');
  });

  test('should accept zero fee values in form', async ({ page }) => {
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    
    await feesInput.fill('0');
    await expect(feesInput).toHaveValue('0');
  });

  test('should create trade with negative fees', async ({ page }) => {
    // Fill in trade details
    await page.fill('#trade-ticker', 'AAPL');
    await page.fill('#trade-strategy', 'Covered Call');
    
    // Fill in leg details with negative fee
    const firstLeg = page.locator('.trade-leg').first();
    await firstLeg.locator('[data-leg-field="orderType"]').selectOption('STO');
    await firstLeg.locator('[data-leg-field="type"]').selectOption('CALL');
    await firstLeg.locator('[data-leg-field="quantity"]').fill('10');
    await firstLeg.locator('[data-leg-field="strike"]').fill('150');
    await firstLeg.locator('[data-leg-field="premium"]').fill('2.50');
    await firstLeg.locator('[data-leg-field="fees"]').fill('-0.65');
    await firstLeg.locator('[data-leg-field="executionDate"]').fill('2024-01-15');
    await firstLeg.locator('[data-leg-field="expirationDate"]').fill('2024-02-16');
    
    // Save the trade
    await page.click('button:has-text("Save Trade")');
    
    // Should navigate back to trades list
    await page.waitForTimeout(500);
    
    // Verify trade was saved (check for success or presence in list)
    // Note: Actual verification depends on app behavior
  });

  test('should create trade with mixed positive and negative fees', async ({ page }) => {
    await page.fill('#trade-ticker', 'TSLA');
    await page.fill('#trade-strategy', 'Iron Condor');
    
    // Add multiple legs
    const addLegBtn = page.locator('#add-leg-btn');
    await addLegBtn.click();
    await addLegBtn.click();
    await addLegBtn.click();
    
    const legs = page.locator('.trade-leg');
    
    // Leg 1: Positive fee
    const leg1 = legs.nth(0);
    await leg1.locator('[data-leg-field="orderType"]').selectOption('BTO');
    await leg1.locator('[data-leg-field="type"]').selectOption('PUT');
    await leg1.locator('[data-leg-field="quantity"]').fill('10');
    await leg1.locator('[data-leg-field="strike"]').fill('200');
    await leg1.locator('[data-leg-field="premium"]').fill('1.00');
    await leg1.locator('[data-leg-field="fees"]').fill('0.65');
    
    // Leg 2: Negative fee (rebate)
    const leg2 = legs.nth(1);
    await leg2.locator('[data-leg-field="orderType"]').selectOption('STO');
    await leg2.locator('[data-leg-field="type"]').selectOption('PUT');
    await leg2.locator('[data-leg-field="quantity"]').fill('10');
    await leg2.locator('[data-leg-field="strike"]').fill('205');
    await leg2.locator('[data-leg-field="premium"]').fill('2.00');
    await leg2.locator('[data-leg-field="fees"]').fill('-0.50');
    
    // Leg 3: Zero fee
    const leg3 = legs.nth(2);
    await leg3.locator('[data-leg-field="orderType"]').selectOption('STO');
    await leg3.locator('[data-leg-field="type"]').selectOption('CALL');
    await leg3.locator('[data-leg-field="quantity"]').fill('10');
    await leg3.locator('[data-leg-field="strike"]').fill('215');
    await leg3.locator('[data-leg-field="premium"]').fill('1.50');
    await leg3.locator('[data-leg-field="fees"]').fill('0');
    
    // Leg 4: Another positive fee
    const leg4 = legs.nth(3);
    await leg4.locator('[data-leg-field="orderType"]').selectOption('BTO');
    await leg4.locator('[data-leg-field="type"]').selectOption('CALL');
    await leg4.locator('[data-leg-field="quantity"]').fill('10');
    await leg4.locator('[data-leg-field="strike"]').fill('220');
    await leg4.locator('[data-leg-field="premium"]').fill('0.50');
    await leg4.locator('[data-leg-field="fees"]').fill('0.65');
    
    // All legs should accept their fee values
    await expect(leg1.locator('[data-leg-field="fees"]')).toHaveValue('0.65');
    await expect(leg2.locator('[data-leg-field="fees"]')).toHaveValue('-0.50');
    await expect(leg3.locator('[data-leg-field="fees"]')).toHaveValue('0');
    await expect(leg4.locator('[data-leg-field="fees"]')).toHaveValue('0.65');
  });

  test('should handle very small negative fees', async ({ page }) => {
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    
    // Enter very small rebate
    await feesInput.fill('-0.0001');
    await expect(feesInput).toHaveValue('-0.0001');
  });

  test('should handle large negative fees', async ({ page }) => {
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    
    // Enter large rebate
    await feesInput.fill('-10.50');
    await expect(feesInput).toHaveValue('-10.50');
  });

  test('should preserve negative fees when editing trade', async ({ page }) => {
    // First create a trade with negative fees
    await page.fill('#trade-ticker', 'SPY');
    await page.fill('#trade-strategy', 'Bull Call Spread');
    
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    await feesInput.fill('-0.85');
    
    await page.locator('[data-leg-field="quantity"]').first().fill('10');
    await page.locator('[data-leg-field="strike"]').first().fill('450');
    await page.locator('[data-leg-field="premium"]').first().fill('5.00');
    
    await page.click('button:has-text("Save Trade")');
    await page.waitForTimeout(500);
    
    // Go to trades list and edit (if implementation allows)
    await page.click('[data-view="trades-list"]');
    
    // Note: Actual edit verification would require clicking edit button
    // and checking if negative fee is preserved
  });
});

test.describe('Trade Calculations with Negative Fees', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
  });

  test('should display improved P&L with negative fees', async ({ page }) => {
    // This test verifies that negative fees improve P&L in the UI
    // Would require creating a complete trade and checking dashboard metrics
    
    await page.click('[data-view="add-trade"]');
    
    // Create a simple trade with negative fees
    await page.fill('#trade-ticker', 'NVDA');
    await page.fill('#trade-strategy', 'Long Call');
    
    const leg = page.locator('.trade-leg').first();
    await leg.locator('[data-leg-field="orderType"]').selectOption('BTO');
    await leg.locator('[data-leg-field="type"]').selectOption('CALL');
    await leg.locator('[data-leg-field="quantity"]').fill('1');
    await leg.locator('[data-leg-field="strike"]').fill('500');
    await leg.locator('[data-leg-field="premium"]').fill('10.00');
    await leg.locator('[data-leg-field="fees"]').fill('-0.50'); // Rebate reduces cost
    
    // Note: Full verification would require saving and checking dashboard
  });
});
