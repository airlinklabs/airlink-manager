import { Badge } from "../../ui/Badge.tsx";
import { Table } from "../../ui/Table.tsx";

type ContainerRow = { id: string; name: string; status: string; image: string };

export function ContainerList({ rows }: { rows: ContainerRow[] }) {
  return (
    <Table
      rows={rows}
      getKey={(row) => row.id}
      columns={[
        { key: "name", header: "Name", render: (row) => row.name },
        { key: "image", header: "Image", render: (row) => row.image },
        { key: "status", header: "Status", render: (row) => <Badge status={row.status === "running" ? "success" : row.status === "paused" ? "warning" : "danger"}>{row.status}</Badge> }
      ]}
    />
  );
}
