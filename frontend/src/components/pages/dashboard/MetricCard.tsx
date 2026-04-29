import { Card } from "../../ui/Card.tsx";
import { Progress } from "../../ui/Progress.tsx";

export function MetricCard({ label, value, detail, percent }: { label: string; value: string; detail: string; percent?: number }) {
  return (
    <Card interactive>
      <p className="text-xs font-medium uppercase text-[var(--theme-text-muted)]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-[var(--theme-text-primary)]">{value}</p>
        <p className="text-xs text-[var(--theme-text-body)]">{detail}</p>
      </div>
      {percent !== undefined ? <div className="mt-3"><Progress value={percent} /></div> : null}
    </Card>
  );
}
