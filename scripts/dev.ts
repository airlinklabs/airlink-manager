import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const localEtc = path.join(root, ".airlink", "etc");
const localData = path.join(root, ".airlink", "data");

await mkdir(localEtc, { recursive: true });
await mkdir(localData, { recursive: true });

const daemon = Bun.spawn(["bun", "--watch", "src/index.ts", "--daemon"], {
  cwd: root,
  env: {
    ...process.env,
    AIRLINK_ETC_DIR: localEtc,
    AIRLINK_DATA_DIR: localData
  },
  stdout: "inherit",
  stderr: "inherit"
});

const frontend = Bun.spawn(["bun", "run", "dev"], {
  cwd: `${root}/frontend`,
  env: {
    ...process.env,
    BACKEND_URL: "http://localhost:9090"
  },
  stdout: "inherit",
  stderr: "inherit"
});

const shutdown = () => {
  daemon.kill();
  frontend.kill();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race([daemon.exited, frontend.exited]);
shutdown();
