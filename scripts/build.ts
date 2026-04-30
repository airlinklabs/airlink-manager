import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function run(command: string[], cwd = root): Promise<void> {
  const proc = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${command.join(" ")} exited with code ${code}`);
  }
}

console.info("==> Checking prerequisites...");
console.info(Bun.version);

console.info("==> Type checking...");
await run(["bun", "tsc", "--noEmit"]);

console.info("==> Building frontend...");
await run(["bun", "install", "--frozen-lockfile"], `${root}/frontend`);
await run(["bun", "run", "build"], `${root}/frontend`);

console.info("==> Running tests...");
await run(["bun", "test"]);

console.info("==> Compiling binary (linux-x64)...");
await run([
  "bun",
  "build",
  "--compile",
  "--minify",
  "--target=bun-linux-x64",
  "--asset-naming=[name].[ext]",
  "./src/index.ts",
  "--outfile",
  "dist/airlink-linux-x64"
]);

console.info("==> Compiling binary (linux-arm64)...");
await run([
  "bun",
  "build",
  "--compile",
  "--minify",
  "--target=bun-linux-arm64",
  "--asset-naming=[name].[ext]",
  "./src/index.ts",
  "--outfile",
  "dist/airlink-linux-arm64"
]);

console.info("==> Bundling node_modules for runtime fallback...");
await run(["cp", "-r", "node_modules", "dist/"]);

console.info("==> Build complete. Binaries in dist/");
