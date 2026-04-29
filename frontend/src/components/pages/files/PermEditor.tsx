import { useMemo, useState } from "react";
import { Button } from "../../ui/Button.tsx";

export function PermEditor({ initial = 0o644 }: { initial?: number }) {
  const [mode, setMode] = useState(initial);
  const label = useMemo(() => mode.toString(8).padStart(3, "0"), [mode]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--theme-text-body)]">Octal: {label}</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        {["Owner", "Group", "Other"].map((scope, scopeIndex) => (
          <div key={scope} className="rounded-xl border border-[var(--theme-border)] p-3">
            <p className="mb-2 font-medium">{scope}</p>
            {["Read", "Write", "Execute"].map((perm, bitIndex) => {
              const bit = 1 << (8 - scopeIndex * 3 - bitIndex);
              return (
                <label key={perm} className="flex items-center gap-2 py-1">
                  <input type="checkbox" checked={Boolean(mode & bit)} onChange={(event) => setMode(event.target.checked ? mode | bit : mode & ~bit)} />
                  {perm}
                </label>
              );
            })}
          </div>
        ))}
      </div>
      <Button>Apply</Button>
    </div>
  );
}
