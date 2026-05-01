import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { compile } from "tailwindcss";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:9090";
const backendWs = backendUrl.replace(/^http/, "ws");

export default defineConfig({
  plugins: [tailwindUtilities(), react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        secure: false
      },
      "/ws": {
        target: backendWs,
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    sourcemap: false
  }
});

function tailwindUtilities(): Plugin {
  let root = process.cwd();
  let candidates = new Set<string>();

  return {
    name: "airlink-tailwind-utilities",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      candidates = await scanCandidates(path.join(root, "src"));
    },
    async transform(code, id) {
      if (!id.endsWith("src/styles.css") || !code.includes("@import \"tailwindcss\"")) {
        return null;
      }
      if (candidates.size === 0) {
        candidates = await scanCandidates(path.join(root, "src"));
      }
      const compiler = await compile(code, {
        base: root,
        from: id,
        async loadStylesheet(specifier, base) {
          let stylesheet: string;
          
          // Handle tailwindcss imports
          if (specifier === "tailwindcss") {
            stylesheet = path.join(root, "node_modules", "tailwindcss", "index.css");
          } else if (specifier.startsWith("tailwindcss/")) {
            stylesheet = path.join(root, "node_modules", `${specifier}.css`);
          }
          // Handle external npm packages like @xterm/xterm/css/xterm.css
          else if (specifier.startsWith("@") || (!/^[./]/.test(specifier))) {
            stylesheet = path.join(root, "node_modules", specifier);
          }
          // Handle relative imports
          else {
            stylesheet = path.resolve(base, specifier);
          }
          
          return { content: await readFile(stylesheet, "utf8"), base: path.dirname(stylesheet) };
        }
      });
      return { code: compiler.build([...candidates]), map: null };
    }
  };
}

async function scanCandidates(dir: string): Promise<Set<string>> {
  const result = new Set<string>();
  const files = await walk(dir);
  for (const file of files) {
    if (!/\.(tsx?|jsx?)$/u.test(file)) continue;
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/["'`]([^"'`]*?)["'`]/gu)) {
      const value = match[1] ?? "";
      for (const token of value.split(/\s+/u)) {
        const candidate = token.trim();
        if (candidate && candidate.length <= 160 && /^[!A-Za-z0-9_:[\]()/%.#,-]+$/u.test(candidate)) {
          result.add(candidate);
        }
      }
    }
  }
  return result;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}
