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
  const files = useFileList(path);
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Files" description="Browse and edit files under your OS permissions." action={<Button><Upload className="h-4 w-4" />Upload</Button>} />
      <Card>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" onClick={() => setPath(".")} aria-label="Home"><Home className="h-4 w-4" /></Button>
            <Button variant="secondary"><Plus className="h-4 w-4" />Folder</Button>
          </div>
          <Input value={path} onChange={(event) => setPath(event.target.value)} />
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <Input className="pl-9" placeholder="Search" />
          </div>
        </div>
        {files.isLoading ? <Skeleton className="h-72" /> : files.isError ? <EmptyState icon={FolderOpen} title="Files unavailable" message="File bridge did not respond." /> : <FileTree entries={files.data?.entries ?? []} />}
      </Card>
    </motion.div>
  );
}
