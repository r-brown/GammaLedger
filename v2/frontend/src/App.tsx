import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/shared/layout/AppShell";
import { TenantThemeProvider } from "@/shared/providers/TenantThemeProvider";
import { Loading } from "@/shared/ui/State";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const TradesPage = lazy(() => import("@/features/trades/TradesPage").then((m) => ({ default: m.TradesPage })));
const PositionsPage = lazy(() => import("@/features/positions/PositionsPage").then((m) => ({ default: m.PositionsPage })));
const WheelPage = lazy(() => import("@/features/wheel/WheelPage").then((m) => ({ default: m.WheelPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const AIAssistantPage = lazy(() => import("@/features/ai/AIAssistantPage").then((m) => ({ default: m.AIAssistantPage })));
const AuthPage = lazy(() => import("@/features/auth/AuthPage").then((m) => ({ default: m.AuthPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TenantThemeProvider>
          <Suspense fallback={<main className="p-4"><Loading /></main>}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/trades" element={<TradesPage />} />
                <Route path="/trades/new" element={<TradesPage />} />
                <Route path="/trades/import" element={<TradesPage />} />
                <Route path="/positions" element={<PositionsPage />} />
                <Route path="/wheel" element={<WheelPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/ai" element={<AIAssistantPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </TenantThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
