import type {
  Envelope,
  AuthFeatures,
  AuthTokens,
  AuthUser,
  FeatureFlag,
  AIMessage,
  AIResponse,
  McpContext,
  McpTradeRow,
  PortfolioSummary,
  StrategyBreakdown,
  TickerExposure,
  TenantConfig,
  Trade,
  TradeInput,
  TradeListItem,
  TradesMeta,
  UsageEvent,
  WheelPmccPosition,
} from "./types";

export const AUTH_ACCESS_TOKEN_KEY = "GammaLedgerAuthAccessToken";
export const AUTH_REFRESH_TOKEN_KEY = "GammaLedgerAuthRefreshToken";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  authFeatures: () => request<Envelope<AuthFeatures>>("/api/v1/auth/features"),
  tenantConfig: () => request<Envelope<TenantConfig>>("/api/v1/tenant/config"),
  resolveTenant: (domain: string) =>
    request<Envelope<TenantConfig>>(`/api/v1/tenant/resolve?domain=${encodeURIComponent(domain)}`),
  features: () => request<Envelope<FeatureFlag[]>>("/api/v1/features"),
  usage: (period?: string) =>
    request<Envelope<UsageEvent[], { period: string }>>(
      `/api/v1/usage${period ? `?period=${encodeURIComponent(period)}` : ""}`,
    ),
  me: () => request<Envelope<AuthUser>>("/api/v1/auth/me"),
  register: (payload: { email: string; password: string; displayName?: string }) =>
    request<Envelope<AuthTokens>>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(storeTokens),
  login: (payload: { email: string; password: string }) =>
    request<Envelope<AuthTokens>>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(storeTokens),
  verifyEmail: (payload: { email: string; token?: string }) =>
    request<Envelope<AuthUser>>("/api/v1/auth/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => {
    const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
    clearTokens();
    if (!refreshToken) return Promise.resolve();
    return request<void>("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },
  trades: (params = "") => request<Envelope<TradeListItem[], TradesMeta>>(`/api/v1/trades${params}`),
  trade: (id: string) => request<Envelope<Trade>>(`/api/v1/trades/${id}`),
  createTrade: (payload: TradeInput) =>
    request<Envelope<Trade>>("/api/v1/trades", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTrade: (id: string, payload: Partial<TradeInput>) =>
    request<Envelope<Trade>>(`/api/v1/trades/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteTrade: (id: string) => request<void>(`/api/v1/trades/${id}`, { method: "DELETE" }),
  bulkDeleteTrades: (ids: string[]) =>
    request<Envelope<{ requested: number; deleted: number; missing: string[] }>>("/api/v1/trades/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  importOfx: (content: string) =>
    request<Envelope<{ imported: number; replaced: number; skipped: number; errors: string[]; message: string }>>(
      "/api/v1/trades/import/ofx",
      {
        method: "POST",
        body: content,
        headers: { "content-type": "text/plain" },
      },
    ),
  migrateJson: (payload: unknown) =>
    request<Envelope<{ imported: number; replaced: number; skipped: number; errors: string[] }>>(
      "/api/v1/migrate",
      { method: "POST", body: JSON.stringify(payload) },
    ),
  context: (asOf = today()) => request<Envelope<McpContext>>(`/api/v1/analytics/mcp-context?as_of=${asOf}`),
  portfolio: (asOf = today()) =>
    request<Envelope<PortfolioSummary>>(`/api/v1/analytics/portfolio-summary?as_of=${asOf}`),
  tickerExposure: (asOf = today()) =>
    request<Envelope<TickerExposure[]>>(`/api/v1/analytics/ticker-exposure?as_of=${asOf}`),
  strategyBreakdown: (asOf = today()) =>
    request<Envelope<StrategyBreakdown[]>>(`/api/v1/strategies/breakdown?as_of=${asOf}`),
  openPositions: (asOf = today()) =>
    request<Envelope<McpTradeRow[]>>(`/api/v1/positions/open?as_of=${asOf}`),
  expiringPositions: (asOf = today(), withinDays = 30) =>
    request<Envelope<McpTradeRow[]>>(`/api/v1/positions/expiring?as_of=${asOf}&within_days=${withinDays}`),
  positionDetail: (id: string, asOf = today()) =>
    request<Envelope<{ trade: Trade; context: McpContext }>>(`/api/v1/positions/${id}?as_of=${asOf}`),
  wheelPmcc: (asOf = today()) =>
    request<Envelope<WheelPmccPosition[]>>(`/api/v1/strategies/wheel-pmcc?as_of=${asOf}`),
  cspGroups: (asOf = today()) =>
    request<Envelope<Array<{ ticker: string; count: number; capitalAtRisk: number; openPositions: McpTradeRow[] }>>>(
      `/api/v1/strategies/csp-groups?as_of=${asOf}`,
    ),
  pnlSummary: (asOf = today()) => request<Envelope<Record<string, number>>>(`/api/v1/pnl/summary?as_of=${asOf}`),
  aiFeatures: () => request<Envelope<AIResponse["featureFlags"]>>("/api/v1/ai/features"),
  aiChat: (message: string, history: AIMessage[], asOf = today()) =>
    request<Envelope<AIResponse>>("/api/v1/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, history, asOf }),
    }),
  tradeAnalysis: (tradeId: string, prompt?: string, asOf = today()) =>
    request<Envelope<AIResponse>>(`/api/v1/ai/trades/${tradeId}/analysis`, {
      method: "POST",
      body: JSON.stringify({ prompt, asOf }),
    }),
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function storeTokens(response: Envelope<AuthTokens>): Envelope<AuthTokens> {
  localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, response.data.accessToken);
  localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, response.data.refreshToken);
  return response;
}

export function clearTokens(): void {
  localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
}

export function hasAccessToken(): boolean {
  return Boolean(localStorage.getItem(AUTH_ACCESS_TOKEN_KEY));
}
