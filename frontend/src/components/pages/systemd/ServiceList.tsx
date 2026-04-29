import { Badge } from "../../ui/Badge.tsx";
import { Table } from "../../ui/Table.tsx";

type Service = { name: string; load: string; active: string; sub: string };

export function ServiceList({ rows }: { rows: Service[] }) {
  return (
    <Table
      rows={rows}
      getKey={(row) => row.name}
      columns={[
        { key: "name", header: "Service", render: (row) => row.name },
        { key: "load", header: "Load", render: (row) => row.load },
        { key: "active", header: "Active", render: (row) => <Badge status={row.active === "active" ? "success" : "danger"}>{row.active}</Badge> },
        { key: "sub", header: "Sub", render: (row) => row.sub }
      ]}
    />
  );
}
