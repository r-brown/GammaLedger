export function Loading({ label = "Loading..." }: { label?: string }): JSX.Element {
  return <div className="rounded border border-border bg-surface p-4 text-sm text-text-secondary">{label}</div>;
}

export function ErrorState({ error }: { error: unknown }): JSX.Element {
  return (
    <div className="rounded border border-error/40 bg-surface p-4 text-sm text-error">
      {error instanceof Error ? error.message : "Request failed"}
    </div>
  );
}

export function Empty({ label }: { label: string }): JSX.Element {
  return <div className="rounded border border-border bg-surface p-6 text-sm text-text-secondary">{label}</div>;
}
