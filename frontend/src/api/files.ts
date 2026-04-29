import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "./client.ts";

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  mode: number;
  uid: number;
  gid: number;
  modifiedAt: number;
};

export function useFileList(path: string) {
  return useQuery({
    queryKey: ["files", path],
    queryFn: () => apiGet<{ entries: FileEntry[] }>(`/api/fs/list?path=${encodeURIComponent(path)}`),
    staleTime: 5_000
  });
}

export function writeFile(path: string, content: string) {
  return apiPost<{ ok: true }>("/api/fs/write", { path, content });
}
