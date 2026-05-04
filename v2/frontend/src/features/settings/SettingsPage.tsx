import { type ReactNode, useEffect, useState } from "react";
import { PageHeader } from "@/shared/layout/AppShell";

interface SettingsState {
  profileName: string;
  portfolioName: string;
  baseCurrency: string;
  theme: "system" | "light" | "dark";
  defaultFee: string;
  finnhubRateLimit: string;
  finnhubApiKey: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiMaxTokens: string;
  aiConsent: boolean;
  disclaimerAccepted: boolean;
}

const storageKey = "GammaLedgerV2Settings";

const defaults: SettingsState = {
  profileName: "Local Trader",
  portfolioName: "GammaLedger Portfolio",
  baseCurrency: "USD",
  theme: "system",
  defaultFee: "0.65",
  finnhubRateLimit: "60",
  finnhubApiKey: "",
  geminiApiKey: "",
  geminiModel: "Gemini 2.5 Flash",
  geminiMaxTokens: "65536",
  aiConsent: false,
  disclaimerAccepted: false,
};

export function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<SettingsState>(() => {
    const raw = localStorage.getItem(storageKey);
    return raw ? { ...defaults, ...JSON.parse(raw) } as SettingsState : defaults;
  });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    document.documentElement.dataset.colorScheme = settings.theme === "system" ? "" : settings.theme;
  }, [settings]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Local preferences for display, defaults, quotes, and AI consent." />
      <section className="mx-auto max-w-[720px] space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Profile & Portfolio</h2>
          <p className="mt-1 text-sm text-text-secondary">Create and manage the local profile metadata used by this portfolio.</p>
        </div>
        <SettingsPanel title="Local Profile" subtitle="Stored in this browser and included when exporting your database.">
          <Field label="Profile Name" value={settings.profileName} onChange={(profileName) => setSettings({ ...settings, profileName })} action="Save" />
          <Field label="Portfolio Name" value={settings.portfolioName} onChange={(portfolioName) => setSettings({ ...settings, portfolioName })} action="Save" />
          <label className="mt-4 block text-sm font-semibold">
            Base Currency
            <select className="gl-input mt-2" value={settings.baseCurrency} onChange={(event) => setSettings({ ...settings, baseCurrency: event.target.value })}>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>CAD</option>
            </select>
          </label>
          <div className="mt-3 rounded bg-cyan-50 px-3 py-2 text-sm text-info">{settings.profileName} / {settings.portfolioName}</div>
        </SettingsPanel>

        <div>
          <h2 className="text-2xl font-semibold">Integration Settings</h2>
          <p className="mt-1 text-sm text-text-secondary">Manage live data connections and other preferences that stay on this device.</p>
        </div>
        <SettingsPanel title="Finnhub API Key" subtitle="We encrypt your key locally before storing it in this browser.">
          <SecretField label="API Key" value={settings.finnhubApiKey} onChange={(finnhubApiKey) => setSettings({ ...settings, finnhubApiKey })} action="Save Key" />
          <p className="mt-2 text-xs text-text-secondary">The key never leaves your machine. Clearing browser storage will remove it.</p>
          <div className="mt-3 rounded bg-cyan-50 px-3 py-2 text-sm text-info">{settings.finnhubApiKey ? "API key loaded" : "No API key stored"}</div>
          <Divider />
          <Field label="Rate Limit (requests per minute)" value={settings.finnhubRateLimit} onChange={(finnhubRateLimit) => setSettings({ ...settings, finnhubRateLimit })} action="Save" />
          <p className="mt-2 text-xs text-text-secondary">Free Finnhub accounts are limited to 60 requests/minute. Adjust if you have a paid plan.</p>
          <div className="mt-3 rounded bg-cyan-50 px-3 py-2 text-sm text-info">Custom: {settings.finnhubRateLimit}/min</div>
        </SettingsPanel>

        <SettingsPanel title="Gemini API" subtitle="Store a Google Gemini-compatible API key to enable AI portfolio insights.">
          <SecretField label="API Key" value={settings.geminiApiKey} onChange={(geminiApiKey) => setSettings({ ...settings, geminiApiKey })} action="Save Key" secondaryAction="Clear" onSecondary={() => setSettings({ ...settings, geminiApiKey: "" })} />
          <label className="mt-4 block text-sm font-semibold">
            Model
            <select className="gl-input mt-2" value={settings.geminiModel} onChange={(event) => setSettings({ ...settings, geminiModel: event.target.value })}>
              <option>Gemini 2.5 Flash</option>
              <option>Gemini 2.5 Flash Lite</option>
              <option>Gemini 2.5 Pro</option>
            </select>
          </label>
          <p className="mt-3 text-xs text-text-secondary">Keys stay on this device. Use Google AI Studio or any compatible service exposing the Gemini generateContent API.</p>
          <div className="mt-3 rounded bg-cyan-50 px-3 py-2 text-sm text-info">{settings.geminiApiKey ? "API key loaded" : "No API key stored"}</div>
          <Divider />
          <Field label="Max Output Tokens" value={settings.geminiMaxTokens} onChange={(geminiMaxTokens) => setSettings({ ...settings, geminiMaxTokens })} action="Save" secondaryAction="Reset" onSecondary={() => setSettings({ ...settings, geminiMaxTokens: defaults.geminiMaxTokens })} />
          <p className="mt-2 text-xs text-text-secondary">Maximum tokens for AI responses. Higher values allow longer responses but may increase cost.</p>
          <div className="mt-3 rounded bg-[#eeeeea] px-3 py-2 text-sm text-text-secondary">Default: 65,536</div>
        </SettingsPanel>

        <div>
          <h2 className="text-2xl font-semibold">Trade Entry Defaults</h2>
          <p className="mt-1 text-sm text-text-secondary">Set default values to speed up manual trade entry.</p>
        </div>
        <SettingsPanel title="Default Fee Per Contract" subtitle="Automatically apply this fee when adding new trade legs.">
          <Field label="Fee Per Contract" value={settings.defaultFee} onChange={(defaultFee) => setSettings({ ...settings, defaultFee })} action="Save" secondaryAction="Clear" />
          <p className="mt-2 text-xs text-text-secondary">Enter the fee charged per contract. This will be multiplied by the quantity when adding new legs.</p>
          <div className="mt-3 rounded bg-[#eeeeea] px-3 py-2 text-sm text-text-secondary">{settings.defaultFee ? `Default: ${settings.defaultFee}` : "Not set"}</div>
        </SettingsPanel>

        <SettingsPanel title="Appearance & Consent" subtitle="Local display and acknowledgement preferences.">
          <Segmented
            value={settings.theme}
            options={["system", "light", "dark"]}
            onChange={(theme) => setSettings({ ...settings, theme: theme as SettingsState["theme"] })}
          />
          <div className="mt-4">
            <Toggle label="Financial disclaimer accepted" checked={settings.disclaimerAccepted} onChange={(disclaimerAccepted) => setSettings({ ...settings, disclaimerAccepted })} />
            <Toggle label="AI coach consent" checked={settings.aiConsent} onChange={(aiConsent) => setSettings({ ...settings, aiConsent })} />
          </div>
        </SettingsPanel>
      </section>
    </>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }): JSX.Element {
  return (
    <div className="grid grid-cols-3 rounded border border-border bg-background p-1">
      {options.map((option) => (
        <button key={option} className={`min-h-10 rounded text-sm capitalize ${value === option ? "bg-primary text-primary-foreground" : "text-text-secondary"}`} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, action, secondaryAction, onSecondary }: { label: string; value: string; onChange: (value: string) => void; action?: string; secondaryAction?: string; onSecondary?: () => void }): JSX.Element {
  return (
    <label className="mb-3 block text-sm">
      <span className="font-semibold text-text">{label}</span>
      <div className="mt-2 flex gap-2">
        <input className="gl-input" value={value} onChange={(event) => onChange(event.target.value)} />
        {action ? <button type="button" className="gl-btn-primary shrink-0">{action}</button> : null}
        {secondaryAction ? <button type="button" className="gl-btn-muted shrink-0" onClick={onSecondary}>{secondaryAction}</button> : null}
      </div>
    </label>
  );
}

function SecretField({ label, value, onChange, action, secondaryAction, onSecondary }: { label: string; value: string; onChange: (value: string) => void; action?: string; secondaryAction?: string; onSecondary?: () => void }): JSX.Element {
  return (
    <label className="mb-3 block text-sm">
      <span className="font-semibold text-text">{label}</span>
      <div className="mt-2 flex gap-2">
        <input className="gl-input" type="password" value={value} placeholder="Paste API key" onChange={(event) => onChange(event.target.value)} />
        {action ? <button type="button" className="gl-btn-primary shrink-0">{action}</button> : null}
        {secondaryAction ? <button type="button" className="gl-btn-muted shrink-0" onClick={onSecondary}>{secondaryAction}</button> : null}
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return (
    <label className="mb-3 flex min-h-11 items-center justify-between gap-4 rounded border border-border bg-background p-3 text-sm">
      <span>{label}</span>
      <input className="h-5 w-5" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SettingsPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }): JSX.Element {
  return (
    <section className="gl-panel">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Divider(): JSX.Element {
  return <div className="my-6 border-t border-border" />;
}
