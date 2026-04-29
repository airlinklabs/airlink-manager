import { Badge } from "../../ui/Badge.tsx";

export function RoleBadge({ role }: { role: string }) {
  return <Badge status={role === "owner" ? "info" : role === "admin" ? "success" : role === "banned" ? "danger" : "neutral"}>{role}</Badge>;
}
