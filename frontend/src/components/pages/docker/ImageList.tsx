import { Table } from "../../ui/Table.tsx";
import { formatBytes } from "../../../lib/format.ts";

type ImageRow = { id: string; repository: string; tag: string; size: number };

export function ImageList({ rows }: { rows: ImageRow[] }) {
  return (
    <Table
      rows={rows}
      getKey={(row) => row.id}
      columns={[
        { key: "repository", header: "Repository", render: (row) => row.repository },
        { key: "tag", header: "Tag", render: (row) => row.tag },
        { key: "size", header: "Size", render: (row) => formatBytes(row.size) }
      ]}
    />
  );
}
