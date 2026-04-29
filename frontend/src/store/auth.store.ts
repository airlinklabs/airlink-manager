import { create } from "zustand";
import type { Role } from "../lib/constants.ts";

export type AuthUser = {
  username: string;
  role: Exclude<Role, "banned">;
  displayName: string;
  avatar: string | null;
};

type AuthState = {
  user: AuthUser | null;
  wsToken: string | null;
  setUser(user: AuthUser | null): void;
  setWsToken(token: string | null): void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  wsToken: null,
  setUser: (user) => set({ user }),
  setWsToken: (wsToken) => set({ wsToken })
}));
