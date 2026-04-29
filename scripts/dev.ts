import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const daemon = Bun.spawn(["bun", "--watch", "src/index.ts", "--daemon"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit"
});

const frontend = Bun.spawn(["bun", "run", "dev"], {
  cwd: `${root}/frontend`,
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
