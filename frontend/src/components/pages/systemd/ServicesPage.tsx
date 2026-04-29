import { motion } from "framer-motion";
import { Search, Settings2 } from "lucide-react";
import { useState } from "react";
import { useServices } from "../../../api/systemd.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Card } from "../../ui/Card.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Input } from "../../ui/Input.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";
import { LogPane } from "./LogPane.tsx";
import { ServiceDetail } from "./ServiceDetail.tsx";
import { ServiceList } from "./ServiceList.tsx";

export function ServicesPage() {
  const [filter, setFilter] = useState("");
  const services = useServices(filter);
  if (services.isError) {
    return <EmptyState icon={Settings2} title="systemd not available" message="systemctl is not present or systemd is not running." />;
  }
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Services" description="Search units, inspect state, and stream logs." />
      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]" />
          <Input className="pl-9" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter services" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card><ServiceList rows={[]} /></Card>
        <div className="space-y-4">
          <ServiceDetail />
          <LogPane />
        </div>
      </div>
    </motion.div>
  );
}
