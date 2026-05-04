import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { PageHeader } from "@/shared/layout/AppShell";
import { Bars, MiniLine } from "@/shared/ui/charts";
import { money, pct } from "@/shared/ui/format";
import { ErrorState, Loading } from "@/shared/ui/State";

export function AnalyticsPage(): JSX.Element {
  const context = useQuery({ queryKey: ["analytics-context"], queryFn: () => api.context() });
  if (context.isLoading) return <Loading label="Loading analytics..." />;
  if (context.error) return <ErrorState error={context.error} />;
  const data = context.data?.data;
  if (!data) return <Loading />;
  const pl = data.portfolio.pl;
  const trend = [pl.last1y ?? 0, pl.last90d ?? 0, pl.last30d ?? 0, pl.last7d ?? 0, pl.mtd ?? 0, pl.ytd ?? 0, pl.total ?? 0];

  return (
    <>
      <PageHeader title="Analytics" subtitle="P&L windows, expiry calendar, strategy and ticker breakdowns." />
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="rounded border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">P&L Windows</h2>
            <span className="text-sm text-text-secondary">YTD {money(pl.ytd)}</span>
          </div>
          <MiniLine values={trend} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["last7d", "last30d", "last90d", "mtd", "ytd", "total"].map((key) => (
              <div key={key} className="rounded border border-border p-3">
                <div className="text-xs uppercase text-text-secondary">{key}</div>
                <div className="mt-1 font-semibold">{money(pl[key])}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-border bg-surface p-5">
          <h2 className="mb-3 font-semibold">Expiry Calendar</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.dteDistribution).map(([bucket, count]) => (
              <div key={bucket} className="rounded border border-border p-3">
                <div className="text-xs text-text-secondary">{bucket}</div>
                <div className="mt-1 text-xl font-semibold">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Strategy Breakdown</h2>
          <Bars data={data.strategyBreakdown.map((row) => ({ label: row.strategy, value: row.totalPL }))} />
        </div>
        <div className="rounded border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Ticker Exposure</h2>
          <div className="space-y-2">
            {data.tickerExposure.map((row) => (
              <div key={row.ticker} className="grid grid-cols-[70px_1fr_70px] gap-3 border-b border-border pb-2 text-sm last:border-0">
                <span className="font-semibold">{row.ticker}</span>
                <span>{money(row.totalPL)}</span>
                <span>{pct(row.winRate)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
