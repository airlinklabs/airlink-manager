import { mkdir, writeFile } from "node:fs/promises";
import { createDatabase } from "../db/index.ts";
import { AIRLINK_PATHS, APP_SECRET_BYTES, CONFIG_KEYS, DEFAULT_PORT } from "../shared/constants.ts";
import { validatePort, validatePositiveInt, validateUsername } from "../shared/validate.ts";
import { generateSelfSignedTls } from "../daemon/tls.ts";

export async function runInstall(): Promise<void> {
  if (process.getuid?.() !== 0) {
    console.error("airlink install must run as root");
    process.exit(1);
  }

  warnBunVersion();
  await warnKernelVersion();

  const owner = validateUsername(prompt("Which OS user should own this panel?") ?? "");
  if (!(await userExists(owner))) {
    console.error(`OS user not found: ${owner}`);
    process.exit(1);
  }
  const port = validatePort(prompt(`Port to listen on? [${DEFAULT_PORT}]`) || String(DEFAULT_PORT));
  const appName = prompt("App name? [Airlink Panel]") || "Airlink Panel";
  const timeoutHours = validatePositiveInt(prompt("Session timeout in hours? [24]") || "24", "session timeout", 24 * 365);

  await setupDirectories();
  await generateSelfSignedTls("localhost");
  await generateAddonKeypair();

  const { db, queries } = await createDatabase(AIRLINK_PATHS.dbPath);
  queries.setConfig(CONFIG_KEYS.ownerUsername, owner);
  queries.setConfig(CONFIG_KEYS.appName, appName);
  queries.setConfig(CONFIG_KEYS.port, String(port));
  queries.setConfig(CONFIG_KEYS.sessionTimeoutHours, String(timeoutHours));
  queries.setConfig(CONFIG_KEYS.appSecret, Buffer.from(crypto.getRandomValues(new Uint8Array(APP_SECRET_BYTES))).toString("hex"));
  queries.upsertRole(owner, "owner", "install");
  db.close();
  await Bun.spawn(["chmod", "600", AIRLINK_PATHS.dbPath], { stdout: "ignore", stderr: "ignore" }).exited;

  await writeFile(AIRLINK_PATHS.systemdUnit, systemdUnit(), { mode: 0o644 });
  
  // Copy the binary to /usr/local/bin/airlink
  // argv[0] is the program invocation name (e.g., "./dist/airlink-linux-arm64" or "sudo ./dist/airlink-linux-arm64")
  const binaryPath = process.argv[0];
  if (binaryPath && !binaryPath.includes("/proc") && !binaryPath.includes("bunfs")) {
    try {
      const binName = binaryPath.split("/").pop() || "airlink";
      // For relative paths, we need to resolve them first  
      const absolutePath = binaryPath.startsWith("/") ? binaryPath : `${process.cwd()}/${binaryPath}`;
      await Bun.spawn(["cp", absolutePath, "/usr/local/bin/airlink"], { stdout: "inherit", stderr: "inherit" }).exited;
      await Bun.spawn(["chmod", "+x", "/usr/local/bin/airlink"], { stdout: "inherit", stderr: "inherit" }).exited;
    } catch (err) {
      console.warn("Could not copy binary to /usr/local/bin/airlink:", err);
    }
  }
  
  await Bun.spawn(["systemctl", "daemon-reload"], { stdout: "inherit", stderr: "inherit" }).exited;
  await Bun.spawn(["systemctl", "enable", "--now", "airlink"], { stdout: "inherit", stderr: "inherit" }).exited;
  const hostname = (await Bun.file("/proc/sys/kernel/hostname").text()).trim();
  console.info(`✓ Airlink Panel is running at https://${hostname}:${port} - log in with your OS credentials`);
}

async function setupDirectories(): Promise<void> {
  await mkdir(AIRLINK_PATHS.etcDir, { recursive: true, mode: 0o700 });
  await mkdir(AIRLINK_PATHS.tlsDir, { recursive: true, mode: 0o700 });
  await mkdir(AIRLINK_PATHS.dataDir, { recursive: true, mode: 0o755 });
  await mkdir(AIRLINK_PATHS.avatarDir, { recursive: true, mode: 0o755 });
  await mkdir(AIRLINK_PATHS.addonDir, { recursive: true, mode: 0o755 });
  for (const target of [AIRLINK_PATHS.etcDir, AIRLINK_PATHS.tlsDir]) {
    await Bun.spawn(["chown", "root:root", target], { stdout: "ignore", stderr: "ignore" }).exited;
    await Bun.spawn(["chmod", "700", target], { stdout: "ignore", stderr: "ignore" }).exited;
  }
}

async function generateAddonKeypair(): Promise<void> {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privateKey = Buffer.from(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)).toString("base64");
  const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", keyPair.publicKey)).toString("base64");
  await Bun.write(AIRLINK_PATHS.signingKey, privateKey);
  await Bun.spawn(["chmod", "600", AIRLINK_PATHS.signingKey], { stdout: "ignore", stderr: "ignore" }).exited;
  const { db, queries } = await createDatabase(AIRLINK_PATHS.dbPath);
  queries.setConfig(CONFIG_KEYS.addonSigningPubkey, publicKey);
  db.close();
}

async function userExists(username: string): Promise<boolean> {
  const passwd = await Bun.file("/etc/passwd").text();
  return passwd.split("\n").some((line) => line.startsWith(`${username}:`));
}

function warnBunVersion(): void {
  const version = process.versions.bun ?? "0.0.0";
  if (compareVersion(version, "1.3.11") < 0) {
    console.warn(`Warning: Bun ${version} detected; Airlink requires >=1.3.11`);
  }
}

async function warnKernelVersion(): Promise<void> {
  const version = await Bun.file("/proc/version").text().catch(() => "");
  const match = version.match(/Linux version (\d+)\.(\d+)/u);
  if (match && Number(`${match[1]}.${match[2]}`) < 5.1) {
    console.warn("Warning: kernel < 5.1 detected; some process features may be limited");
  }
}

function compareVersion(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function systemdUnit(): string {
  return `[Unit]
Description=Airlink Panel
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/airlink --daemon
Restart=always
RestartSec=5
User=root
Group=root
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/airlink /etc/airlink /tmp
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
`;
}
