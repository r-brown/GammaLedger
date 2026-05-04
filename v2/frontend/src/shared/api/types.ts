export interface Envelope<T, M = Record<string, unknown>> {
  data: T;
  meta?: M;
}

export interface TradeListItem {
  id: string;
  ticker: string;
  strategy: string;
  status: string;
  openedDate: string;
  closedDate?: string | null;
}

export interface Leg {
  id: string;
  orderType: "BTO" | "STO" | "BTC" | "STC";
  type: "CALL" | "PUT" | "STOCK" | "CASH" | "FUTURE" | "ETF";
  quantity: number;
  multiplier: number;
  executionDate?: string | null;
  expirationDate?: string | null;
  strike?: number | null;
  premium: number;
  fees: number;
  underlyingPrice?: number | null;
  underlyingType: string;
}

export interface Trade extends TradeListItem {
  underlyingType: string;
  expirationDate?: string | null;
  exitReason?: string | null;
  notes?: string | null;
  legs: Leg[];
}

export interface TradeInput {
  id: string;
  ticker: string;
  strategy: string;
  underlyingType: string;
  status: string;
  openedDate: string;
  closedDate?: string | null;
  expirationDate?: string | null;
  exitReason?: string | null;
  maxRiskOverride?: number | null;
  statusOverride?: string | null;
  notes?: string | null;
  legs: Leg[];
}

export interface McpTradeRow {
  id: string;
  ticker: string;
  strategy: string;
  status: string;
  underlying: string;
  opened: string;
  expires?: string;
  quantity: number;
  strike?: string;
  entryPrice: number;
  pl: number;
  roi: number;
  annualizedROI: number;
  capitalAtRisk: number;
  cashFlow: number;
  fees: number;
  daysHeld: number;
  dte?: number;
  wheelCoverage?: string;
  lifecycleStatus?: string;
  riskIsUnlimited?: boolean;
}

export interface WheelPmccPosition {
  id: string;
  ticker: string;
  strategy: string;
  type: string;
  status: string;
  opened: string;
  assignedOn?: string;
  shares: number;
  strike: number;
  costBasis: number;
  costBasisPerShare: number;
  effectiveCostBasis: number;
  premiumCollected: number;
  coverageStatus: string;
  wheelCoverage?: string;
  lifecycleStatus?: string;
  coveredShares: number;
  uncoveredShares: number;
  activeShortCalls: number;
}

export interface StrategyBreakdown {
  strategy: string;
  total: number;
  closed: number;
  wins: number;
  totalPL: number;
  winRate: number;
  avgPL: number;
}

export interface TickerExposure {
  ticker: string;
  totalPL: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPL: number;
}

export interface PortfolioSummary {
  counts: {
    totalTrades: number;
    closed: number;
    active: number;
    assigned: number;
    awaitingCoverage?: number;
  };
  pl: Record<string, number>;
  performance: Record<string, number | string | null | Record<string, unknown>>;
  risk: Record<string, number>;
  fees: Record<string, number>;
  trading: Record<string, number | string | null | Record<string, unknown>>;
  largestWinner?: { id: string; ticker: string; strategy: string; pl: number; roi: number };
  largestLoser?: { id: string; ticker: string; strategy: string; pl: number; roi: number };
}

export interface McpContext {
  asOfDate: string;
  portfolio: PortfolioSummary;
  strategyBreakdown: StrategyBreakdown[];
  underlyingBreakdown: Array<{ type: string; count: number; totalPL: number; capitalAtRisk: number }>;
  dteDistribution: Record<string, number>;
  concentration: Array<{
    id: string;
    ticker: string;
    strategy: string;
    capitalAtRisk: number;
    sharePct: number;
  }>;
  activePositions: McpTradeRow[];
  wheelPmccPositions: WheelPmccPosition[];
  tickerExposure: TickerExposure[];
  recentClosedTrades: McpTradeRow[];
}

export interface TradesMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIResponse {
  message: string;
  provider: "local" | "gemini";
  externalCall: boolean;
  featureFlags: {
    externalCallsEnabled: boolean;
    geminiConfigured: boolean;
  };
}

export interface AuthFeatures {
  authEnabled: boolean;
  localMode: boolean;
  localUserId: string;
  accessTokenMinutes: number;
  refreshTokenDays: number;
  oauthProviders: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  isVerified?: boolean;
  isActive?: boolean;
  isLocal?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  expiresIn: number;
  user: AuthUser;
}

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  domain?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  plan: string;
  settings: Record<string, unknown>;
  resolvedFrom: string;
}

export interface FeatureFlag {
  featureName: string;
  enabled: boolean;
  limitValue?: number | null;
}

export interface UsageEvent {
  feature: string;
  count: number;
  period: string;
  limitValue?: number | null;
}
