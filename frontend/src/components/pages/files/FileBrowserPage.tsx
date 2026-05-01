import { useRef } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Home, Plus, Search, Upload } from "lucide-react";
import { useState } from "react";
import { useFileList } from "../../../api/files.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Input } from "../../ui/Input.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";
import { FileTree } from "./FileTree.tsx";

export function FileBrowserPage() {
  const [path, setPath] = useState(".");
  const [search, setSearch] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const files = useFileList(path);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const targetPath = path === "." ? file.name : `${path}/${file.name}`;
    const { writeFile } = await import("../../../api/files.ts");
    await writeFile(targetPath, text).catch(console.error);
    files.refetch();
    e.target.value = "";
  };

  const filtered = (files.data?.entries ?? []).filter((entry) =>
    search ? entry.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader
        title="Files"
        description="Browse and edit files under your OS permissions."
        action={
          <>
            <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
            <Button onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" />Upload</Button>
          </>
        }
      />
      <Card>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" onClick={() => setPath(".")} aria-label="Home"><Home className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={async () => {
              const name = prompt("Folder name:");
              if (!name) return;
              const { writeFile } = await import("../../../api/files.ts");
              await writeFile(`${path === "." ? "" : path + "/"}${name}/.keep`, "").catch(console.error);
              files.refetch();
            }}><Plus className="h-4 w-4" />Folder</Button>
          </div>
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="Path" />
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <Input className="pl-9" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {files.isLoading
          ? <Skeleton className="h-72" />
          : files.isError
            ? <EmptyState icon={FolderOpen} title="Files unavailable" message="File bridge did not respond." />
            : <FileTree entries={filtered} currentPath={path} onNavigate={setPath} />
        }
      </Card>
    </motion.div>
  );
}
