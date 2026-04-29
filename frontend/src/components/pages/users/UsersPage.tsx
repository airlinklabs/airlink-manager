import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { useRoles, useUsers } from "../../../api/users.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";
import { UserDetail } from "./UserDetail.tsx";
import { UserList } from "./UserList.tsx";

export function UsersPage() {
  useUsers();
  useRoles();
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Users" description="OS accounts and web roles." action={<Button><UserPlus className="h-4 w-4" />New User</Button>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card><UserList rows={[]} /></Card>
        <UserDetail />
      </div>
    </motion.div>
  );
}
