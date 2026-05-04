import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  Database,
  Gauge,
  Import,
  ListOrdered,
  Music2,
  Plus,
  Settings,
  Shield,
  Target,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";

const nav = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/trades", label: "Trades", icon: ListOrdered },
  { to: "/positions", label: "Positions", icon: BriefcaseBusiness },
  { to: "/wheel", label: "Wheel", icon: Target },
  { to: "/trades/new", label: "Add", icon: Plus },
  { to: "/trades/import", label: "Import", icon: Import },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai", label: "AI", icon: Bot },
  { to: "/auth", label: "Auth", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell(): JSX.Element {
  return (
    <div className="min-h-full bg-background pb-24 md:pb-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[54px] border-r border-border bg-surface md:flex md:flex-col md:items-center">
        <div className="flex h-[72px] w-full flex-col items-center justify-center gap-1 border-b border-border">
          <Music2 className="h-6 w-6 text-primary" />
          <span className="text-[13px] font-bold text-primary">GL</span>
        </div>
        <nav className="flex w-full flex-1 flex-col items-center gap-3 py-5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={`${to}-${label}`}
              to={to}
              title={label}
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition ${
                  isActive && label !== "Add" && label !== "Import"
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-action)]"
                    : "text-text-secondary hover:bg-background hover:text-text"
                }`
              }
            >
              <Icon className="h-4 w-4" />
            </NavLink>
          ))}
        </nav>
        <button className="mb-6 flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex h-[54px] w-full items-center justify-center border-t border-border">
          <Music2 className="h-5 w-5 text-primary" />
        </div>
      </aside>

      <main className="px-4 py-0 md:ml-[54px] md:px-8">
        <Outlet />
      </main>

      <AICoachButton />

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface md:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={`${to}-${label}-mobile`}
            to={to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${
                isActive ? "text-primary" : "text-text-secondary"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <header className="-mx-4 mb-8 border-b border-border bg-surface px-4 py-5 md:-mx-8 md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-normal text-text">{title}</h1>
          <button className="mt-4 inline-flex items-center gap-3 text-sm text-text-secondary" onClick={() => void sharePortfolioSnapshot()}>
            <span className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-text-secondary">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
            Share your portfolio snapshot
          </button>
          <p className="sr-only">{subtitle}</p>
        </div>
        <DatabaseControls />
      </div>
    </header>
  );
}

function DatabaseControls(): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState(() => localStorage.getItem("GammaLedgerCurrentFileName") || "gammaledger.json");
  const [message, setMessage] = useState("");

  async function refreshApp() {
    await queryClient.invalidateQueries();
    navigate("/");
  }

  async function newDatabase() {
    const ok = window.confirm("Create a new empty GammaLedger database? This deletes all trades in the current local backend database.");
    if (!ok) return;
    const existing = await api.trades("?limit=500");
    if (existing.data.length) {
      await api.bulkDeleteTrades(existing.data.map((trade) => trade.id));
    }
    const nextName = "gammaledger.json";
    localStorage.setItem("GammaLedgerCurrentFileName", nextName);
    setFileName(nextName);
    setMessage("New empty database");
    await refreshApp();
  }

  async function loadDatabase(file: File) {
    const text = await file.text();
    const payload = JSON.parse(text) as unknown;
    if (payload && typeof payload === "object" && "settings" in payload) {
      localStorage.setItem("GammaLedgerV2Settings", JSON.stringify((payload as { settings: unknown }).settings));
    }
    const result = await api.migrateJson(payload);
    localStorage.setItem("GammaLedgerCurrentFileName", file.name);
    setFileName(file.name);
    setMessage(`Loaded ${result.data.imported + result.data.replaced} trades`);
    await refreshApp();
  }

  async function saveDatabase() {
    const list = await api.trades("?limit=500");
    const details = await Promise.all(list.data.map((trade) => api.trade(trade.id).then((response) => response.data)));
    const context = await api.context().then((response) => response.data);
    downloadJson(
      {
        version: "2.0",
        exportDate: new Date().toISOString(),
        fileName,
        settings: JSON.parse(localStorage.getItem("GammaLedgerV2Settings") || "{}") as unknown,
        trades: details,
        mcpContext: context,
      },
      fileName || "gammaledger.json",
    );
    setMessage("Database exported");
  }

  return (
    <div className="flex flex-wrap items-start gap-2 lg:justify-end">
      <button className="gl-btn-muted" onClick={() => void newDatabase()}>
        <Database className="h-3.5 w-3.5" />
        New Database
      </button>
      <button className="gl-btn-muted" onClick={() => fileRef.current?.click()}>Load Database</button>
      <button className="gl-btn-primary" onClick={() => void saveDatabase()}>Save Database</button>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        onChange={(event) => event.target.files?.[0] && void loadDatabase(event.target.files[0])}
      />
      <div className="w-full text-right text-xs text-text-secondary">{message || fileName}</div>
    </div>
  );
}

function downloadJson(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function sharePortfolioSnapshot() {
  const context = await api.context().then((response) => response.data);
  const portfolio = context.portfolio;
  const lines = [
    "GammaLedger Portfolio Snapshot",
    `As of: ${context.asOfDate}`,
    `Total trades: ${portfolio.counts.totalTrades}`,
    `Active positions: ${portfolio.counts.active}`,
    `Realized P&L: ${String(portfolio.pl.realized ?? portfolio.pl.total ?? 0)}`,
    `Unrealized P&L: ${String(portfolio.pl.unrealized ?? 0)}`,
    `Collateral at risk: ${String(portfolio.risk.collateralAtRisk ?? 0)}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gammaledger-portfolio-snapshot.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

function AICoachButton(): JSX.Element {
  return (
    <NavLink
      to="/ai"
      className="fixed bottom-6 right-6 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-action)]"
    >
      <Bot className="h-4 w-4" />
      AI Coach
    </NavLink>
  );
}
