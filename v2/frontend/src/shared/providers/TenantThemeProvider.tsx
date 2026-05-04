import { useQuery } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { api } from "@/shared/api/client";

export function TenantThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const tenant = useQuery({
    queryKey: ["tenant-config"],
    queryFn: api.tenantConfig,
    staleTime: 300_000,
  });

  useEffect(() => {
    const config = tenant.data?.data;
    if (!config) return;

    const root = document.documentElement;
    root.style.setProperty("--color-primary", config.primaryColor);
    root.style.setProperty("--color-brand-purple", config.primaryColor);
    root.style.setProperty("--color-info", config.secondaryColor);
    root.style.setProperty("--font-body", config.fontFamily);
    document.title = config.name;

    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon && config.logoUrl) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    if (favicon && config.logoUrl) favicon.href = config.logoUrl;
  }, [tenant.data]);

  return <>{children}</>;
}
