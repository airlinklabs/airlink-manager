import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "../store/auth.store.ts";
import { useAuthStore } from "../store/auth.store.ts";
import { apiGet, apiPost } from "./client.ts";

type LoginBody = { username: string; password: string };
type WsToken = { token: string };

export function useMe() {
  const setUser = useAuthStore((state) => state.setUser);
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const user = await apiGet<AuthUser>("/api/auth/me");
      setUser(user);
      return user;
    },
    retry: false
  });
}

export function useLogin() {
  const client = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  return useMutation({
    mutationFn: (body: LoginBody) => apiPost<AuthUser>("/api/auth/login", body),
    onSuccess: (user) => {
      setUser(user);
      void client.invalidateQueries({ queryKey: ["auth"] });
    }
  });
}

export function useLogout() {
  const client = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const setWsToken = useAuthStore((state) => state.setWsToken);
  return useMutation({
    mutationFn: () => apiPost<{ ok: true }>("/api/auth/logout"),
    onSettled: () => {
      setUser(null);
      setWsToken(null);
      client.clear();
    }
  });
}

export function useWsToken() {
  const setWsToken = useAuthStore((state) => state.setWsToken);
  return useMutation({
    mutationFn: () => apiGet<WsToken>("/api/auth/ws-token"),
    onSuccess: ({ token }) => setWsToken(token)
  });
}
