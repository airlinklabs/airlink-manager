import { Card } from "../../ui/Card.tsx";

export function ContainerDetail() {
  return (
    <Card header={<h2 className="text-sm font-semibold">Container Detail</h2>}>
      <pre className="overflow-auto rounded-lg bg-[var(--theme-bg-input)] p-3 text-xs text-[var(--theme-text-body)]">{JSON.stringify({ inspect: null }, null, 2)}</pre>
    </Card>
  );
}
