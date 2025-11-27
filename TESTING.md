# GammaLedger Testing Guide

This document describes the testing framework and practices for GammaLedger.

## Testing Stack

### Unit Tests - Vitest
- **Framework**: [Vitest](https://vitest.dev/) - Fast, modern unit testing framework
- **Environment**: JSDOM for DOM simulation
- **Coverage**: V8 coverage provider
- **Purpose**: Test individual functions, calculations, and business logic

### E2E Tests - Playwright
- **Framework**: [Playwright](https://playwright.dev/) - Modern cross-browser testing
- **Browsers**: Chromium, Firefox, WebKit (Safari)
- **Purpose**: Test complete user workflows and UI interactions

## Installation

```bash
npm install
```

This will install all testing dependencies including Vitest and Playwright.

## Running Tests

### All Tests
```bash
npm test              # Run all tests in watch mode
npm run test:ci       # Run all tests once (CI mode)
```

### Unit Tests Only
```bash
npm run test:unit           # Run unit tests once
npm run test:coverage       # Run with coverage report
```

### E2E Tests Only
```bash
npm run test:e2e           # Run E2E tests headless
npm run test:e2e:ui        # Run with Playwright UI (interactive)
```

### Watch Mode
```bash
npm test               # Vitest runs in watch mode by default
```

## Test Structure

```
tests/
├── setup.js                    # Vitest global setup
├── unit/                       # Unit tests
│   ├── fees.test.js           # Fee calculation tests (Issue #12)
│   ├── trade-model.test.js    # Trade data model tests
│   └── validation.test.js     # Input validation tests
└── e2e/                        # End-to-end tests
    ├── app.spec.js            # General app functionality
    └── negative-fees.spec.js  # Negative fees UI tests (Issue #12)
```

## Writing Tests

### Unit Tests

Create files matching `tests/unit/**/*.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    const result = someFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### E2E Tests

Create files matching `tests/e2e/**/*.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/index.html');
  });

  test('should interact with UI', async ({ page }) => {
    await page.click('button');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

## Test Coverage

### Current Status

**Important Note**: The initial E2E tests were generated based on assumed DOM structure and may contain selectors that don't match the actual HTML. Tests are being updated to match the real application structure. Currently ~62/111 tests passing after fixing the disclaimer modal blocking issue.

Known issues being addressed:
- Some tests use incorrect DOM selectors (e.g., `#dashboard` vs `.dashboard-view`)
- Tests assume elements that may not exist or have different names
- DOM selectors need to be verified against actual `src/index.html`

### Viewing Coverage Reports

```bash
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/index.html` - HTML report (open in browser)
- `coverage/lcov.info` - LCOV format (for CI/CD)
- Terminal output - Summary

### Coverage Goals

- **Statements**: > 70%
- **Branches**: > 60%
- **Functions**: > 70%
- **Lines**: > 70%

Focus coverage on:
- Core business logic (calculations, validations)
- Data transformations
- Critical user flows

## GitHub Actions

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request

### Workflow Jobs

1. **Unit Tests**
   - Runs Vitest tests
   - Generates coverage report
   - Uploads to Codecov

2. **E2E Tests**
   - Runs in parallel across browsers (Chromium, Firefox, WebKit)
   - Captures screenshots on failure
   - Uploads test artifacts

3. **Test Summary**
   - Aggregates results from all test jobs
   - Reports final status

### Viewing Results

- GitHub Actions tab in repository
- PR checks section
- Codecov dashboard (when configured)

## Testing Specific Features

### Negative Fees (Issue #12)

Tests verifying that negative fees work correctly:

**Unit Tests** (`tests/unit/fees.test.js`):
- Negative fee acceptance
- Cash flow calculations with rebates
- P&L improvements from negative fees
- Mixed positive/negative fee aggregation

**E2E Tests** (`tests/e2e/negative-fees.spec.js`):
- UI accepts negative values in fee input
- Form submission with negative fees
- Mixed fee scenarios in multi-leg trades
- Data persistence with negative fees

### Trade Data Model

Tests for trade normalization and enrichment:
- Leg normalization
- Status management
- Multi-leg strategies
- Cash flow calculations
- DTE calculations
- ROI calculations

### Data Validation

Tests for input validation and parsing:
- Number parsing (decimals, integers)
- Date parsing and calculations
- String normalization
- Required field validation
- Edge cases (infinity, zero, very large/small numbers)

## Debugging Tests

### Debugging Unit Tests

```bash
# Run specific test file
npx vitest tests/unit/fees.test.js

# Run tests matching pattern
npx vitest -t "negative fees"

# Debug mode (add debugger statements)
node --inspect-brk node_modules/.bin/vitest
```

### Debugging E2E Tests

```bash
# Run with UI (best for debugging)
npm run test:e2e:ui

# Run in headed mode
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/negative-fees.spec.js

# Debug mode
npx playwright test --debug
```

## Continuous Integration

### Local Pre-commit Testing

Before committing:
```bash
npm run test:ci
```

This runs the same tests that will run in CI.

### Pull Request Testing

All PRs must pass:
- ✅ All unit tests
- ✅ All E2E tests across all browsers
- ✅ No critical coverage drops

## Best Practices

### Unit Tests
1. Test one thing per test
2. Use descriptive test names
3. Arrange-Act-Assert pattern
4. Mock external dependencies
5. Test edge cases and error conditions

### E2E Tests
1. Test user workflows, not implementation
2. Use data-testid for stable selectors
3. Wait for elements properly (avoid arbitrary timeouts)
4. Keep tests independent
5. Clean up test data

### General
1. Write tests alongside feature development
2. Update tests when fixing bugs
3. Maintain test clarity over cleverness
4. Review test failures carefully
5. Keep tests fast and focused

## Troubleshooting

### "Module not found" errors
```bash
npm ci  # Clean install
```

### E2E tests fail to start server
```bash
# Check if port 8080 is available
lsof -i :8080
kill -9 <PID>  # If blocked
```

### Tests pass locally but fail in CI
- Check Node.js version matches
- Verify dependencies are locked (package-lock.json)
- Check for timing issues (use proper waits)
- Review CI logs for environment differences

### Playwright browser installation issues
```bash
npx playwright install --with-deps
```

## Contributing

When adding new features:
1. Write unit tests for business logic
2. Write E2E tests for user-facing changes
3. Ensure coverage doesn't drop significantly
4. Update this README if adding new test patterns

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
