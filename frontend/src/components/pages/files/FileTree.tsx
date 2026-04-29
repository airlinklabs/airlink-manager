import type { FileEntry } from "../../../api/files.ts";
import { Table } from "../../ui/Table.tsx";
import { formatBytes, formatDate } from "../../../lib/format.ts";
import { Badge } from "../../ui/Badge.tsx";

export function FileTree({ entries }: { entries: FileEntry[] }) {
  return (
    <Table
      rows={entries}
      getKey={(row) => row.path}
      columns={[
        { key: "name", header: "Name", render: (row) => row.name },
        { key: "type", header: "Type", render: (row) => <Badge status={row.type === "directory" ? "info" : "neutral"}>{row.type}</Badge> },
        { key: "size", header: "Size", render: (row) => formatBytes(row.size) },
        { key: "mode", header: "Mode", render: (row) => row.mode.toString(8) },
        { key: "modified", header: "Modified", render: (row) => formatDate(row.modifiedAt) }
      ]}
    />
  );
}
