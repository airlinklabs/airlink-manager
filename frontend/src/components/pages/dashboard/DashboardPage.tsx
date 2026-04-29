import { motion } from "framer-motion";
import { Activity, Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import { useMemo } from "react";
import { useHealth } from "../../../api/metrics.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { formatDuration } from "../../../lib/format.ts";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { Table } from "../../ui/Table.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";
import { MetricCard } from "./MetricCard.tsx";
import { MetricChart } from "./MetricChart.tsx";

export function DashboardPage() {
  const health = useHealth();
  const chartData = useMemo(
    () => Array.from({ length: 24 }, (_, index) => ({ ts: String(index), value: Math.round(30 + Math.sin(index / 2) * 12 + index / 3) })),
    []
  );

  if (health.isLoading) {
    return <Skeleton className="h-96" />;
  }
  if (health.isError) {
    return <EmptyState icon={Activity} title="Dashboard unavailable" message="Health endpoint did not respond." action={{ label: "Retry", onClick: () => void health.refetch() }} />;
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Dashboard" description="Live host status, resource pressure, and platform health." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="CPU" value="0%" detail="waiting" percent={0} />
        <MetricCard label="Memory" value="0 B" detail="available" percent={0} />
        <MetricCard label="Disk" value="0 B" detail="used" percent={0} />
        <MetricCard label="Uptime" value={formatDuration(health.data?.uptime ?? 0)} detail={`v${health.data?.version ?? "1.0.0"}`} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <MetricChart title="CPU History" data={chartData} />
        <MetricChart title="Memory History" data={chartData.map((item) => ({ ...item, value: Math.max(0, item.value - 10) }))} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card header={<h2 className="text-sm font-semibold">Top Processes</h2>}>
          <Table
            rows={[] as { pid: number; name: string; cpu: string }[]}
            getKey={(row) => String(row.pid)}
            columns={[
              { key: "pid", header: "PID", render: (row) => row.pid },
              { key: "name", header: "Name", render: (row) => row.name },
              { key: "cpu", header: "CPU", render: (row) => row.cpu }
            ]}
          />
        </Card>
        <Card header={<h2 className="text-sm font-semibold">Features</h2>}>
          <div className="space-y-3">
            <Feature label="Docker" enabled={Boolean(health.data?.features.docker)} />
            <Feature label="systemd" enabled={Boolean(health.data?.features.systemd)} />
            <Feature label="AccountsService" enabled={Boolean(health.data?.features.accountsService)} />
            <Feature label="Shadow Read" enabled={Boolean(health.data?.features.shadowReadable)} />
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function Feature({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm">
        <Server className="h-4 w-4 text-[var(--theme-text-muted)]" />
        {label}
      </span>
      <Badge status={enabled ? "success" : "warning"}>{enabled ? "Available" : "Unavailable"}</Badge>
    </div>
  );
}
