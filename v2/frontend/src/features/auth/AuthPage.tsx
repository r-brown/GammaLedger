import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Github, KeyRound, LogIn, MailCheck, Shield, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, clearTokens, hasAccessToken } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/layout/AppShell";
import { Empty, ErrorState, Loading } from "@/shared/ui/State";

type Mode = "login" | "register" | "verify";

export function AuthPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  const features = useQuery({ queryKey: ["auth-features"], queryFn: api.authFeatures });
  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: api.me,
    enabled: hasAccessToken() || features.data?.data.localMode,
    retry: false,
  });
  const login = useMutation({
    mutationFn: api.login,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-me"] }),
  });
  const register = useMutation({
    mutationFn: api.register,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-me"] }),
  });
  const verify = useMutation({ mutationFn: api.verifyEmail });

  if (features.isLoading) return <Loading />;
  if (features.isError) return <ErrorState error={features.error} />;

  const authFeatures = features.data?.data;

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    if (mode === "login") login.mutate({ email, password });
    if (mode === "register") register.mutate({ email, password, displayName });
    if (mode === "verify") verify.mutate({ email, token: verifyToken || undefined });
  }

  function logout(): void {
    api.logout().finally(() => {
      clearTokens();
      queryClient.removeQueries({ queryKey: ["auth-me"] });
      queryClient.invalidateQueries({ queryKey: ["auth-features"] });
    });
  }

  const pending = login.isPending || register.isPending || verify.isPending;
  const error = login.error || register.error || verify.error;

  return (
    <section>
      <PageHeader
        title="Auth"
        subtitle="Hosted login, registration, email verification, and local-mode bypass controls."
      />

      {authFeatures?.localMode ? (
        <Empty label={`Local mode: AUTH_ENABLED=false, so API requests run as ${authFeatures.localUserId} without login.`} />
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={onSubmit} className="rounded border border-border bg-surface p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <ModeButton active={mode === "login"} onClick={() => setMode("login")} icon={LogIn} label="Login" />
            <ModeButton
              active={mode === "register"}
              onClick={() => setMode("register")}
              icon={UserPlus}
              label="Register"
            />
            <ModeButton
              active={mode === "verify"}
              onClick={() => setMode("verify")}
              icon={MailCheck}
              label="Verify"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Email
              <input
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>
            {mode === "register" ? (
              <label className="text-sm font-medium">
                Display name
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            ) : null}
            {mode !== "verify" ? (
              <label className="text-sm font-medium">
                Password
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
              </label>
            ) : (
              <label className="text-sm font-medium">
                Verification token
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  value={verifyToken}
                  onChange={(event) => setVerifyToken(event.target.value)}
                  placeholder="Optional in scaffold"
                />
              </label>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || authFeatures?.localMode}>
              {mode === "login" ? <LogIn className="h-4 w-4" /> : null}
              {mode === "register" ? <UserPlus className="h-4 w-4" /> : null}
              {mode === "verify" ? <MailCheck className="h-4 w-4" /> : null}
              {mode === "login" ? "Login" : mode === "register" ? "Register" : "Verify"}
            </Button>
            <Button type="button" variant="outline" onClick={logout}>
              <KeyRound className="h-4 w-4" />
              Clear session
            </Button>
            {error ? <span className="text-sm text-error">{(error as Error).message}</span> : null}
            {verify.isSuccess ? <span className="text-sm text-success">Email marked verified.</span> : null}
          </div>
        </form>

        <aside className="rounded border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            Session
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Auth enabled" value={String(authFeatures?.authEnabled)} />
            <Row label="Local user" value={authFeatures?.localUserId ?? "-"} />
            <Row label="Access TTL" value={`${authFeatures?.accessTokenMinutes ?? 0}m`} />
            <Row label="Refresh TTL" value={`${authFeatures?.refreshTokenDays ?? 0}d`} />
            <Row label="Current user" value={me.data?.data.email ?? "Not signed in"} />
          </dl>
          <div className="mt-4 grid gap-2">
            {(authFeatures?.oauthProviders ?? []).map((provider) => (
              <Button key={provider} type="button" variant="outline" disabled>
                {provider === "github" ? <Github className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {provider}
              </Button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LogIn;
  label: string;
}): JSX.Element {
  return (
    <Button type="button" variant={active ? "default" : "outline"} onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
