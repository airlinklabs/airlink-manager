import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client.ts";

export function useAuditLog(page: number, limit = 50) {
  return useQuery({
    queryKey: ["audit", page, limit],
    queryFn: () => apiGet<{ rows: unknown[] }>(`/api/settings/audit?page=${page}&limit=${limit}`),
    staleTime: 10_000
  });
}
