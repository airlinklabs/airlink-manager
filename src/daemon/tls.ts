import { mkdir, stat } from "node:fs/promises";
import { AIRLINK_PATHS } from "../shared/constants.ts";
import { log } from "./logger.ts";

export type TlsMaterial = {
  key: string;
  cert: string;
};

export async function loadTlsMaterial(): Promise<TlsMaterial> {
  return {
    key: await Bun.file(AIRLINK_PATHS.tlsKey).text(),
    cert: await Bun.file(AIRLINK_PATHS.tlsCert).text()
  };
}

export async function tlsExists(): Promise<boolean> {
  try {
    await stat(AIRLINK_PATHS.tlsKey);
    await stat(AIRLINK_PATHS.tlsCert);
    return true;
  } catch {
    return false;
  }
}

export async function generateSelfSignedTls(commonName = "localhost"): Promise<void> {
  await mkdir(AIRLINK_PATHS.tlsDir, { recursive: true, mode: 0o700 });
  const proc = Bun.spawn(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-384",
      "-keyout",
      AIRLINK_PATHS.tlsKey,
      "-out",
      AIRLINK_PATHS.tlsCert,
      "-days",
      "3650",
      "-nodes",
      "-subj",
      `/CN=${commonName}`
    ],
    { stdout: "pipe", stderr: "pipe" }
  );
  const code = await proc.exited;
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`openssl failed: ${stderr}`);
  }
  await Bun.spawn(["chmod", "600", AIRLINK_PATHS.tlsKey], { stdout: "ignore", stderr: "ignore" }).exited;
  await Bun.spawn(["chmod", "644", AIRLINK_PATHS.tlsCert], { stdout: "ignore", stderr: "ignore" }).exited;
  log("info", "generated self-signed TLS material", { path: AIRLINK_PATHS.tlsDir });
}
