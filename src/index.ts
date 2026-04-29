import { runBridge } from "./bridge/index.ts";
import { runInstall } from "./cli/install.ts";
import { runDaemon } from "./daemon/index.ts";

const command = process.argv[2];

if (command === "--daemon") {
  await runDaemon();
} else if (command === "--bridge") {
  await runBridge(process.argv.slice(3));
} else if (command === "install") {
  await runInstall();
} else {
  console.error("Usage: airlink --daemon | --bridge --uid=N --gid=N | install");
  process.exit(1);
}
