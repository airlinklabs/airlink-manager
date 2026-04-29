import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client.ts";

export function useAddons() {
  return useQuery({
    queryKey: ["addons"],
    queryFn: () => apiGet<{ addons: unknown[] }>("/api/addons"),
    staleTime: 60_000
  });
}
