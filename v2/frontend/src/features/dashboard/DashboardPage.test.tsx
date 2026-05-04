import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

describe("DashboardPage", () => {
  it("renders the dashboard metrics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            asOfDate: "2026-05-04",
            portfolio: {
              counts: { totalTrades: 1, closed: 1, active: 0, assigned: 0, awaitingCoverage: 0 },
              pl: { total: 657.3, ytd: 657.3, mtd: 0, last7d: 0, last30d: 0, last90d: 657.3, last1y: 657.3 },
              performance: { winRate: 100 },
              risk: { collateralAtRisk: 0 },
              fees: { total: 2.7 },
              trading: {},
            },
            strategyBreakdown: [{ strategy: "Wheel", total: 1, closed: 1, wins: 1, totalPL: 657.3, winRate: 100, avgPL: 657.3 }],
            underlyingBreakdown: [],
            dteDistribution: { expired: 0, "0-7d": 0, "8-30d": 0, "31-60d": 0, "61-90d": 0, "90d+": 0 },
            concentration: [],
            activePositions: [],
            wheelPmccPositions: [],
            tickerExposure: [],
            recentClosedTrades: [{ id: "TRD-W001", ticker: "KO", strategy: "Wheel", status: "Closed", underlying: "Stock", opened: "2025-10-06", quantity: 100, entryPrice: 1, pl: 657.3, roi: 11, annualizedROI: 39, capitalAtRisk: 5920, cashFlow: 657.3, fees: 2.7, daysHeld: 103 }],
          },
        }),
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Options Trading Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Realized P&L")).toBeInTheDocument();
  });
});
