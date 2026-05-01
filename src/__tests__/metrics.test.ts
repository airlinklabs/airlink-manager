import { describe, expect, test } from "bun:test";

describe("disk metrics", () => {
  test("df command produces non-empty disk list", async () => {
    const proc = Bun.spawn(
      ["df", "-B1", "--output=target,size,used,avail,pcent", "-x", "tmpfs", "-x", "devtmpfs"],
      { stdin: "ignore", stdout: "pipe", stderr: "ignore" }
    );
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    const lines = text.split("\n").slice(1).filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
  });
});
