import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Plus, Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { Leg, McpTradeRow, TradeInput, TradeListItem } from "@/shared/api/types";
import { PageHeader } from "@/shared/layout/AppShell";
import { money, pct, signedClass } from "@/shared/ui/format";
import { Empty, ErrorState, Loading } from "@/shared/ui/State";

const STRATEGIES = [
  "Bear Call Spread", "Bear Put Spread", "Bull Call Spread", "Bull Put Spread", "Calendar Call Spread",
  "Calendar Put Spread", "Cash-Secured Put", "Collar", "Covered Call", "Diagonal Call Spread",
  "Diagonal Put Spread", "Iron Butterfly", "Iron Condor", "Jade Lizard", "Long Call", "Long Put",
  "Long Straddle", "Long Strangle", "Poor Man's Covered Call", "Protective Put", "Short Call",
  "Short Put", "Short Straddle", "Short Strangle", "Synthetic Long Stock", "Wheel",
];
const STATUSES = ["Open", "Closed", "Expired", "Assigned", "Rolling"];
const UNDERLYING_TYPES = ["Stock", "ETF", "Index", "Future"];
const ORDER_TYPES: Leg["orderType"][] = ["BTO", "STO", "BTC", "STC"];
const LEG_TYPES: Leg["type"][] = ["CALL", "PUT", "STOCK", "CASH", "FUTURE", "ETF"];

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const today = () => new Date().toISOString().slice(0, 10);

const blankLeg = (index = 0): Leg => ({
  id: newId(`LEG${index + 1}`),
  orderType: "STO",
  type: "PUT",
  quantity: 1,
  multiplier: 100,
  executionDate: today(),
  expirationDate: "",
  strike: 0,
  premium: 0,
  fees: 0,
  underlyingPrice: null,
  underlyingType: "Stock",
});

const blankTrade = (): TradeInput => ({
  id: newId("TRD"),
  ticker: "",
  strategy: "Cash-Secured Put",
  underlyingType: "Stock",
  status: "Open",
  openedDate: today(),
  closedDate: null,
  expirationDate: "",
  exitReason: "",
  notes: "",
  legs: [blankLeg()],
});

export function TradesPage(): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<TradeInput>(blankTrade);
  const [tickerFilter, setTickerFilter] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const importMode = location.pathname.endsWith("/import");
  const newMode = location.pathname.endsWith("/new");

  const params = useMemo(() => {
    const search = new URLSearchParams({ limit: "500" });
    if (tickerFilter) search.set("ticker", tickerFilter);
    if (strategyFilter) search.set("strategy", strategyFilter);
    if (statusFilter) search.set("status", statusFilter);
    return `?${search.toString()}`;
  }, [tickerFilter, strategyFilter, statusFilter]);

  const tradesQuery = useQuery({ queryKey: ["trades", params], queryFn: () => api.trades(params) });
  const contextQuery = useQuery({ queryKey: ["analytics-context"], queryFn: () => api.context() });
  const selectedQuery = useQuery({
    queryKey: ["trade", selected],
    queryFn: () => api.trade(selected ?? ""),
    enabled: Boolean(selected),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: TradeInput) => (selected ? api.updateTrade(selected, payload) : api.createTrade(payload)),
    onSuccess: async () => {
      setNotice(selected ? "Trade updated" : "Trade created");
      setSelected(null);
      setDraft(blankTrade());
      await queryClient.invalidateQueries();
      navigate("/trades");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteTrade,
    onSuccess: async () => {
      setNotice("Trade deleted");
      await queryClient.invalidateQueries();
    },
  });
  const ofxMutation = useMutation({
    mutationFn: api.importOfx,
    onSuccess: async (result) => {
      setNotice(`OFX import completed: ${result.data.imported} imported, ${result.data.replaced} replaced, ${result.data.skipped} skipped`);
      await queryClient.invalidateQueries();
      navigate("/trades");
    },
  });

  useEffect(() => {
    if (newMode) {
      setSelected(null);
      setDraft(blankTrade());
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [newMode]);

  useEffect(() => {
    if (!selectedQuery.data?.data) return;
    const trade = selectedQuery.data.data;
    setDraft({
      id: trade.id,
      ticker: trade.ticker,
      strategy: trade.strategy,
      underlyingType: trade.underlyingType,
      status: trade.status,
      openedDate: trade.openedDate,
      closedDate: trade.closedDate,
      expirationDate: trade.expirationDate,
      exitReason: trade.exitReason,
      notes: trade.notes,
      legs: trade.legs.length ? trade.legs : [blankLeg()],
    });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [selectedQuery.data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeTrade(draft);
    if (!normalized.ticker) {
      setNotice("Ticker symbol is required.");
      return;
    }
    saveMutation.mutate(normalized);
  }

  async function importOfx(file: File) {
    ofxMutation.mutate(await file.text());
  }

  async function exportCsv() {
    const list = tradesQuery.data?.data ?? [];
    const rows = [["ID", "Ticker", "Strategy", "Status", "Opened", "Closed"]];
    rows.push(...list.map((trade) => [trade.id, trade.ticker, trade.strategy, trade.status, trade.openedDate, trade.closedDate ?? ""]));
    downloadText(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "gammaledger-trades.csv", "text/csv");
  }

  async function exportOfx() {
    const list = tradesQuery.data?.data ?? [];
    const details = await Promise.all(list.map((trade) => api.trade(trade.id).then((response) => response.data)));
    const transactions = details.flatMap((trade) =>
      trade.legs.map((leg) =>
        [
          "<INVTRAN>",
          `<FITID>${escapeOfx(`${trade.id}-${leg.id}`)}</FITID>`,
          `<DTTRADE>${compactDate(leg.executionDate ?? trade.openedDate)}</DTTRADE>`,
          `<MEMO>${escapeOfx(`${trade.ticker} ${trade.strategy} ${leg.orderType} ${leg.type}`)}</MEMO>`,
          "</INVTRAN>",
          `<SECID><UNIQUEID>${escapeOfx(trade.ticker)}</UNIQUEID><UNIQUEIDTYPE>TICKER</UNIQUEIDTYPE></SECID>`,
          `<UNITS>${leg.quantity}</UNITS>`,
          `<UNITPRICE>${leg.premium}</UNITPRICE>`,
          `<COMMISSION>${leg.fees}</COMMISSION>`,
          `<TOTAL>${signedCashFlow(leg).toFixed(2)}</TOTAL>`,
        ].join("\n"),
      ),
    ).join("\n");
    const ofx = [
      "OFXHEADER:100",
      "DATA:OFXSGML",
      "VERSION:102",
      "SECURITY:NONE",
      "ENCODING:USASCII",
      "CHARSET:1252",
      "COMPRESSION:NONE",
      "OLDFILEUID:NONE",
      "NEWFILEUID:NONE",
      "",
      "<OFX>",
      "<INVSTMTMSGSRSV1><INVSTMTTRNRS><INVSTMTRS><INVTRANLIST>",
      transactions,
      "</INVTRANLIST></INVSTMTRS></INVSTMTTRNRS></INVSTMTMSGSRSV1>",
      "</OFX>",
    ].join("\n");
    downloadText(ofx, "gammaledger-export.ofx", "application/x-ofx");
  }

  return (
    <>
      <PageHeader title={selected ? "Edit Trade" : importMode ? "Import Trades" : "All Trades"} subtitle="List, add, edit, delete, and import trades from OFX or JSON files." />
      <section className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <button className="gl-btn-muted" onClick={() => setNotice("Merge review is not needed: imported closing legs are grouped by the backend importer.")}>Merge Trades</button>
          <button className="gl-btn-muted" onClick={() => void exportOfx()}>Export OFX</button>
          <button className="gl-btn-muted" onClick={() => void exportCsv()}>Export CSV</button>
          <button className="gl-btn-primary" onClick={() => importRef.current?.click()}>
            <FileUp className="h-4 w-4" />
            Import OFX...
          </button>
          <input ref={importRef} className="sr-only" type="file" accept=".ofx,.qfx" onChange={(event) => event.target.files?.[0] && void importOfx(event.target.files[0])} />
        </div>

        {importMode ? (
          <div className="gl-panel max-w-[860px]">
            <h2 className="mb-2 text-xl font-semibold text-text">Import Trade Activity</h2>
            <p className="mb-6 text-sm text-text-secondary">Bring in broker exports without overwriting your existing portfolio. OFX/QFX trades are parsed, grouped, and merged into the current database.</p>
            <button className="gl-btn-primary" onClick={() => importRef.current?.click()}>Import OFX...</button>
            <div className="mt-6 rounded border border-dashed border-border bg-[#fff7ea] p-5 text-sm text-text-secondary">or drag and drop support can be added here once browser file drop handling is needed.</div>
          </div>
        ) : null}

        {notice ? <div className="rounded border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-info">{notice}</div> : null}
        {saveMutation.error ? <ErrorState error={saveMutation.error} /> : null}
        {deleteMutation.error ? <ErrorState error={deleteMutation.error} /> : null}
        {ofxMutation.error ? <ErrorState error={ofxMutation.error} /> : null}

        <div className="gl-panel">
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
            <SelectBox label="Strategy" value={strategyFilter} onChange={setStrategyFilter} options={["", ...STRATEGIES]} emptyLabel="All strategies" />
            <SelectBox label="Status" value={statusFilter} onChange={setStatusFilter} options={["", ...STATUSES]} emptyLabel="All statuses" />
            <Field label="Ticker" value={tickerFilter} placeholder="Filter ticker..." onChange={(value) => setTickerFilter(value.toUpperCase())} />
          </div>
          {tradesQuery.isLoading ? <Loading /> : null}
          {tradesQuery.error ? <ErrorState error={tradesQuery.error} /> : null}
          {tradesQuery.data ? <TradeTable rows={tradesQuery.data.data} analyticsRows={contextQuery.data?.data ? [...contextQuery.data.data.activePositions, ...contextQuery.data.data.recentClosedTrades] : []} onEdit={setSelected} onDelete={(id) => deleteMutation.mutate(id)} /> : null}
        </div>

        <form ref={formRef} className="gl-panel max-w-[860px]" onSubmit={submit}>
          <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
            <h2 className="gl-section-title">{selected ? "Basic Trade Information" : "Add New Trade"}</h2>
            <button type="button" className="gl-btn-muted" onClick={() => { setSelected(null); setDraft(blankTrade()); navigate("/trades/new"); }}>
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          <TradeForm trade={draft} onChange={setDraft} locked={Boolean(selected)} />
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" className="gl-btn-muted" onClick={() => { setSelected(null); setDraft(blankTrade()); }}>Cancel</button>
            <button className="gl-btn-primary" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save Trade"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function TradeTable({ rows, analyticsRows, onEdit, onDelete }: { rows: TradeListItem[]; analyticsRows: McpTradeRow[]; onEdit: (id: string) => void; onDelete: (id: string) => void }): JSX.Element {
  if (rows.length === 0) return <Empty label="No trades found." />;
  const analyticsById = new Map(analyticsRows.map((row) => [row.id, row]));
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="gl-table min-w-[1220px] text-left">
        <thead>
          <tr>
            <th>Ticker</th><th>Strategy</th><th>Strike</th><th>Qty</th><th>Entry Date</th><th>Expiration Date</th><th>DTE</th><th>Max Risk</th><th>P&L</th><th>ROI</th><th>Annual ROI</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((trade) => (
            <TradeRow key={trade.id} trade={trade} analytics={analyticsById.get(trade.id)} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeRow({ trade, analytics, onEdit, onDelete }: { trade: TradeListItem; analytics?: McpTradeRow; onEdit: (id: string) => void; onDelete: (id: string) => void }): JSX.Element {
  return (
    <tr>
      <td><span className="gl-badge gl-badge-teal">{trade.ticker}</span></td>
      <td>{trade.strategy}</td>
      <td>{analytics?.strike ?? "—"}</td>
      <td>{analytics?.quantity ?? "—"}</td>
      <td>{analytics?.opened ?? trade.openedDate}</td>
      <td>{analytics?.expires ?? trade.closedDate ?? "—"}</td>
      <td>{analytics?.dte ?? "—"}</td>
      <td>{analytics ? (analytics.riskIsUnlimited ? "Unlimited" : money(analytics.capitalAtRisk)) : "—"}</td>
      <td className={analytics ? signedClass(analytics.pl) : ""}>{analytics ? money(analytics.pl) : "—"}</td>
      <td className={analytics ? signedClass(analytics.roi) : ""}>{analytics ? pct(analytics.roi) : "—"}</td>
      <td className={analytics ? signedClass(analytics.annualizedROI) : ""}>{analytics ? pct(analytics.annualizedROI) : "—"}</td>
      <td><StatusBadge status={trade.status} /></td>
      <td>
        <div className="flex gap-2">
          <button className="text-info" onClick={() => onEdit(trade.id)}>Edit</button>
          <button className="text-error" onClick={() => window.confirm(`Delete ${trade.ticker} ${trade.id}?`) && onDelete(trade.id)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TradeForm({ trade, onChange, locked }: { trade: TradeInput; onChange: (trade: TradeInput) => void; locked: boolean }): JSX.Element {
  const patchLeg = (index: number, patch: Partial<Leg>) => {
    const legs = trade.legs.map((leg, i) => (i === index ? { ...leg, ...patch } : leg));
    onChange(deriveDates({ ...trade, legs }));
  };
  const removeLeg = (index: number) => onChange(deriveDates({ ...trade, legs: trade.legs.filter((_, i) => i !== index) }));
  const addLeg = () => onChange(deriveDates({ ...trade, legs: [...trade.legs, blankLeg(trade.legs.length)] }));
  const closeLeg = (index: number) => {
    const leg = trade.legs[index];
    if (!leg) return;
    const orderType = leg.orderType === "BTO" ? "STC" : leg.orderType === "STO" ? "BTC" : leg.orderType;
    onChange(deriveDates({ ...trade, legs: [...trade.legs, { ...leg, id: newId(`LEG${trade.legs.length + 1}`), orderType, executionDate: today(), premium: 0, fees: 0 }] }));
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-text-secondary">Opened, expiration, and closed dates are automatically derived from leg activity.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Trade ID" value={trade.id} disabled={locked} onChange={(id) => onChange({ ...trade, id })} />
        <Field label="Ticker Symbol" value={trade.ticker} onChange={(ticker) => onChange({ ...trade, ticker: ticker.toUpperCase() })} />
        <SelectField label="Underlying Type" value={trade.underlyingType} options={UNDERLYING_TYPES} onChange={(underlyingType) => onChange({ ...trade, underlyingType, legs: trade.legs.map((leg) => ({ ...leg, underlyingType })) })} />
        <SelectField label="Strategy" value={trade.strategy} options={STRATEGIES} onChange={(strategy) => onChange({ ...trade, strategy })} />
        <SelectField label="Trade Status" value={trade.status} options={STATUSES} onChange={(status) => onChange({ ...trade, status })} />
        <Field label="Exit Reason (if closed)" value={trade.exitReason ?? ""} onChange={(exitReason) => onChange({ ...trade, exitReason })} />
      </div>
      <TextArea label="Notes" value={trade.notes ?? ""} onChange={(notes) => onChange({ ...trade, notes })} />
      <div className="border-t border-border pt-5">
        <h3 className="gl-section-title mb-3">Trade Legs</h3>
        <div className="space-y-4">
          {trade.legs.map((leg, index) => (
            <div key={leg.id} className="rounded border border-cyan-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-info">Leg {index + 1}</div>
                <div className="flex gap-2">
                  <button type="button" className="rounded bg-cyan-50 px-3 py-1 text-xs text-info" onClick={() => closeLeg(index)}>Close Leg</button>
                  <button type="button" className="rounded bg-muted px-3 py-1 text-xs text-text-secondary" onClick={() => removeLeg(index)} disabled={trade.legs.length === 1}>Remove Leg</button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Action" value={leg.orderType} options={ORDER_TYPES} onChange={(orderType) => patchLeg(index, { orderType: orderType as Leg["orderType"] })} />
                <SelectField label="Instrument" value={leg.type} options={LEG_TYPES} onChange={(type) => patchLeg(index, { type: type as Leg["type"], multiplier: defaultMultiplier(type, trade.underlyingType) })} />
                <NumberField label="Quantity" value={leg.quantity} onChange={(quantity) => patchLeg(index, { quantity })} />
                <Field label="Entry Date" type="date" value={leg.executionDate ?? ""} onChange={(executionDate) => patchLeg(index, { executionDate })} />
                <Field label="Expiration Date" type="date" value={leg.expirationDate ?? ""} onChange={(expirationDate) => patchLeg(index, { expirationDate })} />
                <NumberField label="Strike" value={leg.strike ?? 0} onChange={(strike) => patchLeg(index, { strike })} />
                <NumberField label="Premium (per share)" value={leg.premium} onChange={(premium) => patchLeg(index, { premium })} />
                <NumberField label="Fees" value={leg.fees} onChange={(fees) => patchLeg(index, { fees })} />
                <NumberField label="Multiplier" value={leg.multiplier} onChange={(multiplier) => patchLeg(index, { multiplier })} />
                <NumberField label="Entry Underlying Price" value={leg.underlyingPrice ?? 0} onChange={(underlyingPrice) => patchLeg(index, { underlyingPrice })} />
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="gl-btn-muted mt-4" onClick={addLeg}>Add Leg</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; placeholder?: string }): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="font-medium text-text">{label}</span>
      <input className="gl-input mt-1" disabled={disabled} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="font-medium text-text">{label}</span>
      <textarea className="gl-input mt-1 min-h-24" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }): JSX.Element {
  return <Field label={label} type="number" value={String(value)} onChange={(next) => onChange(Number(next) || 0)} />;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="font-medium text-text">{label}</span>
      <select className="gl-input mt-1" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SelectBox({ label, value, options, emptyLabel, onChange }: { label: string; value: string; options: string[]; emptyLabel: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-text-secondary">{label}</span>
      <select className="gl-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || "all"} value={option}>{option || emptyLabel}</option>)}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const klass = status === "Open" ? "gl-badge-green" : status === "Rolling" ? "gl-badge-blue" : status === "Assigned" ? "gl-badge-yellow" : "gl-badge-red";
  return <span className={`gl-badge ${klass}`}>{status.toUpperCase()}</span>;
}

function deriveDates(trade: TradeInput): TradeInput {
  const executions = trade.legs.map((leg) => leg.executionDate).filter(Boolean).sort() as string[];
  const expirations = trade.legs.map((leg) => leg.expirationDate).filter(Boolean).sort() as string[];
  return {
    ...trade,
    openedDate: executions[0] ?? trade.openedDate,
    expirationDate: expirations.at(-1) ?? trade.expirationDate,
  };
}

function normalizeTrade(trade: TradeInput): TradeInput {
  const normalized = deriveDates({
    ...trade,
    ticker: trade.ticker.trim().toUpperCase(),
    exitReason: trade.exitReason || null,
    notes: trade.notes || null,
    expirationDate: trade.expirationDate || null,
    closedDate: trade.closedDate || null,
    legs: trade.legs.map((leg, index) => ({
      ...leg,
      id: leg.id || newId(`LEG${index + 1}`),
      expirationDate: leg.expirationDate || null,
      executionDate: leg.executionDate || null,
      strike: leg.type === "STOCK" || leg.type === "CASH" ? null : leg.strike,
      underlyingPrice: leg.underlyingPrice || null,
      underlyingType: trade.underlyingType,
    })),
  });
  return normalized;
}

function defaultMultiplier(type: string, underlyingType: string) {
  if (type === "STOCK" || type === "CASH") return 1;
  if (underlyingType === "Future") return 50;
  return 100;
}

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function downloadText(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function signedCashFlow(leg: Leg) {
  const gross = leg.quantity * leg.multiplier * leg.premium;
  const credit = leg.orderType === "STO" || leg.orderType === "STC";
  return (credit ? gross : -gross) - leg.fees;
}

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function escapeOfx(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
