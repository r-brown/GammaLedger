import { money } from "./format";

interface BarDatum {
  label: string;
  value: number;
}

export function Bars({ data, valueLabel = money }: { data: BarDatum[]; valueLabel?: (value: number) => string }): JSX.Element {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[88px_1fr_90px] items-center gap-3 text-sm">
          <span className="truncate text-text-secondary">{item.label}</span>
          <div className="h-5 overflow-hidden rounded-sm bg-border">
            <div
              className={item.value >= 0 ? "h-full bg-[#29b7c6]" : "h-full bg-error"}
              style={{ width: `${Math.max(4, (Math.abs(item.value) / max) * 100)}%` }}
            />
          </div>
          <span className="text-right font-medium">{valueLabel(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniLine({ values }: { values: number[] }): JSX.Element {
  const width = 520;
  const height = 180;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="h-48 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="P&L trend">
      <defs>
        <linearGradient id="gl-line-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#29b7c6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#29b7c6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0,${height} L${points.replaceAll(" ", " L")} L${width},${height} Z`} fill="url(#gl-line-fill)" />
      {Array.from({ length: 8 }).map((_, index) => (
        <line key={index} x1="0" x2={width} y1={(index / 7) * height} y2={(index / 7) * height} stroke="var(--color-border)" strokeOpacity="0.55" />
      ))}
      <line x1="0" x2={width} y1={height - ((0 - min) / range) * height} y2={height - ((0 - min) / range) * height} stroke="var(--color-border)" />
      <polyline fill="none" points={points} stroke="#29b7c6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
