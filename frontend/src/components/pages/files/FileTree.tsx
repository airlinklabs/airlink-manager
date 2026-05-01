import { Folder, File, ArrowUpLeft } from "lucide-react";
import type { FileEntry } from "../../../api/files.ts";
import { Table } from "../../ui/Table.tsx";
import { formatBytes, formatDate } from "../../../lib/format.ts";

export function FileTree({ entries, currentPath, onNavigate }: { entries: FileEntry[]; currentPath: string; onNavigate(path: string): void }) {
  const parentPath = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) || "/" : ".";
  const showParent = currentPath !== "." && currentPath !== "/";

  const nameCell = (row: FileEntry) => {
    const isDir = row.type === "directory";
    return (
      <button
        className="flex items-center gap-2 text-left hover:underline"
        style={{ color: isDir ? "var(--theme-accent)" : "var(--theme-text-primary)" }}
        onClick={() => isDir ? onNavigate(row.path) : undefined}
        disabled={!isDir}
      >
        {isDir ? <Folder className="h-4 w-4 shrink-0" /> : <File className="h-4 w-4 shrink-0 text-[var(--theme-text-muted)]" />}
        <span className="truncate">{row.name}</span>
      </button>
    );
  };

  return (
    <div>
      {showParent && (
        <button
          className="mb-2 flex items-center gap-1 text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]"
          onClick={() => onNavigate(parentPath)}
        >
          <ArrowUpLeft className="h-3 w-3" />
          ..
        </button>
      )}
      <Table
        rows={entries}
        getKey={(row) => row.path}
        columns={[
          { key: "name", header: "Name", render: nameCell },
          { key: "size", header: "Size", render: (row) => row.type === "directory" ? "—" : formatBytes(row.size) },
          { key: "mode", header: "Mode", render: (row) => row.mode.toString(8) },
          { key: "modified", header: "Modified", render: (row) => formatDate(row.modifiedAt) },
        ]}
      />
    </div>
  );
}
