import os from "node:os";
import type * as ptyModule from "node-pty";
import type { DaemonFrame } from "../../shared/types.ts";
import { validatePositiveInt } from "../../shared/validate.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject } from "./helpers.ts";

let pty: typeof ptyModule | null = null;

async function getPty() {
  if (pty === null) {
    try {
      pty = await import("node-pty");
    } catch (err) {
      console.error("Failed to load node-pty module:", err);
      throw new Error("Terminal channel is not available: node-pty module could not be loaded");
    }
  }
  return pty;
}

export class TerminalChannel extends BaseChannel implements ChannelHandler {
  private terminal: any | null = null;
  private readonly buffer: string[] = [];

  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    const cols = typeof payload.cols === "number" ? validatePositiveInt(payload.cols, "cols", 400) : 80;
    const rows = typeof payload.rows === "number" ? validatePositiveInt(payload.rows, "rows", 200) : 24;
    const shell = await detectShell();
    
    const ptyMod = await getPty();
    this.terminal = ptyMod.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env.HOME ?? os.homedir(),
      env: { ...process.env, TERM: "xterm-256color" }
    });
    this.terminal.onData((data: string) => {
      this.buffer.push(data);
      if (this.buffer.length > 1000) {
        this.buffer.shift();
      }
      this.emitData(frame, data);
    });
    this.terminal.onExit(({ exitCode }: {exitCode: number}) => this.exit(frame, exitCode));
    this.ready(frame);
    if (this.buffer.length > 0) {
      this.emitData(frame, this.buffer.join(""));
    }
  }

  async data(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    const data = typeof payload.data === "string" ? payload.data : "";
    this.terminal?.write(data);
  }

  async resize(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    this.terminal?.resize(validatePositiveInt(payload.cols, "cols", 400), validatePositiveInt(payload.rows, "rows", 200));
  }

  async close(): Promise<void> {
    this.terminal?.kill();
    this.terminal = null;
  }
}

async function detectShell(): Promise<string> {
  const username = process.env.USER;
  if (username) {
    try {
      const passwd = await Bun.file("/etc/passwd").text();
      const row = passwd.split("\n").find((line) => line.startsWith(`${username}:`));
      const shell = row?.split(":")[6];
      if (shell) {
        return shell;
      }
    } catch {
      // Fall through to environment shell. Bridge runs with user permissions,
      // so shell lookup failure should not crash terminal creation.
    }
  }
  return process.env.SHELL ?? "/bin/bash";
}
