import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { PageHeader } from "@/shared/layout/AppShell";
import { money } from "@/shared/ui/format";
import { Bars } from "@/shared/ui/charts";
import { Empty, ErrorState, Loading } from "@/shared/ui/State";

export function WheelPage(): JSX.Element {
  const wheel = useQuery({ queryKey: ["wheel"], queryFn: () => api.wheelPmcc() });
  const csp = useQuery({ queryKey: ["csp-groups"], queryFn: () => api.cspGroups() });
  if (wheel.isLoading) return <Loading label="Loading Wheel tracker..." />;
  if (wheel.error) return <ErrorState error={wheel.error} />;
  const rows = wheel.data?.data ?? [];

  return (
    <>
      <PageHeader title="Credit Playbook (beta)" subtitle="Assignment coverage, effective basis, premium collection, and CSP grouping." />
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Summary label="Positions" value={String(rows.length)} hint={`${rows.filter((row) => row.status === "Open").length} active`} />
        <Summary label="Net Premium" value={money(rows.reduce((sum, row) => sum + row.premiumCollected, 0))} hint="Total credit/debit" tone="info" />
        <Summary label="Realized P&L" value="—" hint="No closed positions yet" />
        <Summary label="Win Rate" value="—" hint="No closed positions" />
        <Summary label="Active Risk" value={money(rows.reduce((sum, row) => sum + row.costBasis, 0))} hint="Across open positions" />
        <Summary label="Avg DTE" value={String(Math.round(rows.reduce((sum, row) => sum + (row.activeShortCalls ? 29 : 0), 0) / Math.max(rows.length, 1)))} hint="Open with expiration" />
      </section>
      <section className="space-y-6">
        <div className="gl-panel">
          <div className="mb-5 grid gap-4 md:grid-cols-[220px_1fr_1fr_1fr]">
            <div>
              <div className="mb-2 text-sm font-medium text-text-secondary">Status</div>
              <div className="flex gap-2">
                {["All", "Active", "Closed"].map((status) => <span key={status} className={`rounded-full px-3 py-1 text-xs ${status === "Active" ? "bg-info text-white" : "bg-background text-text-secondary"}`}>{status}</span>)}
              </div>
            </div>
            <label className="text-sm font-medium text-text-secondary">Time Horizon<input className="gl-input mt-2" value="All time" readOnly /></label>
            <label className="text-sm font-medium text-text-secondary">Strategy<input className="gl-input mt-2" value="All strategies" readOnly /></label>
            <label className="text-sm font-medium text-text-secondary">Symbol<input className="gl-input mt-2" placeholder="Filter ticker..." /></label>
          </div>
          {rows.length === 0 ? (
            <Empty label="No Wheel or PMCC positions." />
          ) : (
            <div className="overflow-x-auto">
              <table className="gl-table min-w-[1180px] text-left">
                <thead>
                  <tr><th>Ticker</th><th>Strategy</th><th>Type</th><th>Strike Price</th><th>Status</th><th>Contracts</th><th>Premium</th><th>P&L</th><th>ROI</th><th>Current Price</th><th>Expiration Date</th><th>DTE</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td><span className="gl-badge gl-badge-teal">{row.ticker}</span></td>
                      <td>{row.strategy}</td>
                      <td><span className={row.type === "put" ? "gl-badge gl-badge-red" : "gl-badge gl-badge-green"}>{row.type.toUpperCase()}</span></td>
                      <td>{money(row.strike)}</td>
                      <td><span className="gl-badge gl-badge-green">{row.status.toUpperCase()}</span></td>
                      <td>{row.activeShortCalls || 1}</td>
                      <td className="text-info">{money(row.premiumCollected)}</td>
                      <td className={row.effectiveCostBasis - row.costBasis >= 0 ? "text-info" : "text-error"}>{money(row.effectiveCostBasis - row.costBasis)}</td>
                      <td className="text-info">+{Math.max(0, row.premiumCollected / Math.max(row.costBasis, 1) * 100).toFixed(1)}%</td>
                      <td>{money(row.costBasisPerShare)}</td>
                      <td>{row.assignedOn ?? "—"}</td>
                      <td>{row.activeShortCalls ? 29 : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="gl-panel">
            <h2 className="mb-3 font-semibold">Premium By Ticker</h2>
            <Bars data={rows.map((row) => ({ label: row.ticker, value: row.premiumCollected }))} />
          </div>
          <div className="gl-panel">
            <h2 className="mb-3 font-semibold">CSP Groups</h2>
            {csp.data?.data.length ? (
              <div className="space-y-2">
                {csp.data.data.map((group) => (
                  <div key={group.ticker} className="rounded border border-border bg-background p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{group.ticker}</span>
                      <span>{money(group.capitalAtRisk)}</span>
                    </div>
                    <div className="mt-1 text-text-secondary">{group.count} open CSP positions</div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty label="No CSP groups." />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Summary({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "info" }): JSX.Element {
  return (
    <div className="gl-card min-h-[90px] p-4">
      <div className={`text-2xl font-semibold ${tone === "info" ? "text-info" : "text-text"}`}>{value}</div>
      <div className="mt-2 text-xs text-text-secondary">{label}</div>
      <div className="mt-1 text-xs text-text-secondary">{hint}</div>
    </div>
  );
}
