import { motion } from "framer-motion";
import { Save } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { Input } from "../../ui/Input.tsx";
import { Select } from "../../ui/Select.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";

export function AccountPage() {
  const { user } = useAuth();
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Account" description="Profile, password, avatar, and theme preference." action={<Button><Save className="h-4 w-4" />Save</Button>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card header={<h2 className="text-sm font-semibold">Profile</h2>}>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">Display Name<Input defaultValue={user?.displayName ?? ""} /></label>
            <label className="block space-y-1 text-sm">Email<Input type="email" /></label>
            <Select value="system" onValueChange={() => undefined} items={["system", "light", "dark"]} />
          </div>
        </Card>
        <Card header={<h2 className="text-sm font-semibold">Password</h2>}>
          <div className="space-y-3">
            <Input type="password" placeholder="Current password" />
            <Input type="password" placeholder="New password" />
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
