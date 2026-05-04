import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/shared/api/client";
import type { McpTradeRow } from "@/shared/api/types";
import { PageHeader } from "@/shared/layout/AppShell";
import { money, pct, signedClass } from "@/shared/ui/format";
import { Empty, ErrorState, Loading } from "@/shared/ui/State";

export function PositionsPage(): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const positions = useQuery({ queryKey: ["positions"], queryFn: () => api.openPositions() });
  const expiring = useQuery({ queryKey: ["positions", "expiring"], queryFn: () => api.expiringPositions(undefined, 30) });
  const detail = useQuery({
    queryKey: ["position", selected],
    queryFn: () => api.positionDetail(selected ?? ""),
    enabled: Boolean(selected),
  });
  if (positions.isLoading) return <Loading label="Loading positions..." />;
  if (positions.error) return <ErrorState error={positions.error} />;
  const rows = positions.data?.data ?? [];

  return (
    <>
      <PageHeader title="Positions" subtitle="Open risk, expiring contracts, and leg-level position detail." />
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="rounded border border-border bg-surface p-4">
          <h2 className="mb-3 font-semibold">Open Positions</h2>
          <PositionTable rows={rows} onSelect={setSelected} />
        </div>
        <div className="space-y-5">
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 font-semibold">Expiring Within 30 Days</h2>
            {expiring.data?.data.length ? (
              <div className="space-y-2">
                {expiring.data.data.map((row) => (
                  <button key={row.id} className="grid w-full grid-cols-[70px_1fr_auto] gap-2 rounded border border-border p-3 text-left text-sm" onClick={() => setSelected(row.id)}>
                    <span className="font-semibold">{row.ticker}</span>
                    <span className="truncate text-text-secondary">{row.strategy}</span>
                    <span>{row.dte}d</span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty label="No near-term expirations." />
            )}
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 font-semibold">Position Detail</h2>
            {detail.isLoading ? <Loading /> : null}
            {detail.error ? <ErrorState error={detail.error} /> : null}
            {detail.data ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Ticker" value={detail.data.data.trade.ticker} />
                  <Info label="Status" value={detail.data.data.trade.status} />
                  <Info label="Strategy" value={detail.data.data.trade.strategy} />
                  <Info label="Legs" value={String(detail.data.data.trade.legs.length)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="border-b border-border text-text-secondary">
                      <tr><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Strike</th><th className="py-2 pr-3">Premium</th></tr>
                    </thead>
                    <tbody>
                      {detail.data.data.trade.legs.map((leg) => (
                        <tr key={leg.id} className="border-b border-border last:border-0">
                          <td className="py-2 pr-3">{leg.orderType}</td>
                          <td className="py-2 pr-3">{leg.type}</td>
                          <td className="py-2 pr-3">{leg.strike ?? ""}</td>
                          <td className="py-2 pr-3">{money(leg.premium)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary">Select a position.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function PositionTable({ rows, onSelect }: { rows: McpTradeRow[]; onSelect: (id: string) => void }): JSX.Element {
  if (rows.length === 0) return <Empty label="No open positions." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border text-text-secondary">
          <tr><th className="py-3 pr-4">Ticker</th><th className="py-3 pr-4">Strategy</th><th className="py-3 pr-4">DTE</th><th className="py-3 pr-4">P&L</th><th className="py-3 pr-4">ROI</th><th className="py-3 pr-4">Risk</th><th className="py-3 pr-4">Coverage</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-background" onClick={() => onSelect(row.id)}>
              <td className="py-3 pr-4 font-semibold">{row.ticker}</td>
              <td className="py-3 pr-4">{row.strategy}</td>
              <td className="py-3 pr-4">{row.dte ?? ""}</td>
              <td className={`py-3 pr-4 ${signedClass(row.pl)}`}>{money(row.pl)}</td>
              <td className="py-3 pr-4">{pct(row.roi)}</td>
              <td className="py-3 pr-4">{row.riskIsUnlimited ? "Unlimited" : money(row.capitalAtRisk)}</td>
              <td className="py-3 pr-4">{row.wheelCoverage ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
