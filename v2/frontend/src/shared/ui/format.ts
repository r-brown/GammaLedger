export function money(value: number | undefined | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function pct(value: number | undefined | null): string {
  return `${(value ?? 0).toFixed(2)}%`;
}

export function number(value: number | undefined | null): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function signedClass(value: number | undefined | null): string {
  const n = value ?? 0;
  if (n > 0) return "text-success";
  if (n < 0) return "text-error";
  return "text-text-secondary";
}
