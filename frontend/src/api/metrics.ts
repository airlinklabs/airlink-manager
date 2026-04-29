import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client.ts";

export type Health = {
  status: "ok";
  version: string;
  uptime: number;
  db: "ok" | "error";
  features: {
    docker: boolean;
    systemd: boolean;
    accountsService: boolean;
    shadowReadable: boolean;
  };
};

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/api/health"),
    staleTime: 10_000
  });
}
