import { useMemo } from "react";
import { useAuthStore } from "../store/auth.store.ts";
import type { Role } from "../lib/constants.ts";

const hierarchy: Record<Role, number> = { banned: 0, user: 2, admin: 3, owner: 4 };

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  return useMemo(
    () => ({
      user,
      isAuthed: Boolean(user),
      can: (role: Exclude<Role, "banned">) => Boolean(user && hierarchy[user.role] >= hierarchy[role])
    }),
    [user]
  );
}
