import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../../ui/Card.tsx";

type Point = { ts: string; value: number };

export function MetricChart({ title, data }: { title: string; data: Point[] }) {
  return (
    <Card header={<h2 className="text-sm font-semibold">{title}</h2>}>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="ts" hide />
            <YAxis width={32} domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--theme-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
