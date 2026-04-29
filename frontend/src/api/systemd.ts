import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client.ts";

export function useServices(filter = "") {
  return useQuery({
    queryKey: ["systemd", "services", filter],
    queryFn: () => apiGet<{ services: unknown[] }>(`/api/systemd/services?filter=${encodeURIComponent(filter)}`),
    staleTime: 5_000
  });
}
