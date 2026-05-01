import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { createDatabase } from "../db/index.ts";
import type { Queries } from "../db/queries.ts";
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

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const ownerRaw = (await rl.question("Which OS user should own this panel? ")).trim();
  const owner = validateUsername(ownerRaw || "");
  if (!(await userExists(owner))) {
    rl.close();
    console.error(`OS user not found: ${owner}`);
    process.exit(1);
  }
  const portRaw = (await rl.question(`Port to listen on? [${DEFAULT_PORT}] `)).trim();
  const port = validatePort(portRaw || String(DEFAULT_PORT));

  const appNameRaw = (await rl.question("App name? [Airlink Panel] ")).trim();
  const appName = appNameRaw || "Airlink Panel";

  const timeoutRaw = (await rl.question("Session timeout in hours? [24] ")).trim();
  const timeoutHours = validatePositiveInt(timeoutRaw || "24", "session timeout", 24 * 365);

  rl.close();

  await setupDirectories();
  await generateSelfSignedTls("localhost");
  const { db, queries } = await createDatabase(AIRLINK_PATHS.dbPath);
  await generateAddonKeypair(queries);
  queries.setConfig(CONFIG_KEYS.ownerUsername, owner);
  queries.setConfig(CONFIG_KEYS.appName, appName);
  queries.setConfig(CONFIG_KEYS.port, String(port));
  queries.setConfig(CONFIG_KEYS.sessionTimeoutHours, String(timeoutHours));
  queries.setConfig(CONFIG_KEYS.appSecret, Buffer.from(crypto.getRandomValues(new Uint8Array(APP_SECRET_BYTES))).toString("hex"));
  queries.upsertRole(owner, "owner", "install");
  db.close();
  await Bun.spawn(["chmod", "600", AIRLINK_PATHS.dbPath], { stdout: "ignore", stderr: "ignore" }).exited;
  await writeSudoersDropIn(owner);

  await writeFile(AIRLINK_PATHS.systemdUnit, systemdUnit(), { mode: 0o644 });

  // Resolve compiled binary path. argv[1] is the binary itself when built
  // with `bun build --compile`. In dev mode it ends with .ts - skip copy then.
  const binaryEntry = process.argv[1] ?? "";
  if (binaryEntry.length > 0 && !binaryEntry.endsWith(".ts") && !binaryEntry.endsWith(".js")) {
    try {
      const absoluteBinary = path.isAbsolute(binaryEntry)
        ? binaryEntry
        : path.resolve(process.cwd(), binaryEntry);
      if (await Bun.file(absoluteBinary).exists()) {
        await Bun.spawn(["cp", absoluteBinary, "/usr/local/bin/airlink"], {
          stdout: "inherit",
          stderr: "inherit"
        }).exited;
        await Bun.spawn(["chmod", "+x", "/usr/local/bin/airlink"], {
          stdout: "inherit",
          stderr: "inherit"
        }).exited;
        console.info("[install] binary copied to /usr/local/bin/airlink");
      } else {
        console.warn(`[install] binary not found at ${absoluteBinary} - skipping /usr/local/bin install`);
      }
    } catch (err) {
      console.warn("[install] could not copy binary:", err);
    }
  } else {
    console.warn("[install] running from source - skipping /usr/local/bin copy (run compiled binary to install)");
  }

  await Bun.spawn(["systemctl", "daemon-reload"], { stdout: "inherit", stderr: "inherit" }).exited;
  const binaryAtDest = await Bun.file("/usr/local/bin/airlink").exists();
  if (binaryAtDest) {
    await Bun.spawn(["systemctl", "enable", "--now", "airlink"], { stdout: "inherit", stderr: "inherit" }).exited;
  } else {
    console.warn("[install] /usr/local/bin/airlink not found - skipping systemctl enable.");
    console.warn("[install] To start manually: sudo /path/to/your/compiled/binary --daemon");
  }
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

async function writeSudoersDropIn(owner: string): Promise<void> {
  const content = [
    `# Airlink Panel privilege grants for ${owner}`,
    `${owner} ALL=(root) NOPASSWD: /bin/systemctl start *.service`,
    `${owner} ALL=(root) NOPASSWD: /bin/systemctl stop *.service`,
    `${owner} ALL=(root) NOPASSWD: /bin/systemctl restart *.service`,
    `${owner} ALL=(root) NOPASSWD: /bin/systemctl reload *.service`,
    `${owner} ALL=(root) NOPASSWD: /bin/systemctl enable *.service`,
    `${owner} ALL=(root) NOPASSWD: /bin/systemctl disable *.service`,
    `${owner} ALL=(root) NOPASSWD: /usr/sbin/usermod -L *`,
    `${owner} ALL=(root) NOPASSWD: /usr/sbin/usermod -U *`,
    ""
  ].join("\n");
  const dropin = `/etc/sudoers.d/airlink-${owner}`;
  await writeFile(dropin, content, { mode: 0o440 });
  const check = Bun.spawn(["visudo", "-c", "-f", dropin], { stdout: "ignore", stderr: "pipe" });
  const checkCode = await check.exited;
  if (checkCode !== 0) {
    await Bun.spawn(["rm", "-f", dropin], { stdout: "ignore", stderr: "ignore" }).exited;
    console.warn("[install] sudoers drop-in failed validation - systemd/user management will require root");
  } else {
    console.info(`[install] sudoers drop-in written to ${dropin}`);
  }
}

async function generateAddonKeypair(queries: Queries): Promise<void> {
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privateKey = Buffer.from(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)).toString("base64");
  const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", keyPair.publicKey)).toString("base64");
  await Bun.write(AIRLINK_PATHS.signingKey, privateKey);
  await Bun.spawn(["chmod", "600", AIRLINK_PATHS.signingKey], { stdout: "ignore", stderr: "ignore" }).exited;
  queries.setConfig(CONFIG_KEYS.addonSigningPubkey, publicKey);
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
NoNewPrivileges=no
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/airlink /etc/airlink /tmp
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
`;
}
