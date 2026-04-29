import { cn } from "../../lib/cn.ts";

type TableProps<T> = {
  columns: { key: string; header: string; render(row: T): React.ReactNode }[];
  rows: T[];
  getKey(row: T, index: number): string;
  className?: string;
};

export function Table<T>({ columns, rows, getKey, className }: TableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-[var(--theme-border)]", className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--theme-table-header-bg)] text-xs uppercase text-[var(--theme-text-muted)]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--theme-border-subtle)]">
          {rows.map((row, index) => (
            <tr key={getKey(row, index)} className="hover:bg-[var(--theme-table-row-hover)]">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
