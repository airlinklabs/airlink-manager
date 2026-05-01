import { readdir, readFile } from "node:fs/promises";
import type { DaemonFrame, MetricsSnapshot, ProcessInfo } from "../../shared/types.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel } from "./helpers.ts";

export class MetricsChannel extends BaseChannel implements ChannelHandler {
  private timer: Timer | null = null;
  private lastCpu: number[] | null = null;
  private lastNet: Map<string, [number, number, number]> = new Map();

  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    this.ready(frame);
    const send = async () => this.emitData(frame, await this.snapshot());
    await send();
    this.timer = setInterval(() => {
      send().catch((error: unknown) => this.emitData(frame, { error: error instanceof Error ? error.message : "metrics failed" }));
    }, 2000);
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async snapshot(): Promise<MetricsSnapshot> {
    const [stat, meminfo, loadavg, uptime, hostname, osRelease, kernel] = await Promise.all([
      readText("/proc/stat"),
      readText("/proc/meminfo"),
      readText("/proc/loadavg"),
      readText("/proc/uptime"),
      readText("/proc/sys/kernel/hostname"),
      readText("/etc/os-release"),
      readText("/proc/version")
    ]);
    return {
      ts: Date.now(),
      cpu: this.parseCpu(stat),
      memory: parseMemory(meminfo),
      disk: await this.parseDisk(),
      network: await this.parseNetwork(),
      load: parseLoad(loadavg),
      uptimeSeconds: Number(uptime.split(/\s+/u)[0] ?? "0"),
      processes: await topProcesses(),
      os: parseOs(hostname, osRelease, kernel)
    };
  }

  private parseCpu(stat: string): { totalPercent: number; perCore: number[] } {
    const line = stat.split("\n")[0] ?? "";
    const values = line.trim().split(/\s+/u).slice(1).map(Number);
    const previous = this.lastCpu;
    this.lastCpu = values;
    if (!previous) {
      return { totalPercent: 0, perCore: [] };
    }
    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const prevIdle = (previous[3] ?? 0) + (previous[4] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const prevTotal = previous.reduce((sum, value) => sum + value, 0);
    const totalDelta = total - prevTotal;
    const idleDelta = idle - prevIdle;
    const totalPercent = totalDelta <= 0 ? 0 : Math.round(((totalDelta - idleDelta) / totalDelta) * 1000) / 10;
    return { totalPercent, perCore: [] };
  }

  private async parseDisk(): Promise<{ mount: string; total: number; used: number; free: number; usedPercent: number }[]> {
    const proc = Bun.spawn(
      ["df", "-B1", "--output=target,size,used,avail,pcent", "-x", "tmpfs", "-x", "devtmpfs"],
      { stdin: "ignore", stdout: "pipe", stderr: "ignore" }
    );
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    return text
      .split("\n")
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const cols = line.trim().split(/\s+/u);
        const mount = cols[0] ?? "/";
        const total = Number(cols[1] ?? "0");
        const used = Number(cols[2] ?? "0");
        const free = Number(cols[3] ?? "0");
        const pct = Number((cols[4] ?? "0%").replace("%", ""));
        return { mount, total, used, free, usedPercent: Number.isNaN(pct) ? 0 : pct };
      })
      .filter((entry) => entry.total > 0);
  }

  private async parseNetwork(): Promise<{ iface: string; rxBytesPerSecond: number; txBytesPerSecond: number }[]> {
    const now = Date.now();
    const text = await readText("/proc/net/dev");
    const rows = text.split("\n").slice(2);
    const result: { iface: string; rxBytesPerSecond: number; txBytesPerSecond: number }[] = [];
    for (const row of rows) {
      const [nameRaw, rest] = row.split(":");
      if (!nameRaw || !rest) {
        continue;
      }
      const iface = nameRaw.trim();
      const fields = rest.trim().split(/\s+/u).map(Number);
      const rx = fields[0] ?? 0;
      const tx = fields[8] ?? 0;
      const previous = this.lastNet.get(iface);
      this.lastNet.set(iface, [rx, tx, now]);
      if (previous) {
        const elapsed = Math.max(1, now - previous[2]) / 1000;
        result.push({ iface, rxBytesPerSecond: Math.max(0, (rx - previous[0]) / elapsed), txBytesPerSecond: Math.max(0, (tx - previous[1]) / elapsed) });
      }
    }
    return result;
  }
}

function parseMemory(meminfo: string): MetricsSnapshot["memory"] {
  const values = new Map<string, number>();
  for (const line of meminfo.split("\n")) {
    const [key, raw] = line.split(":");
    if (key && raw) {
      values.set(key, Number(raw.trim().split(/\s+/u)[0] ?? "0") * 1024);
    }
  }
  const total = values.get("MemTotal") ?? 0;
  const available = values.get("MemAvailable") ?? 0;
  return {
    total,
    available,
    used: Math.max(0, total - available),
    swapTotal: values.get("SwapTotal") ?? 0,
    swapFree: values.get("SwapFree") ?? 0
  };
}

function parseLoad(loadavg: string): [number, number, number] {
  const parts = loadavg.split(/\s+/u).slice(0, 3).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function parseOs(hostname: string, osRelease: string, kernel: string): MetricsSnapshot["os"] {
  const values = new Map<string, string>();
  for (const line of osRelease.split("\n")) {
    const [key, raw] = line.split("=");
    if (key && raw) {
      values.set(key, raw.replace(/^"|"$/gu, ""));
    }
  }
  return {
    hostname: hostname.trim(),
    distro: values.get("NAME") ?? "Linux",
    version: values.get("VERSION_ID") ?? "",
    kernel: kernel.trim()
  };
}

async function topProcesses(): Promise<ProcessInfo[]> {
  const entries = await readdir("/proc");
  const processes: ProcessInfo[] = [];
  for (const entry of entries) {
    const pid = Number(entry);
    if (!Number.isInteger(pid)) {
      continue;
    }
    try {
      const [statText, statusText, cmdline] = await Promise.all([
        readFile(`/proc/${pid}/stat`, "utf8"),
        readFile(`/proc/${pid}/status`, "utf8"),
        readFile(`/proc/${pid}/cmdline`, "utf8")
      ]);
      const name = statText.match(/\((.*)\)/u)?.[1] ?? entry;
      const rssKb = Number(statusText.match(/^VmRSS:\s+(\d+)/mu)?.[1] ?? "0");
      const uid = statusText.match(/^Uid:\s+(\d+)/mu)?.[1] ?? "0";
      processes.push({
        pid,
        name,
        user: uid,
        cpuPercent: 0,
        memoryPercent: 0,
        rssBytes: rssKb * 1024,
        state: statText.split(/\s+/u)[2] ?? "?",
        startedAt: 0,
        command: cmdline.replaceAll("\0", " ").trim()
      });
    } catch {
      // Proc rows can disappear between readdir and read. Ignore races.
    }
  }
  return processes.sort((a, b) => b.rssBytes - a.rssBytes).slice(0, 50);
}

async function readText(pathname: string): Promise<string> {
  try {
    return await readFile(pathname, "utf8");
  } catch {
    return "";
  }
}
