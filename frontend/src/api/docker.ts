import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client.ts";

export function useContainers() {
  return useQuery({
    queryKey: ["docker", "containers"],
    queryFn: () => apiGet<{ containers: unknown[] }>("/api/docker/containers"),
    staleTime: 5_000,
    refetchInterval: 5_000
  });
}

export function useImages() {
  return useQuery({
    queryKey: ["docker", "images"],
    queryFn: () => apiGet<{ images: unknown[] }>("/api/docker/images"),
    staleTime: 5_000
  });
}

export function useVolumes() {
  return useQuery({
    queryKey: ["docker", "volumes"],
    queryFn: () => apiGet<{ volumes: unknown[] }>("/api/docker/volumes"),
    staleTime: 5_000
  });
}
