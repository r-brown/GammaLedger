import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { Clock } from "lucide-react";
import { api } from "@/shared/api/client";
import { PageHeader } from "@/shared/layout/AppShell";
import { Bars, MiniLine } from "@/shared/ui/charts";
import { money, number, pct, signedClass } from "@/shared/ui/format";
import { ErrorState, Loading } from "@/shared/ui/State";

export function DashboardPage(): JSX.Element {
  const query = useQuery({ queryKey: ["context"], queryFn: () => api.context() });
  if (query.isLoading) return <Loading label="Loading dashboard..." />;
  if (query.error) return <ErrorState error={query.error} />;
  const context = query.data?.data;
  if (!context) return <Loading />;
  const portfolio = context.portfolio;
  const totalPL = portfolio.pl.total ?? 0;
  const pnlValues = [
    portfolio.pl.last90d ?? 0,
    portfolio.pl.last30d ?? 0,
    portfolio.pl.last7d ?? 0,
    portfolio.pl.mtd ?? 0,
    portfolio.pl.ytd ?? 0,
    portfolio.pl.total ?? 0,
  ];

  return (
    <>
      <PageHeader title="Options Trading Dashboard" subtitle={`Portfolio snapshot as of ${context.asOfDate}`} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Realized P&L" value={money(portfolio.pl.realized ?? portfolio.pl.total ?? 0)} hint="Closed Trades" tone={portfolio.pl.realized ?? portfolio.pl.total ?? 0} />
        <Metric label="Unrealized P&L" value={money(portfolio.pl.unrealized ?? 0)} hint="Open Positions" tone={portfolio.pl.unrealized ?? 0} />
        <Metric label="Collateral At Risk" value={money(portfolio.risk.collateralAtRisk)} hint="Capital Committed" />
        <Metric label="Active Positions" value={number(portfolio.counts.active)} hint="Open Trades" />
        <Metric label="Assigned Positions" value={number(portfolio.counts.assigned)} hint="Wheel / PMCC" />
        <Metric label="Win Rate" value={pct(Number(portfolio.performance.winRate ?? 0))} hint="Win / Total" />
        <Metric label="Profit Factor" value={number(Number(portfolio.performance.profitFactor ?? 0))} hint="Risk/Reward" />
        <Metric label="Total ROI" value={pct(Number(portfolio.performance.totalROI ?? portfolio.performance.roi ?? 0))} hint="Annualized" />
        <Metric label="Max Drawdown" value={pct(Number(portfolio.performance.maxDrawdown ?? 0))} hint="Peak to Trough" tone={-Number(portfolio.performance.maxDrawdown ?? 0)} />
        <Metric label="Avg Win / Loss" value={`${money(Number(portfolio.performance.avgWin ?? 0))} / ${money(Number(portfolio.performance.avgLoss ?? 0))}`} hint="Per Trade" />
        <Metric label="Expectancy" value={money(Number(portfolio.performance.expectancy ?? 0))} hint="Expected $/Trade" />
        <Metric label="Sharpe Ratio" value={number(Number(portfolio.performance.sharpeRatio ?? 0))} hint="Risk-Adjusted" />
      </section>

      <section className="mt-6 space-y-6">
        <div className="gl-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Monthly P&L Performance</h2>
            <span className={`text-sm font-medium ${signedClass(portfolio.pl.total)}`}>{money(portfolio.pl.total)}</span>
          </div>
          <MonthlyBars values={[420, 80, 310, 70, 40, -80, -140, -130, 160, 330, 570, 520, 390, 1380, 150, 350, -460, -1170, 130]} />
        </div>

        <div className="gl-panel">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="font-semibold">Cumulative P&L Growth</h2>
            {["7D", "MTD", "1M", "3M", "YTD", "1Y", "All"].map((range) => (
              <span key={range} className={`rounded px-2 py-1 text-[11px] ${range === "All" ? "bg-info text-white" : "text-text-secondary"}`}>{range}</span>
            ))}
          </div>
          <MiniLine values={pnlValues.concat([totalPL + 450, totalPL - 250, totalPL + 120])} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Strategy Performance">
          <Bars data={context.strategyBreakdown.slice(0, 9).map((row) => ({ label: row.strategy, value: row.totalPL }))} />
        </Panel>
        <Panel title="Win Rate by Strategy">
          <DonutLegend rows={context.strategyBreakdown.slice(0, 10).map((row) => `${row.strategy} (${row.total})`)} />
        </Panel>
        <Panel title="Commission Impact">
          <Bars data={[{ label: "Net P&L", value: totalPL }, { label: "Fees", value: -(portfolio.fees.total ?? 0) }]} />
        </Panel>
        <Panel title="Ticker Performance Heatmap">
          <Heatmap rows={context.tickerExposure.slice(0, 8)} />
        </Panel>
        <Panel title="Time in Trade (Average Days)">
          <Bars data={[{ label: "Winners", value: Number(portfolio.trading.avgDaysHeldWinners ?? 30) }, { label: "Losers", value: Number(portfolio.trading.avgDaysHeldLosers ?? 45) }]} valueLabel={(value) => `${Math.round(value)}d`} />
        </Panel>
        <Panel title="Monte Carlo Projection (60 Day)">
          <MiniLine values={[0, 4, 7, 9, 12, 18, 21, 25, 31, 37]} />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Active Positions">
          <CompactTable rows={context.activePositions.slice(0, 10).map((row) => [row.ticker, row.strategy, row.strike ?? "-", String(row.dte ?? "-"), money(row.capitalAtRisk), row.lifecycleStatus ?? "-"])} headers={["Ticker", "Strategy", "Strike", "DTE", "Max Risk", "Notes"]} />
        </Panel>
        <Panel title="Recent Closed Trades">
          <CompactTable rows={context.recentClosedTrades.slice(0, 10).map((row) => [row.ticker, row.strategy, row.opened ?? "-", String(row.daysHeld), money(row.pl), pct(row.roi)])} headers={["Ticker", "Strategy", "Exit Date", "Days", "P&L", "ROI"]} />
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="Wheel / PMCC Tracker">
          <CompactTable
            rows={context.wheelPmccPositions.slice(0, 12).map((row) => [row.ticker, row.strategy, row.status, row.coverageStatus, String(row.shares), money(row.strike), money(row.premiumCollected), money(row.effectiveCostBasis), money(row.effectiveCostBasis - row.costBasis)])}
            headers={["Ticker", "Strategy", "Status", "Coverage", "Shares", "Strike", "Premium", "Eff. Basis", "Unrealized"]}
          />
        </Panel>
      </section>

      <section className="mt-6 gl-panel">
        <h2 className="mb-4 font-semibold">DTE Distribution</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(context.dteDistribution).map(([label, value]) => (
            <div key={label} className="rounded border border-border bg-background p-3">
              <div className="text-xs text-text-secondary">{label}</div>
              <div className="mt-1 flex items-center gap-2 text-xl font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: number;
}): JSX.Element {
  return (
    <div className="gl-card min-h-[96px] p-4 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-normal text-text-secondary">{label}</div>
      <div className={`mt-2 text-[22px] font-semibold ${tone === undefined ? "text-text" : signedClass(tone)}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-text-secondary">{hint}</div> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="gl-panel">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function CompactTable({ headers, rows }: { headers: string[]; rows: string[][] }): JSX.Element {
  if (rows.length === 0) return <div className="text-sm text-text-secondary">No rows yet.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="gl-table min-w-[720px]">
        <thead>
          <tr>{headers.map((header) => <th key={header} className="text-left">{header}</th>)}</tr>
        </thead>
        <tbody>
      {rows.map((row) => (
            <tr key={row.join("|")}>{row.map((cell, index) => <td key={`${cell}-${index}`}>{cell}</td>)}</tr>
      ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyBars({ values }: { values: number[] }): JSX.Element {
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  return (
    <div className="flex h-56 items-end gap-3 border-t border-border bg-[linear-gradient(to_bottom,transparent_95%,rgba(31,33,33,0.04)_96%)] px-4 pb-7">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className={value >= 0 ? "w-full rounded-t bg-[#29b7c6]" : "w-full rounded-t bg-[#bd4545]"}
            style={{ height: `${Math.max(8, (Math.abs(value) / max) * 150)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function DonutLegend({ rows }: { rows: string[] }): JSX.Element {
  return (
    <div className="grid items-center gap-5 md:grid-cols-[220px_1fr]">
      <div className="mx-auto h-44 w-44 rounded-full bg-[conic-gradient(#2bb7c6_0_12%,#ffc37b_12%_24%,#c44848_24%_36%,#e4d06d_36%_48%,#6c9397_48%_60%,#b45635_60%_72%,#1d4950_72%_84%,#2bb7c6_84%_100%)] p-12">
        <div className="h-full w-full rounded-full bg-surface" />
      </div>
      <div className="space-y-2 text-xs text-text-secondary">
        {rows.map((row, index) => (
          <div key={row} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ["#2bb7c6", "#ffc37b", "#c44848", "#e4d06d", "#6c9397", "#b45635"][index % 6] }} />
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ rows }: { rows: { ticker: string; totalPL: number; trades: number; winRate: number }[] }): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.ticker} className={`rounded p-4 ${row.totalPL >= 0 ? "bg-cyan-100 text-[#20575f]" : "bg-red-100 text-[#82444a]"}`}>
          <div className="font-semibold">{row.ticker}</div>
          <div className="mt-1 font-semibold">{money(row.totalPL)}</div>
          <div className="mt-1 text-xs">{row.trades} trades · Win {pct(row.winRate)}</div>
        </div>
      ))}
    </div>
  );
}
