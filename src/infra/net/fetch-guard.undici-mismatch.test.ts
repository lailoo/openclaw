/**
 * Regression test for #19147: undici v7 Agent passed to globalThis.fetch
 * (undici v6) causes silent connection failures for Telegram media downloads.
 *
 * The fix: use `fetch` from the `undici` package (v7) as the default fetcher
 * in fetch-guard.ts, ensuring the dispatcher and fetch are from the same version.
 */
import { describe, expect, it } from "vitest";
import { Agent } from "undici";

describe("Issue #19147: undici version mismatch (#19147)", () => {
  it("confirms package undici is v7+ (different from Node 22 built-in v6)", async () => {
    const agent = new Agent({ connect: { timeout: 5000 } });
    expect(agent).toBeInstanceOf(Agent);

    const packageVersion = require("undici/package.json").version;
    const majorVersion = parseInt(packageVersion.split(".")[0], 10);

    // Package undici is v7+, Node 22 bundles v6
    expect(majorVersion).toBeGreaterThanOrEqual(7);
    await agent.close();
  });

  it("fetch-guard uses undici package fetch, not globalThis.fetch", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/infra/net/fetch-guard.ts", "utf-8");

    // After fix: uses undiciFetch from the undici package
    expect(src).toContain('import { fetch as undiciFetch } from "undici"');
    expect(src).toContain("params.fetchImpl ?? undiciFetch");

    // Must NOT default to globalThis.fetch (which is Node built-in undici v6)
    expect(src).not.toContain("params.fetchImpl ?? globalThis.fetch");

    console.log("✅ PASS: fetch-guard.ts uses undici package fetch (v7) with v7 dispatcher");
  });
});
