import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client.ts";

export function useUsers() {
  return useQuery({
    queryKey: ["users", "os"],
    queryFn: () => apiGet<{ users: unknown[] }>("/api/users/os"),
    staleTime: 30_000
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["users", "web"],
    queryFn: () => apiGet<{ roles: unknown[] }>("/api/users/web"),
    staleTime: 30_000
  });
}
