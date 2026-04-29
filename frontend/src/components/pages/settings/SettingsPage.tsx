import { motion } from "framer-motion";
import { Shield, Upload } from "lucide-react";
import { useAddons } from "../../../api/addons.ts";
import { useAuditLog } from "../../../api/audit.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { Input } from "../../ui/Input.tsx";
import { Switch } from "../../ui/Switch.tsx";
import { Table } from "../../ui/Table.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/Tabs.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";

export function SettingsPage() {
  const audit = useAuditLog(1);
  const addons = useAddons();
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Settings" description="Owner controls for app, security, TLS, audit, and addons." />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="tls">TLS</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="addons">Addons</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <Card header={<h2 className="text-sm font-semibold">General</h2>}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">App Name<Input defaultValue="Airlink Panel" /></label>
              <label className="space-y-1 text-sm">Port<Input defaultValue="9090" /></label>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <Card header={<h2 className="text-sm font-semibold">Security</h2>}>
            <Switch checked onCheckedChange={() => undefined} label="File editing enabled for users" />
          </Card>
        </TabsContent>
        <TabsContent value="tls" className="mt-4">
          <Card header={<h2 className="text-sm font-semibold">TLS</h2>}>
            <div className="flex flex-wrap gap-2">
              <Button><Upload className="h-4 w-4" />Upload Cert</Button>
              <Button variant="secondary">Regenerate Self-Signed</Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <Card header={<h2 className="text-sm font-semibold">Audit Log</h2>}>
            <Table rows={(audit.data?.rows ?? []) as { id?: number; action?: string; result?: string }[]} getKey={(row, index) => String(row.id ?? index)} columns={[
              { key: "action", header: "Action", render: (row) => row.action ?? "" },
              { key: "result", header: "Result", render: (row) => row.result ?? "" }
            ]} />
          </Card>
        </TabsContent>
        <TabsContent value="addons" className="mt-4">
          <Card header={<h2 className="text-sm font-semibold">Addons</h2>}>
            <p className="flex items-center gap-2 text-sm text-[var(--theme-text-body)]"><Shield className="h-4 w-4" />{addons.data?.addons.length ?? 0} addons registered</p>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
