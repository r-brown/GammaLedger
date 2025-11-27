import { test, expect } from '@playwright/test';

/**
 * E2E tests for basic GammaLedger UI functionality
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

test.describe('GammaLedger Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
  });

  test('should load the application successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/GammaLedger/i);
    
    // Check for main container
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
  });

  test('should display navigation menu', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    // Navigation includes: Dashboard, All Trades, Credit Playbook, Add Trade, Import, Settings
    await expect(navItems).toHaveCount(6);
    
    // Check for specific nav items
    await expect(page.locator('[data-view="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-view="trades-list"]')).toBeVisible();
    await expect(page.locator('[data-view="add-trade"]')).toBeVisible();
  });

  test('should navigate between views', async ({ page }) => {
    // Start on dashboard view
    const dashboard = page.locator('.dashboard-view');
    await expect(dashboard).toHaveClass(/active/);

    // Navigate to Add Trade
    await page.click('[data-view="add-trade"]');
    const addTradeView = page.locator('.add-trade-view');
    await expect(addTradeView).toHaveClass(/active/);

    // Navigate to Trades List
    await page.click('[data-view="trades-list"]');
    const tradesView = page.locator('.trades-list-view');
    await expect(tradesView).toHaveClass(/active/);
  });

  test('should display file management buttons', async ({ page }) => {
    await expect(page.locator('#new-database-btn')).toBeVisible();
    await expect(page.locator('#save-database-btn')).toBeVisible();
    await expect(page.locator('#load-database-btn')).toBeVisible();
  });

  test('should show current file name', async ({ page }) => {
    const fileName = page.locator('#current-file-name');
    await expect(fileName).toBeVisible();
    // Should show either "Unsaved Database" or "Sample Database (Built-in)"
    const text = await fileName.textContent();
    expect(text).toMatch(/(Unsaved Database|Sample Database \(Built-in\))/);
  });
});

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
  });

  test('should display dashboard metrics', async ({ page }) => {
    // Check for key performance metrics
    const metrics = page.locator('.metric-card');
    await expect(metrics.first()).toBeVisible();
    
    // Common metrics should include Total P&L, Win Rate, etc.
    await expect(page.locator('text=/Total P&L|Win Rate|Active Positions/i').first()).toBeVisible();
  });

  test('should show empty state when no trades exist', async ({ page }) => {
    // For a fresh database, should show zero or empty states
    const totalPL = page.locator('text=/\\$0\\.00/').first();
    await expect(totalPL).toBeVisible();
  });
});

test.describe('Trade Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
  });

  test('should display trades table', async ({ page }) => {
    await page.click('[data-view="trades-list"]');
    
    const tradesTable = page.locator('#trades-table');
    await expect(tradesTable).toBeVisible();
    
    // Check for table headers
    await expect(page.locator('th:has-text("Ticker")')).toBeVisible();
    await expect(page.locator('th:has-text("Strategy")')).toBeVisible();
    await expect(page.locator('th:has-text("P&L")')).toBeVisible();
  });

  test('should filter trades by status', async ({ page }) => {
    await page.click('[data-view="trades-list"]');
    
    const statusFilter = page.locator('#filter-status');
    await expect(statusFilter).toBeVisible();
    
    // Should have filter options
    const options = statusFilter.locator('option');
    await expect(options).not.toHaveCount(0);
  });

  test('should search trades by ticker', async ({ page }) => {
    await page.click('[data-view="trades-list"]');
    
    const searchBox = page.locator('#search-ticker');
    await expect(searchBox).toBeVisible();
    
    // Should accept input
    await searchBox.fill('AAPL');
    await expect(searchBox).toHaveValue('AAPL');
  });
});

test.describe('Add Trade Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
    await page.click('[data-view="add-trade"]');
  });

  test('should display add trade form', async ({ page }) => {
    const form = page.locator('#add-trade-form');
    await expect(form).toBeVisible();
  });

  test('should have required trade fields', async ({ page }) => {
    // Check for ticker input
    const ticker = page.locator('#trade-ticker');
    await expect(ticker).toBeVisible();
    
    // Check for strategy input
    const strategy = page.locator('#trade-strategy');
    await expect(strategy).toBeVisible();
  });

  test('should have legs container', async ({ page }) => {
    const legsContainer = page.locator('#trade-legs-container');
    await expect(legsContainer).toBeVisible();
    
    // Should have at least one leg by default
    const legs = page.locator('.trade-leg');
    await expect(legs.first()).toBeVisible();
  });

  test('should allow adding new legs', async ({ page }) => {
    const addLegBtn = page.locator('#add-leg-btn');
    await expect(addLegBtn).toBeVisible();
    
    const initialLegs = await page.locator('.trade-leg').count();
    
    await addLegBtn.click();
    
    const newLegsCount = await page.locator('.trade-leg').count();
    expect(newLegsCount).toBe(initialLegs + 1);
  });

  test('should have leg form fields', async ({ page }) => {
    const firstLeg = page.locator('.trade-leg').first();
    
    // Check for key leg fields
    await expect(firstLeg.locator('[data-leg-field="orderType"]')).toBeVisible();
    await expect(firstLeg.locator('[data-leg-field="type"]')).toBeVisible();
    await expect(firstLeg.locator('[data-leg-field="quantity"]')).toBeVisible();
    await expect(firstLeg.locator('[data-leg-field="strike"]')).toBeVisible();
    await expect(firstLeg.locator('[data-leg-field="premium"]')).toBeVisible();
    await expect(firstLeg.locator('[data-leg-field="fees"]')).toBeVisible();
  });

  test('should allow negative fees in form', async ({ page }) => {
    const feesInput = page.locator('[data-leg-field="fees"]').first();
    await expect(feesInput).toBeVisible();
    
    // Should accept negative values
    await feesInput.fill('-0.65');
    await expect(feesInput).toHaveValue('-0.65');
    
    // Check that min attribute is not restricting negatives
    const minAttr = await feesInput.getAttribute('min');
    expect(minAttr).toBeNull();
  });

  test('should have save and cancel buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Save Trade")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
    await page.click('[data-view="settings"]');
  });

  test('should display settings page', async ({ page }) => {
    const settings = page.locator('#settings');
    await expect(settings).toBeVisible();
  });

  test('should have API key configuration', async ({ page }) => {
    // Check for Finnhub API key input
    const apiKeyInput = page.locator('#api-key');
    await expect(apiKeyInput).toBeVisible();
  });

  test('should have Gemini API configuration', async ({ page }) => {
    // Check for Gemini settings
    const geminiKey = page.locator('#gemini-api-key');
    await expect(geminiKey).toBeVisible();
  });
});

test.describe('Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
  });

  test('should have import buttons', async ({ page }) => {
    await expect(page.locator('#import-ofx-btn')).toBeVisible();
    await expect(page.locator('#import-json-btn')).toBeVisible();
  });

  test('should have export to CSV button', async ({ page }) => {
    await expect(page.locator('#export-csv-btn')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('should have accessible form labels', async ({ page }) => {
    await page.click('[data-view="add-trade"]');
    
    const labels = page.locator('.form-label');
    const labelCount = await labels.count();
    expect(labelCount).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through nav items
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.className);
    expect(focused).toBeTruthy();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
    
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
    
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/src/index.html');
    await page.waitForLoadState('networkidle');
    await dismissDisclaimer(page);
    
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });
});
